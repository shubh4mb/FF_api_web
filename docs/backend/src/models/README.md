# Backend/src/models/

43 Mongoose models. Naming: `<entity>.model.js`, singular; model name `PascalCase`; collection pluralised by
Mongoose.

Conventions: dates end `At`, booleans start `is`/`has`/`requires`, money is **integer rupees**, status
strings are `snake_case`, domain enums are `SCREAMING_SNAKE`.

## By purpose

| Group | Models |
|---|---|
| **Identity** | `user`, `merchant`, `deliveryRider`, `admin`, `partner`, `otp`, `blacklist` |
| **Catalogue** | `productFlat`, `category`, `brand`, `attribute`, `collection`, `banner`, `title_banners` |
| **Ordering** | `order`, `courierOrder`, `warehouseOrder`, `pendingOrders`, `cart`, `courierCart`, `zipCoverOrder` |
| **Fulfilment** | `zone`, `hub`, `warehouse`, `onlineSession`, `returnIssue` |
| **Money** | `transaction`, `wallet`, `dailyPayout`, `weeklyPayout`, `financeEntry`, `riderIncentive` |
| **Promotions** | `offer`, `offerUsage` |
| **Engagement** | `notification`, `review`, `wishlist`, `recentlyViewed`, `supportTicket`, `lead` |
| **System** | `appConfig`, `auditLog` |

## The ones with surprises

### `appConfig.model.js` — a singleton

Read with `AppConfig.getConfig()` (creates it on first call). Holds per-km rates, waiting charges, delivery
radii, payout day/hour, the merchant registration fee, warehouse commission default, **maintenance mode**
(`isOrderPlacementEnabled` defaults to **false**), **testing mode** (restricts the customer app to one
merchant), the promo marquee (`promoAnnouncements`), and per-app force-update version gates.

**Do not hardcode anything that lives here.** Known violations: the ₹2/min overtime rate and `offerEngine`'s
₹20 free-waiting estimate.

Known bug: `merchantAppVersion.storeUrlIos` points at `com.flashfits.merchant`, not the merchant app's actual
bundle ID. `merchantAppVersion.storeUrl` defaults to a GitHub APK URL.

### `order` / `courierOrder` / `warehouseOrder` — three separate models

Not variants. Code handling all three uses a `refPath` discriminator (`orderModel`). `order` is the Try & Buy
model and carries `items[].tryStatus`, `trialPhaseStart`/`End`, `appliedOffers[]`, `finalBilling{}`,
`deliveryFeeRecovery{}`, and the OTPs.

**`finalBilling.discount` currently conflates the offer discount with the return-charge deduction**, and the
rider path reads it back as a discount — a double-deduction. [B2](../../../reports/coupons-and-offers.md).

### `offer.model.js` — serves both offers and coupons

One model, four partly-contradictory flags: `requiresCoupon`, `autoApply`, `couponCode`, `isPublic`.
`requiresCoupon` and `autoApply` encode the same decision with opposite polarity and the engine ORs them.

- `maxUsagePerUser` defaults to **1** — correct for a coupon, silently fatal for an auto-applying offer. The
  admin controller overrides it to `null` and the merchant controller to `1`, so the same field means
  different things depending on who created the row. **B7/B15.**
- `couponCode` has a **sparse, not unique** index; uniqueness is only checked among active offers.
  **B14.**

Target model: one `kind: 'OFFER' | 'COUPON'` discriminator. See
[reports/coupons-and-offers.md §1](../../../reports/coupons-and-offers.md).

### `weeklyPayout.model.js` — polymorphic, and richer than the UI shows

`ownerType` is `merchant` or `rider`. Holds `weekStart`/`weekEnd`, `status`, `totalGrossSales`,
`totalCommission`, `totalEarnings`, `totalDeductions`, `adminDeduction{amount,reason}`, `netPayout`,
`totalIncentive`, `finalAmount`, payment proof (`referenceNumber`, `receipt`, `transactionId`, `paidAt`), and
`orders[]` with per-order `grossAmount`, `commissionRate`, `commissionAmount`, **`merchantDiscount`**.

**Everything the earnings screens need is already stored here** — it is just not surfaced. See
[reports/earnings-and-payouts.md](../../../reports/earnings-and-payouts.md).

### `dailyPayout.model.js` — riders only

One row per rider per day: `date` (IST start of day), `completedOrders`, `totalEarnings`, `loginHours`,
`loginWindows[]`, `incentivesEarned[]`, `dailyIncentiveProcessed` (an idempotency flag).

**There is no merchant equivalent** — merchant daily figures are aggregated live from `order`, which is why
merchant date filtering is both slower and the place the IST bug bites.

### `collection.model.js` — doubles as a campaign

`campaignType` (festival/seasonal/flash_drop/curated), `theme{primaryColor, secondaryColor, bgGradientStart,
bgGradientEnd, textColor, presetName}`, `bannerImage`, `heroBannerImage`, `schedule{isScheduled, startDate,
endDate}`, `subCurations[]`, `attachedCouponCode`, `priority`, auto-generated `slug`.

This is ~70% of a server-driven campaign system already shipped.
[reports/server-driven-campaigns.md](../../../reports/server-driven-campaigns.md).

### `productFlat.model.js`

A denormalised product-variant document. `utils/variantAdapter.js` translates shapes. Products carry
`styleGroupId` and `productCode` as alternative identities, which is why `offerEngine.isItemApplicable`
checks several id fields.

### `banner.model.js` / `title_banners.model.js`

Fixed layout slots (`home_hero`, `home_middle`, `explore_hero`, …) with `ratio`, `actionUrl`, `order`.
Content is server-driven; **placement is not** — adding a slot needs an app release.

### `notification.model.js`

Polymorphic (`userId` | `riderId` | `merchantId`), a 28-value `type` enum, and a `data` blob for deep
linking. The admin broadcast path writes `data: {}`, so broadcast notifications have no deep link.
[reports/push-broadcast.md](../../../reports/push-broadcast.md) P3.

## Gotchas

- **There is no tenancy enforcement.** Scoping is per-document ownership applied in each query. Every query
  must remember to filter — nothing enforces it centrally.
- `findByIdAndUpdate` **does not run validators** unless you pass `runValidators: true`. `updateOffer` omits
  it, so every enum on `offer` is unenforced on update. **B16.**
- Several models are written inside transactions; pass the `session` through.
