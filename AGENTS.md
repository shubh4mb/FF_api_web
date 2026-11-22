# FF_api_web — agent instructions

FlashFits backend API, real-time engine, and admin panel. The hub repo: it owns the cross-repo documents the
other four repos point at.

**Read before changing anything:**

| | |
|---|---|
| `PRODUCT.md` | what FlashFits is, who uses it, the vocabulary |
| `DESIGN.md` | how this service is built, and where it departs from that |
| `docs/security-findings.md` | **read this first.** Socket.IO is unauthenticated today (S1) |
| `docs/ecosystem/README.md` | facts that span repos: IST, money, the order lifecycle |
| `docs/ecosystem/PRINCIPLES.md` | the ten non-negotiables, each with its current violation |
| `docs/backend/README.md` | the package map — which folder does what |
| `docs/ecosystem/TESTING.md` | the test stack and what new work must ship with |
| `VERIFY.md` | what to do when you think you are finished |

## Principles (non-negotiable)

Full statements, with the violation each one already has in this codebase, in
`docs/ecosystem/PRINCIPLES.md`. In short:

1. **One way in.** Every write to an order, offer or payout goes through one function, whatever triggered it.
   Routes and controllers translate and delegate; they hold no rules.
2. **One source for each fact.** A rate, rule, enum or default is stated once. Config lives in
   `appConfig` — read it, never hardcode it.
3. **Identity from a verified token, never from input.** Never trust `req.body.merchantId` or
   `socket.handshake.query.role`.
4. **Money is recomputed, never carried.** In Try & Buy every amount is provisional until the trial ends.
   Recompute against kept items before charging or settling.
5. **Commands are calls; events are notifications.** Do not trigger work by listening for a broadcast.
6. **Fail closed.** Unknown role, missing token, unvalidated input → refuse.
7. **Atomic claims for anything concurrent.** Limits and counters use one atomic operation or a unique index,
   never check-then-write.
8. **Tests ship with the feature** (`docs/ecosystem/TESTING.md`).
9. **Run `/verify` before calling it done** (`VERIFY.md`).

## Time, money, identity — the three that bite

- **IST (UTC+5:30) is the business day.** Use `getDayStartIST` / `getWeekBounds` from
  `Backend/src/helperFns/weeklyPayoutHelper.js`. **Never** write
  `new Date(dateStr + "T00:00:00.000Z")` — that is 05:30 IST and it is the live bug in
  `analytics.controller.js`.
- **`helperFns/calculateFinalBilling.js` owns the final bill. `helperFns/orderSettlement.js` owns who bears
  a discount** (merchant-scoped offers reduce the merchant's payout; admin-scoped reduce FlashFits'
  commission). Do not recompute either elsewhere.
- **Amounts are integer rupees.**

## Commands

```bash
# Backend (from Backend/)
npm install
npm run dev                  # nodemon, reads .env; PORT defaults to 5000
npm start                    # node index.js
npm run test:k6              # load test (k6 required)
npm run test:redis           # redis suite

# Admin panel (from website/FFmanagement/)
npm install
npm run dev                  # vite
npm run lint
npm run build

# Git hooks — once per clone, in this repo
git config core.hooksPath .githooks
```

There is **no test runner configured yet.** Adding one is the first task of any feature that needs tests —
see `docs/ecosystem/TESTING.md` for the chosen stack (Vitest + supertest + mongodb-memory-server for the
backend, Vitest + Testing Library for the admin panel).

## Layout

```
Backend/
  index.js                 entrypoint: db, cron, Telegram, WhatsApp, Socket.IO, server
  src/app.js               express app
  src/config/              db, redis, socket, cors, swagger, cloudinary, razorpay
  src/models/              43 mongoose models
  src/routes/              15 route files — some still hold business logic (debt)
  src/controllers/         grouped per role: admin / merchant / user / deliveryRider
  src/services/            offerEngine, mail, storage, whatsapp, telegram, geminiProductAnalyzer
  src/helperFns/           21 domain helpers — the real business logic lives here
  src/sockets/             per-role socket handlers
  src/middleware/          auth, error, multer, nearbyMerchants
  src/cron/                payoutCron
website/FFmanagement/      admin panel (Vite + React 19 + MUI + Tailwind)
docs/                      mirrors the code tree; see docs/README.md
```

**Where to put new logic:** a domain rule goes in `helperFns/` or `services/`. A controller calls it. A route
wires the controller. If you are writing an `if` in a route file, it is in the wrong place.

## Known debt you will run into

Ranked, with detail in `DESIGN.md` §7:

1. **Socket.IO has no authentication** — `docs/security-findings.md` S1. Do not add a socket handler that
   trusts `handshake.query`.
2. **The kept-items offer recalculation is duplicated 3× and missing from the rider settlement path** — an
   active money leak. `docs/reports/coupons-and-offers.md` B1/C4.
3. **Single-instance only.** `@socket.io/redis-adapter` is installed but not wired; the payout cron and the
   Telegram/WhatsApp clients init in-process. A second instance breaks sockets and double-runs payouts.
4. **`io.emit` is monkey-patched** in `index.js` to trigger rider matching from an event-name prefix.
5. **Business logic inline in route files** — `user.routes.js` 713 lines, `merchant.routes.js` 539,
   `deliveryRider.routes.js` 476.
6. **~35 loose scratch and debug scripts in `Backend/`**, including destructive ones
   (`clean_database.js`, `clear_redis.js`) and a committed DB backup directory that needs a PII check.
7. **Offers and coupons share one model with four contradictory flags.**
   `docs/reports/coupons-and-offers.md`.

Do not "fix" these opportunistically mid-feature. Note them, finish the task, and raise them.

## Documentation

Docs mirror the code tree: `docs/backend/src/<folder>/README.md` documents `Backend/src/<folder>/`.
**Update the doc in the same commit as the code.** `docs/README.md` is the index.

## Git

- Commit **explicit paths**. Never `git add -A` — that is how the scratch files and `.env` got in.
- `type(scope): description`; types `feat fix docs refactor test chore perf`. The `commit-msg` hook enforces it.
- Current branch is `dev2`; production releases are cut by another developer. Treat `dev2` as latest.

## When you are finished

Run the `/verify` protocol in `VERIFY.md`. A green test suite is the precondition for starting it, not a
substitute for it.

If a specific failure resists three genuine fix attempts: **stop**, revert, record it in
`docs/KNOWN-ISSUES.md` in the documented format, and tell the human what would unblock it.

## Process framework (GSD)

This repo also carries the GSD methodology: `PROJECT_RULES.md` (canonical process rules), `GSD-STYLE.md`,
`.gsd/` (SPEC, ROADMAP, STATE, GLOSSARY, ARCHITECTURE, STACK), `.agent/workflows/` (the `/plan`, `/execute`,
`/verify`, `/debug` process commands) and `adapters/` (per-model optional enhancements).

Use it when working inside a GSD phase. It governs **process**; this file and `docs/ecosystem/PRINCIPLES.md`
govern **the code**. They do not overlap, and neither restates the other.

> Note: GSD's `/verify` (`.agent/workflows/verify.md`) validates a *phase* against `.gsd/SPEC.md`.
> `VERIFY.md` in this repo root validates a *feature* by walking real user flows. Run both when you are
> inside a GSD phase; run `VERIFY.md` always.
