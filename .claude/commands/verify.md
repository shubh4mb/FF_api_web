---
description: Walk the real user flows for a finished feature (post-test verification)
argument-hint: "<feature or flow name>"
---

Follow the verification protocol in @VERIFY.md for: $ARGUMENTS

Do not report PASS for any flow you could not actually execute. If no device or browser is
available, run everything you can, then report **PARTIAL — manual device verification
outstanding** and list the flows a human must walk.

If a specific failure resists three genuine fix attempts, stop, revert, and record it in
docs/KNOWN-ISSUES.md in the documented format.
