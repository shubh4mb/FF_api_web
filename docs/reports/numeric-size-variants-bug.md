# Bug report: merchants cannot add numeric size variants (e.g. "30-23 cm")

**Last Updated:** 2026-11-22
**Status:** diagnosed, **not fixed**. The fix is a product decision — see §5.
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
