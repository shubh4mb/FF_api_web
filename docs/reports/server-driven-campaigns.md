# Report: admin-driven campaign theming without an app update

**Last Updated:** 2026-11-21
**Status:** findings + recommendation. Nothing has been changed.
**Question:** can we change app sections — header, hero, etc. — for campaigns like a Christmas sale, from the
admin panel, without shipping an app update? Like Flipkart/Myntra do.

**Short answer: yes, and you have already built three-quarters of it — twice.** The gap is not capability,
it is that there are **four overlapping mechanisms** for server-driven content and none of them owns the home
screen's *layout*. Consolidate into one, rather than building a fifth.

---

## 1. How Flipkart/Myntra actually do it

Worth stating precisely, because it sets the limit of what is possible.

The app ships a **registry of section types it knows how to render** (hero carousel, category grid, product
rail, countdown strip, banner, …). The server returns a **page document**: an ordered list of sections, each
with a type, a config blob, and a theme. The app walks the list and renders each section with the matching
component, skipping any type it does not recognise.

| Changeable from the server, no release | Needs a release |
|---|---|
| Which sections appear, and in what order | A genuinely **new kind** of section |
| All copy, images, colours, gradients, badges | New native capability |
| Which products/collections a rail shows | A change to how an existing section behaves |
| Scheduling (start/end), targeting (city, user segment) | |
| Deep-link targets of taps | |

The trick is that the section registry is deliberately **generic enough that you rarely need a new type**.
A "Christmas Sale" is not a new section type — it is a hero section with a red/gold theme, a countdown strip,
and a product rail pointed at the Christmas collection. All three types already need to exist for ordinary
operation.

**Forward compatibility is the rule that makes it work:** the app must ignore unknown section types silently.
Then you can add `type: "spin_the_wheel"` to the server today and only the users on the new build see it.
Without that rule, every server change risks crashing old installs, and you lose the whole benefit.

---

## 2. What you already have

### (a) Campaign-as-Collection — the most complete piece

[`collection.model.js`](../../Backend/src/models/collection.model.js) already carries a full campaign:

```js
campaignType,                        // festival | seasonal | flash_drop | curated
theme: { primaryColor, secondaryColor, bgGradientStart, bgGradientEnd, textColor, presetName },
bannerImage, heroBannerImage,
schedule: { isScheduled, startDate, endDate },
subCurations: [{ id, label, filterTag, categoryId, gender, maxPrice }],
attachedCouponCode, priority, slug, isActive
```

`presetName` even anticipates named themes (`'onam_gold'`, `'diwali_glow'`, `'summer_brights'`,
`'midnight_luxe'`).

Consumed by [`CampaignContext.tsx`](../../../FlashFitsv2/context/CampaignContext.tsx) and rendered by
[`app/(app)/campaign/[slug].tsx`](../../../FlashFitsv2/app/%28app%29/campaign/[slug].tsx). Admin authoring lives
in [`CollectionManagement.jsx`](../../website/FFmanagement/src/pages/admin/CollectionManagement.jsx).

**This is 70% of the Christmas-sale requirement, already shipped.**

### (b) `appConfig.promoAnnouncements` — a server-driven marquee

[`appConfig.model.js`](../../Backend/src/models/appConfig.model.js) holds an array of
`{ id, badge, title, subtitle, highlightText, actionUrl, icon, isActive, order }`, fetched by
[`api/promotions.ts`](../../../FlashFitsv2/api/promotions.ts). Already a server-driven, ordered, toggleable,
deep-linkable list of content with an `icon` **name** resolved client-side.

**That is the server-driven-UI pattern in miniature.** It proves the approach works in this codebase.

### (c) `banner.model.js` — typed layout slots

```js
type: ['home_hero','home_middle','explore_hero','category_banner','promotional',
       'new_arrivals_banner','trending_banner','recommended_banner'],
ratio, actionUrl, isActive, order
```

Named slots, ordered, with aspect ratios and deep links. Admin UI:
[`BannersPage.jsx`](../../website/FFmanagement/src/pages/Banners/BannersPage.jsx).

This is a **fixed-slot** model: the app decides where `home_hero` goes and whether it renders at all. Adding
a slot means an app release. It is the step before a true layout document.

### (d) `title_banners.model.js` — section headers

`{ title, image, type: category|custom, categoryId, isActive }`.

### (e) `expo-updates` is configured — a genuine escape hatch

[`FlashFitsv2/app.json`](../../../FlashFitsv2/app.json):

```jsonc
"updates": { "url": "https://u.expo.dev/5ffa6730-...", "checkAutomatically": "ON_LOAD",
             "fallbackToCacheTimeout": 0 },
"runtimeVersion": { "policy": "appVersion" }
```

with `development`/`preview`/`production` channels in `eas.json`. So **JS-only changes can already ship
over-the-air** to the customer app without a store review.

