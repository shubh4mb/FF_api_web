# The FlashFits ecosystem

**Last Updated:** 2026-11-21

Five repositories, one product. This folder holds the facts that span more than one of them. Anything true of
only one repo belongs in that repo's own `PRODUCT.md` / `DESIGN.md` / `docs/`.

`FF_api_web` is the **hub repo**: it owns the API, the admin panel, and these cross-repo documents. When a
rule here and a rule in an app repo disagree, this one wins — fix the other in the same change.

---

## The repositories

| Repo | What it is | Stack | Branch |
|---|---|---|---|
| [`FF_api_web`](../..) | Backend API + real-time engine + admin panel (`website/FFmanagement`) | Node 18+, Express 5, MongoDB/Mongoose, Socket.IO, Redis · admin: Vite + React 19 | `dev2` |
| [`FlashFitsv2`](../../../FlashFitsv2) | Customer app | Expo SDK 54, expo-router, NativeWind, TypeScript | `production` |
| [`FlashFits-Delivery-App`](../../../FlashFits-Delivery-App) | Delivery partner (rider) app | Expo SDK 54, expo-router, background location | `main` |
| [`MerchantModule`](../../../MerchantModule) | Merchant web dashboard | Vite + React 19 + TypeScript | `main` |
| [`MerchantApp`](../../../MerchantApp) | Merchant mobile app | Expo SDK 54 | `main` |

> **In flux:** `MerchantApp` and `MerchantModule` are candidates for consolidation into a single
> Capacitor/PWA build. See [reports/merchant-consolidation.md](../reports/merchant-consolidation.md). Until
> that decision is made, treat **`MerchantModule` as the primary** merchant surface and do not add features
> to `MerchantApp` that `MerchantModule` lacks.

**There is no shared package.** Every client talks to the API over REST + Socket.IO and duplicates its own
types, API client and helpers. That is a known cost, accepted for now; it is the reason a contract change
means five edits. If a third client needs the same helper, that is the signal to extract one.

---

## Cross-repo standards

| Document | What it governs |
|---|---|
| [DOCUMENTATION-STANDARD.md](DOCUMENTATION-STANDARD.md) | What docs every repo must have, where they live, and the AI-agent file convention |
| [PRINCIPLES.md](PRINCIPLES.md) | The non-negotiable engineering rules, and the git hooks that enforce them |
| [TESTING.md](TESTING.md) | Test stack and expectations per repo; mandatory for new work, gradual for existing |
| [VERIFY.md](VERIFY.md) | The post-build verification protocol — real user flows, after the tests pass |

## Analysis reports

Point-in-time investigations. Each states what was read, what was found, and what is recommended. None of
them has been acted on.

| Report | Subject |
|---|---|
| [merchant-consolidation.md](../reports/merchant-consolidation.md) | Collapsing the two merchant apps into one Capacitor/PWA build; store identity and signing |
| [coupons-and-offers.md](../reports/coupons-and-offers.md) | Coupon vs offer semantics, 25 bugs, best-offer selection, discount attribution |
| [earnings-and-payouts.md](../reports/earnings-and-payouts.md) | Merchant and rider earnings visibility, filters, the IST/UTC bug |
| [server-driven-campaigns.md](../reports/server-driven-campaigns.md) | Changing app sections and themes from the admin panel without a release |
| [push-broadcast.md](../reports/push-broadcast.md) | Broadcast and event-driven notifications |
| [numeric-size-variants-bug.md](../reports/numeric-size-variants-bug.md) | Numeric size variants (e.g. "30-23 cm") blocked on the merchant web app |
| [../security-findings.md](../security-findings.md) | **Read this one first.** Unauthenticated Socket.IO access, offer exploits |

---

## Facts that span repos

### Shared vocabulary

Defined once, here. Use these words in code, UI and documents; the alternatives in the last column are
banned because they already mean something else somewhere in the system.

| Word | Means | Never call it |
|---|---|---|
| **Try & Buy** | Local order, ₹0 upfront, 30-minute doorstep trial, pay for kept items after | local order, trial order, COD order |
| **Courier order** | Prepaid, standard shipping, 3-day return window. Separate model (`courierOrder`) | shipping order, remote order |
| **Trial phase** | The window between OTP verification and the customer's keep/return selection | try phase (DB value `try_phase` only), fitting |
| **Keep / Return** | What the customer decides per item during the trial. DB `tryStatus` | accept/reject, select |
| **Merchant** | A partner store or a warehouse operator. One model, `accountType` distinguishes them | vendor, seller, partner (a `partner` model exists and is something else) |
| **Delivery partner** / **rider** | The person delivering. DB `deliveryRider` | driver, agent |
| **Offer** | A discount that **applies automatically** when the cart qualifies | — |
| **Coupon** | A discount the customer applies **with a code** | voucher, promo (and never "offer") |
| **Zip cover** | The sealed bag items travel in, with a security seal ID | packaging, bag |
| **Zone** | The geographic dispatch unit riders and orders are matched within | area, region |
| **Hub** / **warehouse** | FlashFits-operated stock locations. Distinct models | depot, store (a store is a merchant) |

### Time

**The business runs on IST (Asia/Kolkata, UTC+5:30).** Every calendar day, week boundary, schedule and
report is an IST day. Mongo stores UTC.

