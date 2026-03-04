---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Cart & Checkout Backend Logic

## Objective
Enforce the single-merchant rule in the cart and implement the backend fee calculation API.

## Context
- `.gsd/SPEC.md`
- `.gsd/ARCHITECTURE.md`
- `FF Project/Backend/src/models/cart.model.js`
- `FF Project/Backend/src/controllers/userControllers/cart.controllers.js`
- `FF Project/Backend/src/controllers/userControllers/order.controllers.js`

## Tasks

<task type="auto">
  <name>Enforce Single-Merchant Cart Rule</name>
  <files>FF Project/Backend/src/controllers/userControllers/cart.controllers.js</files>
  <action>
    - Update the `addToCart` controller to verify the incoming `merchantId`.
    - If the cart is empty, allow the addition.
    - If the cart has items and the `merchantId` differs from the existing items, reject the addition with a specific error message (e.g., "Cart can only contain items from a single merchant").
  </action>
  <verify>grep_search the `cart.controllers.js` file for "merchantId" validation logic</verify>
  <done>Backend `addToCart` successfully rejects items from different merchants.</done>
</task>

<task type="auto">
  <name>Implement Fee Calculation API</name>
  <files>
    FF Project/Backend/src/controllers/userControllers/order.controllers.js
    FF Project/Backend/src/routes/user.routes.js
  </files>
  <action>
    - Create a new endpoint `POST /order/calculateFees` that accepts the customer's delivery address and cart details.
    - Use `calculateDeliveryCharge` from `deliveryChargeFns.js` to estimate the delivery cost based on coordinates.
    - Formulate the fixed or percentage-based "Try & Buy" fee.
    - Return the breakdown (delivery charge, try & buy fee, total initial payable).
    - Avoid touching the final product billing logic yet.
  </action>
  <verify>grep_search the routes and controllers for `calculateFees` implementation</verify>
  <done>API returns delivery charge and Try & Buy fee accurately.</done>
</task>

## Success Criteria
- [ ] Cart prevents mixing products from multiple merchants.
- [ ] Pre-checkout fee calculation API is available and returns accurate delivery & Try & Buy fees.
