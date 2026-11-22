# Backend/src/utils/

Small, dependency-light helpers. Business rules do **not** belong here — they go in
[`helperFns/`](../helperFns/README.md).

| File | What |
|---|---|
| `ApiError.js` | the error class the error middleware maps to a response |
| `ApiResponse.js` | the standard success envelope |
| `asyncHandler.js` | wraps an async handler so rejections reach the error middleware |
| `auditLogger.js` | writes `auditLog` entries for admin actions |
| `pdfGenerator.js` | invoices and payout receipts (`pdfkit`) |
| `variantAdapter.js` | translates between product-variant shapes — `productFlat` vs the nested form clients expect |
| `zoneInfer.js` | infers a zone from coordinates (`@turf/turf`) |
| `validators/product.validator.js` | Joi schema for product input |

## Gotchas

- **`variantAdapter.js` exists because products have more than one identity** — `_id`, `styleGroupId`,
  `productCode`, `variantId`, `warehouseProductId`. Anything matching a product against a list (notably
  `offerEngine.isItemApplicable`) has to consider several of them.
- **`validators/` has exactly one validator** for 43 models. Most input validation is ad-hoc inside
  controllers, or absent. Adding a Joi schema for the endpoint you are touching is a cheap improvement and
  supports principle 6.
- `asyncHandler` is not used consistently; some handlers have their own try/catch. Either is fine, but a
  handler with neither will crash the process on a rejection.
