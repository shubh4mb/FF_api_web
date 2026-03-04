---
phase: 1
plan: 2
wave: 1
---

# Plan 1.2: Customer App Cart & Checkout UI

## Objective
Enforce the single-merchant rule on the client side and integrate the initial fee calculation on the Checkout screen.

## Context
- `.gsd/SPEC.md`
- `.gsd/ARCHITECTURE.md`
- `FlashFits/app/(stack)/ShoppingBag.tsx`
- `FlashFits/components/CartBagComponents/CheckoutPage.tsx`
- `FlashFits/api/orderApis.js`

## Tasks

<task type="auto">
  <name>Enforce Single-Merchant Rule in Customer App</name>
  <files>FlashFits/app/(stack)/ShoppingBag.tsx</files>
  <action>
    - Ensure that when a user tries to add an item to the cart, the local state or API call handles the rejection.
    - If the backend returns the "Single merchant only" error, show a clear UI alert to the user asking if they want to clear the cart to add the new item.
  </action>
  <verify>grep_search `ShoppingBag.tsx` or cart actions for merchant validation UI</verify>
  <done>Frontend gracefully blocks multi-merchant cart additions with an alert.</done>
</task>

<task type="auto">
  <name>Integrate Fee Calculation API</name>
  <files>
    FlashFits/components/CartBagComponents/CheckoutPage.tsx
    FlashFits/api/orderApis.js
  </files>
  <action>
    - Create an API wrapper in `orderApis.js` to call the new `POST /order/calculateFees` endpoint.
    - In `CheckoutPage.tsx`, trigger this API when an address is selected.
    - Display the returned `deliveryCharge` and `Try&Buy Fee` dynamically in the billing summary section before the user clicks to pay.
  </action>
  <verify>grep_search `CheckoutPage.tsx` for `calculateFees` integration</verify>
  <done>Checkout screen displays accurate dynamic fees based on the selected address.</done>
</task>

## Success Criteria
- [ ] Users receive a friendly alert if they mix products from different shops.
- [ ] The checkout summary displays dynamic delivery and Try&Buy service fees based on the address coordinates.
