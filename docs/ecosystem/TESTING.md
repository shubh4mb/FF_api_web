# Testing standard

**Last Updated:** 2026-11-21
**Applies to:** all five FlashFits repositories.

**Current state: there are zero tests and zero test infrastructure in all five repos.** Verified — no
`*.test.*`, no `*.spec.*`, no test runner configured anywhere.

That fact sets the policy. A 95%-coverage gate on a codebase with no tests is a gate that gets disabled in
week one. So:

> **New work ships with tests. Existing code gets tests gradually, and preferentially when a bug is found
> in it.**

---

## 1. The stacks

Chosen so that each repo uses the runner its existing tooling already implies. No new build systems.

| Repo | Unit + integration | E2E | Why |
|---|---|---|---|
| `FF_api_web` (Backend) | **Vitest** + `supertest` + `mongodb-memory-server` | — | Vitest runs native ESM, which the backend is (`"type": "module"`). Jest needs babel for this. |
| `FF_api_web` (admin panel) | **Vitest** + `@testing-library/react` | **Playwright** | Vite is already the build tool; Vitest shares its config and transform pipeline. Zero extra config. |
| `MerchantModule` | **Vitest** + `@testing-library/react` | **Playwright** | same |
| `FlashFitsv2` | **jest-expo** + `@testing-library/react-native` | **Maestro** | `jest-expo` is what Expo prescribes and keeps working across SDK upgrades. |
| `FlashFits-Delivery-App` | same | same | |
| `MerchantApp` | same | same (or Playwright after a Capacitor migration) | |

**Playwright over Cypress:** free parallelism, better trace viewer, one binary for all three browsers.
**Maestro over Detox:** YAML flows, no native build configuration, runs against a release build. Detox is
more powerful and takes a week to set up; Maestro takes an afternoon. Revisit only if Maestro proves limiting.

### Installing, per repo

```bash
# Backend  (FF_api_web/Backend)
npm i -D vitest supertest mongodb-memory-server
# scripts: "test": "vitest run", "test:watch": "vitest", "test:cov": "vitest run --coverage"

# Vite repos  (MerchantModule, website/FFmanagement)
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test

# Expo repos
npx expo install -- --dev jest-expo jest @testing-library/react-native
# Maestro: curl -Ls "https://get.maestro.mobile.dev" | bash   (flows in .maestro/*.yaml)
```

---

## 2. The kinds of test, and what each is for

Use the cheapest kind that can catch the bug. The discipline that matters: **push a case down to the cheapest
layer that can express it.** A rule tested in an E2E flow costs 200× what the same rule costs as a unit test,
and tells you less when it fails.

### Unit — pure logic, no I/O

Milliseconds. No DB, no network, no filesystem, no clock.

This is where most of FlashFits' risk actually lives, because the money logic is already pure:

| Function | File | Why it's the ideal unit test |
|---|---|---|
| `calculateFinalBilling` | `helperFns/calculateFinalBilling.js` | pure; decides what every customer pays |
| `calculateDiscount`, `isItemApplicable`, `getApplicableAmount` | `services/offerEngine.js` | pure; decides every discount |
| `getWeekBounds`, `getDayStartIST` | `helperFns/weeklyPayoutHelper.js` | pure; decides every date boundary |
| `incentiveEngine` slab matching | `helperFns/incentiveEngine.js` | pure; decides rider bonuses |
| `deliveryChargeFns`, `geoHelpers` | `helperFns/` | pure arithmetic |

**Freeze the clock.** Never call `Date.now()` in a test. `vi.setSystemTime(new Date('2026-11-21T18:30:00Z'))`
— and pick instants that are *interesting* in IST: 00:15 IST (previous UTC day), Monday 00:00 IST, a month
end, 29 February.

### Integration — real database, real routes, no network

`mongodb-memory-server` gives a real MongoDB per suite, so Mongoose schemas, indexes, unique constraints and
transactions are genuinely exercised. `supertest` drives the Express app without binding a port.

This layer is where to prove:
- **Authorisation** on every route: rider A cannot read rider B's earnings; a non-admin cannot broadcast.
  Write one of these per protected route. They are short and they are the tests that catch real breaches.
- **Atomicity:** fire N concurrent requests at a limited coupon; assert exactly one wins. Unique indexes
  only exist at this layer.
- **Date boundaries:** seed an order at 00:10 IST, assert it lands in the right day bucket.
- **Idempotency:** replay a request with the same key, assert one effect.

Stub only true third parties — Razorpay, Expo push, Cloudinary, Twilio, Gemini. Never stub Mongo.

### Contract / fixture tests ("case tests")

A directory of real-world inputs, run through the logic, asserted against stored expected output.

```
Backend/src/services/__fixtures__/offers/*.json      # offers the admin team actually creates
Backend/src/helperFns/__fixtures__/billing/*.json    # real order shapes: all-kept, partial, all-returned
```

Worth it because: (a) it documents what production data actually looks like, which no unit test does; and
(b) when you change the offer condition logic ([coupons-and-offers.md B8](../reports/coupons-and-offers.md)),
these tests tell you which **live** offers change behaviour. That is the only way to make that migration
safely.

