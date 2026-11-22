# Engineering principles & enforcement

**Last Updated:** 2026-11-21
**Applies to:** all five FlashFits repositories.

Ten rules. They are chosen because each one addresses a problem that has **already** cost this codebase
something — every rule below has a named violation in the repos today. That is the bar for adding another:
show the bug it would have prevented.

---

## The principles

### 1. One way in for every change

Every write to an order, product, offer or payout goes through **one** function, whatever triggered it — HTTP,
socket, cron, or another service. Controllers translate and delegate; they do not hold rules.

*Violated today:* the kept-items offer recalculation is copy-pasted three times in
`order.controllers.js` and **missing** from the rider settlement path, which is an active money leak
([coupons-and-offers.md B1/B13](../reports/coupons-and-offers.md)). Business logic also lives inline in
`routes/merchant.routes.js` (539 lines) and `routes/deliveryRider.routes.js` (476 lines) rather than in
controllers.

### 2. One source for each fact

A rule, rate, enum or default is stated **once**. If two places need it, one imports from the other.

*Violated today:* IST day boundaries (correct in `weeklyPayoutHelper.js`, re-implemented wrongly in
`analytics.controller.js`); the overtime rate ₹2/min (hardcoded twice, also in `appConfig`); the free-delivery
cascade (four implementations, [coupons-and-offers.md §8.1](../reports/coupons-and-offers.md));
`maxUsagePerUser` defaults (three different values); the admin offer-type list (duplicated in the controller
and the React page).

### 3. Identity comes from a verified token, never from input

Role, user id, merchant id and rider id are read from a verified JWT. Never from a query parameter, body
field or socket handshake.

*Violated today:* **every Socket.IO connection.** [security-findings.md S1](../security-findings.md) — the
highest-severity finding in the ecosystem.

### 4. Money is recomputed, never carried

In Try & Buy every amount is provisional until the trial ends. A total, discount or settlement figure
computed at checkout is **an estimate**. Recompute against kept items before charging or settling, using the
same function the customer's screen used.

*Violated today:* the rider settlement path reuses the checkout discount, overcharging the merchant and
undercharging the customer on the same order
([coupons-and-offers.md B1, C4](../reports/coupons-and-offers.md)).

### 5. Commands are calls; events are notifications

If you need something to happen, call the function. If you want to tell someone it happened, emit the event.
Never trigger work by listening for a broadcast.

*Violated today:* `io.emit` is monkey-patched in `Backend/index.js` so that an event name prefix
(`orderQueued:`) triggers rider matching. A rename silently disables dispatch
([security-findings.md S4](../security-findings.md)).

### 6. Fail closed

An unknown role, a missing token, an unvalidated input, an unrecognised offer type → **refuse**. Never
default to permissive. In production, a missing config is a startup failure, not a silent fallback.

*Violated today:* `updateOffer` mass-assigns `req.body` without `runValidators`, so every schema enum is
unenforced on update ([coupons-and-offers.md B16](../reports/coupons-and-offers.md)).

### 7. Write-time truth, read-time simplicity

Derive and store a fact once when it is written. Readers read; they do not re-derive.

*Rationale:* the free-delivery cascade is re-applied at write **and** twice at read, which is why granular
admin control is currently impossible to express
([coupons-and-offers.md §8](../reports/coupons-and-offers.md)).

### 8. Concurrent paths need atomic claims

Any limit, counter or queue touched by more than one request at a time is enforced with a single atomic
operation or a unique index — never check-then-write.

*Violated today:* `maxUsageTotal`, `maxUsagePerUser` and `recordOfferUsage` are all check-then-write; coupon
code uniqueness has no unique index
([coupons-and-offers.md B4, B5, B6, B14](../reports/coupons-and-offers.md)).

### 9. Tests ship with the feature

New work lands with tests. Existing code gets them gradually. See [TESTING.md](TESTING.md) — this is a hard
requirement for new code and a soft one for old.

### 10. A feature is not done until its user flows are walked

A green test suite proves the code does what the test says. It does not prove a rider can read their
earnings or an admin can run a sale. Run [VERIFY.md](VERIFY.md) before calling anything complete.

---

## Naming conventions

### Backend (Node, MongoDB, Mongoose)

| Thing | Convention | Example |
|---|---|---|
| Model file | `<entity>.model.js`, singular | `weeklyPayout.model.js` |
| Mongoose model name | `PascalCase` singular; collection pluralised automatically | `WeeklyPayout` |
| Controller file | `<domain>.controllers.js` under `controllers/<role>Controller[s]/` | `adminControllers/offer.controllers.js` |
| Route file | `<area>.routes.js` | `merchant.routes.js` |
| Helper | `<domain>Fns.js` or `<domain>Helper.js`, `camelCase` | `weeklyPayoutHelper.js` |
| Service | `<domain><Noun>.js` — cross-cutting, no HTTP awareness | `offerEngine.js` |
| Socket handler | `<role>.socket.js`, exporting `register<Role>Sockets(io, socket)` | `merchant.socket.js` |
| Field | `camelCase`; dates end `At`; booleans start `is`/`has`/`requires` | `settledAt`, `isActive`, `requiresCoupon` |
| Enum value | `SCREAMING_SNAKE` for domain enums, `snake_case` for status strings | `FIRST_TIME_USER`, `try_phase` |
| Money field | integer rupees; a rate ends `Rate`, a per-unit value says the unit | `commissionRate`, `waitingChargePerMinute` |
| Route path | `/<role>/<resource>` kebab-case | `/merchant/earnings/current-week` |

