# Report: consolidating MerchantApp + MerchantModule into one Capacitor/PWA build

**Last Updated:** 2026-11-21
**Status:** recommendation, not yet approved. Nothing has been built.
**Question asked:** can we drop the Expo merchant app, keep one web app with PWA support, and ship it to
Play Store + App Store through Capacitor under the existing listings?

**Short answer:** yes, and `MerchantModule` is the build to keep. One native capability genuinely needs a
Capacitor plugin (the loud order alert), one needs a tiny custom plugin, and the store-identity question is
a solved problem *provided* you still hold the Android upload keystore. Verify that before anything else.

---

## 1. Verdict

| | |
|---|---|
| **Keep** | `MerchantModule` (Vite + React 19 + TS web app) |
| **Retire** | `MerchantApp` (Expo SDK 54) — after the Capacitor build is live and merchants have migrated |
| **Wrap with** | Capacitor 7 (Android + iOS), web assets bundled locally, not a remote URL |
| **Also ship as** | installable PWA for desktop/laptop merchants (zero extra work once the manifest + SW exist) |
| **Blocked on** | confirming you hold the Android upload keystore for `com.shubhamexpo7.FlashFitsMerchantApp` |

**Why MerchantModule and not MerchantApp:** MerchantModule is already a feature superset. It has everything
MerchantApp has, plus bulk product upload, courier orders, brand management, a 4-screen warehouse module, and
product matching. Going the other way — porting those into Expo — is strictly more work for a worse outcome.

---

## 2. Feature parity audit

Routes compared: [MerchantApp/src/app/](../../../MerchantApp/src/app/) vs
[MerchantModule/src/App.tsx](../../../MerchantModule/src/App.tsx).

### Already in MerchantModule (no work)

| MerchantApp screen | MerchantModule equivalent |
|---|---|
| `(tabs)/dashboard.tsx` | `pages/Dashboard.tsx` |
| `(tabs)/orders.tsx` | `pages/OrderManagement.tsx` |
| `(tabs)/products.tsx` | `pages/products/InventoryPage.tsx` |
| `(tabs)/profile.tsx` | `pages/ProfilePage.tsx` (shop / location / hours / **bank** tabs) |
| `(tabs)/revenue.tsx` + `payouts.tsx` | `pages/Revenue.tsx` (989 lines: wallet, week selector, payout log, UTR copy) |
| `add-product.tsx` | `pages/products/AddNewProduct.tsx` |
| `add-variant.tsx` | `components/Products/AddVarient/AddVarient.tsx` |
| `edit-product.tsx` | `pages/products/EditProductPage.tsx` |
| `offers.tsx` | `pages/OffersPage.tsx` |
| `zip-covers.tsx` | `pages/ZipCovers.tsx` |
| `warehouse-stock.tsx` | `pages/warehouse/MerchantWarehouseStock.tsx` |
| `onboarding.tsx` + `bank-and-documents.tsx` | `pages/auth/Register.tsx` + `MapSelector` + `LogoCrop` + `BannerCrop` |
| `pending-verification.tsx` / `rejected.tsx` / `payment.tsx` / `policies.tsx` | same names under `pages/auth/` + `PoliciesPage.tsx` |
| `matching-products.tsx` | `components/Products/MatchingProductsModal.tsx` |

### Only in MerchantModule (pure gain)

`products/BulkUploadProducts.tsx` (CSV via papaparse), `CourierOrders.tsx`, `brands/AddBrandPage.tsx`,
`warehouse/WarehouseDashboard.tsx`, `warehouse/WarehouseInventory.tsx`,
`warehouse/WarehouseOrderManagement.tsx`, `order/MobileUploadProof.tsx`.

### Gaps to close before retiring MerchantApp

