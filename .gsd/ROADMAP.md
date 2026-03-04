# FlashFits Order Flow Roadmap

> **Status:** ACTIVE
> **Target:** Complete the 12-step Try & Buy order workflow

---

## Phase 1: Cart & Checkout Implementation
**Goal:** Implement Cart rules, checkout initiation, and initial Razorpay payment for delivery/try&buy fees.
- **Tasks:**
  - Enforce single-merchant cart rule in Backend and Customer App.
  - Implement Delivery & Try & Buy fee calculation on checkout.
  - Integrate initial Razorpay payment flow before order creation.
  - Create Order with status `placed`.

---

## Phase 2: Merchant Management & Rider Allocation
**Goal:** Real-time merchant notification, packing confirmation, and rider matching.
- **Tasks:**
  - Broadcast `newOrder` socket event to Merchant.
  - Implement Merchant Accept/Decline logic (updates order status, triggers refund if declined).
  - Implement zone-based Rider Matching queue (`PendingOrder`).
  - Broadcast delivery request to nearest available Rider (2-minute auto-expiry/re-queue logic).
  - Rider accepts, gets navigation instructions, arrives at pickup.
  - Merchant marks order as `packed`.

---

## Phase 3: Pickup Verification & Customer Delivery
**Goal:** Secure handover via OTP and live tracking to customer.
- **Tasks:**
  - Merchant generates Pickup OTP.
  - Rider verifies Pickup OTP in app to take possession (`picked & verified order`).
  - Rider live location tracking to Customer App.
  - Rider arrives at delivery location, system verifies Geo-fencing.

---

## Phase 4: Trial Phase & Completion
**Goal:** Handout, 8-minute timer, and complex return/purchase billing.
- **Tasks:**
  - Rider hands out items, initiates `try phase`.
  - Start 8-minute Trial Timer (frontend tracking + backend recording).
  - Implement Trial Completion UI (Buy/Return selection per item).
  - Calculate Final Billing (base amount + overtime penalty - returns).
  - Final Razorpay Payment for kept items.
  - Implement Return workflows (Partial/Full): Rider takes photos, repacks, navigates to merchant.
  - Merchant Return Verification (OTP verification).
  - Finalize Order and Rider Payouts.
