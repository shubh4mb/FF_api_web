# Report: earnings & payment visibility for merchants and delivery partners

**Last Updated:** 2026-11-21
**Status:** findings + recommendation. Nothing has been changed.
**Goal:** merchants and riders should be able to see every useful detail about their earnings — per week, per
day, with standard and custom filters.

**Short answer:** the data model already supports almost all of this. For riders, `DailyPayout` is a
per-rider-per-day rollup that nothing currently exposes beyond "today" and "yesterday". The work is mostly
**one new read endpoint per role plus one filter UI**, not new storage. Before any of it, fix the timezone
bug in §2.1 — every daily figure a merchant sees today is computed on UTC day boundaries while the business
runs on IST.

---

## 1. What exists today

### Storage (the good news)

| Model | Grain | Key fields |
|---|---|---|
| [`dailyPayout.model.js`](../../Backend/src/models/dailyPayout.model.js) | **one row per rider per day** | `date` (start of day IST), `completedOrders`, `cancelledOrders`, `totalEarnings`, `loginHours`, `loginWindows[]`, `incentivesEarned[]`, `totalIncentive`, `weeklyPayoutId` |
| [`weeklyPayout.model.js`](../../Backend/src/models/weeklyPayout.model.js) | **one row per owner per week**, polymorphic (`ownerType` rider \| merchant) | `weekStart`/`weekEnd`, `status`, `totalGrossSales`, `totalCommission`, `totalEarnings`, `totalDeductions`, `adminDeduction{amount,reason}`, `netPayout`, `totalIncentive`, `finalAmount`, `orders[]`, `receipt`, `referenceNumber`, `paymentMethod`, `transactionId`, `paidAt` |
| `orders[]` entry inside a weekly payout | **per order** | `orderId`, `orderModel`, `amount`, `type` (credit/debit), `grossAmount`, `commissionRate`, `commissionAmount`, `merchantDiscount`, `settledAt` |
| [`transaction.model.js`](../../Backend/src/models/transaction.model.js) | ledger | manual payouts, `damage_compensation`, `adjustment` |
| [`riderIncentive.model.js`](../../Backend/src/models/riderIncentive.model.js) | incentive programmes + slabs | |

**The per-order breakdown already carries gross, commission rate, commission amount and merchant discount.**
That is everything needed for a "where did my money go" view. It is simply not surfaced.

### Endpoints

**Rider** — [routes/deliveryRider.routes.js](../../Backend/src/routes/deliveryRider.routes.js):

| Endpoint | Returns |
|---|---|
| `GET /deliveryRider/earnings/today` | today's `DailyPayout` (+ live estimated incentives) |
| `GET /deliveryRider/earnings/yesterday` | yesterday's `DailyPayout` |
| `GET /deliveryRider/earnings/current-week` | current `WeeklyPayout` + daily breakdown |
| `GET /deliveryRider/earnings/history?page&limit` | past weekly payouts + ledger transactions, paginated |
| `GET /deliveryRider/incentives` | active programmes + progress |
| `GET /deliveryRider/wallet` | balance + recent transactions |

**Merchant** — [routes/merchant.routes.js](../../Backend/src/routes/merchant.routes.js):

| Endpoint | Returns |
|---|---|
| `GET /merchant/earnings/current-week` | current `WeeklyPayout` + computed gross/commission |
| `GET /merchant/earnings/history?page&limit` | past weekly payouts + ledger transactions |
| `GET /merchant/analytics?startDate&endDate` | **the only custom-range endpoint in the system** — aggregates Orders directly, returns a `dailyTrend` |

### Screens

| App | Screen | What it shows | Filters |
|---|---|---|---|
| Rider | [`app/(home)/Earnings.tsx`](../../../FlashFits-Delivery-App/app/%28home%29/Earnings.tsx) (420 lines) | current week, 7-day breakdown, expandable weekly history, incentives | **none** |
| Rider | `app/(orderFlow)/EarningsSummary.tsx` | per-trip summary | n/a |
| Merchant | [`pages/Revenue.tsx`](../../../MerchantModule/src/pages/Revenue.tsx) (989 lines) | wallet balance, week picker, analytics for the chosen week, payout log with UTR copy, gross/commission split | **week picker only** |
| Merchant | `MerchantApp/src/app/(tabs)/revenue.tsx` + `payouts.tsx` | mobile equivalents | none |

---

## 2. Problems to fix before adding features

### 🔴 2.1 Merchant analytics uses UTC day boundaries in an IST business