| Gap | Detail | Size |
|---|---|---|
| **Quick stock update** | `pages/products/StockQuickUpdate.tsx` exists but its route is **commented out** at [MerchantModule/src/App.tsx:118](../../../MerchantModule/src/App.tsx#L118). MerchantApp ships this as a primary screen. | re-enable + test |
| **Notifications page** | MerchantModule has only `Navbar/NotificationDropdown.tsx`. MerchantApp has a full-screen `notifications.tsx`. | small |
| **`explore.tsx`** | MerchantApp-only. Check whether it is live or dead scaffold before porting. | verify first |
| **Forced app-update gate** | `hooks/useAppUpdate.ts` in MerchantApp reads `appConfig.merchantAppVersion`. A Capacitor build needs the same gate (see §6). | small |
| **Image download to gallery** | `MerchantApp/src/utils/imageDownloader.ts` uses `expo-media-library` + `expo-sharing`. MerchantModule has `utils/imageDownloader.ts` already — confirm it covers the native case. | verify |

---

## 3. Native capability audit — what actually needs a plugin

Every native import in `MerchantApp/src` was traced to its call sites. Result:

| Capability | Used at | Web/PWA alone | Capacitor answer |
|---|---|---|---|
| **Looping order-alert audio** | `utils/alertManager.ts` (`expo-av` `Audio`, `isLooping: true`, `staysActiveInBackground: true`) | ✗ blocked by autoplay policy without a user gesture; stops when backgrounded | `@capacitor-community/native-audio`, plus a **local notification with a custom sound** for the backgrounded case. See §4 — this is the one real constraint. |
| **Vibration** | `utils/alertManager.ts`, `context/SocketContext.tsx` | partial (`navigator.vibrate`, Android Chrome only, not iOS Safari) | `@capacitor/haptics` |
| **Push notifications** | `context/SocketContext.tsx` (`expo-notifications` → Expo push tokens) | ✗ on iOS unless installed as PWA (16.4+), and no high-priority channels | `@capacitor/push-notifications` → FCM + APNs directly. **Backend change required**, see §5. |
| **Android notification channel w/ `bypassDnd: true`** | `SocketContext.tsx:76-85` | ✗ | `@capacitor/local-notifications` `createChannel()` exposes importance/visibility/sound/vibration but **not `bypassDnd`**. Needs ~30 lines of custom Android plugin, or accept `IMPORTANCE_MAX` without DND bypass. |
| **Camera / photo picker** | `expo-image-picker` in 8 files | ✓ `<input type="file" accept="image/*" capture>` works everywhere | `@capacitor/camera` for a nicer UX; the plain input is the lazy option and already works |
| **Geolocation** | `expo-location` in `onboarding.tsx`, `profile.tsx` | ✓ `navigator.geolocation` (needs HTTPS) | `@capacitor/geolocation` only if you want background — you don't, merchant location is set once |
| **Secure token storage** | `expo-secure-store` in `AuthContext`, `api.ts`, `useAppUpdate.ts` | `localStorage` (what MerchantModule already uses) | `@capacitor/preferences`, or `capacitor-secure-storage-plugin` for Keychain/Keystore backing |
| **Clipboard** | `payouts.tsx` (`expo-clipboard`) | ✓ `navigator.clipboard` | already covered — MerchantModule's Revenue.tsx copies UTRs today |
| **Save image to gallery** | `utils/imageDownloader.ts` | ✗ | `@capacitor/filesystem` + `@capacitor/share` |
| **In-app browser** | `components/external-link.tsx` | ✓ `window.open` | `@capacitor/browser` |
| **WebView** | `onboarding.tsx` (`react-native-webview`) | ✓ `<iframe>` | n/a |
| **Device info** | `SocketContext.tsx` (`expo-device`) | partial | `@capacitor/device` |

**Nothing here blocks the migration.** Contrast with the rider app: `FlashFits-Delivery-App` uses
`expo-task-manager` + background `expo-location` for continuous GPS tracking. That one **can never be a PWA**
and must stay Expo. The merchant app has no such requirement.

---

## 4. The one real constraint: the loud alert when the app is backgrounded

This deserves care because it is the merchant app's single most business-critical behaviour — a missed order
alert costs a sale and breaches the 5–10 minute accept window.

**What `alertManager.ts` does today:** loops `order-alert.mp3` at volume 1.0 with
`staysActiveInBackground: true`, plus a repeating vibration pattern.

**What you need to know:** on iOS this already does not work the way it reads. An app backgrounded without
the `audio` background mode declared is suspended and its audio stops. Even with that mode declared, Apple
rejects apps that use it for alerting rather than media playback. So the current Expo build's indefinite
alarm is in practice a **foreground-only** behaviour on iOS, and on Android it survives only as long as the
OS has not killed the process (no foreground service is declared).

**So the migration loses much less than it appears to.** The honest comparison:

| Scenario | Expo today | Capacitor |
|---|---|---|
| App foregrounded | looping audio + vibration | identical, via `native-audio` or plain HTML5 `<audio loop>` after first gesture |
| App backgrounded, iOS | stops (OS suspends) | stops — same |
| App backgrounded, Android | works until process is killed | same, and can be made *better* with a foreground service |
| Device locked / app killed | push notification only | push notification only |

**Recommended design, both platforms:**

1. **Foreground:** looping audio + haptics, exactly as now. Unlock the audio context on login (one user
   gesture) and keep a primed `Audio` element so there is no autoplay block later.
2. **Backgrounded/killed:** a high-priority push carrying a **custom 25–30s sound file bundled in the app**.
   Android: `order_alerts` channel at `IMPORTANCE_MAX` with that sound. iOS: `"sound": "order-alert.caf"` in
   the APNs payload. 30s is Apple's hard ceiling for a notification sound.
3. **If 30s is genuinely not enough on iOS:** the only sanctioned mechanism is **Critical Alerts**, which
   needs a special entitlement from Apple that is normally granted only for health/public-safety apps. Do not
   plan around getting it.
4. **Android, if you want a true alarm:** a foreground service that rings until dismissed. This is a custom
   plugin (~100 lines Kotlin) and must be declared honestly in the Play listing. Defer until a merchant
   actually complains.

**This is a product decision, not a technical one:** the current app does not deliver a background alarm on
iOS either. If merchants rely on it today, they are relying on Android + app-in-foreground.

---

## 5. Backend change required: push tokens

Today the whole ecosystem speaks **Expo push tokens**:

- `helperFns/notificationHelper.js` — `new Expo()`, `Expo.isExpoPushToken()`, `expo.chunkPushNotifications()`
- `controllers/adminControllers/notification.controllers.js` — same
- `merchant.model.js` / `user.model.js` / `deliveryRider.model.js` — `expoPushTokens: [String]`

A Capacitor app gets **FCM tokens (Android)** and **APNs tokens (iOS)**, which Expo's service will not accept.

**Lazy approach — do not rip out Expo:** the customer and rider apps stay on Expo and keep working. Add a
discriminated token field and one branch in the send path:

```js
// merchant.model.js
pushTokens: [{ token: String, provider: { type: String, enum: ['expo', 'fcm', 'apns'] }, platform: String }]
```

Then one `sendPush(doc, msg)` function that routes per `provider` — Expo SDK for `expo`, `firebase-admin` for
`fcm`/`apns` (FCM can relay to APNs, so one SDK covers both Capacitor platforms). Keep `expoPushTokens` for a
release as a read fallback, then drop it.

**Fix while you are in there:** `appConfig.merchantAppVersion.storeUrlIos` points at
`com.flashfits.merchant`, but the app's actual bundle ID is `com.shubhamexpo7.FlashFitsMerchantApp`
([MerchantApp/app.json](../../../MerchantApp/app.json)). The force-update deep link is broken today.

---

## 6. Store republishing: can you keep the same listings?

### What identifies a listing

| Store | Identity | Changing it means |
|---|---|---|
| Google Play | `applicationId` (currently `com.shubhamexpo7.FlashFitsMerchantApp`) | a different app, new listing, lost reviews/installs |
| App Store | bundle ID + Apple Developer team | same |

The **app name** shown in the store is free to change. The ID is what you must preserve. Set it in Capacitor:

```
// capacitor.config.ts
appId: 'com.shubhamexpo7.FlashFitsMerchantApp'
```

That is all it takes for the stores to see the Capacitor build as an **update** to the existing app.

### Android: the fingerprint question — this is the real risk

Play rejects an upload whose signature does not match the existing app. Two cases:

- **Play App Signing enabled** (the default for anything created after Aug 2021, so almost certainly your
  case): Google holds the *app signing key*. You only need to match the **upload key**. If you lose it, you
  request an upload-key reset in Play Console and are back in business in a few days. **Low risk.**
- **Legacy self-signing**: you must have the exact original keystore. No keystore, no update, ever.

**Your situation:** builds come from EAS (`eas.json` present, `projectId` set,
`appVersionSource: "remote"`), so the keystore is held in **EAS managed credentials**. Export it before
touching anything:

```bash
cd MerchantApp
eas credentials            # Android → production → download keystore
# keep the .jks plus keystore password, key alias, key password
```

Then point Gradle at it in `android/app/build.gradle` of the Capacitor project. Also: **`versionCode` must be
strictly greater** than the live one — check the current value in Play Console, do not assume.

### Where a fingerprint mismatch would actually hurt

A keystore change invalidates anything bound to the signing certificate's SHA-1/SHA-256:

| Binding | Present in MerchantApp? |
|---|---|
| Google Sign-In / OAuth Android client | **No** — grepped; no `google-services.json`, no `@react-native-google-signin`. Auth is phone/password + JWT. |
| Firebase project | **No** |
| Digital Asset Links (`assetlinks.json`) for App Links | **No** — `scheme: "flashfitsmerchantapp"` is a custom scheme, not a verified App Link |
| SafetyNet / Play Integrity | **No** |

**Conclusion: the merchant app has no SHA-bound integrations.** This is the easiest possible migration on
that axis. (The customer app would be harder — `FlashFitsv2` uses `@react-native-google-signin` and
`expo-apple-authentication`. Do not migrate that one.)

### iOS

No "fingerprint" concept. Same bundle ID + same Apple Developer team + a `CFBundleVersion` higher than the
live one = an update to the same listing. You need the App ID and a distribution certificate from the team —
also recoverable from `eas credentials`.

### Apple review risk — read this before committing

| Guideline | Risk | Mitigation |
|---|---|---|
| **4.2 Minimum Functionality** | Apple rejects apps that are "just a repackaged website". | Bundle assets locally; use real native plugins (push, haptics, camera); ship a native splash + icons; make sure it does not render as a browser with a URL bar. A merchant ops console with push + camera clears this bar comfortably. |
| **2.5.2 code download** | Loading your primary UI from a remote URL at runtime is a violation. | **Do not** point Capacitor's `server.url` at production. Bundle `dist/` into the binary. If you want OTA web updates, use Capacitor Live Updates / Appflow, which is the sanctioned equivalent of Expo OTA. |
| **4.7 / enterprise-ish apps** | A merchant-only app with a login wall needs demo credentials for review. | Supply a demo merchant account in App Store Connect review notes — you already need this for the current app. |

### Migration sequencing (lowest risk)

1. Export EAS Android keystore + iOS credentials. **Do not skip. Do this first.**
2. Confirm in Play Console: is the merchant app actually published there? `appConfig.merchantAppVersion.storeUrl`
   currently defaults to a **GitHub APK release URL**, which suggests sideloading, not Play. If it is not on
   Play yet, this entire section is moot and you simply publish fresh — far simpler. **Verify before planning.**
3. Add PWA manifest + service worker + icons to MerchantModule; ship it as a web app. Zero store risk, and it
   immediately serves desktop merchants.
4. Add Capacitor, same `appId`, bundled assets. Close the §2 gaps. Add the §5 push branch.
5. Ship to Play **internal testing** first, signed with the exported upload key. This is where a signature
   mismatch surfaces — cheaply.
6. TestFlight for iOS.
7. Staged rollout (5% → 100%) on Play. Keep the Expo build buildable until rollout completes.
8. Retire `MerchantApp` once telemetry shows no merchants on the old build.

---

## 7. What this buys you

- One codebase instead of two, one deploy, one place for a bug fix. Today every merchant feature is written
  twice or only once-and-missing-on-the-other.
- Web updates ship without a store review (via Live Updates), which matters for a merchant tool.
- Desktop merchants get a real experience — a shop owner doing bulk upload wants a keyboard and a big screen.
- Removes Expo/EAS build costs and SDK-upgrade churn for one of three apps.

**What it costs:** the Android background alarm gets weaker unless you write the foreground-service plugin;
one custom plugin if you insist on `bypassDnd`; the push-token backend branch; and a careful first release.

---

## 8. Open questions for you

1. Is the merchant app actually live on Play Store and App Store today, or distributed as a GitHub APK?
   (`appConfig` suggests the latter.) This changes the risk profile completely.
2. Do you still have access to the EAS account that owns project `afb120d4-1db6-48f5-acf0-bdb195b2efd8`?
3. Do merchants in practice rely on the alert firing while the app is backgrounded, or do they keep the app
   open on a counter device? If the latter, §4 is a non-issue.
4. Is `MerchantApp/src/app/explore.tsx` a live screen or dead scaffold?
