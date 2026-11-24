# Backend/src/services/

Cross-cutting services. No HTTP awareness — they take data and do a thing. Controllers and helpers call them.

| File | What | Notes |
|---|---|---|
| `offerEngine.js` | **evaluates which offers/coupons apply and computes discounts.** 612 lines, the largest file here | see below |
| `mail.service.js` | transactional email | Resend + Nodemailer |
| `storage.service.js` | image upload | Cloudinary |
| `telegramBot.service.js` | catalogue bot + order alerts | **initialises in-process** from `index.js` |
| `whatsapp.service.js` | order alerts via Baileys | **in-process**; needs QR pairing (`npm run whatsapp:connect`) |
| `geminiProductAnalyzer.js` | AI-assisted product attribute extraction | `@google/genai` |

## `offerEngine.js`

Exports: `isFirstTimeUser`, `getUserOfferUsage`, `calculateDiscount`, `isItemApplicable`,
`validateOfferEligibility`, `getApplicableAmount`, `findBestOffers`, `getAvailableOffersForUser`,
`validateCouponCode`, `recordOfferUsage`.

```js
findBestOffers(userId, cartContext, couponCode = null, selectedOffers = [], orderType = null)
// → { appliedOffers, availableOffers, totalDiscount, freeDelivery, freeReturn, freeWaiting }
```

`calculateDiscount`, `isItemApplicable` and `getApplicableAmount` are **pure** — ideal unit tests, and they
decide every discount in the product.

### Gotchas — read before touching this file

This is the most defect-dense file in the codebase.
[reports/coupons-and-offers.md](../../../reports/coupons-and-offers.md) documents 25 findings. The ones that
will surprise you:

- **`selectedOffers` is applied without policy enforcement.** Every offer in the array wins if it is
  stackable. A crafted request reaches a 100%-discounted order. **B3.**
- **`isItemApplicable` ORs restriction types.** An offer limited to `categoryIds: [Shirts]` *and*
  `genders: ['WOMEN']` matches a men's shirt — the category check short-circuits. **B8.**
- **`validateCouponCode` does not check whether the offer is actually a coupon.** Any offer with a
  `couponCode` validates. **B9.**
- **The free-delivery cascade is re-applied at read** (`allowFreeReturn`, `allowFreeWaiting`), overriding
  what was stored — which is why granular admin control is currently impossible to express. **§8.**
- **`totalValue` (used for ranking) is inflated** — it adds the return charge even when nothing is returned,
  plus a hardcoded ₹20 for free waiting. So "best offer" can pick the worse one. **C2.**
- **`recordOfferUsage` is not idempotent and increments non-atomically.** **B4/B6.**
- **`[OFFER_DEBUG]` logs the full cart on every call**, unconditionally, in production. **B10.**
- `import fs from 'fs'` is dead. **B12.**

**`availableOffers` is returned but the customer app's API client type drops it**, so the "choose a different
offer" feature is ~80% built and 0% exposed. §6 of the report.
