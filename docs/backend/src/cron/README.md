# Backend/src/cron/

| File | What |
|---|---|
| `payoutCron.js` | the weekly settlement run |

Started by `initPayoutCron()` from `Backend/index.js`, using `node-cron`.

Driven by `appConfig`: `payoutDay` (0=Sun … default 2=Tue) and `payoutHourIST` (default 2, i.e. 02:00 IST).
The work itself is in [`helperFns/weeklyPayoutHelper.js`](../helperFns/README.md); this file is the schedule.

## Gotchas

- **It runs in-process on every instance.** Two instances means payouts computed twice — and this is money.
  Gate it behind an env flag or a Redis advisory lock before scaling.
  [../../../security-findings.md](../../../security-findings.md) S3.
- All timing is **IST**, computed from `IST_OFFSET_MS` in `weeklyPayoutHelper.js`. A cron expression here is
  interpreted in the server's timezone, so the helper's arithmetic — not the cron string — is what defines a
  payout week. Keep them consistent.
- `routes/cron.routes.js` exposes externally-triggered jobs. Confirm it is not publicly reachable.
- Other periodic work lives outside this folder: `helperFns/orderPendingSweep.js` and
  `helperFns/riderTimeoutHelper.js`.
