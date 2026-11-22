# The `/verify` protocol

**Last Updated:** 2026-11-21
**Applies to:** all five FlashFits repositories, and every agent — Claude, Gemini, Codex, or a human.

> **A green test suite proves the code does what the test says. It does not prove the feature works.**
>
> After every feature build, and after all tests pass, walk the real user flows the feature touches.

This exists because the failures that reach customers are almost never "the function returned the wrong
number". They are: the button is behind the keyboard; the deep link opens the wrong screen; the form cannot
express what the operator intended; the number is right but shown in the wrong currency; the flow works for
the developer's seeded account and not for a real one. No unit test catches any of those.

---

## 1. When to run it

| Trigger | Run? |
|---|---|
| Finished a feature | **yes** — mandatory, even with 100% of tests green |
| Fixed a bug | **yes** — the flow that produced the bug, plus its siblings (§4) |
| Refactor with no behaviour change | the flows through the refactored code |
| Typo, comment, doc, dependency bump | no |

**Tests passing is not a reason to skip this.** It is the precondition for starting it.

---

## 2. The protocol

### Step 0 — Preconditions

Do not start until **all** of these hold. If any fails, that is the finding; stop and report it.

- [ ] Lint and typecheck clean.
- [ ] Full test suite green — unit, integration, E2E (see [TESTING.md](TESTING.md)).
- [ ] The feature's own new tests exist and genuinely fail when the feature is reverted.
- [ ] Docs updated in the same commit (see [DOCUMENTATION-STANDARD.md](DOCUMENTATION-STANDARD.md)).

### Step 1 — Name the flows

List every user journey the change touches, from §5. For each, name **who** the user is and **what they are
trying to achieve** — not which function was changed. If the change touches no user flow, say so explicitly
and explain why (a cron-only change, say), then skip to Step 5.

Include the flows you did **not** change but which **share code** with what you did. This is where
regressions live. If you edited `calculateFinalBilling`, every flow that produces a bill is in scope,
not only the one in the ticket.

### Step 2 — Walk each flow as the user

Not as the developer. Specifically:

- **A fresh account**, not your seeded one. Seeded accounts hide onboarding, empty states and permission
  prompts.
- **The real UI** — tap the buttons, type in the fields. Not curl, not a test harness.
- **A real device or simulator** for app changes, at a **small screen size**. Most layout bugs are only
  visible at 360×640.
- **The whole journey**, from app launch to the outcome the user wanted — including the screen they land on
  afterwards.

At each step record: what you did, what you expected, what happened.

### Step 3 — The standing checklist

Every flow, every time. These are the recurring failure modes in this codebase:

**Empty, first and last**
- [ ] Empty state: no orders, no offers, no earnings — does it read as "nothing yet" rather than broken or ₹0-as-error?
- [ ] First-time user: onboarding, permission prompts, no address, no payment method.
- [ ] Boundary: exactly at a minimum cart value, exactly at a deadline, exactly one item.

**Failure and interruption**
- [ ] Airplane mode mid-flow → a real message, and recoverable state afterwards.
- [ ] Backgrounded mid-flow → resumes where it was.
- [ ] Double-tap the primary action → **one** effect, not two. (The broadcast and order-placement paths are
      the known risks here.)
- [ ] Back button / swipe-back from every new screen → somewhere sensible.
- [ ] An API 500 → a message, not a blank screen or an infinite spinner.

**Money and time — FlashFits-specific, and the most common source of real defects**
- [ ] Every amount is integer rupees with `₹`, formatted `en-IN` (`48,219` not `48219`).
- [ ] Try & Buy before payment is due shows **₹0 charged**, no refund banner.
- [ ] A total shown to the user equals what `calculateFinalBilling` returned — not a client recomputation.
- [ ] Any discount shown names **which** offer or coupon produced it.
- [ ] Every date boundary is **IST**. Check "today" at a time after 00:00 and before 05:30 IST — this is the
      bug class in [earnings-and-payouts.md §2.1](../reports/earnings-and-payouts.md) and it is invisible
      during working hours.

**Cross-role consistency** — the one most often skipped, and the one that produces support calls
- [ ] The customer, the merchant, the rider and the admin all see **the same order** in consistent states.
      Open the admin panel beside the app.
