# Project Glossary

This document serves as the canonical reference for business-specific terminology used in the FlashFits project.

## 1. Try and Buy (T&B) Feature
**Definition:** A service available to a customer when they are located within a specific proximity of a merchant.
- **Radius:** Nominally 7km, but **admin-configurable** via `AppConfig.tryAndBuyRadius`.
- **Optimization:** The configuration is retrieved using `AppConfig.getConfig()`, which implements a **5-minute in-memory cache** to minimize database hits.
- **Merchant Criteria:** Must offer the "Try and Buy" service and be located in an "active delivery zone".

## 2. Instant Try and Buy
**Definition:** A subset of the "Try and Buy" feature where:
- The customer satisfies all "Try and Buy" criteria (proximity and zone).
- **AND** the merchant is currently **online** (available for immediate service).

## 3. Courier Delivery Merchants
**Definition:** Merchants who are capable of performing delivery via external or traditional courier services, typically used for orders that do not fall under the "Try and Buy" radius or service model.

---
*Last updated: 2026-04-06*
