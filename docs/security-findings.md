# Security findings — FlashFits backend

**Last Updated:** 2026-11-21
**Status:** findings from a read of the current `dev2` branch. Nothing has been changed.
**Context:** found while documenting the ecosystem. Raised here rather than silently worked around.

Ordered by severity. S1 is the one to act on before the next release.

---

## 🔴 S1 — Socket.IO connections are completely unauthenticated

**Impact:** anyone on the internet can read every order on the platform in real time, including customer
names, phone numbers, addresses and amounts, and can impersonate any merchant.

### The finding

There is **no `io.use()` authentication middleware anywhere in the codebase.** Verified by grep across
`Backend/src/sockets/` — no `io.use`, no `socket.handshake.auth`, no token verification.

Rooms are joined purely from **unverified handshake query parameters**.

[`Backend/index.js`](../Backend/index.js):

```js
const io = new Server(server, {
  cors: { origin: "*", methods: ['GET','POST','PATCH','PUT','DELETE'] },   // ← any origin
});

io.on('connection', (socket) => {
  const role = socket.handshake.query.role;      // ← attacker-controlled, never verified
  if (role === "admin") {
    registerAdminSockets(io, socket);
    registerWarehouseOrderSockets(io, socket);
  } else if (role === "merchant") {
    registerMerchantSockets(io, socket);
  }
  // …
});
```

[`sockets/admin.socket.js`](../Backend/src/sockets/admin.socket.js):

```js
export const registerAdminSockets = (io, socket) => {
  const role = socket.handshake?.query?.role;
  if (role === "admin") {
    socket.join("admin:orders");     // ← full platform order firehose
    socket.join("admin");
  }
  socket.on("joinAdminOrders", () => {   // ← and an explicit join with no check at all
    socket.join("admin:orders");
    socket.join("admin");
  });
};
```

[`sockets/merchant.socket.js`](../Backend/src/sockets/merchant.socket.js):

```js
const queryMerchantId = socket.handshake.query.merchantId;
if (queryMerchantId) {
  socket.join(`merchant:${queryMerchantId}`);    // ← any merchant id, no ownership check
  socket.data.merchantId = queryMerchantId;
}
socket.on("registerMerchant", async (merchantId) => { /* same, no check */ });
```

### Exploit paths, all trivial

```js
// 1. Read every order placed on the platform, live.
io("https://api.theflashfits.com", { query: { role: "admin" } });
// → auto-joined to admin:orders. Customer PII, addresses, order values, rider assignments.

// 2. Read a competitor merchant's order stream.
io("https://api.theflashfits.com", { query: { role: "merchant", merchantId: "<any id>" } });

// 3. Emit as that merchant.
socket.emit("registerMerchant", "<any id>");
// then any merchant-side event the handlers accept.
```

`cors.origin: "*"` means this works from any webpage, and merchant ids are not secret — they appear in API
responses and URLs.

Note the contrast: HTTP routes are properly protected (`jwtAuth.js`, `adminAuth.middleware.js`,
`authMiddlewareMerchant`, `authMiddlewareRider`) and CORS uses an `allowedOrigins` list
([`config/cors.js`](../Backend/src/config/cors.js)). The socket layer bypasses all of it. This looks like an
oversight during a rush, not a decision.

### Fix

Authenticate at the handshake, derive identity from the token, and **never** read identity from query params:

```js
// Backend/src/config/socket.js  (or a new sockets/auth.js)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;       // auth, not query — not logged, not in referrers
    if (!token) return next(new Error('unauthorized'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.identity = {                           // the ONLY source of identity downstream
      role: payload.role,                              // from the signed token, not the client
      userId: payload.userId, merchantId: payload.merchantId,
      riderId: payload.riderId, adminId: payload.adminId,
    };
    return next();
  } catch { return next(new Error('unauthorized')); }
});
```

Then every `register*Sockets` reads `socket.data.identity` and **ignores** `handshake.query`. A merchant may
only join `merchant:${socket.data.identity.merchantId}`. `joinAdminOrders` checks
`identity.role === 'admin'`.

Also set `cors.origin` to the same `allowedOrigins` list the HTTP layer uses — one source for that fact.

**Client changes needed** (all four clients pass `role`/`merchantId` in the query today):
[`FlashFitsv2/sockets/`](../../FlashFitsv2/sockets/),
[`FlashFits-Delivery-App/config/socketConfig.js`](../../FlashFits-Delivery-App/config/socketConfig.js),
[`MerchantModule/src/utils/socket.ts`](../../MerchantModule/src/utils/socket.ts),
[`MerchantApp/src/context/SocketContext.tsx`](../../MerchantApp/src/context/SocketContext.tsx),
[`FFmanagement/src/hooks/useAdminOrderSocket.js`](../website/FFmanagement/src/hooks/useAdminOrderSocket.js).
They already hold JWTs for HTTP; pass the same token in `auth`. Roll out the server middleware in a mode
that logs-but-allows first if you need a window to update clients, then enforce.

**Verification:** attempt all three exploits above against staging and confirm each is refused. Add an
integration test per exploit — these are the tests that must never be deleted.

---

## 🔴 S2 — Offer system: over-redemption and free-order exploits

Detailed in [reports/coupons-and-offers.md](reports/coupons-and-offers.md). Summarised here because they are
security issues, not just bugs:

