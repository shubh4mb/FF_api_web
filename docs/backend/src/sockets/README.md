# Backend/src/sockets/

Socket.IO handlers. `index.js` dispatches a new connection to one of these by
`socket.handshake.query.role`, then always registers `order.socket.js`.

| File | Registers | Rooms joined |
|---|---|---|
| `admin.socket.js` | `registerAdminSockets` | `admin:orders`, `admin` |
| `merchant.socket.js` | `registerMerchantSockets` | `merchant:{merchantId}`, and `warehouse:{id}` for warehouse accounts |
| `deliveryRider.socket.js` | `registerDeliveryRiderSockets` | `rider:{riderId}` |
| `user.socket.js` | `registerUserSockets` | per-user |
| `warehouseOrder.socket.js` | `registerWarehouseOrderSockets` | `warehouse:{id}` |
| `order.socket.js` | `registerOrderSockets` | `order:{orderId}` via `joinOrderRoom` / `leaveOrderRoom`; registered for **every** client |

## 🔴 There is no authentication here

**No `io.use()` middleware exists anywhere in the codebase.** Role and identity are read from unverified
handshake query parameters, and `cors.origin` is `"*"`.

```js
// index.js
const role = socket.handshake.query.role;        // attacker-controlled
// merchant.socket.js
const queryMerchantId = socket.handshake.query.merchantId;
socket.join(`merchant:${queryMerchantId}`);      // no ownership check
```

Anyone can connect with `?role=admin` and receive every order on the platform, or with
`?role=merchant&merchantId=<any>` and read or impersonate another merchant. Merchant ids are not secret.

**Do not add a handler that trusts `handshake.query`.** The fix — a handshake JWT middleware feeding
`socket.data.identity` — is specified in
[../../../security-findings.md](../../../security-findings.md) S1. It requires a coordinated change in all
five clients.

## Other gotchas

- **`io.emit` is monkey-patched in `index.js`.** An event name beginning `orderQueued:`, `riderAvailable:`
  or `riderFreed:` triggers `matchQueuedOrders(zoneId)`. Rider dispatch therefore depends on an event-name
  string prefix; a rename silently disables it, and the matcher's errors go only to `console.error`.
  Finding S4.
- **`@socket.io/redis-adapter` is installed but not wired.** On a second instance, a client connected to A
  never receives an event emitted on B. The service is single-instance only. Finding S3.
- `config/socket.js` holds `setIO`/`getIO` so other modules can emit without a circular import.
