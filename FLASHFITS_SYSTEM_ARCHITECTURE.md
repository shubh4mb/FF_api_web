# FlashFits Ecosystem Master Architecture & System Overview

This document provides an exhaustive, precise, and authoritative overview of the **FlashFits** multi-application quick-commerce ecosystem. It details every application, feature, user screen, real-time socket workflow, business rule, and backend architecture for AI agents and developers.

---

## 1. Executive Summary & Core Business Model

**FlashFits** is an instant fashion quick-commerce platform operating across two primary delivery models:

1. **Local Try & Buy (30-Minute Doorstep Trial)**:
   - **Zero Upfront Payment**: Customers order multiple sizes/styles without paying anything upfront at checkout (`₹0 Upfront`).
   - **Hyperlocal Dispatch**: Orders are dispatched from local partner stores or warehouse hubs via dedicated FlashFits riders.
   - **30-Minute Doorstep Trial**: Rider delivers items and waits outside while the customer tries the clothes at home.
   - **Selection & Post-Trial Payment**: The customer marks items to **KEEP** or **RETURN** inside the app. Payment is collected **only for kept items + delivery fee** via UPI/Card link or Cash on Delivery (COD) to the rider.
   - **Instant Doorstep Return**: Unkept items are handed back immediately to the rider for instant return to the merchant store.

2. **Courier Delivery (Standard 3-Day Shipping)**:
   - **Prepaid Upfront**: Full payment is collected at checkout for distant/out-of-city merchants.
   - **Direct Shipping**: Dispatched via standard courier partners.
   - **3-Day Return Window**: Post-delivery return/refund request workflow available within 3 calendar days (72 hours) of delivery via the in-app tracking screen (free return shipping for merchant defect / incorrect items; tiered reverse courier fee for customer choice; refund issued in 2–5 business days).

---

## 2. Multi-Application Ecosystem Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Backend Node.js API      │
                                  │  (MongoDB, Sockets, Razorpay) │
                                  └───────────────┬───────────────┘
                                                  │
            ┌───────────────────────┬─────────────┴─────────────┬───────────────────────┐
            │                       │                           │                       │
