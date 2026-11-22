# Bug report: merchants cannot add numeric size variants (e.g. "30-23 cm")

**Last Updated:** 2026-11-22
**Status:** **fixed** on 2026-11-22 — Option A (free text) approved. See §8 for what shipped.
One step is outstanding and needs a human: the production data check in §5.4.
**Reported as:** "Merchants are not able to add products which have size variants of numerical values like
30-23 cm. It was working before and became faulty during the latest changes."

---

## 1. Answer

**The bug is real and it is in the WEB app (`MerchantModule`), not the mobile app.**

| Surface | Can a merchant enter "30-23 cm"? |
|---|---|
| **`MerchantModule` → Add New Product** | ❌ **No** — the size field is a `<select>` with 8 hardcoded letter sizes |
| **`MerchantModule` → Edit Product** | ❌ **No** — same `<select>`, and it **silently corrupts** existing numeric sizes (§3) |
| **`MerchantModule` → Bulk CSV Upload** | ❌ **No** — hard-rejects any size outside 6 letter sizes |
| **`MerchantModule` → Add Variant** (to an existing product) | ✅ Yes — free-text input |
| **`MerchantApp` (Expo) → Add Product** | ✅ Yes — free-text input |
| **`MerchantApp` (Expo) → Add Variant** | ✅ Yes — free-text input |
| **Backend / database** | ✅ Yes — `size` is an unconstrained `String`; it stores and returns the value untouched |

**It is not a regression from the latest changes.** The restriction has been in place since **3 Aug 2026**
(commit `f6561aa` "after flashmart"), which is when the size + stock UI was *first added* to the web
Add Product page — it was introduced as a `<select>`, never as a text field. Before that commit the page had
no size rows at all; sizes were only ever entered through the Add Variant flow, which **is** free text.

So nothing broke. What most likely happened is that merchants (or staff) moved from the Expo app or the
Add Variant flow — both of which accept any size — onto the web Add Product page, which never did.

**Dates, for the record:**

| Change | Commit | Date |
|---|---|---|
| Bulk-upload `VALID_SIZES` restriction added | `5b9b0c0` "before onboard" | 29 Jun 2026 |
| Size `<select>` added to Add Product **and** Edit Product | `f6561aa` "after flashmart" | 3 Aug 2026 |
| `'FS'` added to both option lists (a *widening*, not a restriction) | `038a8b7` "nov6" | 6 Nov 2026 |
| "fixing add product bug" / "bug 2" | `1dc7031`, `0d71d8b` | 19–20 Nov 2026 |

The two November "add product bug" commits touched **price and discount only** — they did not go near the
size field. I checked their diffs specifically.

---

## 2. The blocking code

### 2.1 Add New Product — [`MerchantModule/src/pages/products/AddNewProduct.tsx:1746`](../../../MerchantModule/src/pages/products/AddNewProduct.tsx#L1746)

```jsx
<select value={sz.size} onChange={(e) => updateSize(szIdx, "size", e.target.value)} required>
  {['FS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free'].map((optionSize) => (
    <option key={optionSize} value={optionSize}>{optionSize}</option>
  ))}
</select>
```

A closed dropdown. There is **no numeric size in the list at all** — not "32", not "30-23 cm". A merchant
selling trousers, footwear, or anything measured cannot describe their stock.

