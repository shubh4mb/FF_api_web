# Report: coupons vs offers — semantics, bugs found, and the fix

**Last Updated:** 2026-11-21
**Status:** findings + recommendation. Nothing has been changed.
**Scope read:** [services/offerEngine.js](../../Backend/src/services/offerEngine.js) (612 lines),
[models/offer.model.js](../../Backend/src/models/offer.model.js),
[models/offerUsage.model.js](../../Backend/src/models/offerUsage.model.js),
[helperFns/calculateFinalBilling.js](../../Backend/src/helperFns/calculateFinalBilling.js),
[controllers/userControllers/order.controllers.js](../../Backend/src/controllers/userControllers/order.controllers.js),
[controllers/deliveryRiderController/orderController.js](../../Backend/src/controllers/deliveryRiderController/orderController.js).

---

## 1. The agreed model

> **Coupon** = the customer types or taps a code to apply it.
> **Offer** = applies automatically when the cart qualifies.

This is the right split and it is what the code *almost* does. The problem is that today the distinction is
spread across **four independent boolean flags** on one `Offer` document, and they can contradict each other:

| Flag | Current meaning | Default |
|---|---|---|
| `requiresCoupon` | `true` = needs a code, `false` = auto-apply | `false` |
| `autoApply` | "auto-apply to cart even if couponCode is set" | `false` |
| `couponCode` | the code string | `null` |
| `isPublic` | show in the coupon list vs hidden/manual-entry only | `true` |

`requiresCoupon` and `autoApply` encode the *same decision* with opposite polarity, and the engine ORs them:

```js
// offerEngine.js — findBestOffers()
const autoQualifyingOffers = validOffers.filter(o => o.autoApply || !o.requiresCoupon);
```

So `{ requiresCoupon: true, autoApply: true }` is a coupon that also auto-applies without the code — which is
neither of your two types. 2×2 flags = 16 combinations, of which 2 are meaningful. This ambiguity is the root
cause of several bugs below.

### Recommended shape

Replace the four flags with **one discriminator**, derived once at write time:

```js
kind: { type: String, enum: ['OFFER', 'COUPON'], required: true, index: true }
// OFFER  → auto-applies; couponCode MUST be null
// COUPON → requires couponCode; never auto-applies
// isPublic stays, but only means anything for COUPON (listed vs secret code)
```

Then the engine has two clear paths instead of one branchy one:

- `kind: 'OFFER'` → evaluated on every cart recalculation, no code involved.
- `kind: 'COUPON'` → evaluated only when a matching code is supplied.

Migration is mechanical and back-fillable:

```js
kind = (requiresCoupon && !autoApply) || (couponCode && !autoApply) ? 'COUPON' : 'OFFER'
```

Keep `requiresCoupon`/`autoApply` as deprecated read-only fields for one release so nothing in-flight breaks,
then drop them. Validate on save that `kind: 'COUPON'` has a `couponCode` and `kind: 'OFFER'` has none —
a schema-level `validate` is cheaper than defending against the combination everywhere downstream.

### One stacking rule, stated once

The code comment claims *"Best admin offer + Best merchant offer can stack"*, but the implementation has four
different stacking branches that disagree. State the rule as data the engine reads, not as prose:

> At most **one** `COUPON` + at most **one** admin `OFFER` + at most **one** merchant `OFFER` + at most
> **one** delivery benefit apply to a cart. `isExclusive` on any winner drops everything else. Total discount
> never exceeds the kept-items subtotal.

Everything else (`stackable`, the scope juggling) then falls out of that one sentence.

---

## 2. Bugs found

Confirmed by reading the code paths end to end. Severity is about money and trust, not aesthetics.

### 🔴 B1 — Rider settlement applies the full-cart discount to kept items only

**The most expensive bug here.** In Try & Buy, the discount is computed at checkout against the whole cart,
then the customer keeps a subset. The customer-side paths recompute it. The rider-side path does not.

