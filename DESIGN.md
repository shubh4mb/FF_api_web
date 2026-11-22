# FF_api_web: design

_Last Updated: 2026-11-21 (first full design document; describes the `dev2` branch as it is)_

Read [PRODUCT.md](PRODUCT.md) for what FlashFits is, and
[docs/ecosystem/README.md](docs/ecosystem/README.md) for the facts that span repos (IST, money, vocabulary,
the order lifecycle). Naming conventions are in
[docs/ecosystem/PRINCIPLES.md](docs/ecosystem/PRINCIPLES.md).

**This document describes the code as it is, including where it departs from its own intended shape.**
§7 is the honest list. An aspirational design document teaches an agent a structure that does not exist, and
it will write code to match the fiction.

---

## 1. Architecture

```
 customer app      rider app       merchant web/app      admin panel
 (Expo)            (Expo)          (Vite / Expo)         (Vite, in this repo)
     │                 │                  │                   │
     │   REST /api/*   +   Socket.IO (role in handshake query) │
     └────────┬────────┴──────────┬───────┴─────────┬──────────┘
              ▼                   ▼                 ▼
 ┌──────────────────────── Backend (Node 18+, single instance) ───────────────────┐
 │  index.js   db · payoutCron · TelegramBot · WhatsApp · Socket.IO · listen      │
 │     │                                                                          │
 │  src/app.js  express 5 ─ helmet, cors(allowedOrigins), rate-limit, swagger     │
 │     │                                                                          │
 │  routes/ ──► controllers/<role>/ ──► helperFns/ + services/ ──► models/        │
 │                                           │                        │           │
 │                                     offerEngine                 mongoose       │
 │                                     orderSettlement                │           │
 │                                     calculateFinalBilling          ▼           │
 │                                     weeklyPayoutHelper        MongoDB Atlas    │
 │                                     incentiveEngine                            │
 │     │                                                                          │
 │  sockets/<role>.socket.js ──► rooms: order: merchant: rider: warehouse: admin  │
 │  cron/payoutCron.js  ──► weekly settlement (IST, appConfig.payoutDay)          │
 └────────────────────────────────────────────────────────────────────────────────┘
         │              │              │            │             │
     Razorpay      Cloudinary      Expo Push    Redis(Upstash)  Gemini
                                                 Telegram · WhatsApp (Baileys) · Resend/Nodemailer
```

**Stack:** Node 18+ (ESM, `"type": "module"`), Express 5, Mongoose 8 on MongoDB Atlas, Socket.IO 4,
Redis via `@upstash/redis` + `redis`, `node-cron`, Joi + express-validator, JWT + bcrypt, Pino,
swagger-jsdoc. Admin panel: Vite 6, React 19, MUI 7, Tailwind 4, Recharts, React Router 7, Leaflet.

**No build step for the backend.** It runs the source directly; there is no TypeScript, no transpile.

---

## 2. Layering, and where it actually holds

The intended shape:

```
route  →  controller  →  helperFn / service  →  model
(wiring)  (translate)     (the rules)           (persistence)
```

| Layer | Should | Actually does |
|---|---|---|
| `routes/` | wire paths to controllers, attach middleware | **four route files hold business logic inline** — `user.routes.js` 713 lines, `merchant.routes.js` 539, `deliveryRider.routes.js` 476, `admin.routes.js` 472. The rider and merchant earnings endpoints are written as inline handlers. |
| `controllers/` | translate HTTP ↔ domain, no rules | mostly holds, but the offer-recalculation logic in `userControllers/order.controllers.js` is domain logic living in a controller — and duplicated three times |
| `helperFns/` | the rules | **this is where the real business logic lives.** 21 files. `calculateFinalBilling`, `orderSettlement`, `weeklyPayoutHelper`, `incentiveEngine`, `deliveryChargeFns`, `orderFns` are the load-bearing ones |
| `services/` | cross-cutting, no HTTP awareness | holds. `offerEngine.js` is the largest at 612 lines |
| `models/` | schema + indexes | holds. 43 models |

**Where to put new logic:** a domain rule goes in `helperFns/` or `services/`. A controller calls it. A route
wires the controller. **If you are writing an `if` in a route file, it is in the wrong place.**

### The functions that own a fact

These are the single sources of truth. Do not recompute what they produce.

| Fact | Owner |
|---|---|
| What a customer pays | `helperFns/calculateFinalBilling.js` |
| Who bears a discount, and what each party is paid | `helperFns/orderSettlement.js` |
| When an IST day or week starts | `helperFns/weeklyPayoutHelper.js` |
| Which offers apply, and the discount | `services/offerEngine.js` |
| A rider's incentive | `helperFns/incentiveEngine.js` |
| Delivery and return charges | `helperFns/deliveryChargeFns.js` |
| Rates, radii, payout timing, maintenance mode, version gates | `models/appConfig.model.js` (singleton) |

---

## 3. Identity, authorisation, tenancy

