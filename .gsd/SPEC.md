# FlashFits Try & Buy Order Flow Specification

> **Status:** FINALIZED
> **Version:** 1.0.0
> **Date:** 2026-03-04

## 1. Overview
FlashFits is a "Try & Buy" fashion delivery platform. The following specifies the exact end-to-end order flow from cart creation to final payment and returns.

## 2. The 12-Step Order Flow

### Step 1: Cart Creation
- Customer browses products and selects product, variant (color/design), and size.
- Adds item to the cart.
- **Cart Rule:** The cart can contain items ONLY from one merchant/shop at a time.
- If the user attempts to add an item from another merchant: The system will prevent the addition or request the user to clear the cart.

### Step 2: Checkout Initiation
- Customer proceeds to checkout.
- System checks for a saved delivery address.
  - If no address exists: Customer must add an address before continuing.
- Once an address is selected: The system calculates and displays the `delivery charge` and `Try & Buy service fee`.

### Step 3: Initial Payment
- The customer pays ONLY the delivery charge / Try & Buy fee.
- **Important:** Product payment is NOT collected yet.
- After successful payment: The order is created in the system with status `placed`.

### Step 4: Merchant Notification
- The merchant receives a real-time new order notification.
- Merchant reviews order details and chooses to Accept or Decline.
- **If Declined:**
  - Order is cancelled.
  - Customer is notified.
  - Delivery fee is refunded (if applicable).
  - Workflow ends.
- **If Accepted:**
  - Order moves to the delivery allocation stage (`accepted`).
  - Merchant begins preparing the order.

### Step 5: Rider Allocation
- The system searches for available riders near the merchant location (zone-based matching).
- A delivery request is sent to the nearest rider.
- Rider sees: Pickup location, Delivery location, Estimated distance, Estimated earnings.
- Rider has 2 minutes to accept.
- **If Not Accepted:** Request expires, sent to next available rider. Previous rider is temporarily restricted from receiving the same request.
- **If Accepted:** Rider receives navigation instructions to the merchant shop and status becomes `en route to pickup`.

### Step 6: Rider Arrives at Merchant
- Rider reaches the shop and confirms arrival in the app (`arrived at pickup`).
- System verifies rider is near the merchant location using GPS.
- Meanwhile, the merchant prepares and packs the order.

### Step 7: Merchant Packing Confirmation
- After packing, merchant marks the order as `packed`.
- Rider is notified that the order is ready for pickup.

### Step 8: Order Pickup Verification
- Before handing over the package, merchant generates a pickup OTP.
- Rider asks merchant for OTP and enters it in the Rider App.
- Once verified: Rider officially collects the order (`picked & verified order`). Rider receives the customer delivery location.

### Step 9: Rider Travels to Customer
- Rider navigates to the customer's address.
- When the rider reaches the destination, they confirm arrival (`arrived at delivery`).
- System verifies rider's location to ensure they are near the customer.

### Step 10: Trial Phase
- Rider hands over items to the customer for trial.
- Customer receives a trial screen (`try phase`) displaying:
  - All products delivered
  - Product details
  - Options to select `Buy` or `Return` for each product

### Step 11: Trial Timer
- A trial timer starts when the rider reaches the customer.
- **Trial Policy:** First 8 minutes are free. After 8 minutes, an additional per-minute charge applies.
- Timer is visible to the rider to monitor the wait time.

### Step 12: Trial Completion
Once the customer finishes trying the items, three outcomes can occur:

#### Scenario 1: Customer Buys All Products
- Customer selects `Buy` for all items.
- System calculates final order amount (Product price + any additional trial time charges). Note: Delivery was paid in Step 3.
- Customer completes the final payment via Razorpay.
- After successful payment: Order is `completed`, Rider receives payout confirmation, workflow ends.

#### Scenario 2: Partial Return
- Customer buys some items and returns others, then ends trial session.
- Rider receives notification and collects returning items.
- Rider takes photos of each returned item for record purposes, packs them.
- Customer completes payment for the matching kept items.
- **Return to Merchant:** Rider receives navigation back to merchant shop and travels there.
- **Merchant Verification:** Merchant inspects and compares returned items with original details.
- **Return Confirmation:** Merchant generates a return confirmation OTP. Rider enters it in the app (`otp-verified-return`).
- After verification: Order `completed`, Rider receives payout confirmation.

#### Scenario 3: Full Return
- Customer decides not to purchase any items. Trial session ends.
- Rider collects all items, takes photos, repacks them.
- Rider returns to merchant shop (`reached return merchant`).
- **Merchant Verification:** Merchant verifies all products are returned.
- After confirmation (via OTP): Order `completed`, Rider receives payout confirmation.

---

## 3. Key Data Structures

- **Order Enums Needed:** 
  - `tryStatus` per item: `pending`, `accepted`, `returned`
  - `orderStatus`: `placed`, `accepted`, `packed`, `out_for_delivery`, `arrived at delivery`, `try phase`, `completed try phase`, `otp-verified-return`, `reached return merchant`, `completed`, `cancelled`

- **Payment Flows:** Two-step payment via Razorpay. First for delivery logic, second for final billing dynamically calculated based on trial time and returned item reductions.
