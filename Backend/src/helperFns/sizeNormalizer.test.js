import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSize, isValidSize } from "./sizeNormalizer.js";

test("normalizeSize strips all whitespace and upper-cases", () => {
  assert.equal(normalizeSize("  m "), "M");
  assert.equal(normalizeSize("30-23 cm"), "30-23CM");
  assert.equal(normalizeSize("UK 8"), "UK8");
  assert.equal(normalizeSize("Free"), "FREE");
});

test("normalizeSize collapses the variants that used to collide on productCode", () => {
  // the bug: these two stored differently but produced one productCode
  assert.equal(normalizeSize("30-23 cm"), normalizeSize("30-23cm"));
  assert.equal(normalizeSize("x l"), normalizeSize("XL"));
});

test("normalizeSize passes non-strings through untouched", () => {
  // the ProductFlat setter also sees query values, e.g. { size: { $in: [/^M$/i] } }
  const re = /^M$/i;
  assert.equal(normalizeSize(re), re);
  assert.equal(normalizeSize(undefined), undefined);
});

test("isValidSize accepts every size shape merchants actually sell", () => {
  for (const s of ["M", "XXL", "FS", "Free", "32", "28-29", "30-23 cm", "UK 8", "7.5 inch", "4Y", "90/36"]) {
    assert.ok(isValidSize(s), `expected ${s} to be valid`);
  }
});

test("isValidSize rejects empty, oversized and corrupting input", () => {
  for (const s of ["", "   ", undefined, null, 32, "-M", "M;DROP", "<b>M</b>", "a".repeat(21)]) {
    assert.ok(!isValidSize(s), `expected ${JSON.stringify(s)} to be invalid`);
  }
});