**HTTP** — JWT bearer tokens, one middleware per role:

| Middleware | Sets | Used by |
|---|---|---|
| `middleware/jwtAuth.js` | `req.userId` | customer routes |
| `authMiddlewareMerchant` | `req.merchantId` | merchant routes |
| `authMiddlewareRider` | `req.riderId` | rider routes |
| `middleware/adminAuth.middleware.js` | `req.adminId` | admin routes |

Social sign-in: `googleAuth.controllers.js`, `appleAuth.controllers.js`. OTP via `otp.model.js` + Twilio.
CORS from an allowlist in `config/cors.js`. Helmet and `express-rate-limit` are applied in `src/app.js`.

**There is no tenancy model.** Scoping is per-document ownership (`merchantId`, `userId`, `riderId`) applied
in each query. There is no reseller or workspace dimension, and no central enforcement — **every query must
remember to filter**, which is a standing risk rather than a guarantee.

**Socket.IO has no authentication at all.** Rooms are joined from unverified handshake query parameters.
This is finding S1 in [docs/security-findings.md](docs/security-findings.md) and the highest-severity item
in the ecosystem. Do not add a socket handler that trusts `handshake.query`.

---

## 4. Data model

43 Mongoose models. Grouped by what they are for:

| Group | Models |
|---|---|
| **Identity** | `user`, `merchant`, `deliveryRider`, `admin`, `partner`, `otp`, `blacklist` |
| **Catalogue** | `productFlat`, `category`, `brand`, `attribute`, `collection`, `banner`, `title_banners` |
| **Ordering** | `order` (Try & Buy), `courierOrder`, `warehouseOrder`, `pendingOrders` (dispatch queue), `cart`, `courierCart`, `zipCoverOrder` |
| **Fulfilment** | `zone`, `hub`, `warehouse`, `onlineSession`, `returnIssue` |
| **Money** | `transaction`, `wallet`, `dailyPayout`, `weeklyPayout`, `financeEntry`, `riderIncentive` |
| **Promotions** | `offer`, `offerUsage` |
| **Engagement** | `notification`, `review`, `wishlist`, `recentlyViewed`, `supportTicket`, `lead` |
| **System** | `appConfig` (singleton), `auditLog` |

### Shapes worth knowing before you touch money

- **`order` vs `courierOrder` vs `warehouseOrder` are three separate models**, not variants. Logic that must
  handle all three uses a `refPath`/`orderModel` discriminator (see `weeklyPayout.orders[].orderModel`).
- **`productFlat`** is a denormalised product-variant document. `utils/variantAdapter.js` translates between
  shapes. Products carry `styleGroupId` and `productCode` as alternative identities, which is why
  `offerEngine.isItemApplicable` checks several id fields.
- **`weeklyPayout` is polymorphic** — `ownerType` is `merchant` or `rider` — and holds a per-order breakdown
  with `grossAmount`, `commissionRate`, `commissionAmount` and `merchantDiscount`. Everything the earnings
  screens need is already in here.
- **`dailyPayout` exists for riders only.** There is no merchant daily rollup; merchant daily figures are
  aggregated live from `order`.
- **`offer` serves both offers and coupons** through four partly-contradictory flags
  (`requiresCoupon`, `autoApply`, `couponCode`, `isPublic`). See
  [docs/reports/coupons-and-offers.md](docs/reports/coupons-and-offers.md).
- **`collection` doubles as a campaign** — `campaignType`, `theme`, `heroBannerImage`, `schedule`,
  `subCurations`, `attachedCouponCode`.

Per-model detail: [docs/backend/src/models/README.md](docs/backend/src/models/README.md).

---

## 5. Real-time

`Backend/index.js` creates the Socket.IO server and dispatches by `handshake.query.role` to one of
`sockets/{admin,merchant,user,deliveryRider,warehouseOrder,order}.socket.js`.

**Rooms:** `order:{orderId}`, `merchant:{merchantId}`, `rider:{riderId}`, `warehouse:{warehouseId}`,
`admin:orders`.

### The monkey-patched emit

```js
const originalEmit = io.emit.bind(io);
io.emit = function (event, ...args) {
  if (event.startsWith('orderQueued:') || event.startsWith('riderAvailable:') || event.startsWith('riderFreed:')) {
    matchQueuedOrders(event.split(':')[1]).catch(console.error);
  }
  return originalEmit(event, ...args);
};
```

**Rider–order matching is triggered by a string prefix on a socket event name.** There is no compile-time or
test-time link between the emit site and the matcher; a rename silently disables dispatch, and the matcher's
errors go only to `console.error`. This violates "commands are calls, events are notifications" and is
finding S4. Call `matchQueuedOrders()` explicitly instead.

---

## 6. Background work and integrations

