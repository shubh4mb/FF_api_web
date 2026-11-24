# Known issues

Problems that resisted three genuine fix attempts, or that are known and deliberately not fixed yet.

**Why this file exists:** after three failed attempts the model of the problem is wrong, and a fourth attempt
usually breaks something adjacent. Recording the attempt is more valuable than making it. See the 3-strike
rule in `../FF_api_web/docs/ecosystem/PRINCIPLES.md` and `VERIFY.md`.

Anything here that is a *bug with a known fix* belongs in a ticket, not in this file. This is for things that
are **stuck**.

## Format

Copy this block, newest first.

```markdown
## <short title>
**Found:** YYYY-MM-DD · **Where:** path/to/file.js:line · **Severity:** blocker | degraded | cosmetic
**Flow:** <which user flow from VERIFY.md exposes it>
**Symptom:** <what is observably wrong, with the evidence>
**Tried:** 1) <approach + why it failed> 2) … 3) …
**Current state:** shipped-broken | reverted | feature-flagged off
**Next idea:** <the most promising untried approach>
**Blocked on:** <a decision, a credential, a third party — or "nothing, just hard">
```

---

_No entries yet._
