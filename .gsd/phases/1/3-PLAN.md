---
phase: 1
plan: 3
wave: 2
---

# Plan 1.3: Payment & Order Creation

## Objective
Implement Razorpay for the initial delivery + trial fee payment, and create the order only after successful payment.

## Context
- `.gsd/SPEC.md`
- `.gsd/ARCHITECTURE.md`
- `FF Project/Backend/src/controllers/userControllers/order.controllers.js`
- `FF Project/Backend/src/routes/user.routes.js`
- `FlashFits/app/(stack)/Payment.tsx`

## Tasks

<task type="auto">
  <name>Backend: Initial Razorpay Order Creation</name>
  <files>FF Project/Backend/src/controllers/userControllers/order.controllers.js</files>
  <action>
    - Update `createRazorpayOrder` to ONLY charge for the Delivery Fee + Try & Buy Fee (the initial payable amount calculated in Plan 1.1).
    - Do NOT include the product prices in this first payment.
  </action>
  <verify>grep_search `order.controllers.js` for Razorpay creation logic</verify>
  <done>Razorpay order reflects the correct initial fee amount.</done>
</task>

<task type="auto">
  <name>Backend: Payment Verification & Order Placement</name>
  <files>FF Project/Backend/src/controllers/userControllers/order.controllers.js</files>
  <action>
    - Update `verifyPayment` or `razorpayWebhook` to handle the successful payment of the initial fees.
    - ONLY upon successful signature verification, create the actual `Order` record in MongoDB.
    - Set `orderStatus` to `placed` and `paymentStatus` to `pending` (since products are not paid for yet).
    - Insert the `deliveryCharge` and `tryAndBuyFee` into the `finalBilling` object of the order.
    - Enqueue the order for Rider matching via `enqueueOrder` (from `orderFns.js`).
  </action>
  <verify>grep_search `verifyPayment` for order creation and `enqueueOrder`</verify>
  <done>Order is created with `placed` status and assigned to the matching queue only after payment success.</done>
</task>

## Success Criteria
- [ ] Initial Razorpay window charges only delivery and service fees.
- [ ] Orders are securely created in the database after signature verification.
- [ ] Successfully paid orders are pushed to the Redis matching queue (`enqueueOrder`).