Snapshot-style, but **review every snapshot change deliberately** — a blindly-accepted snapshot update is
worse than no test.

### E2E — the real app against a real backend

Slow, flaky-prone, expensive. Keep the suite **small and about journeys, not rules**. One happy path per
critical flow; edge cases belong in the layers above.

The flows worth E2E coverage (and only these, to start):

| Flow | Tool |
|---|---|
| Customer places a Try & Buy order and reaches `try_phase` | Maestro |
| Customer keeps some / returns some, pays, order completes | Maestro |
| Merchant accepts, packs, attaches a zip-cover seal | Playwright (MerchantModule) |
| Rider accepts → pickup OTP → delivery OTP → settlement | Maestro |
| Customer applies a coupon and sees the right total | Maestro |
| Admin creates a campaign and it appears in the app | Playwright + Maestro |
| Merchant/rider filters earnings by a custom range and the total matches | Playwright / Maestro |

### Load

`load-tests/` already exists in `Backend` with a k6 script and `npm run test:k6`. Keep it. Run it before a
campaign that will spike traffic — a Christmas sale is exactly the event that finds the single-instance
constraint in [security-findings.md S3](../security-findings.md).

---

## 3. Expectations

### For new work — required, enforced

A feature is not complete without:

1. **Unit tests for every pure function** it adds, including the boundary and failure cases.
2. **One integration test per new or changed endpoint**, including its **authorisation** test.
3. **A regression test for every bug fixed**, written so it fails before the fix. If you cannot make it fail
   first, you have not found the bug.
4. **One E2E flow** if the feature adds or changes a user journey.
5. **A `/verify` pass** — see [VERIFY.md](VERIFY.md). Tests are necessary, not sufficient.

### For existing code — gradual, unenforced

No coverage gate yet. Instead, two rules that make coverage grow where it is worth most:

- **Boy-scout rule:** touching a file with no tests? Add tests for the part you touched. Not the whole file.
- **Bug-first rule:** every bug fixed in legacy code gets its regression test. Bugs cluster, so coverage
  accumulates exactly where the defects are.

### Coverage gates — later, and staged

Introduce only once a suite exists and is green in CI. Then ratchet: measure, set the gate at the current
number, and raise it as it rises. A gate that is never red teaches nothing; a gate that is always red gets
removed.

Suggested first targets, by value rather than by line count:

| Area | Target | Why this number |
|---|---|---|
| `helperFns/calculateFinalBilling.js`, `services/offerEngine.js`, `helperFns/orderSettlement.js`, `helperFns/weeklyPayoutHelper.js`, `helperFns/incentiveEngine.js` | **95%** | pure, and every line is money |
| Controllers | 60% | mostly glue; the value is in the auth tests |
| Routes | — | should contain no logic; if coverage matters here, the logic is in the wrong place (principle 1) |
| React components | 40% | render + interaction on the complex ones only |
| Expo screens | 30% | E2E covers these better than unit tests do |

---

## 4. Conventions

- **Location:** beside the code. `offerEngine.js` → `offerEngine.test.js`. Not a parallel `__tests__` tree —
  a test you can see is a test you remember to update.
- **Name:** `describe('<unit>')` → `it('<does what> when <condition>')`. The failure output should read as a
  sentence.
- **One assertion idea per test.** Several `expect`s proving one fact is fine; several unrelated facts is not.
- **No shared mutable state between tests.** Each test seeds what it needs. Order-dependent suites rot.
- **Fixtures, not factories, to start.** A JSON file is easier to read than a builder DSL. Add a factory when
  the third test needs the same shape with one field different.
- **Never assert on a `console.log`.** Assert on returned values and persisted state.
- **Test the contract, not the implementation.** A test that breaks on a refactor with no behaviour change is
  a liability — delete it rather than update it.

---

## 5. First tests to write

Highest value per hour, given the findings. Each has a named bug it would have caught:

| # | Test | Catches |
|---|---|---|
| 1 | `calculateFinalBilling` — partial keep with a `minCartValue` discount, **settled via the rider path** | [B1 / C4](../reports/coupons-and-offers.md) — customer undercharged *and* merchant overcharged |
| 2 | `getDayBoundsIST` — 00:15 IST, month end, leap day | [the UTC/IST bug](../reports/earnings-and-payouts.md) in every daily figure |
| 3 | Concurrent redemption of a `maxUsageTotal: 1` coupon | [B4](../reports/coupons-and-offers.md) over-redemption |
| 4 | `selectedOffers` with 5 stackable offer ids | [B3](../reports/coupons-and-offers.md) free-order exploit |
| 5 | Socket connect with `role=admin` and no token | [S1](../security-findings.md) unauthenticated PII access |
| 6 | `isItemApplicable` — the full category × gender matrix | [B8](../reports/coupons-and-offers.md) wrong-audience discounts |
| 7 | Admin offer with `freeDelivery` only → the other two stay false | [§8.1](../reports/coupons-and-offers.md) cascade overriding the admin's choice |
| 8 | Attribution conservation: `merchantDiscount + adminDiscount + unrecovered` = total given | [C5](../reports/coupons-and-offers.md) silent cross-subsidy |

Tests 1, 2 and 5 are the three to write first. Each corresponds to something currently losing money or
leaking data.
