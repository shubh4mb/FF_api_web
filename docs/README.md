# FF_api_web documentation index

Docs mirror the code tree: `docs/<path>/README.md` documents `<path>/`.
**Update the doc in the same commit as the code** — see
[ecosystem/DOCUMENTATION-STANDARD.md](ecosystem/DOCUMENTATION-STANDARD.md).

## Start here

| | |
|---|---|
| [security-findings.md](security-findings.md) | **read first** — what is currently exposed |
| [../PRODUCT.md](../PRODUCT.md) | what FlashFits is, who uses it, the vocabulary |
| [../DESIGN.md](../DESIGN.md) | how this service is built, and §7 its known debt |
| [../AGENTS.md](../AGENTS.md) | rules for AI coding agents |
| [../VERIFY.md](../VERIFY.md) | what to do when you think a feature is finished |

## Cross-repo standards

| | |
|---|---|
| [ecosystem/README.md](ecosystem/README.md) | the five repos; IST, money, identity, the order lifecycle |
| [ecosystem/PRINCIPLES.md](ecosystem/PRINCIPLES.md) | the ten non-negotiables, naming, git hooks, the 3-strike rule |
| [ecosystem/TESTING.md](ecosystem/TESTING.md) | test stacks, what new work must ship with, the first tests to write |
| [ecosystem/VERIFY.md](ecosystem/VERIFY.md) | the post-build verification protocol and the full flow catalogue |
| [ecosystem/DOCUMENTATION-STANDARD.md](ecosystem/DOCUMENTATION-STANDARD.md) | what docs exist, where, and the AI-agent file convention |

## Analysis reports

Awaiting decisions; none has been acted on. Index: [reports/README.md](reports/README.md).

| | |
|---|---|
| [reports/merchant-consolidation.md](reports/merchant-consolidation.md) | one merchant app via Capacitor/PWA; store identity and signing |
| [reports/coupons-and-offers.md](reports/coupons-and-offers.md) | coupon vs offer, 25 bugs, best-offer selection, discount attribution |
| [reports/earnings-and-payouts.md](reports/earnings-and-payouts.md) | merchant and rider earnings visibility and filters |
| [reports/server-driven-campaigns.md](reports/server-driven-campaigns.md) | campaigns from the admin panel without a release |
| [reports/push-broadcast.md](reports/push-broadcast.md) | broadcasts and event notifications |
| [reports/numeric-size-variants-bug.md](reports/numeric-size-variants-bug.md) | numeric size variants blocked on the merchant **web** app (diagnosed) |

## Code map

| Path | What | Doc |
|---|---|---|
| `Backend/` | the API service | [backend/README.md](backend/README.md) |
| `Backend/src/models/` | 43 mongoose models | [backend/src/models/README.md](backend/src/models/README.md) |
| `Backend/src/routes/` | HTTP route wiring | [backend/src/routes/README.md](backend/src/routes/README.md) |
| `Backend/src/controllers/` | per-role request handlers | [backend/src/controllers/README.md](backend/src/controllers/README.md) |
| `Backend/src/services/` | cross-cutting services | [backend/src/services/README.md](backend/src/services/README.md) |
| `Backend/src/helperFns/` | **the business logic** | [backend/src/helperFns/README.md](backend/src/helperFns/README.md) |
| `Backend/src/sockets/` | Socket.IO handlers | [backend/src/sockets/README.md](backend/src/sockets/README.md) |
| `Backend/src/middleware/` | auth, errors, uploads | [backend/src/middleware/README.md](backend/src/middleware/README.md) |
| `Backend/src/cron/` | scheduled jobs | [backend/src/cron/README.md](backend/src/cron/README.md) |
| `Backend/src/config/` | db, redis, socket, cors, payments, media | [backend/src/config/README.md](backend/src/config/README.md) |
| `Backend/src/utils/` | response/error shapes, PDFs, adapters | [backend/src/utils/README.md](backend/src/utils/README.md) |
| `website/FFmanagement/` | the admin panel | [website/README.md](website/README.md) |

## Operational

| | |
|---|---|
| [runbook.md](runbook.md) | running and operating the service |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md), [PUBLIC_POLICY_OVERVIEW.md](PUBLIC_POLICY_OVERVIEW.md) | published policy documents |
| [model-selection-playbook.md](model-selection-playbook.md), [token-optimization-guide.md](token-optimization-guide.md) | AI/agent workflow guides |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | problems that resisted three fix attempts |
