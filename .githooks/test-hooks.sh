#!/usr/bin/env bash
# Self-check for the FlashFits git hooks. Run from anywhere:
#   bash FF_api_web/.githooks/test-hooks.sh
# Builds a throwaway repo in a temp dir, exercises every rule, prints PASS/FAIL.
set -u
HOOKS=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
cd "$TMP"; git init -q .; git config user.email t@t.t; git config user.name t
mkdir -p .githooks sub/node_modules; cp "$HOOKS"/pre-commit "$HOOKS"/commit-msg "$HOOKS"/pre-push .githooks/
chmod +x .githooks/*; git config core.hooksPath .githooks
PASS=0; FAIL=0
check() { # name expected(block|allow) ...commit
  local name=$1 want=$2; shift 2
  if git commit -q -m "$1" >/dev/null 2>&1; then got=allow; else got=block; fi
  if [ "$got" = "$want" ]; then echo "  ✓ $name"; PASS=$((PASS+1));
  else echo "  ✗ $name (wanted $want, got $got)"; FAIL=$((FAIL+1)); fi
}
echo "FlashFits hook self-check"
echo ok > a.txt; git add a.txt;                 check "clean commit allowed"        allow "docs: add a file"
echo x > b.txt;  git add b.txt;                 check "bad message blocked"         block "added stuff"
                                                check "good message allowed"        allow "feat(x): add b"
echo K=v > .env; git add -f .env;               check "secret blocked"              block "chore: env"
git reset -q
head -c 3000000 /dev/zero > big.bin; git add big.bin; check "large file blocked"    block "chore: big"
git reset -q; rm -f big.bin .env
printf '{"name":"sub","scripts":{"lint":"exit 1"}}\n' > sub/package.json
echo c > sub/a.js; git add -f sub/package.json sub/a.js
                                                check "failing lint warns (lenient)" allow "feat(sub): add a"
touch .githooks/strict; echo d >> sub/a.js; git add sub/a.js
                                                check "failing lint blocks (strict)" block "feat(sub): add d"
printf '{"name":"sub","scripts":{"lint":"exit 0"}}\n' > sub/package.json; git add sub/package.json
                                                check "passing lint allowed (strict)" allow "fix(sub): lint now passes"
echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