> The split between `controllers/adminController/` (singular) and `controllers/adminControllers/` (plural) is
> an existing inconsistency. Use the **plural** form; fold the singular one in when touching it.

### React (admin panel, MerchantModule)

Components and pages `PascalCase.tsx`; hooks `useX.ts`; utilities `camelCase.ts`; API clients
`src/api/<domain>.ts`; routes kebab-case. Tests beside the file as `X.test.tsx`.

### Expo apps

Routes follow `expo-router` file conventions — groups `(name)`, dynamic `[param]`. Screens are the route
files; shared UI in `components/`; contexts `XContext.tsx`; API clients `api/<domain>.ts`. Prefer typed
routes (`experiments.typedRoutes` is on in `MerchantApp` and should be on everywhere).

### Commits

```
type(scope): description
```

`feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `perf`. One logical change per commit.
Commit **explicit paths** — never `git add -A`, which is how scratch files and `.env` files get committed
(see [security-findings.md S6](../security-findings.md)).

---

## Git hooks

No new dependency: a plain shell script plus git's own `core.hooksPath`. Husky is unnecessary for this.

### Install (each repo, once per clone)

```bash
git config core.hooksPath .githooks
```

Put that line in each repo's `README.md` under setup. It is per-clone, so a new developer must run it —
there is no way around that without a dependency, and the dependency is not worth it.

### `.githooks/pre-commit`

Path-aware and cheapest-first, so an unrelated commit is not slowed down. It **blocks** on things that are
objectively broken and **warns** on judgement calls — a hook that blocks spuriously gets bypassed with
`--no-verify`, and then it protects nothing.

| Check | Scope | Blocks? |
|---|---|---|
| Secrets: `.env`, `*.pem`, `*.jks`, `*credentials*`, `serviceAccount*.json` staged | all | **block** |
| Large file > 2 MB staged | all | **block** |
| `console.log` added in `Backend/src/**` | backend | warn |
| Lint (`eslint`) on changed packages | per repo | **block in strict mode**, else warn |
| `tsc --noEmit` | TS repos | **block in strict mode**, else warn |
| Tests for changed packages | per repo | **block in strict mode**, else warn |
| `new Date(... + "T00:00:00.000Z")` added | backend | warn + name the IST helper |
| Code changed under `<path>/` with no change under `docs/<path>/` | all | warn |
| `_Last Updated:` older than 180 days in a touched doc | all | warn |

### `.githooks/commit-msg`

Blocks a message that does not match `^(feat|fix|docs|refactor|test|chore|perf)(\([a-z0-9._/-]+\))?: .{3,}`.
One regex, catches the whole convention.

### `.githooks/pre-push`

The expensive gate, run once per push rather than per commit: full lint + typecheck + the whole test suite.
Blocks on failure.

### Lenient by default, strict when you opt in

No repo has a clean lint baseline today and none has a test suite, so lint/typecheck/test **warn** rather
than block. They start blocking the moment a repo creates the marker file:

```bash
touch .githooks/strict && git add .githooks/strict
```

Flip it per repo, the day that repo's baseline is green. This matters: a hook that blocks every commit gets
bypassed with `--no-verify` within a day, and after that it protects nothing — including the secret and
large-file checks, which are the ones you actually cannot afford to lose.

**Secrets, large files and the commit-message format always block**, in both modes. They have no false
positives, so there is no reason to soften them.

### Verifying the hooks

The hooks have their own self-check — they contain real logic, so they get a real test:

```bash
bash .githooks/test-hooks.sh     # builds a throwaway repo, exercises every rule, prints PASS/FAIL
```

Run it after editing a hook. It currently passes 8/8.

### Why not CI instead?

Do both — but hooks first. There is no CI in any of these repos today, and a hook you can install in one
command is worth more right now than a pipeline nobody has set up. Once CI exists, the hooks become the fast
feedback and CI becomes the authority (hooks can be bypassed; CI cannot).

---

## The 3-strike rule

If you cannot fix a specific failure after **three** genuine attempts, **stop**. Do not keep trying, do not
work around it silently, and do not widen the change hoping the problem moves.

Record it in `docs/KNOWN-ISSUES.md`:

```markdown
## <short title>
**Found:** YYYY-MM-DD · **Where:** path/to/file.js:line · **Severity:** blocker | degraded | cosmetic
**Symptom:** <what is observably wrong>
**Tried:** 1) … 2) … 3) …
**Current state:** <is it shipped broken, reverted, or feature-flagged off?>
**Next idea:** <the most promising untried approach>
**Blocked on:** <a decision, an access credential, a third party — or "nothing, just hard">
```

Then tell the human, naming the file. Three failed attempts means the model of the problem is wrong, and the
fourth attempt is the one that breaks something adjacent.

`FF_api_web` already encodes this in `.agent/workflows/` under `<context_hygiene>` — this is the same rule
stated for every repo.
