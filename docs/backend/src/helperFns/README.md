# Backend/src/helperFns/

**The business logic lives here.** 21 files. Controllers call these; these call models. If you need to know
how FlashFits actually works, read this folder, not the routes.

Most of these are **pure functions** — no DB, no network — which makes them the highest-value and cheapest
things in the codebase to test. See [../../../ecosystem/TESTING.md](../../../ecosystem/TESTING.md).

## The ones that own a fact

| File | Owns | Pure? |
|---|---|---|
| `calculateFinalBilling.js` | **what a customer pays.** Kept items, overtime penalty, delivery/return charges, tip, discount → `totalPayable` | ✅ pure |
| `orderSettlement.js` | **who gets paid and who bears a discount.** Commission, merchant payout, admin payout, free-delivery funding | ❌ DB + session |
| `weeklyPayoutHelper.js` | **when an IST day or week starts**, and the weekly settlement | partly |
| `incentiveEngine.js` | rider incentive slabs and daily evaluation | partly |
| `deliveryChargeFns.js` | delivery and return charges from distance and `appConfig` | ✅ mostly |

## The rest

| File | What |
|---|---|
| `orderFns.js` | order creation, the rider matcher (`matchQueuedOrders`) |
| `orderCancellationHelper.js` | cancellation, and refund only where money was actually taken |
| `orderPendingSweep.js` | reclaims orders a merchant never accepted |
| `riderTimeoutHelper.js` | the rider acceptance window |
| `deliveryRiderFns.js` | rider state, availability |
| `onlineSessionHelper.js` | rider online sessions, login hours (08:00–23:00 IST window) |
| `merchantFns.js` | merchant metadata in Redis, online state |
| `walletHelper.js`, `transactionHelper.js` | wallet balances and the ledger |
| `notificationHelper.js` | in-app notification + Expo push, with dead-token pruning |
| `geoHelpers.js`, `orsHelper.js` | distances, routing |
| `categoryHelper.js`, `searchHelper.js` | catalogue lookups and search |
| `referralHelper.js` | referral rewards |
| `testModeHelper.js` | the `appConfig.isTestingMode` single-merchant restriction |

## Contracts worth knowing

### `calculateFinalBilling({ orderItems, deliveryCharge, returnCharge, deliveryTip, trialPhaseStart, trialPhaseEnd, discountToApply, freeWaiting, freeDelivery, freeReturn })`

Returns `{ baseAmount, overtimePenalty, deliveryCharge, returnCharge, effectiveReturnCharge, deliveryTip,
returnChargeDeduction, totalPayable, itemsAccepted, itemsReturned, allItemsKept, isWaitingFree,
isDeliveryFree, isReturnFree }`.

- `baseAmount` counts only items with `tryStatus` of `accepted` / `keep` / `not-triable`, excluding
  `out_of_stock`.
- Overtime is ₹2/min beyond 10 minutes — **hardcoded here**, while the rate also lives in
  `appConfig.waitingChargePerMinute`. Known DRY violation.
- `totalPayable` floors at 0.
- **`discountToApply` must already be recomputed against kept items.** This function does not do that for
  you, and the rider settlement path currently passes the stale checkout value — see
  [B1](../../../reports/coupons-and-offers.md).

### `orderSettlement.js`

Attribution is correct in principle: `offer.scope === 'merchant'` reduces the merchant's payout,
`'admin'` reduces FlashFits' commission. Three known leaks (excess discount silently absorbed; stacked free
delivery charged to the merchant; waiting charge always charged to FlashFits) are documented in
[reports/coupons-and-offers.md §7](../../../reports/coupons-and-offers.md).

### `weeklyPayoutHelper.js`

```js
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export function getDayStartIST(date = null) { … }   // returns the UTC instant of IST midnight
export function getWeekBounds(date) { … }           // Monday 00:00 IST → Sunday 23:59:59.999 IST, in UTC
```

**This is the single source for business-day arithmetic.** It is correct. It is also under-used —
`analytics.controller.js` re-implements day boundaries in UTC and gets them wrong. Import from here.

## Gotchas

- **Four call sites close out an order** and each must recompute offers identically. Three do;
  the rider path does not. Before changing anything billing-related,
  `grep -rn "calculateFinalBilling" --include=*.js Backend/src` and check every caller.
- **`orderFns.matchQueuedOrders(zoneId)` is invoked by a monkey-patched `io.emit`** in `index.js`, not by a
  normal call. Renaming an event prefix silently disables dispatch.
- **`onlineSessionHelper` hardcodes an 08:00–23:00 IST window** for login-hour credit.
- Several of these take a mongoose `session` and must be called inside the caller's transaction.
