# website/FFmanagement/

The FlashFits **admin panel** — the console the team runs the business from. Vite 6 + React 19 + MUI 7 +
Tailwind 4, deployed on Vercel.

> It lives nested inside the API repo, and its `package.json` is still named `"c"`. Whether it should be its
> own repo is an open point ([../../DESIGN.md](../../DESIGN.md) §8).

## Running

```bash
cd website/FFmanagement && npm install && npm run dev     # vite
npm run build && npm run lint
```

## Layout

| Path | What | Doc |
|---|---|---|
| `src/routes/AppRoutes.jsx` | every route | [src/README.md](src/README.md) |
| `src/layouts/` | `AdminLayout`, `MerchantLayout` | |
| `src/pages/admin/` | **41 screens** — the bulk of the app | [src/README.md](src/README.md) |
| `src/pages/merchant/` | 2 screens (a merchant view inside the admin panel) | |
| `src/pages/Banners/` | banner management | |
| `src/api/` | 21 REST clients, one per domain | |
| `src/components/admin/` | `Sidebar`, `Table`, `EditProductModal`, `ProductDetailsModal` | |
| `src/components/ui/`, `common/`, `commmon/` | shared UI — note `commmon` is a **typo'd duplicate** of `common` | |
| `src/hooks/` | `useAdminOrderSocket`, `useTableFeatures`, `useImageCropper`, `cropImage` | |

## Screens by area

| Area | Screens |
|---|---|
| **Orders** | `LiveOrders`, `OrderCancellations`, `WarehouseOrders`, `UnresponsiveRiderReports` |
| **Catalogue** | `Products`, `AddProducts`, `Variants`, `AddVariants`, `MatchingProducts`, `Category`, `AddCategory`, `EditCategory`, `AddBrand`, `AttributeManagement`, `CollectionManagement`, `WarehouseProducts` |
| **Merchants** | `Merchants`, `AddMerchants`, `EditMerchant`, `MerchantStatus`, `SalesLeads`, `leads/` |
| **Fulfilment** | `Zones`, `CreateZone`, `Hubs`, `WarehouseManagement`, `ZipCoverRequests` |
| **Money** | `FinanceManagement`, `PayoutManagement`, `Transactions`, `IncentiveManagement` |
| **Promotions** | `OffersManagement`, `Title_Banner`, `Banners/BannersPage` |
| **Support** | `ReturnIssues`, `SupportTickets`, `Moderation` |
| **System** | `Dashboard`, `Settings` (drives `appConfig`), `AuditLogs`, `BroadcastNotifications`, `AdminLogin`, `AdminRegister` |

## Gotchas

- **`Settings.jsx` writes `appConfig`**, the singleton that drives app behaviour without a release —
  delivery rates, radii, payout timing, maintenance mode, testing mode, the promo marquee, and the
  force-update version gates for all three apps. A mistake here affects every client immediately. Treat it
  as a production control surface, not a form.
- **`OffersManagement.jsx` is 682 lines with ~20 inputs**, including four free-* / auto-apply checkboxes
  that the backend then partially overrides — so the form can misrepresent what was created. It also
  maintains its **own copy** of the admin offer-type list, duplicating the controller's.
  [../reports/coupons-and-offers.md §5.3](../reports/coupons-and-offers.md).
- **`useAdminOrderSocket.js` connects with `role=admin` in the handshake query.** When the backend adds
  socket authentication ([../security-findings.md](../security-findings.md) S1) this must pass the JWT in
  `auth` instead.
- **Both `common/` and `commmon/` exist.** Consolidate into `common/` when you touch either.
- **Support parity:** `FinanceManagement` and `PayoutManagement` compute earnings separately from the
  merchant and rider apps' own endpoints. They should read the same endpoint so a support agent sees exactly
  what the merchant is looking at. [../reports/earnings-and-payouts.md §3.6](../reports/earnings-and-payouts.md).
- **Merchants and support staff use this on phones.** Test at 360px.

## Testing

**No runner configured.** Vite is already the build tool, so: **Vitest** + `@testing-library/react` (shares
the Vite config) and **Playwright** for E2E. [../ecosystem/TESTING.md](../ecosystem/TESTING.md).
