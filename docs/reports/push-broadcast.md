# Report: push notification broadcasts & event-driven notifications

**Last Updated:** 2026-11-21
**Status:** findings + recommendation. **Low priority** per your note — this is here so the design is settled
when you get to it.
**Goal:** broadcast to customers / merchants / riders / admins per event and per campaign ("Christmas sale is
here"), plus app-initiated notifications for things only the app knows.

**Short answer:** a working broadcast already exists but it runs **synchronously inside the HTTP request**
with no segmentation, no scheduling, no deep link and no delivery tracking. It will fall over at a few
thousand users. The event-driven side (`notificationHelper.js`) is in much better shape and is the model the
broadcast path should copy.

---

## 1. What exists

### Event-driven notifications — solid

[`helperFns/notificationHelper.js`](../../Backend/src/helperFns/notificationHelper.js) (352 lines) does the
right things: resolves the recipient's `expoPushTokens`, validates each with `Expo.isExpoPushToken()`, chunks
via `expo.chunkPushNotifications()`, routes order alerts to the high-priority `order_alerts` channel, and
**prunes tokens** that come back `DeviceNotRegistered`.

[`notification.model.js`](../../Backend/src/models/notification.model.js) stores the in-app inbox with a
28-value `type` enum covering the customer, rider and generic cases, plus a `data` blob for deep linking and
indexes on `userId`/`riderId`/`merchantId`/`orderId`.

Delivery is dual-channel: Socket.IO for a live client, push for a backgrounded one.

### Broadcast — works, but will not scale

[`adminControllers/notification.controllers.js`](../../Backend/src/controllers/adminControllers/notification.controllers.js)
(~110 lines), driven by
[`BroadcastNotifications.jsx`](../../website/FFmanagement/src/pages/admin/BroadcastNotifications.jsx):

```js
const { target, title, body } = req.body;        // target ∈ customers | merchants | riders
const users = await model.find(query).select("expoPushTokens _id");
for (const user of users) {
  pushTokens.push(...user.expoPushTokens);
  if (target === "merchants" || target === "riders") {
    const notification = await Notification.create(notificationPayload);   // ← one await per user
    io.to(room).emit("notification", {...});
  }
}
let chunks = expo.chunkPushNotifications(messages);
for (let chunk of chunks) { await expo.sendPushNotificationsAsync(chunk); }   // ← all inline
```

---

## 2. Problems

| # | Problem | Consequence |
|---|---|---|
| 🔴 **P1** | **Entirely synchronous in the request.** Every user loaded into memory, one `await Notification.create()` per merchant/rider in a serial loop, then every push chunk sent inline. | At 50k customers the request times out behind nginx/Render long before finishing. The admin sees an error and cannot tell how many were actually sent. At 500 users it works, which is why it hasn't bitten yet. |
| 🔴 **P2** | **No idempotency.** A timeout (P1) looks like a failure, so the admin retries. | Everyone who was reached gets the message twice. This is the most likely first production incident. |
| 🔴 **P3** | **`data: {}` hardcoded.** | Tapping a "Christmas sale is here" notification opens the app at the home screen. The campaign has no landing. `notificationHelper` passes `data` properly; the broadcast path does not. |
| 🟠 **P4** | **No segmentation.** Only all-customers / all-merchants / all-riders. | Cannot target a city, a zone, inactive users, first-time users, or merchants in one category. A nationwide blast for a Kochi-only sale trains users to disable notifications. |
| 🟠 **P5** | **No scheduling.** | "Christmas sale at 9am" means someone is at a keyboard at 9am. |
| 🟠 **P6** | **No record of the broadcast.** No `Broadcast` document. | No history, no "what did we send last week", no open/tap rates, no way to audit who sent what. The in-app `Notification` rows are per-user, not per-campaign. |
| 🟠 **P7** | **Receipts never fetched.** `expo.getPushNotificationReceiptsAsync()` is not called on this path. | Tickets are accepted but delivery errors are never read, so dead tokens accumulate — unlike the event path, which prunes them. Over time your "sent to N devices" figure becomes fiction. |
| 🟠 **P8** | **Customers get no in-app record** (deliberate, per the code comment). | A customer who dismisses the notification has no way to find the offer again. Given that the campaign has no deep link either (P3), the message is effectively one-shot. |
| 🟡 **P9** | **No admin recipient.** `target` has no `admins` option. | Admins cannot be notified of anything. |
| 🟡 **P10** | **No rate/quiet-hours guard.** | Nothing stops three blasts in an hour, or one at 2am. |
| 🟡 **P11** | Socket emission assumes a single server instance — `@socket.io/redis-adapter` is a dependency but **not wired up** (see [security-findings.md](../security-findings.md) and `Backend/index.js`). | On more than one instance, in-app notifications reach only the users connected to the sending instance. |

---

## 3. Recommendation

### 3.1 A `Broadcast` document — the campaign is the thing, not the send

```js
// Backend/src/models/broadcast.model.js
{
  title, body,
  data: { screen, params },               // fixes P3 — deep link target
  imageUrl,                                // rich push; both platforms support it
  audience: {
    roles: ['customer'],                   // customer | merchant | rider | admin  (fixes P9)
    zoneIds: [], cityNames: [],            // fixes P4
    userSegment: 'all'|'new'|'returning'|'inactive_30d',
    genders: [], minOrders: null,
    appVersionMin: null
  },
  schedule: { sendAt, timezone: 'Asia/Kolkata' },     // fixes P5
  status: 'draft'|'scheduled'|'sending'|'sent'|'failed'|'cancelled',
  createdBy, createdByModel,
  stats: { targeted: 0, sent: 0, failed: 0, invalidTokens: 0, opened: 0 },   // fixes P6
  idempotencyKey: { type: String, unique: true, sparse: true },              // fixes P2
  startedAt, completedAt
}
```

One row per campaign, with its audience, its schedule, its outcome. Everything else hangs off this.

### 3.2 Move the send out of the request

The POST creates the `Broadcast` as `scheduled` and returns immediately. A worker picks it up, pages through
recipients, and updates `stats` as it goes. The admin UI polls or listens on a socket for progress.

**Do not add a queue dependency for this.** `node-cron` is already in use
([`cron/payoutCron.js`](../../Backend/src/cron/payoutCron.js)) and the payout cron already proves the pattern
in this codebase. A minute-granularity cron that claims due broadcasts is enough:

```js
// claim atomically so two instances cannot both send it — also the P2 fix
const b = await Broadcast.findOneAndUpdate(
  { status: 'scheduled', 'schedule.sendAt': { $lte: new Date() } },
  { $set: { status: 'sending', startedAt: new Date() } },
  { new: true }
);
```

Then cursor over recipients in batches of ~500 (`.cursor()`, not `.find()` into an array — P1), build Expo
messages, `chunkPushNotifications`, send, and `$inc` the stats. Resume-safe: record the last processed `_id`
on the broadcast so a crashed send continues instead of restarting.

Only reach for a real queue (BullMQ on the existing Redis) if you need retries with backoff per chunk and
the cron approach measurably falls short. It probably won't at your scale.

### 3.3 Close the loop on delivery

Store the ticket ids, then fetch receipts ~15 minutes later in the same cron:
`expo.getPushNotificationReceiptsAsync(ids)` → count failures, prune `DeviceNotRegistered` tokens exactly as
`notificationHelper.js` already does (P7). Reuse that pruning code rather than writing a second copy.

### 3.4 Give customers an inbox

Reverse P8: write a `Notification` row for broadcast recipients too (`type: 'admin_notification'`), with the
deep link in `data`. The customer app already has the model and the indexes; it needs a notifications screen —
the merchant and rider apps already have one. This is also what makes a campaign recoverable after a
dismissed notification, which is the difference between a push that converts and one that doesn't.

### 3.5 Guardrails

- **Quiet hours** in `appConfig` (e.g. 22:00–08:00 IST): a broadcast scheduled inside the window is held to
  the next allowed slot, with the admin told. Transactional order notifications are exempt — a rider needs to
  know about an order at 23:00.
- **Rate limit per audience** (e.g. max 2 promotional pushes per user per day). Enforce it when resolving
  recipients, not at authoring time, so it holds across overlapping campaigns.
- **A confirmation step showing the resolved audience size** before send. "This will notify 48,219 customers"
  prevents most mistakes, and it is one count query.
- **A test-send** to a named list of staff device tokens. Do this first; it is the cheapest feature here and
  it catches the broken deep link every time.

### 3.6 App-initiated notifications

Your "things that only need the app" case. These should be **local notifications**, not server pushes — no
token, no network, no privacy exposure:

| Trigger | App | Mechanism |
|---|---|---|
| Trial timer about to expire | customer | `expo-notifications` local, scheduled when the trial starts, cancelled on selection |
| Cart abandoned N hours | customer | local, scheduled on app background |
| Rider idle while online | rider | local |
| Merchant store left offline during business hours | merchant | local, rescheduled on each heartbeat |
| Unaccepted order approaching the accept deadline | merchant | local **and** server push — too important to rely on one |

`expo-notifications` is already a dependency in all three apps, so this is `scheduleNotificationAsync` plus
cancellation bookkeeping. The discipline that matters: **always cancel the scheduled local notification when
the condition resolves**, or users get "your trial is ending" after they already paid. That is the bug this
feature always ships with.

---

## 4. Platform note for the merchant app

If the merchant app moves to Capacitor
([merchant-consolidation.md](merchant-consolidation.md)), its push tokens become FCM/APNs rather than Expo,
and the broadcast worker needs the provider branch described in that report's §5. Design the `Broadcast`
worker to call a single `sendPush(recipient, message)` that dispatches on token provider — then the migration
touches one function instead of every send site.

---

## 5. Tests

See [docs/ecosystem/TESTING.md](../ecosystem/TESTING.md).

**Unit:**
- Audience resolution: each `audience` dimension in isolation and in combination; empty audience → zero
  recipients (and the send is **not** attempted); `userSegment: 'inactive_30d'` boundary at exactly 30 days.
- Quiet-hours shifting: a broadcast at 23:30 IST moves to the next 08:00 IST, including across a month end.
- Message building: `data` is carried through (the P3 regression test); invalid tokens filtered; chunking
  boundaries at exactly 100 messages.

**Integration** (`vitest` + `mongodb-memory-server`, Expo SDK stubbed):
- **P2 regression:** two cron ticks racing one due broadcast → the atomic claim means exactly one sends.
- **P1 regression:** 10,000 seeded recipients → the worker completes, `stats.sent` is correct, and peak
  memory stays flat (assert it cursors rather than materialising — e.g. spy that `.cursor()` was used).
- Crash mid-send → resume continues from the recorded position, no duplicates.
- Receipt handling: a `DeviceNotRegistered` receipt prunes that token from the user document.
- Rate limit: a user already at their daily cap is excluded from a second campaign.
- Authorisation: a non-admin cannot POST a broadcast. Worth an explicit test given the findings in
  [security-findings.md](../security-findings.md).

**E2E:** admin creates a draft → test-send to a staff token → confirms the audience count → schedules →
cron fires → assert the `Notification` inbox row exists with the deep link, and tapping it in the app
(Maestro) lands on the campaign screen.

**Verification flow** (per [VERIFY.md](../ecosystem/VERIFY.md)): the only check that matters is a real device
receiving a real notification and the tap landing on the right screen. Send yourself a Christmas-sale push on
Android and iOS, locked and unlocked, app foregrounded, backgrounded and killed — six states. No test suite
substitutes for this, and P3 is exactly the kind of bug that passes every unit test.
