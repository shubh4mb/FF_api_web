# Documentation standard

**Last Updated:** 2026-11-21
**Applies to:** all five FlashFits repositories.
**Modelled on:** `eltask` (`Work Space/elSapiens/eltask`), whose docs mirror its code tree.

The point of this standard is that **an agent or a new developer opening any folder can find the document
that explains it, and that document is current.** Everything below serves that.

---

## 1. The rule that matters most

> **Docs mirror the code tree. `docs/<same path>/README.md` documents `<path>/`.**
> **Update the doc in the same commit as the code.**

```
Backend/src/services/offerEngine.js   →   docs/backend/src/services/README.md
website/FFmanagement/src/pages/       →   docs/website/src/pages/README.md
src/app/(tabs)/                       →   docs/src/app/README.md
```

A doc that is wrong is worse than a doc that is missing, because the missing one sends you to the code. The
pre-commit hook (§6) enforces the same-commit rule mechanically, because a convention nobody enforces decays
within a month.

---

## 2. Files every repo has at its root

| File | Audience | Answers | Length |
|---|---|---|---|
| **`README.md`** | a human arriving at the repo | How do I run this? What is it? | ≤ 150 lines |
| **`PRODUCT.md`** | anyone, technical or not | What is this *for*? Who uses it? What are the concepts? | ≤ 150 lines |
| **`DESIGN.md`** | someone about to change it | How is it built, and why that way? Where are the seams? | 200–450 lines |
| **`AGENTS.md`** | **any** AI coding agent | The rules. The non-negotiables. Where to look. | ≤ 120 lines |
| **`CLAUDE.md`** | Claude Code | one line: `@AGENTS.md` | 1 line |
| **`GEMINI.md`** | Gemini CLI | one line: `@AGENTS.md` | 1 line |
| **`VERIFY.md`** | any agent finishing a feature | The user flows to walk after the tests pass | ≤ 200 lines |
| **`docs/KNOWN-ISSUES.md`** | everyone | Things an agent could not fix, and what it tried | grows |

### Why `AGENTS.md` is the single source

`AGENTS.md` is the emerging cross-tool convention (Codex, Cursor, Zed, Gemini CLI, others). Claude Code reads
`CLAUDE.md`; Gemini CLI reads `GEMINI.md`. Rather than maintain three copies that drift, **`AGENTS.md` holds
the content and the other two are one-line imports:**

```markdown
<!-- CLAUDE.md -->
@AGENTS.md
```

`MerchantApp` already does exactly this. It is the pattern; reuse it. When a new tool appears, add a
one-line pointer — never a second copy of the rules.

**If a tool needs genuinely tool-specific content** (a Claude skill, a Gemini-only setting), put *that* in the
tool's file **below** the import, and keep everything shared in `AGENTS.md`. One fact, one place.

> `FF_api_web` additionally carries the GSD framework (`PROJECT_RULES.md`, `.gsd/`, `.agent/workflows/`,
> `adapters/`). That is a *process* framework and stays as it is. `AGENTS.md` points at it rather than
> restating it.

---

## 3. What goes in each file

### `PRODUCT.md`

Plain language. No stack names, no file paths. A non-engineer should finish it understanding the product.

```markdown
# <App>: what it is
_Last Updated: YYYY-MM-DD_

<Two or three sentences. What it does, for whom.>

## Who uses it
<Each role, and what they come here to do.>

## The main ideas
| Idea | In plain words |
|---|---|
<The domain vocabulary. This table is the glossary everything else assumes.>

## What it does today
<Shipped. Present tense.>

## Later (built when needed)
<Named, not detailed. Guards against someone building it speculatively.>

## Status
<Where the product actually is, honestly.>
```

### `DESIGN.md`

The document you want when about to change something. Lead with a diagram, then the decisions.

```markdown
# <App>: design
_Last Updated: YYYY-MM-DD (<what changed>)_

## 1. Architecture
<ASCII diagram: processes, data stores, who calls whom. Then the stack, one list.>

## 2. Layering and where logic lives
<The intended shape, and honestly where the code departs from it.>

## 3. Identity, tenancy, authorisation
## 4. Data model overview
<Table of models → purpose. Detail lives in docs/<path>/README.md.>

## 5. Real-time / background work
## 6. Contracts (API surface)
## 7. Known debt
<Ranked. With the cost of each. This is the most-read section — do not skip it.>

## 8. Open points
<Decisions not yet made, so nobody assumes one was.>
```

**`DESIGN.md` must describe the code as it is, not as intended.** If route files hold business logic, say so
and put it in §7. An aspirational design doc teaches an agent a structure that doesn't exist, and it will
write code to match the fiction.

### `AGENTS.md`

Short, imperative, enforceable. The template is in [PRINCIPLES.md](PRINCIPLES.md) §5.

Every `AGENTS.md` must contain, in this order: a pointer to `PRODUCT.md`/`DESIGN.md`; the non-negotiable
principles for that repo; the commands (install, run, lint, typecheck, test); where docs live and the
same-commit rule; the testing requirement; the `/verify` requirement; and the 3-strike escalation rule.

