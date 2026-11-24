# FlashFits: what it is

_Last Updated: 2026-11-21_

FlashFits is an **instant fashion commerce platform**. A customer orders several sizes and styles with
**nothing to pay upfront**, a rider brings them to the door within the hour and waits outside while the
customer tries them on at home, and the customer pays only for what they keep. Everything else goes straight
back with the rider.

It also sells the ordinary way — prepaid, shipped by courier — for stores too far away to deliver from.

This repo is the **API and the admin panel**: the service all four apps talk to, and the console the
FlashFits team runs the business from.

## Who uses it

- **Customers** browse nearby boutiques and warehouse stock, order with ₹0 upfront, try at home, and pay for
  what they keep. Or they order prepaid from a distant store and wait for the courier.
- **Merchants** — partner boutiques and FlashFits warehouse operators. They list products, accept orders
  within minutes, pack them into sealed zip covers, hand them to riders, inspect what comes back, run their
  own store offers, and get paid weekly.
- **Delivery partners** (riders) take a trip, collect from the store, run the doorstep trial, collect payment
  by QR or cash, carry unkept items back, and earn per delivery plus incentives.
- **The FlashFits team** approves merchants, watches live orders, draws delivery zones, runs campaigns and
  coupons, settles weekly payouts, and resolves disputes — all through the admin panel in this repo.

## The two ways to buy

### Try & Buy — the local, 30-minute doorstep trial

The reason FlashFits exists. Clothes do not fit predictably, so the customer orders a few options and decides
at the door.

1. Order several sizes and styles. **₹0 is charged at checkout.**
2. A nearby merchant accepts within 5–10 minutes and packs the items into a sealed zip cover.
3. A rider collects them — verifying the seal and matching the order — and brings them to the door.
4. OTP handshake, then the trial begins: the customer tries things on at home while the rider waits.
5. The customer marks each item **Keep** or **Return**.
6. They pay for the kept items plus the delivery fee, by UPI QR or cash to the rider.
7. The rider carries the returns straight back to the store, photographing them as proof.

### Courier — prepaid, standard shipping

For stores outside delivery range. Paid in full at checkout, shipped normally, with a 3-day return window
after delivery.

## The main ideas

| Idea | In plain words |
|---|---|
| **Try & Buy order** | A local order, nothing paid upfront, with a doorstep trial. |
| **Courier order** | A distant order, paid in full, shipped. A separate thing entirely. |
| **Trial phase** | The window between the rider's OTP handshake and the customer's keep/return decision. |
| **Keep / Return** | What the customer decides, per item, during the trial. Only kept items are charged. |
| **Zip cover** | The sealed bag items travel in. Its seal ID is the proof nothing was swapped. |
| **Merchant** | A partner boutique, or a FlashFits warehouse. |
| **Zone** | The geographic area orders and riders are matched within. |
| **Hub / warehouse** | Stock FlashFits holds itself, rather than a partner's. |
| **Offer** | A discount that **applies automatically** when the cart qualifies. |
| **Coupon** | A discount the customer applies **with a code**. |
| **Incentive** | An extra payment to a rider for hitting a target — trips in a day, peak hours. |
| **Weekly payout** | What a merchant or rider is actually paid, settled once a week. |
| **Campaign** | A themed, scheduled promotion — a festival sale, a seasonal drop. |

## What makes it awkward to build

Worth stating plainly, because almost every hard part of this codebase comes from one of these:

- **Nothing is final until the trial ends.** Every total, discount and settlement figure computed at checkout
  is an estimate. A coupon validated against a ₹2,400 cart has to be recomputed when the customer keeps
  ₹600 of it. Four different code paths close out an order, and each must recompute identically.
- **Five parties watch the same order at once** — customer, merchant, rider, warehouse, admin — and all of
  them must see consistent state in real time. Hence the Socket.IO layer.
- **A missed alert is a lost sale.** The merchant has minutes to accept; the rider has seconds. Both apps
  need alarms that work on a locked phone.
- **Money moves three ways.** The customer pays, the merchant is paid weekly minus commission, the rider is
  paid weekly plus incentives. A discount has to be charged to whoever offered it — a merchant's offer comes
  out of the merchant's share, a FlashFits offer out of FlashFits'.
- **The business runs on IST** while the database stores UTC, so every "today" is a decision.

## What it does today

**Customer-facing:** catalogue with variants and attributes, nearby-store discovery, search, collections and
campaigns, cart split across Try & Buy and courier, checkout with offers and coupons, Razorpay for prepaid
orders, live order tracking, the trial and settlement flow, courier returns, wallet, referrals, reviews, and
a help centre with photo-based damage reports.

**Merchant-facing:** registration with KYC and bank details, a registration fee, catalogue management with
bulk CSV upload, stock updates, live order acceptance, zip-cover sealing, return inspection, store offers,
warehouse operations, and weekly payouts with UTR records.

**Rider-facing:** onboarding, online sessions with readiness checks, zone-based dispatch with an acceptance
window, navigation, OTP handshakes at both ends, the trial timer, QR and cash collection, return proof
photos, daily and weekly earnings, and incentive programmes.

**Admin-facing:** 41 screens — live orders, merchant approval, catalogue and attribute management, zones and
hubs, offers, collections and banners, finance and payouts, incentives, return issues, support tickets,
broadcast notifications, audit logs, and a config screen driving app behaviour without a release.

**Plumbing:** Socket.IO real-time across all roles, a weekly payout cron, Cloudinary media, Razorpay,
Telegram and WhatsApp alert channels, Expo push, and Gemini-assisted product analysis.

## Status

Live and operating, with a launch gate: `appConfig.isOrderPlacementEnabled` defaults to **off**, and there is
a testing mode that restricts the customer app to a single merchant. Branch `dev2` is the current line of
work.

Honest about the state: there are **no automated tests anywhere** in the ecosystem, the Socket.IO layer is
**unauthenticated**, and the service can only run on **one instance**. See
[docs/security-findings.md](docs/security-findings.md) and [DESIGN.md](DESIGN.md) §7.

## Later (named, not built)

Server-driven home-screen layouts so campaigns need no app release; custom-range earnings reporting for
merchants and riders; a reworked offer/coupon model with explicit discount attribution; scheduled and
segmented push broadcasts; consolidating the two merchant apps into one. Each has a report in
[docs/reports/](docs/reports/) and none has been approved.
