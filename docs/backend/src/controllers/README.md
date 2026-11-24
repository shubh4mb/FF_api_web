# Backend/src/controllers/

Request handlers, grouped by caller role. A controller translates HTTP ↔ domain and delegates to
`helperFns/` or `services/`. It should hold no business rules.

| Group | Files | Covers |
|---|---|---|
| `userControllers/` | 18 | auth, address, cart, courierCart, home, product, merchant, collection, offer, order, courierOrder, warehouseOrder, warehouseProduct, review, wishlist, recentlyViewed, banner, referral |
| `merchantController/` | 12 | auth, merchant, product, warehouseProduct, order, warehouseOrder, offer, payment, analytics, operator, returnIssue, zipCover |
| `adminControllers/` | 27 | dashboard, merchant, product, category, brand, attribute, collection, banner, titleBanner, offer, order, finance, payout, transaction, incentive, zone, hub, warehouse, warehouseOrder, warehouseProduct, returnIssue, moderation, notification, auditLog, appConfig, cart, lead |
| `deliveryRiderController/` | 3 | auth, order, session |
| `adminController/` (singular) | 1 | zipCover — **a naming inconsistency**; use the plural folder |
| root | 4 | `auth.controllers.js`, `adminAuth.controllers.js`, `googleAuth.controllers.js`, `appleAuth.controllers.js` |

## Gotchas

- **`userControllers/order.controllers.js` contains the kept-items offer recalculation three times**
  (≈ lines 1140, 1462, 1969) — ~90 lines each, nearly identical. It is domain logic that belongs in
  `helperFns/`, and the fourth place that needs it (`deliveryRiderController/orderController.js`) does not
  have it. This is the active money leak: [B1/B13](../../../reports/coupons-and-offers.md).
- **`adminControllers/offer.controllers.js` and `merchantController/offer.controllers.js` write different
  defaults to the same model field** (`maxUsagePerUser`: `null` vs `1`) and each maintains its own
  allowed-type list. [B15](../../../reports/coupons-and-offers.md).
- **`adminControllers/offer.controllers.js` `updateOffer` mass-assigns `req.body`** and omits
  `runValidators`, so schema enums are unenforced on update. [B16](../../../reports/coupons-and-offers.md).
- **`merchantController/analytics.controller.js` hardcodes UTC day boundaries**
  (`new Date(startDate + "T00:00:00.000Z")`) in an IST business, so every daily figure is shifted 5h30m.
  Use `helperFns/weeklyPayoutHelper.js`. [§2.1](../../../reports/earnings-and-payouts.md).
- **`adminControllers/notification.controllers.js` broadcasts synchronously inside the request**, loading
  every user into memory. It will time out past a few thousand recipients.
  [reports/push-broadcast.md](../../../reports/push-broadcast.md).
- Identity comes from `req.userId` / `req.merchantId` / `req.riderId` / `req.adminId`, set by middleware.
  **Never read it from `req.body` or `req.query`.**