- [ ] An amount a merchant sees matches what the admin panel shows for the same order.
- [ ] Real-time updates arrive without a manual refresh (sockets), on every affected role.

**Access**
- [ ] Logged out → the protected screen redirects, it does not render blank.
- [ ] Another user's id in the URL or request → refused. (See
      [security-findings.md](../security-findings.md); do not assume this works.)

### Step 4 — Capture evidence

Per flow, a short record. No prose essays — a table row and a screenshot.

| Flow | Role | Result | Evidence |
|---|---|---|---|
| Place Try & Buy order | new customer | pass | `verify/2026-11-21-trybuy-place.png` |
| Apply coupon at checkout | returning customer | **fail** — total ₹30 off expected, showed ₹0 | screenshot + the request/response |

"It should work" and "the tests pass" are not evidence. A screenshot, a response body, or a log line is.

### Step 5 — Verdict

**PASS** — every flow walked, every checklist item either passes or is justified as not-applicable.
Write the record to `verify/<date>-<feature>.md` and say so in the handover.

**FAIL** — fix and re-run from Step 0. Not from Step 2: a fix invalidates the test run.

**BLOCKED** — see §3.

---

## 3. The 3-strike escalation

If a specific failure resists **three** genuine fix attempts: **stop.**

Three failures means the model of the problem is wrong. A fourth attempt, made on the same wrong model,
usually breaks something adjacent — and the agent that keeps going is the one that turns a one-line bug into
a refactor nobody asked for.

Then, in order:

1. **Revert** the attempted fixes, unless one left the system better. Do not leave three half-fixes in place.
2. **Record it** in `docs/KNOWN-ISSUES.md` using this exact shape:

```markdown
## <short title>
**Found:** YYYY-MM-DD · **Where:** path/to/file.js:line · **Severity:** blocker | degraded | cosmetic
**Flow:** <which user flow from §5 exposes it>
**Symptom:** <what is observably wrong, with the evidence>
**Tried:** 1) <approach + why it failed> 2) … 3) …
**Current state:** shipped-broken | reverted | feature-flagged off
**Next idea:** <most promising untried approach>
**Blocked on:** <a decision, a credential, a third party — or "nothing, just hard">
```

3. **If it is a blocker**, do not ship the feature. Feature-flag it off and say so.
4. **Tell the human**, naming the file and the one decision or piece of information that would unblock it.
5. **Update the docs** if the attempts revealed that `DESIGN.md` or a `docs/` file was wrong. A failed fix
   usually means something documented is untrue — that is worth more than the fix.

---

## 4. Sibling-flow rule

Before declaring PASS, grep for other callers of what you changed:

```bash
grep -rn "calculateFinalBilling" --include=*.js Backend/src
```

Every caller is a sibling flow and must be walked. This is not optional diligence — it is the exact
discipline that would have caught
[the rider settlement bug](../reports/coupons-and-offers.md): three call sites were updated, the fourth was
not, and every test passed because no test covered the fourth.

---

## 5. Flow catalogue

The journeys this product is made of. Each repo's own `VERIFY.md` lists the subset it participates in.

### Customer (`FlashFitsv2`)

| # | Flow | Touches |
|---|---|---|
| C1 | Onboard: install → OTP sign-in → location permission → set address | auth, address |
| C2 | Browse: home → gender toggle → category → product → variant select | home, products |
| C3 | Search with a typo → result → open product | search |
| C4 | Add to bag (Try & Buy and courier in one cart) → cart shows the split | cart |
| C5 | Checkout Try & Buy: address → tip → **coupon** → shows **₹0 upfront** | cart, offers |
| C6 | Checkout courier: prepaid via Razorpay → success and failure | courier, payments |
| C7 | Track: live rider map → status stepper → arrival | sockets, orders |
| C8 | **Trial:** OTP handed over → timer → mark keep/return → pay kept items | orders, billing, offers |
| C9 | Cancel before payment → **₹0 charged**, no refund banner | cancellation |
| C10 | Courier return within 3 days → reason → refund status | returns |
| C11 | Wallet: balance, refund credit, pay with wallet | wallet |
| C12 | Report a damaged item with a photo → refund | support |
| C13 | Refer & earn → share → the referred user's coupon applies | referral, offers |
| C14 | Open a campaign from the home hero → campaign screen → themed correctly | campaigns |
| C15 | Force-update gate when below `minVersion` | appConfig |

