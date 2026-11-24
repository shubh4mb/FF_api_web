# website/FFmanagement/src/

## Routing

`routes/AppRoutes.jsx` defines everything; `layouts/AdminLayout.jsx` wraps the authenticated admin area and
`layouts/MerchantLayout.jsx` the merchant view. `components/admin/Sidebar.jsx` is the nav.

## Where to put things

| | |
|---|---|
| A screen | `pages/admin/<Name>.jsx` (`PascalCase`), registered in `routes/AppRoutes.jsx` and the sidebar |
| A server call | `api/<domain>.js` — **never** `axios` directly in a page |
| Shared UI | `components/ui/` (primitives) or `components/common/` (composites). Not `commmon/` — that is a typo'd duplicate to be folded in |
| Table behaviour | `hooks/useTableFeatures.js` — sorting, filtering, pagination, already used by most list screens |
| Image cropping | `hooks/useImageCropper.js` + `hooks/cropImage.js` (`react-easy-crop`) |
| Real-time | `hooks/useAdminOrderSocket.js` |

## API clients

21 files in `api/`: `appConfig`, `attributes`, `auditLogs`, `banner.api`, `brand`, `categories`,
`collections`, `dashboard`, `incentives`, `lead`, `merchants`, `offers`, `orders`, `payouts`, `products`,
`support`, `title_banner`, `transactions`, `warehouse`, `zipCovers`, `zone`.

Naming is inconsistent (`banner.api.js` vs `zone.js`, `title_banner.js` vs `titleBanner`). Prefer
`<domain>.js`.

## Stack notes

- **MUI 7 and Tailwind 4 are both in use**, plus `class-variance-authority`, `clsx` and `tailwind-merge`.
  Match the surrounding file rather than introducing a third pattern in it.
- `recharts` for charts, `react-leaflet` for maps (zones, hubs, merchant locations), `sonner` **and**
  `react-hot-toast` for notifications — two toast libraries; prefer `sonner` and retire the other.
- `jsconfig.json` + `components.json` indicate a shadcn-style setup for `components/ui/`.

## Gotchas

- **This is JavaScript, not TypeScript** (`.jsx`, `jsconfig.json`), unlike `MerchantModule`. There is no
  typecheck step, so the pre-commit hook's `tsc --noEmit` does not apply here — lint is the only static gate.
- `pages/admin/VariantsImageUploader` is a directory, not a file; check its contents before importing.
- Charts and money displays must use `en-IN` formatting with `₹`.