[controllers/merchantController/analytics.controller.js:11-14](../../Backend/src/controllers/merchantController/analytics.controller.js#L11):

```js
const { startDate, endDate } = req.query;
if (startDate && endDate) {
    createdAt: {
        $gte: new Date(startDate + "T00:00:00.000Z"),   // ← UTC midnight
        $lte: new Date(endDate   + "T23:59:59.999Z")
    }
}
```

IST is UTC+5:30, so "2026-11-21" here means **21 Nov 05:30 IST → 22 Nov 05:29 IST**.

**Failure scenario:** a merchant takes orders until 23:00 IST. Every order between 00:00 and 05:30 IST is
counted in the *previous* calendar day. A merchant checking "today's revenue" at 2am sees yesterday's number
plus tonight's orders, and the daily trend chart is shifted by a fifth of a day. Totals over a long range are
right; every daily figure is wrong.

**The fix already exists in the repo and is not being used.**
[helperFns/weeklyPayoutHelper.js](../../Backend/src/helperFns/weeklyPayoutHelper.js) has correct IST
arithmetic (`IST_OFFSET_MS`, `nowIST()`, `getWeekBounds()`, `getDayStartIST()`), and `DailyPayout.date` is
documented as "start of day IST". The analytics controller just doesn't import it.

**Do:** export a `getDayBoundsIST(dateStr)` from `weeklyPayoutHelper.js` and use it at **every** date filter
in the codebase. One source for the fact "when does a business day start". Grep first — `getDayStartIST` is
currently imported only by `onlineSessionHelper.js`, so there are likely other UTC-boundary filters in the
admin dashboard and finance controllers that need the same treatment.

### 🟠 2.2 Riders have a daily rollup table; merchants do not

`DailyPayout` gives rider day-grain for free. Merchant daily numbers are aggregated live from `Order` on every
request. That means merchant custom-range queries are the expensive ones *and* the ones with the timezone bug.

**Options:**
- **(a) Lazy, recommended for now:** keep aggregating live, but fix the boundaries (§2.1) and add an index on
  `{ merchantId: 1, createdAt: -1, orderStatus: 1 }`. At current order volume this is fine, and it avoids a
  new table that can drift out of sync with orders.
- **(b) Later, when it hurts:** a `merchantDailyRollup` written by the same nightly cron that writes
  `DailyPayout`. Add it when a range query measurably slows down, not before. Note the cost: a second source
  of truth for the same money, which must then be reconcilable.

### 🟠 2.3 `financeEntry` / commission rate provenance

`weeklyPayout.orders[].commissionRate` defaults to 4 but the comment says "Category commission %", and
`appConfig.defaultWarehouseCommissionRate` is 10 for warehouse sales. A merchant looking at a payout cannot
currently see *why* their rate was what it was. Whatever the rule is, the per-order entry should record the
rate **and its source** (`category` \| `warehouse_default` \| `merchant_override`) so a dispute is answerable
from the record rather than by reading code.

### 🟡 2.4 Rider "today" recomputes estimated incentives on every call

`earnings/today` calls `evaluateDailyIncentives()` when no payout row exists or `totalIncentive === 0`. That
is correct behaviour (riders need live progress) but it is an uncached recomputation on a screen riders
refresh constantly. Cache for 60s in Redis — `@upstash/redis` is already a dependency.

---

## 3. Proposed feature: one earnings endpoint per role, with real filters

### 3.1 The API shape

Rather than adding `/earnings/this-month`, `/earnings/last-month`, `/earnings/custom`… (the path the current
`today`/`yesterday`/`current-week` endpoints are already on), add **one** endpoint per role that takes the
period as parameters:

```
GET /deliveryRider/earnings?from=2026-11-01&to=2026-11-21&groupBy=day
GET /merchant/earnings?from=2026-11-01&to=2026-11-21&groupBy=day
```

| Param | Values | Notes |
|---|---|---|
| `from`, `to` | `YYYY-MM-DD`, IST calendar dates, inclusive | required; cap the span (e.g. 400 days) to bound the query |
| `groupBy` | `day` \| `week` \| `month` | drives the series granularity |
| `preset` | `today` \| `yesterday` \| `this_week` \| `last_week` \| `this_month` \| `last_month` \| `last_7` \| `last_30` | **resolved to `from`/`to` on the server** |

**Resolve presets server-side, not in each app.** Three clients computing "last week" in local device time is
three chances to disagree with the payout cron. The server owns the IST calendar; the apps send `preset=last_week`
and render what comes back. This also means a new preset ships without an app update — which ties into
[server-driven-campaigns.md](server-driven-campaigns.md).

Keep the existing endpoints as thin wrappers for one release so nothing breaks, then retire them.

### 3.2 The response shape

One shape for both roles, so the filter UI is written once and the two apps diverge only in labels:

```jsonc
{
  "period":  { "from": "2026-11-01", "to": "2026-11-21", "timezone": "Asia/Kolkata", "groupBy": "day" },
  "summary": {
    "grossEarnings": 48200,      // what the work was worth
    "deductions":    1150,       // penalties, damage compensation, adjustments
    "commission":    1928,       // merchant only
    "incentives":    2300,       // rider only
    "netEarnings":   47150,      // what you actually get
    "paidOut":       41000,      // already settled
    "pending":        6150,      // accrued, not yet settled
    "completedOrders": 142,
    "cancelledOrders":   6,
    "onlineHours":     96.5      // rider only
  },
  "series": [                     // one entry per groupBy bucket — drives the chart
    { "bucket": "2026-11-01", "grossEarnings": 2100, "netEarnings": 2016, "orders": 7, "incentives": 0 }
  ],
  "breakdown": [                  // what MADE the money, the part that answers "why this number"
    { "label": "Delivery fees",     "amount": 32000 },
    { "label": "Distance bonus",    "amount": 8400  },
    { "label": "Peak-hour incentive","amount": 2300 },
    { "label": "Penalties",         "amount": -1150 }
  ],
  "payouts": [                    // settlement records, with proof
    { "weekStart": "2026-11-10", "weekEnd": "2026-11-16", "status": "paid",
      "netPayout": 11200, "paymentMethod": "bank_transfer",
      "referenceNumber": "UTR123456789", "paidAt": "2026-11-18T...",
      "receiptUrl": "https://..." }
  ],
  "orders": { "items": [ /* per-order rows */ ], "page": 1, "total": 142 }
}
```

`summary` + `series` + `breakdown` + `payouts` is the whole screen. Everything in it is already in the
database today.

### 3.3 What riders should see that they can't today

| Need | Today | Add |
|---|---|---|
| Earnings for an arbitrary range | only today/yesterday/this week | `from`/`to` |
| Monthly total (for a loan application, rent, tax) | ✗ | `groupBy=month` + a date-range picker |
| Per-order breakdown for a past week | only last 10 orders, `week.orders.slice(-10)` | paginated `orders` |
| Why a payout was less than expected | `adminDeduction.reason` exists but the UI shows it only when `totalDeductions > 0` | a dedicated deductions list with reason + date + linked order |
| Cash-in-hand owed to FlashFits | tracked on `deliveryRider` but not on the earnings screen | surface it in `summary` — riders carry COD and need to know their liability |
| Online hours vs earnings (₹/hour) | `loginHours` and `loginWindows` are stored, never shown | a derived `earningsPerHour` in `summary` — this is the number gig workers actually optimise |
| Incentive progress mid-slab | `/incentives` exists, shown separately | keep, but also show "₹120 more for the ₹200 bonus" inline |
| Proof of payment | `referenceNumber`/`receipt` stored | show UTR + downloadable receipt (the merchant web app already does this) |

### 3.4 What merchants should see that they can't today

| Need | Today | Add |
|---|---|---|
| Arbitrary range | week picker only | `from`/`to` |
| Daily revenue, correct | `analytics` `dailyTrend`, **shifted by 5h30m** (§2.1) | fix boundaries |
| Commission transparency | totals only | per-order rate + source (§2.3) |
| Try & Buy vs Courier vs Warehouse split | `orderModel` is on each entry, not surfaced | group `breakdown` by order model — these have different economics and merchants ask |
| Effect of their own coupons on their payout | `merchantDiscount` is recorded per order, never shown | a `breakdown` line: "Your store offers: −₹X". Closes the loop with [coupons-and-offers.md](coupons-and-offers.md) |
| Returns/cancellations impact | `cancelledOrders` counted | value of returned items, not just the count |
| Next payout date + what's accruing | `status: accumulating` shown | "₹6,150 settles Tuesday 25 Nov" — derived from `appConfig.payoutDay`/`payoutHourIST` |
| Export | ✗ | CSV of the `orders` list. One `papaparse` call — already a MerchantModule dependency |

### 3.5 Where it goes in the UI

- **Rider** ([`Earnings.tsx`](../../../FlashFits-Delivery-App/app/%28home%29/Earnings.tsx)): add a preset chip row
  (`Today · Yesterday · This week · Last week · This month · Custom`) above the existing cards; `Custom` opens
  the `@react-native-community/datetimepicker` already in the dependency list. Keep the current layout —
  summary cards, then series chart, then breakdown, then payouts, then orders. No redesign needed.
- **Merchant** ([`Revenue.tsx`](../../../MerchantModule/src/pages/Revenue.tsx)): the week picker becomes a
  period picker with the same presets. `recharts` is already in use for the trend chart. Add the CSV export
  button and the commission/offer breakdown rows.

### 3.6 Admin side

[`FinanceManagement.jsx`](../../website/FFmanagement/src/pages/admin/FinanceManagement.jsx) and
[`PayoutManagement.jsx`](../../website/FFmanagement/src/pages/admin/PayoutManagement.jsx) should read the
**same** endpoint with an `ownerId` parameter, so a support agent sees exactly the number the merchant or
rider is looking at while on the phone with them. Today they are separate code paths, which is how
"my app says ₹47,150 but you say ₹47,400" happens.

---

## 4. Suggested order of work

| # | Work | Why |
|---|---|---|
| 1 | `getDayBoundsIST()` exported and used at every date filter; audit for other UTC-boundary filters | every daily number is currently wrong; everything else builds on it |
| 2 | `GET /merchant/earnings` + `GET /deliveryRider/earnings` with `from`/`to`/`groupBy`/`preset`, returning the §3.2 shape | one endpoint, both roles |
| 3 | Rider preset chips + custom range; merchant period picker | the visible feature |
| 4 | Breakdown rows: deductions w/ reasons, incentives, commission source, merchant offer impact, order-model split | "all useful details" |
| 5 | Paginated per-order list + CSV export | removes `slice(-10)` |
| 6 | Earnings-per-hour, cash-in-hand, next-payout-date derived fields | high value, trivial once §2 exists |
| 7 | Admin reads the same endpoint | support parity |
| 8 | Redis cache on the live-incentive recompute | only once §2 is proven slow |

---

## 5. Tests to write alongside

See [docs/ecosystem/TESTING.md](../ecosystem/TESTING.md) for the stack.

**Unit** — the date arithmetic is the whole risk surface here, and it is pure:

- `getDayBoundsIST('2026-11-21')` → exactly `2026-11-20T18:30:00.000Z` … `2026-11-21T18:29:59.999Z`.
- Every `preset` → the right `from`/`to` for a fixed "now". **Include the boundary cases that break naive
  implementations:** now = 00:15 IST (yesterday in UTC), now = Monday 00:00 IST (`this_week` start), the last
  day of a month, and a leap day. Freeze the clock; never call `Date.now()` in a test.
- `getWeekBounds()` against `appConfig.payoutDay` — a week must align with what the payout cron settles,
  or the UI and the bank transfer disagree.
- Summary arithmetic: `netEarnings === grossEarnings − deductions − commission + incentives`, as a property
  over generated inputs.

**Integration** (`vitest` + `mongodb-memory-server` + `supertest`):

- Seed orders at 23:50 IST and 00:10 IST; assert they land in the right day buckets. **This is the §2.1
  regression test** and the single most important one here.
- `groupBy=week` sums equal the `WeeklyPayout.netPayout` for the same span — the UI must never contradict the
  settlement record.
- A rider with no activity in the range → zeroed summary, empty series, HTTP 200 (not 404, not a crash).
- `from` after `to`, a 10-year span, a malformed date → 400 with a useful message.
- Authorisation: rider A cannot read rider B's earnings by passing an `ownerId`. **Write this one first** —
  see [security-findings.md](../security-findings.md); authorisation on these routes deserves scrutiny.

**E2E** (Maestro for the rider/customer apps, Playwright for MerchantModule):

- Rider: open Earnings → tap "Last week" → assert the total matches the seeded payout → switch to Custom,
  pick a 3-day range → assert the series has 3 buckets.
- Merchant: pick a range → export CSV → assert the row count and the net total match the on-screen summary.

**Verification flow** (per [VERIFY.md](../ecosystem/VERIFY.md)): a passing test suite does not prove a rider
can read their own earnings. The flow to walk by hand is *log in as a real rider with a mixed week (orders +
an incentive + an admin deduction) → check every preset → confirm the net figure equals the bank transfer
that actually landed*. That last comparison is the only one that matters to the rider, and no unit test
can make it.