### Merchant (`MerchantModule`, `MerchantApp`)

| # | Flow | Touches |
|---|---|---|
| M1 | Register → KYC + bank + GSTIN → map location → registration fee → pending → approved | auth, onboarding |
| M2 | Add a product with variants, sizes, colours, images | products |
| M3 | Bulk upload a product CSV, including a malformed row | products |
| M4 | Quick stock update: in / low / out | inventory |
| M5 | **Order alert:** chime + popup → accept within the window → pack → zip-cover seal | sockets, orders, alerts |
| M6 | Decline an order, and let one time out | orders |
| M7 | Hand over to the rider: last-4 match → share pickup OTP | orders |
| M8 | Verify a returned item → approve the return handshake | returns |
| M9 | Create a store offer, and a store coupon → appears for customers | offers |
| M10 | Earnings: current week → **custom range** → per-order breakdown → UTR → CSV | earnings |
| M11 | Toggle store online/offline, and set business hours | profile |
| M12 | Warehouse operator: dashboard → inventory → fulfil a warehouse order | warehouse |

### Delivery partner (`FlashFits-Delivery-App`)

| # | Flow | Touches |
|---|---|---|
| R1 | Register → licence + vehicle + bank → approved | auth |
| R2 | Go online → device-readiness checks → receive an offer with the alarm | sockets, alerts |
| R3 | Accept inside the 15s window, and let one expire | dispatch |
| R4 | Navigate to pickup → item + seal verification → pickup OTP | orders |
| R5 | Navigate to customer → delivery OTP → start the trial | orders |
| R6 | Trial timer → record keep/return → collect via QR, and via cash | billing, payments |
| R7 | Photograph returns → return to store → merchant handshake | returns |
| R8 | Earnings: today → this week → **custom range** → incentive progress → cash-in-hand | earnings |
| R9 | Background location keeps updating while the app is backgrounded | location |

### Admin (`FF_api_web/website/FFmanagement`)

| # | Flow | Touches |
|---|---|---|
| A1 | Live orders board updates in real time | sockets |
| A2 | Approve a merchant; reject one with a reason | merchants |
| A3 | Create an admin offer; create a coupon; verify both in the app | offers |
| A4 | Create a campaign collection with a theme and schedule | campaigns |
| A5 | Run the weekly payout; record a UTR; apply a penalty with a reason | payouts |
| A6 | Zones and hubs: create, assign, change status | zones |
| A7 | Broadcast a notification → arrives on a real device → **the tap lands correctly** | notifications |
| A8 | Maintenance mode on → customer app shows the maintenance screen | appConfig |
| A9 | Resolve a return issue → refund → customer wallet reflects it | returns, wallet |
| A10 | Finance: reconcile commission, deductions, merchant vs FlashFits attribution | finance |

### Cross-role — the ones that matter most

| # | Flow |
|---|---|
| X1 | **The whole Try & Buy journey** — C5 → M5 → M7 → R4 → R5 → C8 → R6 → R7 → M8, with the admin board open throughout. **Run this before any release.** |
| X2 | A coupon's full life: A3 → C5 → C8 → settlement → M10 shows the right payout → A10 attributes it to the right bearer |
| X3 | A campaign's full life: A4 → C14 → expiry → the app returns to default |
| X4 | A broadcast's full life: A7 → received on a locked device → tapped → lands on the campaign |

---

## 6. For non-Claude agents

This file **is** the specification. There is nothing Claude-specific in it.

- **Claude Code:** `/verify` → `.claude/commands/verify.md`, which is one line importing this file.
- **Gemini CLI, Codex, Cursor, anything else:** each repo's `AGENTS.md` instructs you to follow its
  `VERIFY.md`, which points here. Read it and execute the steps.
- **No browser or device available?** Say so explicitly, run everything you *can* (integration tests against
  real routes, response-body inspection, rendered-HTML assertions), and mark the verdict
  **PARTIAL — manual device verification outstanding**, listing which flows a human must walk.
  Do **not** report PASS for a flow you could not execute. An unverified claim of verification is worse than
  no verification, because it stops anyone else from checking.