┌───────────▼───────────┐ ┌─────────▼───────────┐ ┌─────────────▼───────────┐ ┌─────────▼───────────┐
│     Customer App      │ │    Merchant App     │ │    Delivery Rider App    │ │    Web Platform     │
│ (flashfits-refactor)  │ │(MerchantApp/Module) │ │ (FlashFits-Delivery-App) │ │(style-delivered)    │
│ React Native / Expo   │ │ Expo Mobile / React │ │   React Native / Expo    │ │ Vite React Landing  │
└───────────────────────┘ └─────────────────────┘ └──────────────────────────┘ └─────────────────────┘
```

---

## 3. Customer Mobile App (`flashfits-refactor`)

### Tech Stack
- **Framework**: Expo SDK 54 (`expo-router` file-based routing, TypeScript).
- **Styling**: NativeWind (TailwindCSS) + Custom Design System tokens.
- **State Management**: React Context API (`AuthContext`, `AddressContext`, `WishlistContext`, `GenderContext`, `CartContext`).
- **Real-Time**: `socket.io-client` for live rider location tracking and order status changes.
- **Payments**: Razorpay SDK (`react-native-razorpay`).
- **Location**: `react-native-maps`, `expo-location`, `react-native-google-places-autocomplete`.

### Screens & Features Breakdown

#### A. Authentication & Onboarding
- `app/(auth)/onboarding.tsx`: Value proposition slider showcasing Try & Buy benefits.
- `app/(auth)/otpVerification.tsx`: Phone number OTP verification and Firebase auth integration.

#### B. Discovery & Browsing (Main Tabs)
- `app/(tabs)/index.tsx`: Main home screen featuring dynamic hero banners, gender toggle (Men/Women/Kids), quick store discovery, trending categories, and curated collection carousels.
- `app/(tabs)/Categories.tsx`: Hierarchical category catalog (Apparel, Footwear, Accessories) with instant sub-category filtering.
- `app/(tabs)/FlashfitsStores.tsx`: Interactive map and grid of local partner boutiques with distance calculation.
- `app/(tabs)/Wishlist.tsx`: Saved favorite products for quick add-to-cart.

#### C. Product & Store Details
- `app/(app)/ProductDetail/`: Image gallery, size/color variant selector, real-time store stock availability, size guide modal, user reviews, and Try & Buy add-to-bag action.
- `app/(app)/ShopDetails/`: Store profile screen showing boutique address, rating, operating hours, and full store catalog.
- `app/(app)/MainSearchPage.tsx`: Instant product search with fuzzy matching, auto-suggestions, and recent search history.

#### D. Shopping Bag & Checkout
- `app/(app)/cart.tsx`: Split shopping bag separating **Try & Buy (Local)** items and **Courier** items. Quantity adjustments and item removal.
- `app/(app)/checkout.tsx`: Address selector, delivery tip picker, promo coupon applier (`coupons.tsx`).
  - **Try & Buy Flow**: Displays `Payable Upfront Now: ₹0 (FREE)`. Shows post-trial estimated bill breakdown.
  - **Courier Flow**: Displays total prepaid amount collected via Razorpay.

#### E. Order Tracking & Trial Session
- `app/(app)/order-tracking.tsx`: Dedicated live tracking screen for local Try & Buy orders:
  - Real-time map displaying rider position and store origin.
  - Status stepper: `Placed` ➔ `Accepted` ➔ `Packed` ➔ `Picked Up` ➔ `En Route` ➔ `Trial Started` ➔ `Payment & Selection` ➔ `Completed`.
  - Doorstep trial session UI: Displays countdown timer during trial. Allows customer to mark items as KEPT or RETURNED and triggers online payment for kept items.
  - Cancelled order card: Shows zero payment charged if cancelled before trial payment.
- `app/(app)/courier-tracking.tsx`: Tracking screen for courier orders showing shipping carrier status, tracking number, and return request forms.

#### F. Profile, Wallet & Customer Support
- `app/(app)/orders.tsx`: Historical order list with tab filters (`All`, `Active`, `Completed`, `Cancelled`, `Refunds`).
- `app/(app)/mywallet.tsx`: Digital wallet interface displaying balance, cashback, refund transaction history, and wallet pay toggle.
- `app/(app)/help-center.tsx`: Self-serve customer care and damage reporting interface. Supports uploading photo evidence of defective/damaged items for instant wallet refunds.

---

## 4. Merchant Mobile App & Web Module (`FlashFits-Merchant-App` / `MerchantModule`)

### Tech Stack
- **Mobile**: Expo SDK (`src/app/`), TypeScript, NativeWind.
- **Web Dashboard**: Vite React (`MerchantModule`), TailwindCSS, Socket.io-client.

### Screens & Features Breakdown

- `onboarding.tsx` / `bank-and-documents.tsx`: Store partner KYC registration, uploading GSTIN, FSSAI/Trade License, bank account details for payouts, and shop geo-coordinates.
- `index.tsx` (Dashboard): Real-time metrics showing today's orders, pending store accepts, packed count, and daily revenue.
- `add-product.tsx` & `edit-product.tsx`: Comprehensive product manager. Allows merchants to upload images, set base price, discounted price, category, and manage color/size inventory variants (`add-variant.tsx`).
- `stock-update.tsx` & `warehouse-stock.tsx`: Quick stock toggle to mark items as in-stock, low-stock, or out-of-stock instantly.
- `Order Fulfillment (Live)`:
  - Real-time order alert with loud chime sound when a customer places an order.
  - Merchant has **5 to 10 minutes** to accept or decline the order.
  - Packing verification: Merchant packs items into secure **FlashFits Zip Covers** and scans/attaches zip cover security seal IDs (`zip-covers.tsx`).
- `offers.tsx`: Merchant coupon manager to create store-specific discounts and minimum purchase offers.
- `Return Verification`: Merchant inspects items brought back by riders from trial sessions. Verifies tag integrity and approves return handshake.

---

## 5. Delivery Rider App (`FlashFits-Delivery-App`)

### Tech Stack
- **Framework**: Expo SDK 54 (`app/(orderFlow)`), TypeScript.
- **Map & Geo**: `react-native-maps`, Mapbox navigation, GPS location background tracking daemon.
- **Audio & Media**: `expo-av` (custom alert rings), `expo-camera` (return proof photo capture).

### Screens & Features Breakdown

- `(auth)` / `(register)`: Rider onboarding, driving license upload, vehicle registration (bike/scooter), and bank details for daily payouts.
- `AcceptOrder.tsx` (Pending Order Dispatch Queue):
  - Loud audio broadcast when an order is assigned.
  - 15-second acceptance timer countdown.
  - Displays pickup store address, delivery location distance, and estimated payout for the trip.
- `ReachPickup.tsx` & `PickupDetails.tsx`:
  - Turn-by-turn navigation to the merchant boutique.
  - **Merchant Handshake**: Rider shares the last 4 digits of the Order ID (`#XXXX`) with the store partner so the merchant can identify the order and share the 4-digit pickup OTP.
  - Item verification modal: Rider checks item tags and Zip Cover security seals before taking custody.
- `ReachDeliveryLocation.tsx`: Live GPS navigation to the customer's doorstep.
- `DeliveryDetails.tsx` (Doorstep Trial & Settlement):
  - **OTP Verification**: Rider inputs customer handshake OTP to initiate the trial session.
  - **Live Trial Timer**: 15 to 30-minute trial countdown on rider screen.
  - **Selection Screen**: Rider marks which items the customer decided to keep vs return.
  - **Payment Collection**: System generates a Razorpay dynamic QR code or collects Cash on Delivery (COD) for the final kept amount + delivery fee.