The single source for this arithmetic is
[`Backend/src/helperFns/weeklyPayoutHelper.js`](../../Backend/src/helperFns/weeklyPayoutHelper.js) —
`IST_OFFSET_MS`, `nowIST()`, `getWeekBounds()`, `getDayStartIST()`.

**Never write `new Date(dateStr + "T00:00:00.000Z")`.** It is UTC midnight, which is 05:30 IST, and it is
currently wrong in `analytics.controller.js` — see
[earnings-and-payouts.md §2.1](../reports/earnings-and-payouts.md). Import the helper.

Clients send and receive **ISO 8601 UTC** instants, or bare `YYYY-MM-DD` IST calendar dates for date
filters. Never a device-local date string. Period presets (`this_week`, `last_month`) are resolved
**server-side** so three clients cannot disagree with the payout cron.

### Money

- **All amounts are integer rupees** unless a field name says otherwise. `calculateDiscount` is the one place
  that produces 2-decimal values; it rounds before returning.
- **One function owns the final bill:**
  [`helperFns/calculateFinalBilling.js`](../../Backend/src/helperFns/calculateFinalBilling.js). Any screen
  showing a total must show what it returned, never a client-side recomputation.
- **One function owns settlement:**
  [`helperFns/orderSettlement.js`](../../Backend/src/helperFns/orderSettlement.js). It decides who bears a
  discount: a merchant-scoped offer reduces the merchant's payout, an admin-scoped offer reduces FlashFits'
  commission. Neither subsidises the other.
- **Try & Buy means every amount is provisional until the trial ends.** A discount validated against the
  full cart must be recomputed against **kept items** before it is charged or settled. There are currently
  four settlement call sites and one of them does not do this — see
  [coupons-and-offers.md §2/B1](../reports/coupons-and-offers.md).
- Never display a charge for a Try & Buy order before payment is due. If `paymentStatus` is not `paid`,
  `delivery_fee_paid` or `refunded`, the UI shows **₹0 charged**.

### Identity and authorisation

| Caller | HTTP | Socket.IO |
|---|---|---|
| Customer | JWT, `jwtAuth.js` | **currently unauthenticated — see [security-findings.md S1](../security-findings.md)** |
| Merchant | JWT, `authMiddlewareMerchant` | same |
| Rider | JWT, `authMiddlewareRider` | same |
| Admin | JWT, `adminAuth.middleware.js` | same |

**Rule: identity comes from a verified token, never from a request parameter.** The HTTP layer follows this.
The socket layer does not, which is finding S1 — the highest-severity item in the ecosystem. Until it is
fixed, do not add socket handlers that trust `handshake.query`.

### Real-time

Socket.IO rooms: `order:{orderId}`, `merchant:{merchantId}`, `rider:{riderId}`, `warehouse:{warehouseId}`,
`admin:orders`. Registered per role in
[`Backend/src/sockets/`](../../Backend/src/sockets/).

**Deployment constraint: the backend currently runs on exactly one instance.** `@socket.io/redis-adapter` is
installed but not wired, and the payout cron plus the Telegram and WhatsApp clients initialise in-process.
A second instance breaks socket delivery and double-runs payouts. See
[security-findings.md S3](../security-findings.md).

### The order lifecycle

```
placed → accepted → packed → picked_up → in_transit → at_delivery
                                                          │ handshake OTP
                                                          ▼
                                                      try_phase          [30-min trial]
                                                          │ customer selects keep/return
                                                          ▼
                                                    selection_made
                                                          │ payment collected
                                                          ▼
                                                      completed
```

Rejected or cancelled at any point before payment → `cancelled`, with **no charge** for Try & Buy.
Courier orders use `courierOrder` and a different, prepaid lifecycle.

### Config lives in the database

[`appConfig.model.js`](../../Backend/src/models/appConfig.model.js) is a **singleton document** holding
per-km rates, waiting charges, delivery radii, payout day/hour, commission defaults, maintenance mode, the
promo marquee, and per-app force-update version gates. Read it with `AppConfig.getConfig()`.

**Do not hardcode a value that lives here.** Current violations worth knowing about: the ₹2/min overtime rate
is hardcoded in `calculateFinalBilling.js` *and* in the rider order controller while also living in
`appConfig.waitingChargePerMinute`; `offerEngine.js` hardcodes ₹20 for the free-waiting benefit.

---

## Where to start, by task

| Task | Read |
|---|---|
| Anything at all | [../security-findings.md](../security-findings.md), then this file |
| Backend change | `FF_api_web/CLAUDE.md` → `AGENTS.md`, `DESIGN.md`, `docs/backend/README.md` |
| Admin panel change | `FF_api_web/docs/website/README.md` |
| Customer app change | `FlashFitsv2/AGENTS.md`, `DESIGN.md` |
| Rider app change | `FlashFits-Delivery-App/AGENTS.md`, `DESIGN.md` |
| Merchant change | `MerchantModule/AGENTS.md` — **and** [merchant-consolidation.md](../reports/merchant-consolidation.md) before adding anything |
| Money, offers, settlement | [coupons-and-offers.md](../reports/coupons-and-offers.md) + the Money section above |
| Writing tests | [TESTING.md](TESTING.md) |
| Finishing a feature | [VERIFY.md](VERIFY.md) |
