# FF_api_web

The FlashFits **backend API**, real-time engine, and **admin panel**. The hub repo of the
[FlashFits ecosystem](docs/ecosystem/README.md) — it also holds the documents the other four repos point at.

- `Backend/` — Node 18+, Express 5, MongoDB/Mongoose, Socket.IO, Redis
- `website/FFmanagement/` — admin panel, Vite + React 19 + MUI + Tailwind

## Setup

```bash
git config core.hooksPath .githooks     # once per clone — see docs/ecosystem/PRINCIPLES.md

cd Backend && npm install
cp .env.example .env                    # if absent, see docs/runbook.md for required variables
npm run dev                             # nodemon, PORT defaults to 5000

cd ../website/FFmanagement && npm install && npm run dev
```

## Commands

| | |
|---|---|
| `npm run dev` (Backend) | nodemon on `index.js` |
| `npm start` (Backend) | production start |
| `npm run test:k6` | load test (needs `k6`) |
| `npm run test:redis` | redis suite |
| `npm run whatsapp:connect` | pair the WhatsApp order-alert client |
| `npm run dev` / `build` / `lint` (admin) | Vite |
| `bash .githooks/test-hooks.sh` | self-check the git hooks |

**There is no unit/integration test runner configured yet.** The chosen stack is Vitest + supertest +
mongodb-memory-server — see [docs/ecosystem/TESTING.md](docs/ecosystem/TESTING.md).

## Where things are

```
Backend/index.js            entrypoint: db, cron, Telegram, WhatsApp, Socket.IO, listen
Backend/src/models/         43 mongoose models
Backend/src/routes/         15 route files
Backend/src/controllers/    grouped per role: admin / merchant / user / deliveryRider
Backend/src/services/       offerEngine, mail, storage, whatsapp, telegram, geminiProductAnalyzer
Backend/src/helperFns/      21 domain helpers — most business logic lives here
Backend/src/sockets/        per-role socket handlers
Backend/src/cron/           payoutCron
website/FFmanagement/src/   admin panel: pages/admin (41 screens), api/, components/
docs/                       mirrors the code tree — start at docs/README.md
```

## Documentation

| | |
|---|---|
| [PRODUCT.md](PRODUCT.md) | what FlashFits is, who uses it, the vocabulary |
| [DESIGN.md](DESIGN.md) | how this service is built, and its known debt |
| [AGENTS.md](AGENTS.md) | rules for AI coding agents (`CLAUDE.md` and `GEMINI.md` import it) |
| [VERIFY.md](VERIFY.md) | what to do when you think a feature is finished |
| [docs/README.md](docs/README.md) | the documentation index |
| [docs/security-findings.md](docs/security-findings.md) | **read this first** |
| [docs/ecosystem/](docs/ecosystem/) | cross-repo standards: principles, testing, verification, docs |
| [docs/reports/](docs/reports/) | analysis reports awaiting a decision |
| [docs/runbook.md](docs/runbook.md) | operational runbook |

## Deployment notes

**The backend currently runs on exactly one instance.** `@socket.io/redis-adapter` is installed but not
wired, and the payout cron plus the Telegram and WhatsApp clients initialise in-process. A second instance
breaks socket delivery and double-runs payouts. See
[docs/security-findings.md](docs/security-findings.md) S3 before scaling.

Branch `dev2` is the current line of work; releases are cut by another developer.