- `ReturnVerification.tsx` & `ReturnItemCamera.tsx`:
  - Rider takes photo proof of any unkept returned items.
  - Returns unkept items back to the store partner (`ReachReturnLocation.tsx` & `MerchantReturnVerification.tsx`).
- `EarningsSummary.tsx`: Real-time rider wallet ledger showing per-delivery payout, distance bonus, peak hour incentives, and cash-collected-in-hand counter.

---

## 6. Backend API & Real-Time Engine (`FF Project`)

### Tech Stack
- **Runtime**: Node.js, Express.js.
- **Database**: MongoDB Atlas with Mongoose ORM.
- **Real-Time Communication**: `socket.io` rooms (`order:orderId`, `rider:riderId`, `merchant:merchantId`).
- **Integrations**: Razorpay API, Cloudinary CDN (images), Firebase Admin (Push Notifications), Google Maps Distance Matrix.

### Key Database Models (`src/models/`)

| Model Name | Description & Key Fields |
| :--- | :--- |
| `order.model.js` | Local Try & Buy order schema storing items, trial status, final billing breakdown, kept items list, rider assignment, and payment status. |
| `courierOrder.model.js` | Courier shipping order schema with shipping address, tracking numbers, and prepaid status. |
| `deliveryRider.model.js` | Rider profile, vehicle info, current live geo-coordinates (`location.coordinates`), active status, and cash-in-hand balance. |
| `merchant.model.js` | Store profile, store coordinates, owner details, operating hours, bank info, and rating. |
| `pendingOrders.model.js` | Dispatch queue tracking order-to-rider matching state and acceptance countdown timers. |
| `returnIssue.model.js` | Defect and damage reports submitted by customers with photo URLs, investigation notes, and refund settlement logs. |
| `wallet.model.js` & `transaction.model.js` | In-app user, rider, and merchant financial ledgers. |

### Real-Time Socket Architecture (`src/sockets/`)
- `order.socket.js`: Emits live order status updates to customer mobile screens (`placed` ➔ `accepted` ➔ `picked_up` ➔ `trial_started` ➔ `completed`).
- `deliveryRider.socket.js`: Receives live GPS coordinates from active riders every 5 seconds and updates order map position. Broadcasts new delivery offers to nearby riders.
- `merchant.socket.js`: Triggers instant popups and chime alerts on merchant app screens when new orders arrive.

### Core Order Lifecycle State Machine

```
[Customer Places Order]
         │
         ▼
     (placed) ───(Merchant Accepts)───► (accepted)
         │                                   │
  (Merchant Rejects)                         ▼
         │                                (packed)
         ▼                                   │
    [cancelled]                      (Rider Assigned)
                                             │
                                             ▼
                                        (picked_up)
                                             │
                                             ▼
                                       (in_transit)
                                             │
                                             ▼
                                       (at_delivery)
                                             │
                                     (Handshake OTP)
                                             │
                                             ▼
                                       (try_phase) ───► [30-Min Trial Timer]
                                             │
                                     (Customer Selects)
                                             │
                                             ▼
                                     (selection_made)
                                             │
                                  (Payment Collected)
                                             │
                                             ▼
                                        (completed)
```

### Payment & Cancellation Helper Logic (`orderCancellationHelper.js`)
- **Zero Upfront Refund Overhead**: For Try & Buy orders, if cancelled while `paymentStatus === 'pending'`, no wallet/gateway reversal is executed because zero money was deducted.
- **Paid Order Reversal**: If an order was paid (e.g. Courier prepaid order or delivery fee paid), `orderCancellationHelper` automatically credits the customer's wallet or initiates a Razorpay refund API call, and sets `paymentStatus = 'refunded'`.

---

## 7. Web Platform (`flashfits-style-delivered`)

- **Domain**: `www.theflashfits.com`
- **Purpose**:
  - Brand landing page introducing the Try & Buy concept.
  - Store partner & Boutique onboarding portal.
  - Rider recruitment portal.
  - Central Public Policy Hub (`/public-policy` and `/privacy-policy`) for Google Play & Apple App Store compliance.

---

## 8. Rules for AI Coding Assistants

When modifying any codebase in the FlashFits ecosystem, AI agents **MUST** follow these rules:

1. **Try & Buy Upfront Payment**: Never calculate or display upfront item charges or upfront delivery charges for local Try & Buy orders. Payment is strictly collected post-trial.
2. **Cancellation UI**: If `paymentStatus` is not `'paid'` or `'delivery_fee_paid'` or `'refunded'`, display **`₹0 CHARGED`** and **`No Payment Deducted`**. Do NOT show refund processing banners for unpaid orders.
3. **Expo Router Navigation**: Always use typed params and verify screen routes in `app/` before generating navigation calls.
4. **API Contracts**: Always maintain parameter structures in REST services (`app/api/`) and verify MongoDB schema fields before writing backend queries.
