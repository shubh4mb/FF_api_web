# VERIFY — FF_api_web (backend + admin panel)

**The protocol is defined once, for every repo and every agent, in
[docs/ecosystem/VERIFY.md](docs/ecosystem/VERIFY.md). Read it.**
This file lists the flows *this* repo participates in, and the checks specific to it.

> A green test suite proves the code does what the test says. It does not prove the feature works.
> Run this after a feature build, **even when all tests pass**.

## The short version

0. **Preconditions** — lint clean, typecheck clean, all tests green, the feature's own tests genuinely fail
   when the feature is reverted, docs updated in the same commit.
1. **Name the flows** the change touches — including the ones you did *not* change but which share code
   (`grep` the callers; that is where regressions live).
2. **Walk each one as the user** — fresh account, real UI, real device, small screen, whole journey.
3. **Run the standing checklist** from the hub file: empty states, first-time user, boundaries, offline,
   backgrounding, double-tap, back button, API 500, money formatting, IST dates, cross-role consistency,
   access control.
4. **Capture evidence** — a screenshot or a response body per flow. "It should work" is not evidence.
5. **Verdict** — PASS (record it in `verify/<date>-<feature>.md`), FAIL (fix, re-run from step 0), or
   BLOCKED (see below).

## Flows owned by this repo

| # | Flow |
|---|---|
| A1 | Live orders board updates in real time |
| A2 | Approve a merchant; reject one with a reason |
| A3 | Create an admin offer; create a coupon; verify both appear in the customer app |
| A4 | Create a campaign collection with a theme and schedule |
| A5 | Run the weekly payout; record a UTR; apply a penalty with a reason |
| A6 | Zones and hubs: create, assign, change status |
| A7 | Broadcast a notification → arrives on a real device → **the tap lands correctly** |
| A8 | Maintenance mode on → the customer app shows the maintenance screen |
| A9 | Resolve a return issue → refund → the customer wallet reflects it |
| A10 | Finance: reconcile commission, deductions, merchant vs FlashFits attribution |

Because this repo is the API, **every** flow in the catalogue runs through it. A change to
`helperFns/`, `services/` or `models/` means walking the client flows that depend on it, not only the admin
screens.

The full catalogue, including the cross-role flows, is in the hub file. **X1 — the whole Try & Buy journey
across all four roles — is run before any release.**

## Checks specific to this repo

- [ ] **Sibling call sites.** `grep -rn "<function>" --include=*.js Backend/src` and walk every caller. This
      is the exact discipline that would have caught the rider settlement bug: three call sites updated, the
      fourth missed, all tests green.
- [ ] **IST boundaries.** Any date filter: check a timestamp between 00:00 and 05:30 IST. A UTC boundary bug
      is invisible during working hours.
- [ ] **Money conservation.** After a settlement change, assert
      `merchantDiscount + adminDiscount + unrecovered` equals the discount actually given. Nothing may vanish.
- [ ] **Authorisation per route.** Call the endpoint as the wrong role and as another user's id. Do not
      assume it is protected — see `docs/security-findings.md`.
- [ ] **Socket effects.** If the change emits, confirm every role that should receive it does, with the
      admin panel open beside the app.
- [ ] **Single instance.** Remember the backend runs on one instance today (`docs/security-findings.md` S3).
      Do not introduce anything that silently assumes more.
- [ ] **Admin panel at 360px** — merchants and support staff use it on phones.

## When something will not fix

Three genuine fix attempts on one specific failure and no further. Then: **stop**, revert the attempts,
record it in `docs/KNOWN-ISSUES.md` in the documented format, and tell the human the one decision or
credential that would unblock it.

A fourth attempt built on a wrong model of the problem is the one that breaks something adjacent.

## For non-Claude agents

Nothing here is Claude-specific. Claude Code has `/verify`; every other agent reads this file and the hub
file and executes the steps. If you have no device or browser, run what you can and report
**PARTIAL — manual device verification outstanding**, naming the flows a human must walk. Never report PASS
for a flow you could not execute.
