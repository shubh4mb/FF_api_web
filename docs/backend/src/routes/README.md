# Backend/src/routes/

HTTP route wiring, mounted by `src/app.js`. A route file should attach middleware and point a path at a
controller — nothing more.

| File | Lines | Mounts | Notes |
|---|---|---|---|
| `user.routes.js` | 713 | customer endpoints | ⚠ holds business logic inline |
| `merchant.routes.js` | 539 | merchant endpoints | ⚠ inline logic; the earnings endpoints are written here |
| `deliveryRider.routes.js` | 476 | rider endpoints | ⚠ inline logic; earnings + incentives written here |
| `admin.routes.js` | 472 | admin endpoints | ⚠ inline logic |
| `auth.routes.js` | 235 | customer auth, OTP, Google, Apple | |
| `courierOrder.routes.js` | 181 | courier ordering | |
| `riderNotifPhotos.routes.js` | 134 | rider return-proof uploads | |
| `map.routes.js` | 93 | geocoding / routing proxies | |
| `userNotifWallet.routes.js` | 71 | customer notifications + wallet | |
| `cron.routes.js` | 68 | externally-triggered jobs | check this is not publicly reachable |
| `adminFinance.routes.js` | 39 | finance | |
| `adminBanner.routes.js` | 33 | banners | |
| `userBanner.routes.js` | 12 | banner reads | |
| `adminRoutes/lead.routes.js`, `adminRoutes/zipCover.routes.js` | | leads, zip covers | |
| `merchantRoutes/zipCover.routes.js` | | merchant zip covers | |

## Authorisation

Each route group attaches its role middleware (`jwtAuth`, `authMiddlewareMerchant`,
`authMiddlewareRider`, `adminAuth`). See [../middleware/README.md](../middleware/README.md).

**Authorisation is per-route and hand-applied.** There is no declarative guarantee that a new route is
protected — adding one without its middleware silently exposes it. When adding a route, write its
authorisation integration test in the same commit
([../../../ecosystem/TESTING.md](../../../ecosystem/TESTING.md)).

## Gotchas

- **Four of these files hold business logic.** `/merchant/earnings/current-week`,
  `/merchant/earnings/history`, `/deliveryRider/earnings/*` and `/deliveryRider/incentives` are inline
  handlers with aggregation logic in them. New endpoints go in a controller; when you touch one of these,
  move the handler out rather than adding to it.
- Paths are `/<role>/<resource>`, kebab-case.
- Swagger annotations are `swagger-jsdoc` comments; `config/swagger.js` collects them.