[controllers/deliveryRiderController/orderController.js:413](../../Backend/src/controllers/deliveryRiderController/orderController.js#L413):

```js
discountToApply: order.finalBilling?.discount || 0,   // ← checkout-time, full-cart discount
```

versus [controllers/userControllers/order.controllers.js:1223](../../Backend/src/controllers/userControllers/order.controllers.js#L1223):

```js
discountToApply: recalculatedDiscount,                 // ← recomputed against kept items
```

**Failure scenario:** cart ₹2,400, coupon `FLAT500` with `minCartValue: 1999` → ₹500 off. Customer keeps one
₹600 item. Rider settles the order. Billing charges ₹600 − ₹500 = **₹100** for a ₹600 item, on an order that
never met the ₹1,999 threshold. FlashFits eats ₹500.

### 🔴 B2 — `finalBilling.discount` conflates two different numbers, then gets re-read as one

[order.controllers.js:1230](../../Backend/src/controllers/userControllers/order.controllers.js#L1230):

```js
order.finalBilling.discount = recalculatedDiscount + billing.returnChargeDeduction;
```

An offer discount and a return-charge waiver are summed into one field. The rider path (B1) then reads that
field back as `discountToApply`, so the return-charge deduction is **applied twice** — once by
`calculateFinalBilling`'s own return logic, once smuggled in via `discount`.

**Fix:** keep them separate (`finalBilling.offerDiscount`, `finalBilling.returnChargeDeduction`) and let the
display layer sum them. One field, one fact.

### 🔴 B3 — Client-supplied `selectedOffers` bypasses the stacking policy

[offerEngine.js](../../Backend/src/services/offerEngine.js), `findBestOffers`:

```js
if (selectedOfferIdsStr.length > 0) {
  for (const offer of validOffers) {
    if (selectedOfferIdsStr.includes(offer._id.toString())) winningOffers.push(offer);
  }
  // only filtered if one is exclusive, or one is non-stackable
}
```

When the client sends an array of offer IDs, **every** matching eligible offer is applied as long as each is
`stackable !== false` and none is `isExclusive`. The "1 admin + 1 merchant" cap is only enforced on the
auto-apply path, never here.

**Failure scenario:** a crafted request with five stackable admin offer IDs stacks all five. The only backstop
is `Math.min(rawDiscount, cartContext.subtotal)` — so the floor is a **100%-discounted order**, not a
negative one. Still a free-order exploit.

**Fix:** run `selectedOffers` through the same single policy function as the auto path. The selection should
only ever be able to *narrow* what the engine would have picked, never widen it.

### 🔴 B4 — Over-redemption race on `maxUsageTotal`

Validation reads the counter; commit increments it unconditionally:

```js
// validateOfferEligibility
if (offer.maxUsageTotal !== null && offer.currentUsage >= offer.maxUsageTotal) { /* reject */ }

// recordOfferUsage
await Offer.findByIdAndUpdate(offerId, { $inc: { currentUsage: 1 } });
```

Two concurrent checkouts at `currentUsage === maxUsageTotal - 1` both pass validation and both increment.
A "first 100 customers" coupon goes to 150 on a flash sale.

**Fix** — make the increment the gate, atomically:

```js
const claimed = await Offer.findOneAndUpdate(
  { _id: offerId, $or: [{ maxUsageTotal: null },
                        { $expr: { $lt: ['$currentUsage', '$maxUsageTotal'] } }] },
  { $inc: { currentUsage: 1 } },
  { new: true }
);
if (!claimed) throw new ApiError(409, 'Offer usage limit reached');
```

### 🔴 B5 — Per-user limit has no unique index, so it races too

`offerUsage.model.js` indexes `{ userId, offerId }` but **not uniquely**, and `maxUsagePerUser` is checked
with a `countDocuments` before insert. Same race as B4.

**Fix:** a partial unique index enforcing the limit for the common `maxUsagePerUser: 1` case, and let the
duplicate-key error be the rejection:

```js
offerUsageSchema.index({ userId: 1, offerId: 1 }, { unique: true, partialFilterExpression: { /* … */ } });
```

For limits > 1 keep the count but do it inside the order transaction (the order flow already uses a session).

### 🟠 B6 — `recordOfferUsage` is not idempotent

No uniqueness on `(offerId, orderId)`. A retried order-placement call, or a webhook replay, records the
redemption twice and double-increments `currentUsage`.

**Fix:** unique index on `{ offerId: 1, orderId: 1 }`.

### 🟠 B7 — `maxUsagePerUser` defaults to `1` for auto-apply offers

[offer.model.js](../../Backend/src/models/offer.model.js):

```js
maxUsagePerUser: { type: Number, default: 1 },
```

For a `COUPON` that is correct. For an `OFFER` — "Free delivery above ₹799", "20% off Men's Wear" — it means
the offer **silently stops working after one order per customer**, forever. A standing store discount
evaporates for your repeat customers, which is the opposite of the intent, and it fails quietly: the customer
just sees a higher price.

**Fix:** `default: null` (unlimited) for `kind: 'OFFER'`; `default: 1` for `kind: 'COUPON'`. This is a strong
argument for the §1 discriminator — the sane default genuinely differs by type.

### 🟠 B8 — Item-restriction conditions are OR'd when they read as AND

`isItemApplicable` returns `true` on the **first** matching restriction type:

```js
if (productIds?.length) { if (matchesProduct) return true; }
if (collectionId)       { if (matches)        return true; }
if (categoryIds?.length){ if (matches)        return true; }
if (genders?.length)    { if (matches)        return true; }
return false;
```

So an offer configured as `categoryIds: [Shirts]` **and** `genders: ['WOMEN']` applies to a **men's** shirt —
the category match short-circuits before gender is considered.

**Failure scenario:** admin creates "20% off Women's Footwear", customers get 20% off men's footwear too.

**Fix:** decide the intent (almost certainly AND across *different* restriction types, OR *within* a list) and
implement it as such. This needs a data audit of live offers before the change, because existing offers were
authored against the OR behaviour.

### 🟠 B9 — `validateCouponCode` does not check `kind`/`requiresCoupon`

```js
const offer = await Offer.findOne({ couponCode: cleanCode, isActive: true, /* dates */ }).lean();
```

Any offer that merely *has* a `couponCode` validates as a coupon, including one that auto-applies. Under the
§1 model this becomes a one-line guard (`kind: 'COUPON'`); today it is a hole.

### 🟡 B10 — Debug logging dumps the full cart on every request

```js
const log = (msg) => { console.log(`[OFFER_DEBUG] ${msg}`); };
log(`Cart Context: ${JSON.stringify(cartContext)}`);
log(`--- FINAL RESULT: ${JSON.stringify(finalResult)}`);
```

Runs unconditionally in production on every cart recalculation — log volume, latency, and customer data in
logs. Gate behind `process.env.OFFER_DEBUG` or use the `pino` logger that is already a dependency.

### 🟡 B11 — Magic number for the free-waiting benefit

```js
if (allowFreeWaiting) { totalValue += 20; }   // "Estimated value for free waiting time benefit"
```

₹20 hardcoded, while the real rate lives in `appConfig.waitingChargePerMinute` (₹2/min). Ranking decisions
are made on a stale guess. Read it from `appConfig`.

### 🟡 B12 — Unused import

`import fs from 'fs';` at the top of `offerEngine.js` — dead, remove.

### 🟡 B13 — The recalculation block is copy-pasted three times

The ~90-line "recompute offers against kept items" block appears at `order.controllers.js` lines **~1140**,
**~1462**, and **~1969**, and is **absent** from the rider path (that is B1). Four call sites, three copies,
one omission.

**Fix is the same fix as B1:** extract one `recalculateOrderOffers(order, session)` into
`helperFns/` and call it from all four. The smallest diff that fixes B1 is also the one that removes the
duplication — patching only the rider path would leave three copies that drift.

---

## 3. Suggested order of work

| # | Work | Why first |
|---|---|---|
| 1 | Extract `recalculateOrderOffers()`, call from all 4 sites → fixes **B1**, **B13** | active money leak |
| 2 | Split `finalBilling.discount` → **B2** | active money leak, same code area |
| 3 | Atomic usage claims + unique indexes → **B4**, **B5**, **B6** | exploitable, and index migrations want their own release |
| 4 | Route `selectedOffers` through the policy function → **B3** | exploitable |
| 5 | Add `kind` discriminator + migration → **B7**, **B9**, and kills the flag ambiguity | unblocks everything after |
| 6 | Audit live offers, then fix condition logic → **B8** | needs data review first |
| 7 | Housekeeping → **B10**, **B11**, **B12** | trivial, do alongside |

---

## 4. Tests to write with these fixes

Per the standing rule that new work ships with tests. The good news: the offer engine is where testing pays
off fastest, because `calculateDiscount`, `isItemApplicable`, `getApplicableAmount` and
`calculateFinalBilling` are all **pure functions** — no DB, no mocks, instant unit tests.

See [docs/ecosystem/TESTING.md](../ecosystem/TESTING.md) for the stack. For this feature specifically:

**Unit** (`vitest`, pure, no DB) — `Backend/src/services/offerEngine.test.js`:

- `calculateDiscount`: flat > applicable amount is capped; percentage respects `maxDiscount`; percentage
  rounds to 2dp; zero and negative inputs.
- `isItemApplicable`: each restriction type alone; **the B8 AND/OR matrix explicitly** — a case per
  combination, so the intended semantics are pinned down in code and can never silently flip back.
- `getApplicableAmount`: merchant-scope isolation; item-restricted vs whole-cart.
- `calculateFinalBilling`: all-kept vs partial-kept vs all-returned; overtime penalty boundary at exactly
  10 minutes; `freeDelivery`/`freeReturn`/`freeWaiting` each in isolation; `totalPayable` never negative.
- The stacking policy function (once extracted): the full table from §1 as a parameterised test.

**Integration** (`vitest` + `mongodb-memory-server` + `supertest`):

- **B1 regression:** place a Try & Buy order with a `minCartValue` coupon, keep a subset below the threshold,
  settle via the **rider** endpoint, assert `totalPayable` equals the customer-path result. This single test
  is the one that must exist — it is the money bug.
- **B4:** fire N concurrent redemptions of a coupon with `maxUsageTotal: 1`; assert exactly one succeeds.
- **B5:** same for `maxUsagePerUser`.
- **B6:** call the order-placement path twice with one idempotency key; assert `currentUsage` is 1.
- **B3:** post a crafted `selectedOffers` array of 5 stackable offers; assert the policy cap holds.
- **B9:** `validateCouponCode` with an auto-apply offer's code → rejected.

**E2E** (Playwright against MerchantModule/admin, Maestro for the customer app):

- Admin creates a coupon → customer applies it at checkout → kept-items settlement shows the right total.
  One happy path only; the edge cases belong in the layers above where they are cheap.

**Case/fixture tests:** keep a `Backend/src/services/__fixtures__/offers/*.json` set of real-world offer
configs (the ones currently live in production) and run the engine over each as a snapshot. This is how you
catch B8's migration breaking an existing offer — cheap, and it documents what the admin team actually
creates.

---

## 5. The admin/merchant authoring side — why it feels complex

You are right that it is complex. The complexity is not incidental; it comes from **one model serving two
authors with two different rule sets, enforced in two hand-written controllers that disagree with each other
and with the schema.** Three sources of truth for the same facts.

### 5.1 Where the rules live today

| Fact | Stated in | And also in | And also in |
|---|---|---|---|
| Which types admin may create | `ADMIN_OFFER_TYPES` in [adminControllers/offer.controllers.js:9](../../Backend/src/controllers/adminControllers/offer.controllers.js#L9) | `ADMIN_OFFER_TYPES` in [OffersManagement.jsx:11](../../website/FFmanagement/src/pages/admin/OffersManagement.jsx#L11) (with labels/icons) | `type` enum in `offer.model.js` (all 9 types, no scope link) |
| Which types merchants may create | `MERCHANT_OFFER_TYPES` in [merchantController/offer.controllers.js:9](../../Backend/src/controllers/merchantController/offer.controllers.js#L9) | MerchantModule `pages/OffersPage.tsx` | same single enum |
| Default per-user usage limit | schema: `1` | admin controller: `null` | merchant controller: `1` |
| What `freeReturn`/`freeWaiting` imply | `offer.model.js` comments | admin controller's cascade | `offerEngine.js` recomputes the cascade *again* |

The `type` enum mixes both scopes into one list (`FIRST_TIME_USER` … `VENDOR_CLEARANCE`), so the database
itself cannot tell you that a merchant may not create a `FLASH_SALE`. That invariant exists only as an `if`
in one controller — and it is skipped entirely on update (B16 below).

### 5.2 Additional bugs on the authoring path

#### 🔴 B14 — No unique index on `couponCode`; uniqueness is checked only among active offers

The model declares `offerSchema.index({ couponCode: 1 }, { sparse: true })` — **sparse, not unique**. Both
controllers guard with:

```js
const existing = await Offer.findOne({ couponCode: couponCode.toUpperCase(), isActive: true });
```

Two ways this breaks:
- **Resurrection collision:** deactivate offer A (`DIWALI50`), create offer B with `DIWALI50` — allowed,
  A is inactive. Re-activate A via `toggleOffer`, which does **not** re-check the code. Now two active offers
  share a code, and `validateCouponCode` does `findOne` — whichever Mongo returns first wins,
  non-deterministically. The customer sees a different discount on different requests.
- **Race:** two admins (or one double-click) creating the same code simultaneously both pass the check.

**Fix:** a real unique partial index, and let the duplicate-key error be the error message:

```js
offerSchema.index({ couponCode: 1 }, { unique: true, partialFilterExpression: { couponCode: { $type: 'string' } } });
```

Decide deliberately whether a retired code may be reused. Recommendation: **no** — codes get screenshotted and
shared on social media long after a campaign ends, and reuse means an old screenshot silently redeems a new
campaign's discount. A globally unique code forever is the safe default.

#### 🔴 B15 — The two authoring paths write different defaults to the same field

```js
// adminControllers/offer.controllers.js
maxUsagePerUser: maxUsagePerUser || null,   // → unlimited
// merchantController/offer.controllers.js
maxUsagePerUser: maxUsagePerUser || 1,      // → once per customer, ever
```

Same model, same field, opposite meaning depending on who created the row — and neither matches the schema's
own `default: 1`.

**Consequence:** a merchant's "Flat 25% OFF on Nike Store" auto-applying offer works **once per customer and
then silently stops**. The merchant sees their offer listed as active; returning customers just quietly pay
more. An identical admin-created offer has no such limit. This is very likely a live complaint already, and
it is invisible in the admin UI.

This is the strongest argument for the §1 `kind` discriminator: `OFFER` → unlimited per user,
`COUPON` → 1 per user. Set the default **once, from `kind`, in the schema**, and delete both controller
expressions.

#### 🔴 B16 — `updateOffer` mass-assigns the request body and skips validators

```js
const updates = req.body;
delete updates.scope;
delete updates.createdBy;
delete updates.createdByModel;
const offer = await Offer.findByIdAndUpdate(id, updates, { new: true });
```

Three fields are blocked; everything else is writable. Two separate problems:

1. **The `ADMIN_OFFER_TYPES` guard is create-only.** `PATCH { type: 'VENDOR_CLEARANCE' }` on an admin offer
   succeeds, producing `scope: 'admin'` + a vendor type — a combination `offerEngine.js`'s scope logic was
   never written for. Same for `merchantId`, `targetUserId`, `currentUsage`, `isPublic`.
2. **`findByIdAndUpdate` does not run schema validators unless you pass `runValidators: true`.** It is not
   passed. So every `enum` on the model — `type`, `scope`, `discountType`, `benefitType`, `applicableTo`,
   `conditions.genders` — is **unenforced on update**. `discountType: 'banana'` persists, and then
   `calculateDiscount` silently falls through its `if (flat) … else percentage` to the percentage branch.

**Fix:** an explicit allow-list of updatable fields (the lazy version is one `pick()` with ~20 keys), plus
`{ new: true, runValidators: true }`. Apply the same create-time type guard on update.

#### 🟠 B17 — `toggleOffer` re-activates without re-validating anything

Reactivating an offer skips the coupon-code check (B14), the date window, and the type/scope guard. A
toggle is treated as metadata, but it is the switch that puts money at risk.

#### 🟡 B18 — `getAllOffers` / `getMyOffers` have no pagination

Both `find()` the whole collection. Fine at today's volume; a trap once there are thousands of expired
offers. Worth a `limit`/`skip` while the file is open.

### 5.3 The admin form itself

[OffersManagement.jsx](../../website/FFmanagement/src/pages/admin/OffersManagement.jsx) is 682 lines with a
single flat form carrying ~20 inputs, including **four independent checkboxes** —
`freeDelivery`, `freeReturn`, `freeWaiting`, `autoApply` — that the backend then partially overrides:

```js
freeReturn:  isFreeDeliveryType || freeReturn  || freeDelivery || false,
freeWaiting: isFreeDeliveryType || freeWaiting || freeDelivery || false,
```

So an admin who ticks "Free Delivery" and deliberately leaves "Free Waiting" unticked gets free waiting
anyway. The form lies about the outcome. Then `offerEngine.js` recomputes the same cascade a third time at
read. Three places implement one rule.

**Why it feels complex to the person using it:** the admin is asked to make decisions the system should be
making for them. Picking `FREE_DELIVERY` as the type and *then* being asked to tick three free-* boxes and
choose a `benefitType` is redundant — the type already determines all of them.

### 5.4 Recommended simplification

Collapse the authoring surface to the decisions that are genuinely the author's:

| Author decides | Derived by the system |
|---|---|
| `kind` — Offer (auto) or Coupon (code) | `requiresCoupon`, `autoApply` → deleted |
| `type` (from a scope-filtered list) | `benefitType`, the three `free*` flags, `isFlashSale`, `firstTimeUserOnly` |
| Who/what it applies to (`conditions`) | `maxUsagePerUser` default, `stackable` default |
| How much (`discountType`, `discountValue`, `maxDiscount`) | `badgeText` default |
| When (`startDate`, `endDate`) | — |
| Caps (`maxUsageTotal`, and per-user only for coupons) | — |

Mechanically:

1. **One offer-type catalogue module**, imported by both controllers and exported to both UIs over an
   endpoint:

   ```js
   // Backend/src/services/offerCatalogue.js  — the single source
   export const OFFER_TYPES = {
     FREE_DELIVERY: { scope: 'admin', benefitType: 'DELIVERY',
                      implies: { freeDelivery: true, freeReturn: true, freeWaiting: true },
                      label: 'Free Delivery & Returns' },
     VENDOR_DISCOUNT: { scope: 'merchant', benefitType: 'PRODUCT', implies: {}, label: 'Store Discount' },
     // …
   };
   ```

   The admin UI's `ADMIN_OFFER_TYPES` array (labels, icons, descriptions) then comes from the API instead of
   being a second hand-maintained copy, and the form renders only the fields that type actually needs. One
   place to add a type; the DRY fix and the simpler-UI fix are the same change.

2. **Apply `implies` once**, in a `pre('save')` hook on the model, so create, update, toggle and any future
   script all get it. Delete the cascade from the admin controller and from `offerEngine.js`.

3. **Validate scope×type in the schema**, not in controllers — then `scope: 'admin'` + `VENDOR_CLEARANCE`
   becomes impossible to persist regardless of which endpoint is called.

4. **Show the author the outcome.** A live preview panel: *"This is an Offer. It applies automatically to
   Try & Buy carts over ₹999. Free delivery, returns and waiting are included. Unlimited uses per customer,
   5,000 total."* Generated from the same catalogue. Most of the confusion is that today you cannot tell what
   you just created without reading `offerEngine.js`.

**Net effect:** `offer.model.js` loses 4 flags, the two controllers lose their divergent defaults and
cascades, the admin form loses ~8 inputs, and the three copies of the free-* rule become one.

### 5.5 Updated order of work

Folding §5 into §3:

| # | Work | Fixes |
|---|---|---|
| 1 | Extract `recalculateOrderOffers()`, call from all 4 sites | B1, B13 |
| 2 | Split `finalBilling.discount` into two fields | B2 |
| 3 | Unique partial index on `couponCode`; re-validate in `toggleOffer` | B14, B17 |
| 4 | Atomic usage claims + unique indexes on `OfferUsage` | B4, B5, B6 |
| 5 | Allow-list `updateOffer`, add `runValidators`, apply type guard on update | B16 |
| 6 | Route `selectedOffers` through the one policy function | B3 |
| 7 | `offerCatalogue.js` + `pre('save')` implies + `kind` discriminator + migration | B7, B9, B15, and §5.4 |
| 8 | Drive both UIs from the catalogue endpoint; add the outcome preview | §5.3 |
| 9 | Audit live offers, then fix condition AND/OR logic | B8 |
| 10 | Housekeeping: debug logs, magic number, dead import, pagination | B10, B11, B12, B18 |

Items 1–2 are the active money leak and should ship first, on their own, with the B1 regression test.

---

## 6. Best-offer consolidation with user override (Zomato-style)

**Requirement:** when several offers qualify, auto-apply the best one; let the customer switch to a different
one if they prefer.

**Status: the backend already does most of this. The client throws it away.**

### 6.1 What already works

`findBestOffers()` returns both halves of the contract:

```js
return {
  appliedOffers: winningOffers,     // what the engine chose
  availableOffers: availableOffers, // EVERY eligible offer, each with discountAmount + totalValue
  totalDiscount, freeDelivery, freeReturn, freeWaiting,
};
```

and it already accepts an override:

```js
export const findBestOffers = async (userId, cartContext, couponCode = null, selectedOffers = [], orderType = null)
```

`getAvailableOffersForUser()` additionally returns `eligible` plus a human `reason` per offer
(`"Add ₹240 more to avail this offer"`) — which is exactly the Zomato "add ₹200 more to unlock" affordance,
already built.

### 6.2 What is missing

#### 🔴 C1 — The client cannot send a chosen offer

[FlashFitsv2/api/offers.ts](../../../FlashFitsv2/api/offers.ts):

```ts
export const getBestOffersForCart = async (
  cartContext: {...},
  couponCode?: string            // ← no selectedOffers parameter
): Promise<AppliedOffers> => { ... }

export interface AppliedOffers {
  appliedOffers: (Offer & { discountAmount: number })[];
  totalDiscount: number;
  freeDelivery?: boolean;        // ← availableOffers is not in the type at all
}
```

The engine's `selectedOffers` path is unreachable from the customer app, and `availableOffers` is dropped on
the floor by the type. So today the customer gets whatever the engine picked, with no list and no way to
change it. The feature is ~80% built and 0% exposed.

**Fix:** add `selectedOfferIds?: string[]` to the request and `availableOffers` to the response type. Thread
it through `OffersContext` (which currently holds only `appliedOffers`). This is a small change — but see C3,
the override path must be validated server-side before it is exposed.

#### 🟠 C2 — "Best" is ranked on an inflated number

Winners are sorted by `totalValue`, not by actual savings:

```js
if (allowFreeDelivery || allowFreeReturn) {
  totalValue += (cartContext.totalDeliveryCharge || 0) + (cartContext.totalReturnCharge || 0);
}
if (allowFreeWaiting) { totalValue += 20; }   // B11: hardcoded
```

A free-delivery offer is credited with delivery **plus** return charge **plus** a guessed ₹20, even when the
customer will keep everything (no return trip, so the return charge never existed — `calculateFinalBilling`
zeroes it when `allItemsKept`). So a ₹60 free-delivery offer can be ranked at ₹120 and beat a genuine ₹100
discount. The customer is auto-given the worse offer, and the screen says it is the best one.

**Fix:** rank on **realised customer saving** computed by the same function that produces the final bill.
`calculateFinalBilling` is pure and cheap — call it once per candidate and compare `totalPayable`. That is
the only definition of "best" that cannot disagree with what the customer is charged.

#### 🔴 C3 — The override path has no policy enforcement (this is B3)

See §2/B3. `selectedOffers` currently applies **every** offer in the array. Before exposing the picker,
`selectedOffers` must be treated as a *preference*, not an instruction:

```
engine(cart, selectedOfferIds) =
    candidates  = all eligible offers
    preferred   = candidates ∩ selectedOfferIds
    winners     = applyStackingPolicy(preferred ∪ bestOf(candidates - conflicts))
```

The invariant: **the policy function is the only thing that can decide winners.** A selection may change
*which* offer fills a slot; it can never add a slot. Enforce this in one function, server-side, and the
exploit and the feature are solved by the same code.

### 6.3 Recommended UX

Mirror Zomato, which is the pattern customers already understand:

| Surface | Content |
|---|---|
| Cart / checkout summary | `✓ ₹150 saved with FLAT150` + a `Change` link. Never a silent discount — a customer who cannot see which offer applied will assume none did. |
| Offers sheet | Eligible offers first, sorted by actual saving, the applied one marked. Then ineligible ones, greyed, each with its `reason` ("Add ₹240 more"). Then a code-entry box for secret coupons (`isPublic: false`). |
| On switching | Recompute server-side and show the delta: *"You'll save ₹30 less"* — and require a confirm tap for a downgrade. |
| Stacked case | List each winner on its own line with its own amount, so "₹150 off + free delivery" reads as two facts, not one mystery total. |

**Decision you need to make:** does a user's manual choice survive a cart edit? Recommendation: **keep the
choice, re-validate it, and tell them if it lapsed** ("FLAT150 no longer applies — you're ₹240 below the
minimum"). Silently reverting to the auto-best is the behaviour customers describe as "the app removed my
coupon".

Note this interacts with Try & Buy: an offer chosen at checkout is re-evaluated against **kept items** after
the trial (§2/B1). The customer must be shown the post-trial recomputation on the selection screen, or they
will dispute the final bill. This is the single most Flash Fits-specific thing about the whole offer system
and it deserves its own copy in the UI.

---

## 7. Discount attribution — who pays for the discount

**Requirement:** a merchant's offer is funded from the merchant's share; a FlashFits offer is funded from
FlashFits' share. Neither subsidises the other.

**Status: already implemented correctly in the settlement helper.** Do not rebuild it — but it has three
leaks, and one of them is caused by bug B1.

### 7.1 What already works

[helperFns/orderSettlement.js](../../Backend/src/helperFns/orderSettlement.js):

```js
for (const offer of (order.appliedOffers || [])) {
  if (offer.scope === "admin")         adminDiscount    += (offer.discountApplied || 0);
  else if (offer.scope === "merchant") merchantDiscount += (offer.discountApplied || 0);
}
…
const finalMerchantPayout = Math.max(0, totalMerchantPayout - merchantDiscount);
const finalAdminPayout    = totalCommission - adminDiscount;
```

Merchant offers reduce the merchant's payout; admin offers reduce FlashFits' commission. `merchantDiscount`
is persisted per order and carried into `weeklyPayout.orders[].merchantDiscount`. The intent is right and the
plumbing exists.

### 7.2 Leaks

#### 🔴 C4 — B1 corrupts settlement, not just the customer's bill

Attribution reads `offer.discountApplied`. That field is refreshed by the kept-items recalculation — which the
**rider settlement path never runs** (§2/B1, `deliveryRiderController/orderController.js:413`). So on every
rider-settled order, `discountApplied` still holds the **checkout-time, full-cart** figure.

**Failure scenario:** ₹2,400 cart, merchant offer gives ₹400 off. Customer keeps ₹600 of items. Rider settles.
The merchant's payout is reduced by **₹400** against a ₹600 sale, for a discount the customer was never
actually given at that size. The merchant is overcharged, silently, and the number lands in their weekly
payout as fact.

This makes B1 a **two-sided** money bug — the customer underpays *and* the merchant is overcharged. It raises
B1 from "fix first" to "fix before the next payout run". The regression test in §4 must assert the
`merchantDiscount` written at settlement, not only `totalPayable`.

#### 🟠 C5 — Excess merchant discount is silently absorbed by nobody

```js
merchantDiscount = Math.min(merchantDiscount, totalMerchantPayout);
```

If a merchant offer's discount exceeds the merchant's own payout, the excess is clipped. The customer still
received the full discount, so the shortfall comes out of the money collected — i.e. FlashFits' commission —
**uncapped and unrecorded**. That is precisely the cross-subsidy this requirement forbids, and there is no
field anywhere that says it happened.

**Fix:** record it rather than clip it silently.

```js
const requestedMerchantDiscount = merchantDiscount;
merchantDiscount = Math.min(requestedMerchantDiscount, totalMerchantPayout);
const unrecoveredDiscount = requestedMerchantDiscount - merchantDiscount;   // persist this
```

Then decide the policy deliberately: absorb it (and alert, so an offer configured this badly gets noticed),
or carry it to the merchant's next payout as a debit. Either is defensible; silently absorbing an unknown
amount is not. The same applies to `finalAdminPayout`, which has **no floor** and can go negative — correct
in principle (FlashFits really does lose money on an aggressive coupon) but it should be flagged above a
threshold rather than discovered at month end.

#### 🟠 C6 — Stacked free delivery is charged to the merchant even when FlashFits offered it

```js
const freeDeliveryOffers = (order.appliedOffers || []).filter(o => o.freeDelivery === true);
const freeDeliveryOffer  = freeDeliveryOffers.find(o => o.scope === "merchant")
                        || freeDeliveryOffers.find(o => o.scope === "admin");
```

The comment says this is deliberate ("Prioritize Merchant offer... so delivery charge is funded from
Merchant's fund"), but it contradicts the requirement. When both a merchant and an admin free-delivery
benefit are in `appliedOffers` — reachable, because the engine's stacking explicitly allows a delivery offer
alongside a discount — **only the merchant is charged**, and FlashFits' own promotion is funded by the
merchant.

**Fix:** attribute each benefit to the scope that granted it. If two offers grant the same benefit, the
engine should not have let both win in the first place (one delivery slot, per the §1 stacking rule) — so
this is really a symptom of the stacking policy being spread across four branches. Fixing the policy fixes
this.

#### 🟡 C7 — Rider waiting-time compensation is charged to FlashFits unconditionally

```js
if (waitingTimeCharge > 0) { adminDiscount += waitingTimeCharge; }
```

Reasonable as a default. But if the `freeWaiting` benefit came from a **merchant** offer, the merchant chose
to give it away and FlashFits pays for it. Same class of bug as C6, smaller amount.

### 7.3 What to add

- **Persist an attribution breakdown per order**, not just two running totals:
  `settlement.attribution = [{ offerId, scope, benefit: 'DISCOUNT'|'DELIVERY'|'RETURN'|'WAITING', amount, bearer: 'merchant'|'flashfits' }]`.
  This is what makes a merchant dispute answerable from the record, and it is what feeds the
  "Your store offers: −₹X" line requested in
  [earnings-and-payouts.md §3.4](earnings-and-payouts.md).
- **Show the bearer at authoring time.** When a merchant creates an offer, the form should say plainly:
  *"This discount is deducted from your payout."* When an admin creates one: *"FlashFits funds this."*
  Most disputes are about surprise, not arithmetic.
- **An admin reconciliation view**: per campaign, total discount given, split by bearer. Today
  `adminDiscount` is computed and used but never reported, so nobody can answer "what did the Diwali coupon
  cost us".

### 7.4 Tests for §6 and §7

**Unit:**
- Ranking (C2): a candidate set where free-delivery `totalValue` exceeds a flat discount's but the realised
  `totalPayable` is worse → assert the flat discount wins. This test is the definition of "best offer".
- The stacking policy function: `selectedOfferIds` containing 5 stackable offers → assert at most one per
  slot survives (C3/B3).
- Attribution: for each `(scope, benefit)` pair, assert the amount lands on the right bearer and that
  `merchantDiscount + adminDiscount + unrecoveredDiscount` equals the total discount given — a conservation
  property. Nothing may vanish.

**Integration:**
- **C4 regression, the critical one:** Try & Buy order, merchant offer, partial keep, **settled via the rider
  endpoint** → assert both `finalBilling.totalPayable` *and* the persisted `merchantDiscount` match the
  kept-items recomputation.
- C5: a merchant offer larger than the merchant's payout → assert `unrecoveredDiscount` is recorded and the
  conservation property above still holds.
- C6: an order with both a merchant and an admin free-delivery benefit → assert each bearer is charged for
  its own, or that the engine refused to stack them.
- Switching offers: apply offer A, switch to B, assert the recomputed total and that only B is recorded.

**E2E:** customer with 3 eligible offers → cart shows the best with a `Change` link → open sheet → ineligible
offers show their reason → switch to a smaller one → confirm the downgrade warning → place order → assert the
merchant's payout reflects the chosen offer's scope.

---

## 8. Logistics benefits: granular for admin, bundled for merchants

**Requirement:** the FlashFits admin can grant the three logistics benefits independently — free delivery,
free waiting-time charge, free return delivery. A merchant gets **one** "Free delivery" toggle that includes
all three.

This is a good rule and it resolves several of the ambiguities above. It is also **not what the code does
today** — in fact the current backend actively destroys the admin's granularity.

### 8.1 What breaks it today

[adminControllers/offer.controllers.js:79-81](../../Backend/src/controllers/adminControllers/offer.controllers.js#L79):

```js
freeDelivery: isFreeDeliveryType || freeDelivery || false,
freeReturn:   isFreeDeliveryType || freeReturn  || freeDelivery || false,
freeWaiting:  isFreeDeliveryType || freeWaiting || freeDelivery || false,
```

`freeDelivery` cascades into the other two **for admin offers**. So an admin who deliberately ticks only
"Free delivery" and leaves waiting and return unticked gets all three anyway. The admin form
([OffersManagement.jsx](../../website/FFmanagement/src/pages/admin/OffersManagement.jsx), three separate
checkboxes) presents a granular choice that the backend then overrides. The UI lies.

Then `offerEngine.js` applies the cascade a **third** time at read:

```js
const allowFreeReturn  = Boolean((offer.freeReturn  || offer.freeDelivery || offer.type === 'FREE_DELIVERY') && !isMerchantCourier);
const allowFreeWaiting = Boolean( offer.freeWaiting || offer.freeDelivery || offer.type === 'FREE_DELIVERY');
```

…so even if you fixed the controller, the engine would re-apply it. And `calculateFinalBilling` has a fourth
variant of the rule:

```js
const isReturnFree = Boolean(freeReturn || freeDelivery || Number(deliveryCharge) === 0 || Number(returnCharge) === 0);
```

**One rule, four implementations, none of them matching the intended policy.** Granular admin control is
currently impossible to express — not because of a missing field, but because three layers keep overwriting it.

### 8.2 The rule, stated once

> The three logistics benefits — `freeDelivery`, `freeWaiting`, `freeReturn` — are **independent booleans on
> the offer document**. Nothing derives one from another at read time.
>
> **Admin authoring** sets each independently.
> **Merchant authoring** exposes one "Free delivery" control which writes **all three as `true`**.
>
> The bundling happens **once, at write time, in the merchant authoring path.** Readers never infer.

That last line is what makes it work. Today's bug is that readers infer. Once the document is the truth,
`offerEngine.js` and `calculateFinalBilling` both simplify to reading three booleans.

### 8.3 Where it goes

In the `offerCatalogue.js` proposed in §5.4, keyed by scope:

```js
// Backend/src/services/offerCatalogue.js
export const LOGISTICS_BENEFITS = ['freeDelivery', 'freeWaiting', 'freeReturn'];

export const SCOPE_RULES = {
  admin: {
    // each benefit independently selectable
    logistics: 'granular',
  },
  merchant: {
    // one control; selecting it grants all three
    logistics: 'bundled',
    bundleLabel: 'Free delivery (includes waiting time & return delivery)',
  },
};
```

and applied in a `pre('save')` hook on the model, so create, update, `toggleOffer` and any back-fill script
all behave identically:

```js
offerSchema.pre('save', function () {
  if (this.scope === 'merchant' && this.freeDelivery) {
    this.freeWaiting = true;
    this.freeReturn  = true;
  }
  if (this.type === 'FREE_DELIVERY') {       // admin's all-inclusive type
    this.freeDelivery = this.freeWaiting = this.freeReturn = true;
  }
});
```

Then **delete** the cascade from the admin controller, from `findBestOffers`, from `validateCouponCode`, and
from `calculateFinalBilling`'s `isReturnFree`. Four deletions, one addition — the diff is net negative, which
is the sign it is the right fix.

Note `calculateFinalBilling`'s `isReturnFree` also folds in `deliveryCharge === 0 || returnCharge === 0`.
That is a *different* fact ("this order had no charge to begin with") wearing the same name as "an offer
waived it". Keep them separate: the offer decides `freeReturn`; a zero base charge needs no waiver. Merging
them is why free-return currently appears to apply to orders no offer touched.

### 8.4 Consequences this rule settles

**It resolves C7 (§7.2).** A merchant "Free delivery" offer bundles waiting, so the merchant granted it and
the merchant bears it. The current unconditional
`if (waitingTimeCharge > 0) { adminDiscount += waitingTimeCharge; }` becomes:

```js
if (waitingTimeCharge > 0) {
  const grantor = (order.appliedOffers || []).find(o => o.freeWaiting);
  if (grantor?.scope === 'merchant') merchantDiscount += waitingTimeCharge;
  else                               adminDiscount    += waitingTimeCharge;   // incl. no grantor: FF absorbs
}
```

Same pattern for delivery and return (fixing C6). **One principle covers all three: whoever granted the
benefit pays for it.** With the scope-aware bundling in §8.3, that principle is now computable from the
document — which it is not today.

**It simplifies the ranking fix (C2).** Once the three flags are honest, `calculateFinalBilling` returns the
true `totalPayable` per candidate, and "best offer" needs no `totalValue` heuristic and no hardcoded ₹20.
Delete `totalValue` entirely.

**It clarifies a merchant restriction already in the code.**
[merchantController/offer.controllers.js:53-57](../../Backend/src/controllers/merchantController/offer.controllers.js#L53):

```js
if (applicableTo === 'courier' || applicableTo === 'both') {
  benefitType = 'PRODUCT';
  isFreeDelivery = false;
}
```

Merchants cannot grant free delivery on courier orders — sensible, since FlashFits does not control courier
cost — but today it is silently stripped with no feedback. Under the catalogue it becomes a declared
constraint the merchant UI can **show** ("Free delivery is available for Try & Buy orders only") instead of a
surprise. Right now a merchant can tick the box, save, and get an offer that does nothing.

### 8.5 Tests

**Unit:**
- Merchant offer with `freeDelivery: true` → after save, all three flags are `true`.
- Admin offer with `freeDelivery: true`, `freeWaiting: false`, `freeReturn: false` → **stays exactly that**.
  This is the regression test for the bug in §8.1 and the reason the whole rule exists.
- Admin `type: 'FREE_DELIVERY'` → all three true.
- `calculateFinalBilling` with `freeReturn: false` but `returnCharge: 0` → no phantom "return free" state.
- Attribution: for each of the three benefits × each scope, assert the right bearer (§8.4).

**Integration:**
- Merchant creates a free-delivery offer with `applicableTo: 'courier'` → 400 with a clear message, not a
  silent strip.
- Admin creates a delivery-only waiver → place a Try & Buy order that returns items → assert the customer is
  charged the return fee and the waiting charge, and only delivery was waived.

**Verification flow:** create one offer of each shape through the real admin and merchant UIs, place an order
against each, and read the resulting settlement. Three authoring paths × three benefits is exactly the kind of
matrix where a passing unit suite coexists with a form that cannot express what the operator intended.