Note the submit path itself is fine — [`AddNewProduct.tsx:805`](../../../MerchantModule/src/pages/products/AddNewProduct.tsx#L805)
filters on **stock** being numeric, not size:

```js
.filter(s => s.size && s.stock !== '' && s.stock !== undefined && !isNaN(Number(s.stock)))
```

and sends `size: s.size.trim()` verbatim. **Only the input widget blocks it.**

### 2.2 Edit Product — [`MerchantModule/src/pages/products/EditProductPage.tsx:966`](../../../MerchantModule/src/pages/products/EditProductPage.tsx#L966)

Identical `<select>` with the identical 8 options. This one is worse than a blocker — see §3.

### 2.3 Bulk CSV upload — [`MerchantModule/src/pages/products/BulkUploadProducts.tsx:59`](../../../MerchantModule/src/pages/products/BulkUploadProducts.tsx#L59)

```js
const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
…
if (!VALID_SIZES.includes(sName)) {
  productErrors.push(`${colorLabel}: Invalid size '${sName}'. Must be: ${VALID_SIZES.join(', ')}.`);
}
```

A **hard rejection**, declared twice (lines 59 and 161 — two copies of the same list). This list is even
narrower than the dropdowns: it excludes `FS` and `Free`, which the dropdowns offer. So a CSV exported from a
product created through the UI with size `FS` **will not re-import**.

The row editor at line 966 also renders only these 6 as fixed toggles, so a numeric size cannot be fixed up
in the UI after a failed parse either.

### 2.4 What works, for contrast

All of these are free-text and need no change:

- [`MerchantApp/src/app/add-product.tsx:1224`](../../../MerchantApp/src/app/add-product.tsx#L1224) — `<TextInput placeholder="S, M, 32">`
- [`MerchantApp/src/app/add-variant.tsx:482`](../../../MerchantApp/src/app/add-variant.tsx#L482) — `<TextInput placeholder="e.g. M, 34">`
- [`MerchantModule/src/components/utils/DynamicSizesInput.tsx:94`](../../../MerchantModule/src/components/utils/DynamicSizesInput.tsx#L94) — `<input type="text" placeholder="Size (e.g. M or 32)">`, used by the Add Variant flow
- [`MerchantModule/src/components/Products/VariantForm.tsx:355`](../../../MerchantModule/src/components/Products/VariantForm.tsx#L355) — `placeholder="Size"`

### 2.5 The backend is not the problem

- [`productFlat.model.js:108`](../../Backend/src/models/productFlat.model.js#L108) — `size: { type: String, required: true }`. No enum.
- [`createProductFull`](../../Backend/src/controllers/merchantController/product.controllers.js#L2444) stores `size: sizeInfo.size` **raw**, so "30-23 cm" round-trips intact.
- The Joi schema in [`product.validator.js`](../../Backend/src/utils/validators/product.validator.js) *does*
  have `size: Joi.string().valid('XS','S','M','L','XL','XXL')` — but it sits under `variants`, and the only
  caller (`addBaseProduct`) **deletes `size` from the body before validating**. So it never fires on this
  path. It is a trap for whoever adds a `variants` payload later, and should be loosened to match the model
  regardless.

---

## 3. 🔴 Worse than a blocker: Edit Product silently rewrites numeric sizes

This is the part worth acting on quickly, because it **destroys data that is already in the database**.

Products created through the Expo app or the Add Variant flow legitimately hold sizes like `30-23 cm`, `32`,
`9.5`. When such a product is opened in the web **Edit Product** page:

1. `<select value="30-23 cm">` has **no matching `<option>`**, so the browser renders the dropdown as
   **blank** — the merchant cannot see what size that row is.
2. The `<select>` is marked `required`, so the form **cannot be submitted** until the merchant picks one of
   the 8 letter options.
3. Picking one **overwrites** `30-23 cm` with e.g. `M`, and saving persists it.

So a merchant who opens an existing numeric-size product to change its price loses the size. There is no
warning and no undo. This alone could be what was reported as "it was working before" — the sizes *were*
there, and editing silently removed them.

**Failure scenario:** merchant creates "Formal Trousers" in the Expo app with sizes `30-23 cm`, `32-24 cm`,
`34-26 cm`. Later they open it on the web to correct the price. Three dropdowns show blank. The form refuses
to submit. They pick `S`, `M`, `L` to get past it. The product now has the wrong sizes, customers order the
wrong fit, and the returns come back as "size mismatch".

---

## 4. 🟠 Secondary backend bug found while tracing (independent of the above)

[`product.controllers.js:2417`](../../Backend/src/controllers/merchantController/product.controllers.js#L2417):

```js
const cleanSize = sizeInfo.size.replace(/\s+/g, '').toUpperCase();
…
productCode = `${baseProductCode}-${cleanColor}-${cleanSize}`;
```

`productCode` is **`unique: true`** on the model, and it is built from a **whitespace-stripped** size, while
the other uniqueness rule — `index({ styleGroupId, "color.name", size }, { unique: true })` — uses the
**raw** size. Two normalisations for one concept.

**Consequence:** sizes `"30-23 cm"` and `"30-23cm"` are *distinct* by the compound index but collide on
`productCode` → `E11000 duplicate key` → HTTP 500 `"Server error while creating product"`. Easy to hit in
the Expo app, where free text invites exactly that kind of near-duplicate.

**Made worse by the lack of a transaction:** the size loop calls `await newDoc.save()` per size with the
`try/catch` *outside* the loop. If size #3 collides, sizes #1 and #2 are **already committed**, and the
merchant gets a generic 500. On retry, #1 and #2 now violate the compound unique index too, so the retry
also fails — leaving a half-created product the merchant cannot create *or* fix. This matches the symptom
"not able to add products" more closely than a validation message would.

Two fixes, both small:
- Normalise once. Use the same canonical form for `productCode` and for the uniqueness check.
- Wrap the loop in a transaction (or `insertMany` with `ordered: false` plus cleanup) so a partial product is
  never persisted.

Also: `sizeInfo.size.replace(...)` has **no null guard**, so a size row arriving without `size` throws
`TypeError: Cannot read properties of undefined` → the same opaque 500.

---

## 5. Recommended fix

> **Superseded in part by §8.** §5.1 proposed a `<datalist>`; the approved fix keeps the dropdown behind a
> size-type selector instead. §5.3 (backend hardening) and §5.4 (data repair) still read as written — §5.3 is
> done, §5.4 is not.

The product decision is: **should the web page allow any size text, or a curated list?** The rest of the
system (mobile app, Add Variant, database) already allows anything, so the web page is the outlier and
should match it.

### 5.1 The lazy fix that keeps the dropdown convenience — native `<datalist>`

A `<select>` cannot accept free text. A text input with a `<datalist>` gives you **both**: the merchant still
gets a one-tap dropdown of the common sizes, and can type anything else. It is a native HTML feature, so no
component, no dependency, no state.

In both [`AddNewProduct.tsx:1745-1751`](../../../MerchantModule/src/pages/products/AddNewProduct.tsx#L1745)
and [`EditProductPage.tsx:965-971`](../../../MerchantModule/src/pages/products/EditProductPage.tsx#L965),
replace the `select-wrapper` block with:

```jsx
<>
  <input
    type="text"
    list="ff-size-options"
    value={sz.size}
    onChange={(e) => updateSize(szIdx, "size", e.target.value)}
    placeholder="Size (e.g. M, 32, 30-23 cm)"
    required
  />
  <datalist id="ff-size-options">
    {['FS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free',
      '28', '30', '32', '34', '36', '38', '40', '42'].map(s => <option key={s} value={s} />)}
  </datalist>
</>
```

The `ChevronDown` icon and `.select-wrapper` div come out with it. One `<datalist>` per page is enough —
hoist it outside the `sizes.map()` if you prefer a single node.

**Why not reuse `DynamicSizesInput`?** It already exists and is free text, which makes it the obvious
candidate — but it ships its own SKU toggle and its own row layout, so dropping it into these two pages
means reconciling two layouts and two sources of the `hasCustomSizeSku` state. The datalist swap is a much
smaller diff for the same outcome. Reuse `DynamicSizesInput` only if you also want to unify these three size
UIs, which is a separate, larger job.

### 5.2 Bulk upload

Replace both `VALID_SIZES` lists with a shape check rather than a membership check — the point is to catch
an empty or absurd cell, not to police vocabulary:

```js
// one definition, not two
const isValidSize = (s) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= 20;
```

Keep the duplicate-size check that follows it; that one is genuinely useful. Then make the row editor's size
cell an input rather than a fixed toggle grid.

### 5.3 Backend hardening (do with or without the above)

- Loosen the dead Joi `variants[].size` enum to `Joi.string()` so it matches the model and cannot ambush a
  future caller.
- Guard `sizeInfo.size` before `.replace()`.
- Normalise `productCode` and the compound unique index the same way (§4).
- Wrap the per-size save loop in a transaction (§4).

### 5.4 Data repair

Before shipping 5.1, check whether the Edit page has already overwritten sizes in production:

```js
// how many products hold a non-letter size today?
db.productflats.find({ size: { $not: /^(FS|XS|S|M|L|XL|XXL|XXXL|Free|FREE SIZE)$/i } })
                .count()
```

Compare against `auditLog` entries for product edits. If sizes were lost there is no automatic recovery —
the merchant has to re-enter them — so it is worth telling affected merchants rather than letting them find
out from a return.

---

## 6. Tests to add with the fix

Per [ecosystem/TESTING.md](../ecosystem/TESTING.md).

**Unit (Vitest + Testing Library, `MerchantModule`):**
- Type `30-23 cm` into the Add Product size field → it is in state and in the submitted payload verbatim.
- Render Edit Product for a product whose size is `30-23 cm` → **the field displays `30-23 cm`**. This is the
  §3 regression test and the most important one here.
- `isValidSize`: empty, whitespace-only, 21 chars, `30-23 cm`, `M`, `9.5`.

**Integration (backend):**
- `createProductFull` with sizes `["30-23 cm", "32-24 cm"]` → both persist with the raw strings.
- `createProductFull` with sizes `["30-23 cm", "30-23cm"]` → **asserts a clean 4xx, not a 500 and not a
  half-created product** (the §4 regression test).
- A size row with `size` missing → 400, not a `TypeError` 500.

**E2E (Playwright):** add a product with a numeric size on the web → open it in Edit → save without touching
the size → assert the size is unchanged.

**Verification flow** ([VERIFY.md](../ecosystem/VERIFY.md), flows M2 and M3): create a trousers product with
`30-23 cm` in the **web** UI, confirm it appears in the customer app with that size, then edit its price on
the web and confirm the size survives. The cross-surface check is the whole point — this bug exists precisely
because the three size inputs were never compared against each other.

---

## 7. Decision brief for approval (plain language)

Written for partners/stakeholders, not engineers. The question being approved is narrow: **what may a
merchant type into the "Size" field on the web dashboard?**

### 7.1 What's true today

Size is **already free text everywhere except two screens.** It is not a decision we are making for the
first time; it is a decision that was made in four places and contradicted in two.

| Where a merchant enters a size | What it accepts today | Numeric sizes? |
|---|---|---|
| Merchant mobile app → Add Product | free text, hint "S, M, 32" | ✅ works |
| Merchant mobile app → Add Variant | free text, hint "e.g. M, 34" | ✅ works |
| Merchant web → Add Variant | free text | ✅ works |
| Merchant web → **Add Product** | dropdown, 8 fixed options | ❌ **blocked** |
| Merchant web → **Edit Product** | dropdown, 8 fixed options | ❌ **blocked + destroys data** |
| Merchant web → **Bulk CSV upload** | 6 letter sizes only | ❌ **row rejected** |
| The database | plain text, no restriction | ✅ accepts anything |

So the four green rows and the database agree with each other. The three red rows are the outlier. That is
what "the web page is the outlier" means: we are not opening something up, we are removing a restriction that
one team added on one screen and that nothing else in the product shares.

### 7.2 The two options

**Option A — free text (recommended).** The merchant types the size: `M`, `32`, `30-23 cm`, `UK 8`,
`7.5 inch`. The list of common sizes stays, as suggestions that drop down when the field is tapped — so a
clothing merchant still picks `M` in one tap and nothing gets slower for them.

- Unblocks the reported problem immediately, on all three screens.
- Matches the mobile app, the database, and the existing Add Variant screen — one rule everywhere.
- No data migration, and no risk to existing products.
- Any future category — footwear, kids, home textiles, accessories, anything measured in cm or inches —
  needs no code change.
- **Honest downside:** typos and near-duplicates become possible (`XL`, `xl`, `X L`; `30-23cm` vs
  `30-23 cm`). This matters for how sizes group on a product page and for any future "filter by size"
  feature. Mitigated cheaply by trimming spaces and upper-casing on save, which the backend already does for
  one purpose and should do for both.

**Option B — a curated list extended with numeric sizes.** Keep the dropdown; add numbers (28–46) and a set
of cm ranges.

- Cleaner data, no typos, easy to filter on later.
- **But:** every size shape that doesn't exist in the list needs a developer and a release. Footwear, kids'
  ages, bust–waist–hip, inches, "one size" — each becomes a ticket.
- It does not actually solve the reported case unless we can list every measurement in advance, and for
  measurement-based sizing (`30-23 cm`) we cannot.
- It leaves the mobile app, Add Variant and the database still accepting anything, so merchants keep getting
  different answers on different screens. That inconsistency is precisely how this bug reached production
  unnoticed.

### 7.3 Recommendation

**Option A**, keeping the suggestion list. The risk is close to zero because the database and four of six
entry points already work this way; only the web UI relaxes.

If size filtering or size-based analytics becomes a priority later, the right fix is normalising on save and
in reporting — not restricting what merchants may sell.

### 7.4 Not part of this decision

Two items in this report are defects, not product choices, and should be fixed under either option:

1. **Edit Product silently rewrites existing numeric sizes** (§3). A merchant editing a price loses their
   sizes, with no warning. This is data loss and it is happening now.
2. **Backend `productCode` collision leaves half-created products** (§4). The merchant sees an unexplained
   failure and cannot retry.


---

## 8. What shipped (2026-11-22)

Option A approved: **free text, with a size-type selector so the dropdown convenience is kept**, plus
normalisation on save. Two commits — `FF_api_web` and `MerchantModule`.

### 8.1 Backend (`FF_api_web`)

| File | Change |
|---|---|
| `Backend/src/helperFns/sizeNormalizer.js` | **new.** `normalizeSize` (strip all whitespace, upper-case), `isValidSize` (shape check, not a vocabulary), `MAX_SIZE_LENGTH`. The one place a size is normalised. |
| `Backend/src/helperFns/sizeNormalizer.test.js` | **new.** 5 tests, `node --test`, zero dependencies. |
| `Backend/src/models/productFlat.model.js` | `size` gets `set: normalizeSize`. |
| `Backend/src/controllers/merchantController/product.controllers.js` | `createProductFull`: normalise and validate every size **before** any write, upload or brand auto-create; reject duplicates and unusable shapes with a message naming the colour; replace the per-size `save()` loop with one `insertMany` that is rolled back on failure; return **409** with an explanation on a uniqueness collision instead of a bare 500. |
| `Backend/src/utils/validators/product.validator.js` | the dead `size` enum (`XS…XXL`) replaced by a shape pattern. It never ran, but it was the same rule that broke the web form, and the next person to wire it up would have re-introduced the bug. |
| `Backend/package.json` | `npm test` → `node --test "src/**/*.test.js"`. |

**Why the setter on the model and not in the controller:** there are **nine** places that create a
`ProductFlat` (merchant web, merchant app, bulk CSV, admin, warehouse, Telegram bot, three variant paths),
each with its own hand-rolled `cleanSize`. One of them stored the whitespace-stripped value and the rest
stored it raw — which is how the stored `size` and the `productCode` built from it came to disagree. A setter
on the field covers all nine without any of them having to remember, and it is the smallest diff that
actually closes the bug class. The guard `typeof value === "string"` matters: Mongoose runs setters on query
filters too, and the customer-facing size filter passes `RegExp` values
(`userControllers/product.controllers.js:1065`).

**Side effect to know about:** sizes are now stored upper-cased with internal spaces removed, so
`30-23 cm` is stored as `30-23CM`. The customer size filter is a case-insensitive regex, so browse is
unaffected. Existing rows are untouched — see §5.4.

### 8.2 Merchant web (`MerchantModule`)

| File | Change |
|---|---|
| `src/utils/size.ts` | **new.** Mirrors the backend normaliser, plus the vocabularies (`LETTER_SIZES`, `NUMERIC_SIZES` = 28–36) and `deriveSizeMode`. |
| `src/utils/size.test.ts` | **new.** 11 Vitest tests, including the data-loss guard. |
| `src/components/Products/SizeField.tsx` | **new.** `SizeModeSelector` (per product) and `SizeField` (per row). |
| `src/pages/products/AddNewProduct.tsx` | the hardcoded `<select>` → `<SizeField>`; size-type selector in the section header; mode derived when sizes are copied from a catalog or base product. |
| `src/pages/products/EditProductPage.tsx` | same, with the mode derived from the sizes the product already has. |
| `src/pages/products/BulkUploadProducts.tsx` | `VALID_SIZES` hard reject → `isValidSize` shape check; the preview grid now shows the common sizes **plus whatever the CSV actually supplied**, so a numeric size is visible and editable instead of silently absent; CSV template header is `Size (e.g. M, 32, 30-23 cm)` (the old header is still accepted on import). |
| `package.json` | `npm test` → `vitest run`; `npm run test:watch`. |

**How the merchant sees it.** One "Size type" selector above the size rows:

- **Lettered (S, M, XL)** — `FS XS S M L XL XXL FREE`, the previous behaviour.
- **Numerical (28–36)** — the usual Indian waist/bust run.
- **Custom / other** — a free text box: `30-23 cm`, `28-29`, `UK 8`, `7.5 inch`.

**The data-loss fix falls out of the design, not a special case.** A row whose current value is not in the
chosen dropdown *always* renders as a text box. So a product carrying `30-23CM` from the merchant app opens
in Custom mode showing its real value, and even if the merchant switches the selector to Lettered, that row
stays a text box. There is no state in which the form displays a size it would not save back.

### 8.3 Verification

**Static checks**

| Check | Result |
|---|---|
| `MerchantModule`: `npx tsc -b --noEmit` | clean |
| `MerchantModule`: `npm run build` | clean |
| `MerchantModule`: `npx eslint` on the five touched files | 64 errors, all pre-existing `no-explicit-any`; **identical counts to `HEAD`** (29/27/8), and 0 in the two new files |
| `MerchantModule`: `npm test` | 14 passed |
| `FF_api_web/Backend`: `npm test` | 5 passed |

**Flow walk (`/verify`), 2026-11-22.** Run against the real backend and the real merchant UI, on a
**local** MongoDB (`127.0.0.1:27018/ff_verify`) seeded with a merchant, a category and one product carrying
the raw legacy size `30-23 cm`. The Atlas URI in `Backend/.env` was overridden on the command line and never
connected to. No Cloudinary writes (image bytes were stripped from the request in the browser, so the forms
submitted for real with an empty image array).

| Flow | Route | Result |
|---|---|---|
| **M-SIZE-1** lettered `M` | API | ✅ stored `M` |
| **M-SIZE-2** numerical `32` | **merchant web, full form** | ✅ stored `32`, `productCode` ends `-32` |
| **M-SIZE-3** custom `30-23 cm` | **merchant web, full form** | ✅ stored `30-23CM`; the field normalised to `30-23CM` on blur |
| **M-SIZE-4** `30-23 cm` + `30-23cm` in one product | API | ✅ 400 with the duplicate message, **0 rows created** — the half-created product is gone |
| **M-SIZE-5** edit the legacy app product | **merchant web** | ✅ opened in Custom showing `30-23 cm`; price 999 → 949; **size survived** as `30-23CM` |
| **M-SIZE-6** CSV with `M`, `32`, `30-23 cm` | **merchant web** | ✅ parsed, **All Valid**, all three in the preview grid with editable stock — then blocked by an unrelated backend bug, §9 |
| extra: `M; DROP TABLE`, blank size | API | ✅ 400, 0 rows |
| extra: stored `size` equals the `productCode` token, every new row | DB | ✅ true |

**The walk found a defect the tests did not.** Switching Size type to *Numerical* turned every row into a
text box pre-filled with `FS`, `S`, `M` — the "never hide a value" rule firing on a deliberate mode change.
Data-safe, but plainly wrong: the merchant asked for a 28-36 dropdown. Fixed with `sizeFitsMode`: an
explicit mode change clears values the new dropdown cannot show, while values arriving from the server still
fall back to free text. That is the distinction that matters, and it is now three tests.

---

## 9. Unrelated bugs this walk exposed

Neither is caused by the size change. Both were found while verifying it, and are recorded here rather than
fixed, per `AGENTS.md`: *note them, finish the task, and raise them.*

### 9.1 🔴 CSV bulk upload is completely broken, for every merchant

[`product.controllers.js:2228`](../../Backend/src/controllers/merchantController/product.controllers.js#L2228)
— `bulkUploadProducts` ends with:

```js
const product = new Product({ ...,  variants });
await product.save();
```

`Product` is **not imported in this file and does not exist**. Every CSV import fails with
`{"success":false,"message":"Failed to upload any products","errors":[{"error":"Product is not defined"}]}`.

Verified unrelated to sizes with a control request carrying only the letter size `M` — identical failure.

It is not a typo fix. `new Product({ variants: [...] })` is the **old nested-variant schema**; the
database is flat (`ProductFlat`, one document per colour × size with its own `productCode`). The block has to
be rewritten the way `createProductFull` does it. The client is fine — it builds and sends a correct payload.

### 9.2 🟡 React key warning in the bulk upload preview

[`BulkUploadProducts.tsx:688`](../../../MerchantModule/src/pages/products/BulkUploadProducts.tsx#L688) —
`parsedProducts.map` returns a bare `<>` fragment with the `key` on the inner `<tr>`, so the list child has
no key. Cosmetic, present on `HEAD` before this change, but it is console noise that will mask a real warning
during the next `/verify`. Fix: `<React.Fragment key={idx}>`.