**Important caveat:** `runtimeVersion.policy: "appVersion"` means an OTA update only reaches installs whose
`version` matches. Bump `version` in `app.json` and the OTA channel no longer serves existing users until
they update from the store. For campaign work that is fine (JS-only, no version bump), but it means OTA is
**not** a substitute for server-driven content — it is a slower, riskier sibling. Server-driven data reaches
every install instantly, including ones that never update. Prefer data.

### What is genuinely missing

| Missing | Consequence |
|---|---|
| A **layout document**: which sections the home screen shows, in what order | The home screen's structure is hardcoded in `app/(app)/(tabs)/index.tsx`. Reordering for Christmas needs a release. |
| A **section-type registry** with forward compatibility | Nothing can be added server-side without risking old builds. |
| **App-wide theming** (header, tab bar, accents) | `CampaignContext` themes the campaign screen; the rest of the app stays default. |
| **One mechanism** instead of four | Four admin screens author overlapping content; nobody can say what the home screen will look like next Tuesday without reading four tables. |
| **Targeting** beyond active/scheduled | No city, zone, gender, new-vs-returning segmentation. |
| **Preview** | No way to see a campaign before it goes live to everyone. |

---

## 3. Recommendation

### Do not build a fifth mechanism. Add the one thing that is missing — the layout document — and let it
### reference what already exists.

```js
// Backend/src/models/appLayout.model.js   (new — one model)
{
  surface: 'customer_home' | 'customer_explore' | 'merchant_dashboard',
  name: 'Christmas 2026',
  isActive: true,
  priority: 10,
  schedule: { startDate, endDate },               // reuse Collection's shape
  targeting: {                                    // all optional; empty = everyone
    zoneIds: [], cityNames: [], genders: [],
    userSegment: 'all' | 'new' | 'returning',
    minAppVersion: '1.1.0'                        // hide a section from builds that can't render it
  },
  theme: { /* exactly Collection.theme — same shape, same presets */ },
  sections: [
    { id, type: 'hero_carousel', order: 0, isActive: true,
      config: { bannerIds: [...] } },
    { id, type: 'countdown_strip', order: 1,
      config: { endsAt, title: 'Christmas Sale ends in', theme: 'inherit' } },
    { id, type: 'product_rail',   order: 2,
      config: { collectionId, title: 'Christmas Picks', showViewAll: true } },
    { id, type: 'category_grid',  order: 3, config: { categoryIds: [...], columns: 3 } },
    { id, type: 'promo_marquee',  order: 4, config: { announcementIds: [...] } }
  ]
}
```

**Why this shape:**
- `config` is an opaque blob **per type** — so adding a type needs no schema migration.
- Sections reference existing `Banner`, `Collection`, `Category`, `promoAnnouncements` rows by id. You are not
  duplicating content, you are **arranging** it. The four existing admin screens keep their jobs; this one
  decides what appears where.
- `theme` reuses `Collection.theme` verbatim so the preset list is shared and a campaign collection and the
  home screen can be themed identically from one palette.
- `minAppVersion` per section is the pragmatic forward-compatibility belt — alongside the app's "skip unknown
  types" brace.

### Client side

```tsx
// FlashFitsv2/components/layout/SectionRegistry.tsx
const REGISTRY = {
  hero_carousel:   HeroCarousel,
  countdown_strip: CountdownStrip,
  product_rail:    ProductRail,
  category_grid:   CategoryGrid,
  promo_marquee:   PromoMarquee,
};

export function RenderSections({ sections }) {
  return sections
    .filter(s => s.isActive && REGISTRY[s.type])   // ← unknown types silently skipped. The whole trick.
    .sort((a, b) => a.order - b.order)
    .map(s => {
      const C = REGISTRY[s.type];
      return <ErrorBoundary key={s.id} fallback={null}><C {...s.config} /></ErrorBoundary>;
    });
}
```

Two defences, both one-liners: filter unknown types, and wrap each section in an error boundary so one bad
config blob cannot white-screen the home page. **Both are mandatory** — without them, the admin panel becomes
a way to break production from a web form.

Then `app/(app)/(tabs)/index.tsx` becomes roughly:

```tsx
const { layout } = useAppLayout('customer_home');     // cached, with a bundled fallback
return <ThemeProvider theme={layout?.theme}>
         <RenderSections sections={layout?.sections ?? FALLBACK_SECTIONS} />
       </ThemeProvider>;
```

`FALLBACK_SECTIONS` is the current hardcoded layout, bundled in the app. **If the endpoint fails, the app
looks exactly like it does today.** No network dependency for a working home screen — this is what keeps the
feature from becoming an outage risk.

### App-wide theming

Extend the existing `CampaignContext` from "theme the campaign screen" to "theme the app" by feeding its
`CampaignTheme` into the header, tab bar and accent colours. The type already exists and is already
populated; the change is where it is consumed, not what it is.

**Keep the scope honest:** theme = colours, gradients, a logo variant, maybe a background image. Do **not**
make fonts, spacing or component shapes server-driven — that is where server-driven UI projects become
unmaintainable, and a Christmas sale does not need a different type scale.

### Effort estimate

