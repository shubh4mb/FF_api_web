# FlashFits Policy Architecture & App Store Compliance Guide

> **Document Type:** Operational, Legal & Store Submission Reference  
> **Primary Dedicated Privacy URL:** [`https://www.theflashfits.com/privacy-policy`](https://www.theflashfits.com/privacy-policy)  
> **Public Policy Hub URL:** [`https://www.theflashfits.com/public-policy`](https://www.theflashfits.com/public-policy)  
> **Entity:** FlashFits Technologies Private Limited, Kochi, Kerala, India  
> **Official Contact Email:** `flashfits.pvt@gmail.com`  
> **Customer Hotline (WhatsApp):** `+91 83838 23813`  
> **Last Updated:** February 2026  

---

## 1. Site Policy Architecture

To meet Apple App Store and Google Play Developer guidelines while providing full consumer transparency, the FlashFits policy ecosystem is divided into two distinct tiers:

```
https://www.theflashfits.com/
│
├── /privacy-policy (DEDICATED MANDATORY PRIVACY POLICY)
│     └── Required by Apple & Google Play store listing metadata.
│     └── Contains explicit disclosures for personal data collection, SDKs,
│         retention schedules, in-app deletion, and legal exceptions.
│
└── /public-policy (CONSOLIDATED PUBLIC POLICY HUB)
      ├── 1. Public Purpose & Commitments (Transparent quick commerce)
      ├── 2. Try & Buy Doorstep Standards (10–15 min window, hygiene limits)
      ├── 3. Returns, Refunds & Cancellations (Instant doorstep rejection for Try & Buy, 3-day return window for Courier Orders, Razorpay)
      ├── 4. Merchant Quality & Authenticity Guarantee (Anti-counterfeit pledge)
      ├── 5. User Data Rights & Account Deletion (Links to dedicated policy & DSAR)
      ├── 6. Delivery Partner Road Safety (Zero speed-penalties)
      └── 7. Statutory Grievance Redressal (India E-Commerce Rules, Kochi address)
```

---

## 2. Deep Research: Apple App Store & Google Play Policy Mandates

### A. Apple App Store Requirements (Guidelines 5.1.1 & 5.1.2)
1. **Mandatory Dedicated URL (Guideline 5.1.1(i)):**
   * Must have a publicly accessible, dedicated Privacy Policy URL entered into App Store Connect.
   * Linking to a generic home page or non-specific page leads to App Review rejection.
2. **Third-Party SDK Disclosures (Guideline 5.1.1):**
   * Apple explicitly requires apps to disclose all third parties that receive user data (e.g. Razorpay, Cloudinary, Maps, Analytics, MongoDB Atlas) and confirm that these third parties provide equivalent privacy protections.
3. **Mandatory In-App Account Deletion (Guideline 5.1.1(v)):**
   * If your app supports account creation, **users must be able to initiate account deletion directly from inside the app**.
   * Providing only a website link or an email contact is grounds for rejection for consumer apps.
   * Path in app must be intuitive: e.g., **Profile → Settings & Privacy → Delete Account**.
4. **Legally Permitted Retention:**
   * Apple permits apps to retain certain records where required by applicable local law (e.g. tax, accounting, anti-money laundering regulations).
   * **Mandate:** The privacy policy must explicitly distinguish between what is purged immediately (profile, auth tokens, addresses, preferences) and what is retained under statutory law (GST invoices, transaction logs).

### B. Google Play Store Requirements (User Data & Account Deletion)
1. **Data Safety Section Consistency:**
   * Every data type collected in the app (Name, Phone, Geolocation, Device IDs) must be declared in Google Play Console Data Safety and match the Privacy Policy word-for-word.
2. **Web-Based Account Deletion URL Requirement (Mandatory since 2024):**
   * Google Play requires an in-app deletion path **AND** a public web URL resource where users can request account and data deletion without reinstalling the app.
   * FlashFits fulfills this via:
     * Web DSAR Portal: `https://app.termly.io/dsar/a734c1cc-8462-4503-bc50-dc332410690b`
     * Direct Privacy Email: `mailto:flashfits.pvt@gmail.com?subject=Account%20and%20Data%20Deletion%20Request`
3. **Location Tracking (Foreground & Background):**
   * Location cannot be gathered invisibly. Must clearly explain that precise location is used solely to discover nearby boutiques (within 5 km) and route the 30-minute delivery.

---

## 3. Dedicated Privacy Policy Structure ([`/privacy-policy`](file:///c:/Users/leno2/Desktop/flashfits-style-delivered/src/pages/PrivacyPolicy.tsx))

| Section | Content & Disclosures |
| :--- | :--- |
| **1. Information We Collect** | Name, Phone Number (primary auth OTP), Email, Delivery Addresses, Precise Geolocation (GPS), Payment metadata (Razorpay tokenized references, NO raw cards), Device telemetry, and Support messages. |
| **2. How We Collect Data** | Direct user input, OS device permissions (GPS & Push alerts), order/trial events, and payment gateway webhooks. |
| **3. Purpose of Processing** | Account creation, 30-minute order routing, Try & Buy doorstep trials, Razorpay refunds, support care, and fraud prevention. |
| **4. Third-Party Sharing & SDKs** | Explicit table detailing **Razorpay** (payments/refunds), **Cloudinary** (product images/CDN), **MongoDB Atlas** (encrypted cloud database), **Google Maps/Mapbox** (geocoding/routing), and **Delivery Partners/Merchants** (fulfillment). |
| **5. Retention & Deletion Schedule** | **Purged immediately:** User credentials, tokens, addresses, carts, search history.<br>**Retained by law:** GST financial invoices (8 years under Sec 36 CGST Act) & Razorpay dispute logs (isolated from active operations). |
| **6. In-App Deletion Instructions** | Detailed steps to delete from inside the app (`Profile → Settings & Privacy → Delete Account`) and web deletion channels. |
| **7. User Privacy Rights** | DPDP Act 2023 statutory rights: Access, Correction, Erasure, Consent Withdrawal, and Grievance Redressal. |
| **8. Security Safeguards** | TLS 1.3 transit encryption, AES-256 cloud encryption at rest, JWT tokenization, and least-privilege RBAC. |
| **9. Children's Privacy** | Strict 18+ policy; immediate purging of unauthorized minor accounts under Indian Contract Act. |
| **10. Cross-Border Transfers** | Primary Indian data residency with DPDP-compliant international CDN and push notification transfer safeguards. |
| **11. Policy Updates** | In-app notification mechanism and timestamp versioning. |
| **12. Contact & Grievance** | Grievance Officer details, Kadavanthara, Kochi address, email `flashfits.pvt@gmail.com`, and 48h acknowledgment / 30-day resolution SLA. |

---

## 4. App Store Submission Cheat-Sheet

| Store Field | Exact Value to Enter |
| :--- | :--- |
| **Apple App Store: Privacy Policy URL** | `https://www.theflashfits.com/privacy-policy` |
| **Google Play: Privacy Policy URL** | `https://www.theflashfits.com/privacy-policy` |
| **Google Play: Account Deletion URL** | `https://www.theflashfits.com/privacy-policy#in-app-deletion` (or `https://www.theflashfits.com/public-policy#privacy-deletion`) |
| **Refund & Cancellation Policy URL** | `https://www.theflashfits.com/public-policy#refund-cancellation` |
| **Grievance Redressal URL** | `https://www.theflashfits.com/public-policy#grievance` |
| **Official Contact Email** | `flashfits.pvt@gmail.com` |
| **Official Phone / WhatsApp** | `+91 83838 23813` |
