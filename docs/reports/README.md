# Analysis reports

Point-in-time investigations into specific questions. Each states what was read, what was found, and what is
recommended.

**None of these has been acted on, except `numeric-size-variants-bug.md`, which is fixed (§8).** The rest
are written to be decided on, not applied.

| Report | Question it answers |
|---|---|
| [merchant-consolidation.md](merchant-consolidation.md) | Can we drop the Expo merchant app for one web build + Capacitor? What breaks? Can we keep the store listings? |
| [coupons-and-offers.md](coupons-and-offers.md) | How should coupons and offers differ? What is broken? Who pays for a discount? |
| [earnings-and-payouts.md](earnings-and-payouts.md) | What should merchants and riders be able to see about their money, and what is wrong today? |
| [server-driven-campaigns.md](server-driven-campaigns.md) | Can we run a Christmas sale from the admin panel without an app release? |
| [push-broadcast.md](push-broadcast.md) | How should broadcasts and event notifications work? |
| [numeric-size-variants-bug.md](numeric-size-variants-bug.md) | Why can't merchants add sizes like "30-23 cm"? Is it the app or the web? **Fixed — §8 is what shipped.** |
| [../security-findings.md](../security-findings.md) | **Read first.** What is currently exposed. |

## Reading order, if you only read some

1. **[../security-findings.md](../security-findings.md)** — S1 is unauthenticated access to every order on
   the platform. Nothing else here matters as much.
2. **[coupons-and-offers.md](coupons-and-offers.md)** §2 B1 and §7 C4 — one missing function call is
   undercharging customers *and* overcharging merchants on every rider-settled order. It is the most
   expensive single bug found.
3. **[earnings-and-payouts.md](earnings-and-payouts.md)** §2.1 — every daily figure in the system is
   computed on UTC day boundaries in an IST business.
4. Then whichever feature you are about to build.

## The shape of these reports

Each one follows the same structure, because the questions were the same:

- **what exists today**, with file and line references, so the claim is checkable;
- **what is broken**, severity-ranked, each with a concrete failure scenario rather than a category;
- **what to do**, ordered so that the money leaks and the exploits come first;
- **the tests to write with it**, because a fix without a regression test is a fix that comes back.

Where a report says "already built", that is the most useful finding in it — three of these five questions
turned out to be largely implemented and either unexposed or undermined by a bug elsewhere.