| Piece | Size |
|---|---|
| `appLayout.model.js` + CRUD controller + customer read endpoint | small |
| 5 section components (4 are refactors of code already in `index.tsx`) | medium |
| `SectionRegistry` + `useAppLayout` + fallback | small |
| Admin builder UI (drag-to-reorder list, per-type config form, theme picker) | **the bulk of the work** |
| Preview (admin passes `?layoutId=` + a debug flag to see a draft) | small, high value |
| Theme plumbing into header/tab bar | small |

The admin builder is where the time goes. Keep v1 deliberately plain: a list with up/down arrows, an
`isActive` toggle, a type dropdown and a form per type. Drag-and-drop and live preview can come later —
up/down arrows ship this month.

---

## 4. Rollout plan

1. **Model + read endpoint + registry + fallback, with `sections: []` everywhere.** Ship it. Nothing changes
   visually; the plumbing is live and proven harmless.
2. **Move today's home screen into section components**, drive it from a seeded `customer_home` layout that
   reproduces the current design exactly. Verify pixel parity. Now the mechanism is load-bearing but the
   output is unchanged.
3. **Admin builder v1** (list, toggle, reorder, theme preset).
4. **First real campaign.** Schedule it, targeted at one zone, and watch it.
5. **Targeting + preview + `minAppVersion`.**
6. Extend to `customer_explore`, then the merchant dashboard if useful.

Steps 1–2 are the ones that de-risk everything: by the time you change anything visible, the mechanism has
already been running in production doing nothing.

---

## 5. Things that will bite

| Risk | Mitigation |
|---|---|
| **A bad config blob white-screens the home page** | Error boundary per section + skip unknown types (both above). Non-negotiable. |
| **Image-heavy campaigns are slow on Indian 4G** | Serve Cloudinary transforms sized per `ratio` (`banner.model.js` already stores it); `expo-image` is already used and caches. Set explicit dimensions so layout does not jump. |
| **Admin edits a live layout mid-traffic** | Draft/publish on the layout document, not direct edits. Cheap: an `isDraft` flag and a publish action that copies draft → live. |
| **The layout endpoint becomes a hot path** | Cache in Redis (`@upstash/redis` is a dependency) with a short TTL, bust on publish. Serve the client a `version` so it can skip re-render when nothing changed. |
| **Scheduling in the wrong timezone** | Use the same IST helper as everything else — see [earnings-and-payouts.md §2.1](earnings-and-payouts.md). A sale that starts at 05:30 IST instead of midnight is the exact same bug class. |
| **Four mechanisms become five** | Treat `appLayout` as the *only* thing that decides placement. `Banner`, `Collection`, `TitleBanner`, `promoAnnouncements` become content libraries it points at. Write that rule down. |
| **Nobody can tell what is live** | An admin "what's live right now" view showing the resolved layout per surface per segment. Add it with the builder, not later. |

---

## 6. Store-policy note

Both stores permit server-driven **content and layout**. Apple's 2.5.2 prohibits downloading **executable
code** that changes primary functionality. A JSON layout document interpreted by components already in the
binary is content, not code — this is exactly what every large retail app does. You are safe.

Where you would cross the line: shipping JS/HTML from your own server and executing it, or using the layout
system to introduce functionality the review never saw (e.g. a payment flow that appears only after
approval). Don't.

---

## 7. Tests

See [docs/ecosystem/TESTING.md](../ecosystem/TESTING.md).

**Unit:**
- `RenderSections`: unknown `type` → skipped, no throw; `isActive: false` → skipped; out-of-order `order` →
  sorted; a section whose component throws → error boundary catches, siblings still render. **These four
  are the safety contract** and must exist before the feature is exposed to the admin panel.
- Layout resolution: overlapping active layouts → highest `priority` wins; expired `schedule` → not served;
  `targeting` matching for each dimension, and empty targeting → matches everyone.
- Theme merge: a partial `theme` falls back to defaults field-by-field, never to `undefined` in a style prop.

**Integration:**
- `GET /user/app-layout?surface=customer_home` for: no active layout → the seeded default; a scheduled
  campaign mid-window → the campaign; a draft → **not** served without the debug flag.
- Publish busts the Redis cache (assert the second read differs).
- Schedule boundaries in **IST** — a campaign set to start 00:00 IST is not served at 23:00 IST the day before.

**E2E (Maestro):**
- Seed a Christmas layout → launch app → assert hero/countdown/rail present and in order → expire the
  campaign → relaunch → assert the default layout returns.
- **Offline/failure path:** block the layout endpoint → assert the app renders `FALLBACK_SECTIONS` and is
  fully usable. This is the test that protects you from the feature causing an outage.

**Verification flow** (per [VERIFY.md](../ecosystem/VERIFY.md)): build a real Christmas campaign in the admin
panel as an operator would — no seeded fixtures, no API calls — then open the app on a real device and
confirm it looks right, taps go to the right screens, and the countdown is accurate. Then expire it and
confirm the app returns to normal. A passing test suite does not tell you whether the admin panel is usable
by the person who will actually run the sale, and that is the whole point of the feature.