| What | Where | Notes |
|---|---|---|
| Weekly payouts | `cron/payoutCron.js` + `helperFns/weeklyPayoutHelper.js` | IST, driven by `appConfig.payoutDay` / `payoutHourIST`. **In-process** — a second instance double-settles. |
| Pending order sweep | `helperFns/orderPendingSweep.js` | reclaims unaccepted orders |
| Rider timeouts | `helperFns/riderTimeoutHelper.js` | the acceptance window |
| Payments | `config/RazorPay.js` | prepaid courier orders, merchant registration fee, trial QR collection |
| Media | `config/cloudinary.config.js`, `services/storage.service.js` | all images |
| Push | `helperFns/notificationHelper.js` | Expo push + Socket.IO. Prunes `DeviceNotRegistered` tokens. |
| Order alerts | `services/telegramBot.service.js`, `services/whatsapp.service.js` | **both init in-process**; WhatsApp is Baileys with a QR pairing step |
| Email | `services/mail.service.js` | Resend + Nodemailer |
| Product AI | `services/geminiProductAnalyzer.js` | assists merchant catalogue entry |
| Geo | `helperFns/geoHelpers.js`, `orsHelper.js`, `zoneInfer.js`, `@turf/turf` | zones, distances, routing |
| Caching / state | `config/redisConfig.js` | merchant online state, session metadata |

---

## 7. Known debt

Ranked by what it costs. Do not fix these opportunistically mid-feature — note them, finish the task, raise
them.

1. **Socket.IO is unauthenticated.** Anyone can connect as `role=admin` and read every order on the platform
   — customer names, phone numbers, addresses, amounts — or impersonate any merchant.
   [docs/security-findings.md](docs/security-findings.md) S1.

2. **The kept-items offer recalculation is duplicated three times and missing from the rider settlement
   path.** `userControllers/order.controllers.js` has the ~90-line block at three places;
   `deliveryRiderController/orderController.js:413` instead reuses the checkout-time discount. On every
   rider-settled partial-keep order the **customer is undercharged and the merchant is overcharged**.
   [docs/reports/coupons-and-offers.md](docs/reports/coupons-and-offers.md) B1/C4. The most expensive single
   bug found.

3. **Single-instance only.** `@socket.io/redis-adapter` is installed but never wired; the payout cron and
   the Telegram and WhatsApp clients initialise in-process. A second instance breaks socket delivery and
   double-runs payouts. S3.

4. **`io.emit` is monkey-patched to drive dispatch** (§5). S4.

5. **Business logic inline in route files** (§2) — four files, 2,200 lines between them.

6. **Offers and coupons share one model with four contradictory flags**, two authoring controllers that
   write different defaults for the same field, a free-delivery cascade implemented four times, and no
   unique index on `couponCode`. Over-redemption and free-order exploits are reachable.
   [docs/reports/coupons-and-offers.md](docs/reports/coupons-and-offers.md).

7. **UTC day boundaries in an IST business.** `merchantController/analytics.controller.js` hardcodes
   `T00:00:00.000Z`, so every daily figure is shifted 5h30m — while a correct helper exists two directories
   away and is unused.
   [docs/reports/earnings-and-payouts.md](docs/reports/earnings-and-payouts.md) §2.1.

8. **No automated tests.** No runner configured, no test files.
   [docs/ecosystem/TESTING.md](docs/ecosystem/TESTING.md).

9. **~35 loose scratch and debug scripts in `Backend/`**, including destructive ones (`clean_database.js`,
   `clear_redis.js`) and a committed `db_backup_prelaunch_20261010/` directory that needs a PII check. S6.

10. **No tenancy enforcement** (§3) — correct scoping depends on every query remembering to filter.

11. **`[OFFER_DEBUG]` logs full cart contents in production** on every cart recalculation. S7.

12. **`controllers/adminController/` and `controllers/adminControllers/`** both exist. Use the plural; fold
    the singular in when touching it.

---

## 8. Open points

Decisions not yet made. Stated so nobody assumes one was.

- **Coupon code reuse.** May a retired code be re-issued? (Recommendation: no — codes get screenshotted and
  shared long after a campaign ends.)
- **Offer condition semantics.** Are `categoryIds` + `genders` on one offer an AND or an OR? The code ORs
  them; the UI implies AND. Live offers were authored against the current behaviour, so this needs a data
  audit before it changes.
- **Excess merchant discount.** When a merchant offer exceeds the merchant's payout, the excess is currently
  clipped and silently absorbed. Absorb and alert, or carry as a debit to the next payout?
- **Merchant daily rollups.** Add a `merchantDailyRollup` table, or keep aggregating live with fixed
  boundaries and a better index?
- **Whether to keep two merchant apps.**
  [docs/reports/merchant-consolidation.md](docs/reports/merchant-consolidation.md).
- **Push provider.** If the merchant app moves to Capacitor, tokens become FCM/APNs while the other apps stay
  on Expo. One `sendPush()` with a provider branch, or migrate everything to FCM?
- **Where the admin panel should live.** It is currently nested at `website/FFmanagement` inside the API repo
  with `"name": "c"` in its `package.json`.