| Ref | Issue |
|---|---|
| **B3** | Client-supplied `selectedOffers` bypasses the stacking policy — a crafted request stacks unlimited offers, floored only by `Math.min(discount, subtotal)`, i.e. a **100%-discounted order**. |
| **B4** | `maxUsageTotal` is checked then incremented non-atomically — concurrent requests over-redeem a limited coupon. |
| **B5** | `maxUsagePerUser` is checked with `countDocuments` with no unique index — same race. |
| **B6** | `recordOfferUsage` is not idempotent — a replayed request double-redeems. |
| **B14** | No unique index on `couponCode`; uniqueness checked only among active offers, so a deactivate/create/reactivate sequence yields two live offers sharing a code and `findOne` picks non-deterministically. |
| **B16** | `updateOffer` mass-assigns `req.body` and omits `runValidators`, so every schema `enum` is unenforced on update and an admin offer can be mutated into an inconsistent scope/type combination. |

---

## 🟠 S3 — No horizontal-scaling safety; single-instance assumptions are load-bearing

[`Backend/index.js`](../Backend/index.js) does three things that silently break on a second instance:

1. **`@socket.io/redis-adapter` is a dependency but never wired up.** Two instances means a client connected
   to instance A never receives an event emitted on instance B. Order status updates, merchant alerts and
   rider dispatch all go silently missing for half of users.
2. **`initPayoutCron()`, `initTelegramBot()` and `initWhatsAppClient()` run in-process on every instance.**
   Two instances = payouts computed twice, two Telegram bots competing for the same updates. The payout cron
   is money.
3. **`io.emit` is monkey-patched** (see S4) with in-process matcher state.

**Fix:** wire the Redis adapter (the dependency is already installed, so this is a few lines); gate the cron
and bots behind an env flag or a Redis advisory lock so exactly one instance runs them.

**Until then, treat "single instance" as a hard deployment constraint and write it down** — this is the kind
of thing that gets discovered by scaling up under load, at the worst possible moment.

---

## 🟠 S4 — `io.emit` is monkey-patched to drive dispatch

[`Backend/index.js`](../Backend/index.js):

```js
const originalEmit = io.emit.bind(io);
io.emit = function (event, ...args) {
  if (event.startsWith('orderQueued:') || event.startsWith('riderAvailable:') || event.startsWith('riderFreed:')) {
    const zoneId = event.split(':')[1];
    matchQueuedOrders(zoneId).catch(console.error);
  }
  return originalEmit(event, ...args);
};
```

Not a vulnerability by itself, but a reliability hazard worth listing with them:

- **Rider–order matching is triggered by a string prefix on a socket event name.** Any code that emits a
  similarly-named event triggers matching; any rename silently disables it. There is no compile-time or
  test-time link between the emit site and the matcher.
- The matcher's errors go to `console.error` and are otherwise swallowed — a failed match is invisible.
- It is fire-and-forget, so matching can race with the transaction that queued the order.

**Fix:** call `matchQueuedOrders(zoneId)` explicitly where an order is queued or a rider frees up, and emit
the socket event separately. A command is a function call; an event is a notification. Keeping them distinct
makes the dispatch path greppable and testable, and matching no longer depends on a broadcast succeeding.

---

## 🟠 S5 — Socket CORS is `*` while HTTP is allowlisted

Already noted in S1; separate line item because it is independently exploitable for CSRF-style reads from any
origin even after identity checks are added. Use `allowedOrigins` from
[`config/cors.js`](../Backend/src/config/cors.js) in the `Server` options.

---

## 🟡 S6 — Debug and scratch files in the repo root

`Backend/` contains ~35 loose scripts at the top level: `check_db.js`, `clean_database.js`,
`clear_redis.js`, `db_debug.js`, `backup_pre_launch.js`, `scratch_fix_flat_wh.js`,
`dumpOffers.js`, `test-admin.js`, `diagnose-admin.js`, and a `db_backup_prelaunch_20261010/` directory.

Concerns, in order:
- `clean_database.js` and `clear_redis.js` are destructive and one `node` invocation away in production.
- A committed database backup directory may contain customer PII. **Check this before anything else** — if it
  does, it needs removing from history, not just from `HEAD`.
- They obscure the actual entrypoint for anyone new (or any agent) reading the repo.

**Fix:** move operational scripts to `Backend/scripts/` (which already exists) with a `README` saying what each
does and which are destructive; delete the scratch files; verify the backup directory for PII and purge from
git history if present; confirm `.gitignore` covers future backups.

---

## 🟡 S7 — `[OFFER_DEBUG]` logs customer cart contents in production

[`services/offerEngine.js`](../Backend/src/services/offerEngine.js) unconditionally logs the full cart context
and result on every evaluation. Customer data into logs, plus volume and latency. Gate it behind an env flag
or route it through the `pino` logger already in the dependency list.

---

## Suggested order

| # | Finding | Why |
|---|---|---|
| 1 | **S1** socket auth | unauthenticated PII access, live, today |
| 2 | **S6** verify the committed DB backup for PII | if it contains customer data, nothing else is more urgent |
| 3 | **S2** offer indexes + atomic claims + `selectedOffers` validation | exploitable for free orders |
| 4 | **S5** socket CORS | one line, ships with S1 |
| 5 | **S3** Redis adapter + cron gating | blocks scaling; do before you need to scale |
| 6 | **S4** explicit matcher calls | reliability |
| 7 | **S7**, rest of **S6** | hygiene |
