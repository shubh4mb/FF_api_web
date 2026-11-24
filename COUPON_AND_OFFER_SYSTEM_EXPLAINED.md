# FlashFits (FF) Coupon & Offer System — Architecture & Specification

## 1. System Overview

The FlashFits Offer & Coupon System is an intelligent, multi-tenant promotion engine powered by `offerEngine.js`. It governs discount discovery, coupon validation, auto-application, order-type targeting, multi-vendor isolation, and promotional stacking between Platform (Admin) and Merchant (Store) promotions.

```
                          ┌───────────────────────────┐
                          │   Offer / Coupon Sources  │
                          ├─────────────┬─────────────┤
                          │ Admin Scope │ Merch Scope │
                          └──────┬──────┴──────┬──────┘
                                 │             │
                                 ▼             ▼
                      ┌─────────────────────────────────┐
                      │    Eligibility & Rule Checks    │
                      │  - Active & Date/Time Window    │
                      │  - Total & User Usage Caps      │
                      │  - First-time User Validation   │
                      │  - Cart / Order Minimums        │
                      │  - Targeted Products/Categories │
                      │  - Try & Buy vs Standard Order  │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │    Calculation & Stacking       │
                      │  - Flat vs % with Max Cap       │
                      │  - Exclusive / Non-stackable    │
                      │  - 1 Best Admin + 1 Best Merch  │
                      │  - Delivery / Logistics Waiver  │
                      │  - Anti-Exploit Subtotal Cap    │
                      └────────────────┬────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
              [ Try & Buy Cart ]            [ Standard Courier Cart ]
```

---

## 2. Core Entities & Database Models

### A. Offer Model (`offer.model.js`)

Each offer represents a promotional rule defined either by the Super Admin or an onboarded Merchant.

| Field | Type | Description |
| :--- | :--- | :--- |
| `title`, `description`, `badgeText` | `String` | Customer-facing display text and badge (e.g. `"FLAT 25% OFF"`, `"FLASH SALE"`). |
| `type` | `Enum` | Offer classification (see Section 3). |
| `scope` | `Enum ('admin', 'merchant')` | Who owns and finances the offer. |
| `applicableTo` | `Enum ('try_and_buy', 'courier', 'both')` | Restricts whether the offer applies to Instant Try & Buy, Courier delivery, or both. |
| `benefitType` | `Enum ('PRODUCT', 'CART', 'DELIVERY')` | Granularity of benefit. Merchants are restricted to `PRODUCT` for standard courier orders. |
| `stackable` | `Boolean` (default `true`) | Determines if this offer can combine with other eligible offers. |
| `isExclusive` | `Boolean` (default `false`) | If `true`, overrides and blocks all other discounts, courier benefits, or store offers. |
| `discountType` | `Enum ('flat', 'percentage')` | Either absolute rupee deduction (`flat`) or percentage (`percentage`). |
| `discountValue` | `Number` | Discount value (e.g. `100` for ₹100 or `20` for 20%). |
| `maxDiscount` | `Number` | Cap for percentage discounts (e.g. 20% off up to ₹200). `null` means uncapped. |
| `conditions` | `Object` | Criteria for eligibility (min cart value, categories, products, gender, first-time user). |
| `couponCode` | `String` | Optional uppercase promo code (e.g. `WELCOME50`, `DIWALI2026`). |
| `requiresCoupon` | `Boolean` | `false` = Auto-applied if qualified. `true` = Requires entering the coupon code. |
| `isPublic` | `Boolean` | `true` = Listed in available coupons list. `false` = Hidden (personalized/secret code only). |
| `targetUserId` | `ObjectId (User)` | For personalized referral or user-exclusive rewards. |
| `maxUsageTotal` | `Number` | Maximum redemptions across all users (`null` = unlimited). |
| `maxUsagePerUser` | `Number` | Limit per individual user (default: 1). |
| `currentUsage` | `Number` | Total redemptions count so far. |
| `freeDelivery` | `Boolean` | Waives standard delivery charges. |
| `freeReturn` | `Boolean` | Waives return fees. |
| `freeWaiting` | `Boolean` | Waives rider waiting fees during Try & Buy trials. |
| `priority` | `Number` | Higher priority offers are evaluated first during auto-selection ties. |
| `startDate`, `endDate`, `isActive`| `Date / Boolean` | Temporal validity controls. |

### B. Offer Usage Model (`offerUsage.model.js`)

Tracks individual redemptions upon order placement:
- `userId`: Reference to the customer.
- `offerId`: Reference to the redeemed offer.
- `orderId`: Reference to either `Order` (Try & Buy) or `CourierOrder` (Standard Delivery).
- `orderModel`: `'Order'` or `'CourierOrder'`.
- `discountApplied`: Actual discount amount credited to the order.
- `usedAt`: Timestamp of redemption.

---

## 3. Offer Types & Scopes

