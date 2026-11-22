# Backend/

The FlashFits API: REST for all four clients, Socket.IO for real-time, MongoDB for state.
Node 18+ ESM (`"type": "module"`) — **no build step**, it runs the source.

## Entry

| File | What |
|---|---|
| `index.js` | connects the DB, starts `payoutCron`, the Telegram bot and the WhatsApp client, creates the Socket.IO server, **monkey-patches `io.emit`** to trigger rider matching, dispatches sockets by role, listens on `PORT` (default 5000) |
| `src/app.js` | the Express app: helmet, CORS from `config/cors.js`, rate limiting, swagger, route mounting, error middleware |

**Read `index.js` before changing anything about startup or sockets.** Three things initialise in-process
(cron, Telegram, WhatsApp) which is why this service can only run on one instance — see
[../security-findings.md](../security-findings.md) S3.

## Layout

| Path | What | Doc |
|---|---|---|
| `src/models/` | 43 mongoose models | [src/models/README.md](src/models/README.md) |
| `src/routes/` | 15 route files; four still hold business logic | [src/routes/README.md](src/routes/README.md) |
| `src/controllers/` | grouped per role | [src/controllers/README.md](src/controllers/README.md) |
| `src/services/` | offerEngine, mail, storage, telegram, whatsapp, gemini | [src/services/README.md](src/services/README.md) |
| `src/helperFns/` | 21 files — the real business logic | [src/helperFns/README.md](src/helperFns/README.md) |
| `src/sockets/` | per-role handlers, room membership | [src/sockets/README.md](src/sockets/README.md) |
| `src/middleware/` | 4 auth middlewares, errors, multer, nearbyMerchants | [src/middleware/README.md](src/middleware/README.md) |
| `src/cron/` | `payoutCron.js` | [src/cron/README.md](src/cron/README.md) |
| `src/config/` | db, redis, socket, cors, swagger, cloudinary, razorpay | [src/config/README.md](src/config/README.md) |
| `src/utils/` | ApiError, ApiResponse, asyncHandler, auditLogger, pdfGenerator, variantAdapter, zoneInfer, validators | [src/utils/README.md](src/utils/README.md) |
| `load-tests/` | k6 + a node stress runner. `npm run test:k6` | — |
| `scripts/` | operational scripts | — |

## Not part of the service

**~35 loose scripts sit in `Backend/` root** — `check_db.js`, `clean_database.js`, `clear_redis.js`,
`db_debug.js`, `dumpOffers.js`, `scratch_*.js`, `test-admin.js`, `seed*.js`, and a
`db_backup_prelaunch_20261010/` directory.

Some are **destructive** (`clean_database.js`, `clear_redis.js`) and one `node` invocation away in
production. The backup directory may contain customer PII and needs checking. They should move to `scripts/`
with a README, or be deleted. See [../security-findings.md](../security-findings.md) S6.

Do not take these as examples of how to write code here.

## Conventions

- Models `<entity>.model.js` (singular), controllers `<domain>.controllers.js`, routes `<area>.routes.js`,
  helpers `<domain>Fns.js` / `<domain>Helper.js`.
- Dates end `At`; booleans start `is`/`has`/`requires`; money is **integer rupees**.
- Business days are **IST** — use `helperFns/weeklyPayoutHelper.js`, never a hardcoded `T00:00:00.000Z`.
- Full list: [../ecosystem/PRINCIPLES.md](../ecosystem/PRINCIPLES.md).

## Testing

**No runner configured.** Chosen stack: Vitest + supertest + mongodb-memory-server.
[../ecosystem/TESTING.md](../ecosystem/TESTING.md) lists the eight tests worth writing first — the top three
each correspond to something currently losing money or leaking data.
