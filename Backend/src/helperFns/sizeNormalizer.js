/**
 * The one place a size string is normalised.
 *
 * Sizes are free text (`M`, `32`, `30-23 cm`, `UK 8`) — see
 * docs/reports/numeric-size-variants-bug.md. Free text means two merchants can
 * type the same size three ways, so every write normalises to one form.
 *
 * Internal whitespace is removed, not collapsed, on purpose. `productCode` is
 * built everywhere as `size.replace(/\s+/g, '').toUpperCase()`, so storing the
 * same token makes the stored `size` and the `productCode` agree by
 * construction. When they disagreed, `30-23 cm` and `30-23cm` passed the
 * unique index on (styleGroupId, color.name, size) but collided on the unique
 * `productCode` — an E11000 the merchant saw as an unexplained 500.
 *
 * Applied by the setter on `ProductFlat.size`, so it covers all nine creation
 * sites (merchant web, merchant app, bulk CSV, admin, warehouse, Telegram bot)
 * without each one remembering to call it.
 */
export const normalizeSize = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : value;

/** Longest real size we expect: "30-23CM", "XXXL", "UK10.5". 20 is generous. */
export const MAX_SIZE_LENGTH = 20;

/**
 * Shape check, not a vocabulary check. Any size a merchant can actually sell
 * passes; control characters, separators that would corrupt a productCode, and
 * pasted sentences do not.
 */
export const isValidSize = (value) => {
  const size = normalizeSize(value);
  if (typeof size !== "string" || size.length === 0) return false;
  if (size.length > MAX_SIZE_LENGTH) return false;
  return /^[A-Z0-9][A-Z0-9./-]*$/.test(size);
};