### 1. Platform / Admin Offers (`scope: 'admin'`)
Configured via the Admin Web Panel (`/api/admin/offers`):
- **`FIRST_TIME_USER`**: Targets new customers who have 0 non-cancelled orders across both Try & Buy and Courier channels.
- **`CART_VALUE`**: Cart-wide threshold discount (e.g., ₹150 OFF on orders above ₹999).
- **`CATEGORY`**: Targeted discount on specific categories/subcategories (e.g., 20% OFF Men's Footwear).
- **`COLLECTION`**: Targets products linked to specific curated collections.
- **`FLASH_SALE`**: Time-sensitive discount window with visual urgency markers.
- **`FREE_DELIVERY`**: Waives delivery fee, return fee, and rider waiting charge.

### 2. Merchant Store Offers (`scope: 'merchant'`)
Configured by store owners via Merchant Portal / App (`/api/merchant/offers`):
- **`VENDOR_DISCOUNT`**: Store-wide or product-specific discount funded by the merchant.
- **`VENDOR_MIN_ORDER`**: Merchant-level threshold discount (e.g., Buy ₹1,499 from this merchant to get ₹200 off).
- **`VENDOR_CLEARANCE`**: Steep discounts on designated dead-stock or end-of-season items.
- *Guardrail*: Merchant offers only apply to items belonging to that specific merchant. They cannot give cart-wide discounts or free platform courier delivery on behalf of other vendors.

---

## 4. How the Offer Engine Works (`offerEngine.js`)

### Step 1: Validation & Qualification
When a user views their cart or triggers `/api/offers/best-for-cart`, each active offer is verified through `validateOfferEligibility`:
1. **Time Check**: `startDate <= now < endDate` and `isActive === true`.
2. **Global Cap**: `currentUsage < maxUsageTotal`.
3. **User Cap**: Checks `OfferUsage` records for this user and ensures count `< maxUsagePerUser`.
4. **Target User**: If `targetUserId` is present, only that specific user ID is allowed.
5. **First-Time Buyer**: If `firstTimeUserOnly === true`, queries both `Order` and `CourierOrder` tables to verify 0 previous orders.
6. **Order Type Match**: Checks if the offer is allowed for the cart's order mode (`try_and_buy` vs `courier`).
7. **Minimum Cart / Store Value**:
   - `conditions.minCartValue` verified against total eligible cart value.
   - `conditions.minOrderValue` verified against that merchant's specific subtotal.
8. **Item & Filter Match** (`isItemApplicable`):
   - Confirms cart has items matching targeted `productIds`, `categoryIds`, `subCategoryIds`, `collectionId`, or `genders`.
   - Confirms merchant ID matches for merchant-scoped offers.

---

### Step 2: Discount Calculation
Calculated via `calculateDiscount(offer, applicableAmount)`:
- **Applicable Amount Isolation**:
  - If the offer is restricted to specific products/categories, `applicableAmount` only sums qualifying items (not the entire cart).
  - For merchant-scoped offers, only items sold by that merchant contribute to the sum.
  - For store-wide admin offers, the entire subtotal is used.
- **Formula**:
  - `flat`: `Math.min(discountValue, applicableAmount)`
  - `percentage`: `(applicableAmount * discountValue) / 100`, clamped to `maxDiscount` if configured.

---

### Step 3: Stacking & Combination Rules
The engine applies clear arbitration rules:

1. **Exclusive Offers (`isExclusive: true`)**:
   - If an applied coupon or top auto-offer is exclusive, **all other discounts and logistics benefits are disabled**. Only that offer is applied.
2. **Platform + Merchant Stacking**:
   - The system allows **1 Best Admin Offer + 1 Best Merchant Offer** to stack together.
   - Multiple admin offers do not stack against each other (only the best admin discount wins).
   - Multiple merchant offers do not stack against each other for the same scope.
3. **Logistics & Delivery Benefits**:
   - Free delivery / return / waiting benefits can stack on top of a stackable discount offer.
   - If a coupon explicitly includes `freeDelivery`, it will waive delivery charges alongside price cuts.
4. **Anti-Exploit Ceiling**:
   - `totalDiscount = Math.min(rawDiscount, cartContext.subtotal)`.
   - The total discount can never exceed the cart subtotal, preventing negative invoice totals or checkout exploits.

---

## 5. Flow of Coupon Lifecycle

```
[ User enters coupon code at checkout ]
                   │
                   ▼
       POST /api/offers/apply
                   │
                   ▼
       validateCouponCode()
  ┌────────────────┴────────────────┐
[ Invalid / Ineligible ]    [ Valid & Qualified ]
  │                                 │
  ▼                                 ▼
Return error message        Save normalized couponCode to Cart
(e.g., "Add ₹200 more")     Re-evaluate cart pricing totals
                                    │
                                    ▼
                          [ Order Placement ]
                                    │
                                    ▼
                          recordOfferUsage()
                          - Saves OfferUsage record
                          - Increments currentUsage on Offer
```

---

## 6. API Reference

### Customer Endpoints (`/api/user/offers`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/offers` | Lists all active, public coupons with eligibility status and progress messages (e.g. "Add ₹150 more to unlock"). |
| `POST`| `/api/offers/apply` | Validates and attaches a coupon code to the user's active cart (`Cart` or `CourierCart`). |
| `POST`| `/api/offers/remove` | Removes the attached coupon from the user's cart. |
| `POST`| `/api/offers/best-for-cart` | Real-time calculation of best auto-applied and explicit coupon combination. |
| `GET` | `/api/offers/merchant/:merchantId` | Lists active discounts and banners for a specific merchant store page. |
| `GET` | `/api/offers/flash-sales` | Retrieves active flash sales for homepage countdown ribbons. |

### Admin Endpoints (`/api/admin/offers`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/offers` | Create platform-wide offer or coupon. |
| `GET`  | `/api/admin/offers` | List all admin offers with pagination and filters. |
| `PUT`  | `/api/admin/offers/:id` | Update offer parameters, limits, or dates. |
| `PATCH`| `/api/admin/offers/:id/toggle` | Enable or disable an offer immediately. |
| `DELETE`| `/api/admin/offers/:id` | Remove an offer. |

### Merchant Endpoints (`/api/merchant/offers`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/merchant/offers` | Create store-level discount for merchant's own catalog. |
| `GET`  | `/api/merchant/offers` | View all offers created by the logged-in merchant. |
| `PUT`  | `/api/merchant/offers/:id` | Update store offer. |
| `PATCH`| `/api/merchant/offers/:id/toggle` | Toggle store offer status. |
| `DELETE`| `/api/merchant/offers/:id` | Delete store offer. |