### `docs/<path>/README.md`

One per meaningful directory. Start with the directory name, state its single responsibility, then the
details a caller needs.

```markdown
# src/services/

<One sentence: what this folder is responsible for.>

| File | What | Notes |
|---|---|---|

## Contracts
<Exported functions, their inputs, and what they guarantee. Pre/post-conditions.>

## Gotchas
<What has bitten someone. The highest-value section in the file.>
```

Keep them short. A 40-line doc that is read beats a 400-line one that is not.

---

## 4. Index files

Each repo's `docs/README.md` is a **table** mapping every documented path to its doc, like
`eltask/docs/backend/README.md`. It is the map an agent uses to find things without walking the tree.

Each level of `docs/` that has children gets an index too. A path with no doc is listed as `—` so the gap is
visible rather than ambiguous.

---

## 5. Rules for keeping it true

1. **`_Last Updated:` on every doc**, with a note of what changed. A stale date is a warning label.
2. **Update the doc in the commit that changes the code.** Not after. Not in a follow-up.
3. **One fact, one place.** If two docs state the same thing, one must link to the other. Duplication is how
   docs start lying.
4. **Link, don't repeat.** Reference `file.js:42` as a relative markdown link so it stays clickable.
5. **Write down what is wrong.** Known bugs and debt belong in `DESIGN.md` §7 or `docs/KNOWN-ISSUES.md`, not
   in someone's memory.
6. **Delete rather than let rot.** A doc for deleted code goes in the same commit as the deletion.
7. **No generated boilerplate.** The `create-expo-app` README must be replaced, not appended to. Four of the
   five repos currently ship scaffold READMEs that tell a reader nothing.

---

## 6. Enforcement

[PRINCIPLES.md](PRINCIPLES.md) §6 defines the pre-commit hook. For documentation it checks:

- A commit touching `<path>/**` that does not touch `docs/<path>/**` → **warn**, listing the doc to update.
  Warn, not block: a typo fix should not require a doc edit, and a hook that blocks spuriously gets disabled,
  which costs more than the rule gains.
- A commit adding a new top-level directory with no `docs/` entry → **warn**.
- A doc whose `_Last Updated:` is more than 180 days old, in a directory changed by this commit → **warn**.

---

## 7. Current state and what to produce

| Repo | README | PRODUCT | DESIGN | AGENTS | CLAUDE | GEMINI | VERIFY | docs/ mirror |
|---|---|---|---|---|---|---|---|---|
| `FF_api_web` | ⚠ none at root | ☐ | ⚠ `FLASHFITS_SYSTEM_ARCHITECTURE.md`, partly stale | ☐ | ☐ | ✓ `.gemini/GEMINI.md` | ☐ | ☐ |
| `FlashFitsv2` | ⚠ Expo scaffold | ☐ | ⚠ 3 overlapping root `.md`s | ☐ | ☐ | ☐ | ☐ | ☐ |
| `FlashFits-Delivery-App` | ✗ **none at all** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `MerchantModule` | ⚠ Vite scaffold | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `MerchantApp` | ⚠ Expo scaffold | ☐ | ☐ | ⚠ 2 lines | ✓ `@AGENTS.md` | ☐ | ☐ | ☐ |

**Also to resolve:** `FLASHFITS_SYSTEM_ARCHITECTURE.md` exists in **both** `FF_api_web` and `FlashFitsv2` and
describes apps by names that no longer match the directories (`flashfits-refactor`,
`flashfits-style-delivered`), plus a Razorpay React Native SDK the customer app does not depend on. Fold the
accurate parts into each repo's `DESIGN.md` plus
[ecosystem/README.md](README.md), then **delete both copies** — two drifting copies of one architecture
document is the exact failure this standard exists to prevent.

`FlashFitsv2` likewise has `flashfits_app_overview.md`, `APPLE_SUBMISSION_AND_FLOW_SPEC.md` and two
`*_TERMS_AND_POLICIES.md` at root. Terms/policy documents are product artefacts — move them to `docs/legal/`.
The overview folds into `PRODUCT.md`; the Apple spec into `docs/releasing.md`.

### Order of work

1. `AGENTS.md` + `CLAUDE.md` + `GEMINI.md` + `VERIFY.md` + `.githooks/` + `docs/KNOWN-ISSUES.md` for all five
   repos. Small, immediately useful to every agent and every developer.
2. `README.md` for all five — replacing the scaffolds. `FlashFits-Delivery-App` first; it has none.
3. `PRODUCT.md` + `DESIGN.md` for `FF_api_web`, `FlashFitsv2`, `FlashFits-Delivery-App`.
4. `docs/` mirror for `FF_api_web` (the largest surface, and the one agents touch most).
5. `docs/` mirror for the app repos.
6. **Merchant pair last** — `PRODUCT.md`/`DESIGN.md` for `MerchantModule` and `MerchantApp` depend on the
   consolidation decision in [merchant-consolidation.md](../reports/merchant-consolidation.md). Writing full
   design docs for `MerchantApp` before deciding whether to retire it is work that may be deleted.
