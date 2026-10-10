/**
 * Builds a regex that matches terms flexibly, ignoring differences in hyphens,
 * underscores, and spaces.
 * 
 * For example:
 * - "tshirt" matches "T-Shirt", "T-shirt", "T Shirt", "tshirt", "Polo T-Shirt"
 * - "t-shirt" matches "T-Shirt", "Tshirt", "T Shirt"
 * - "croptop" matches "Crop Top", "Crop-Top", "Croptop"
 */
export const buildFlexibleSearchRegex = (term) => {
  if (!term || typeof term !== 'string') return new RegExp('', 'i');
  const trimmed = term.trim();
  if (!trimmed) return new RegExp('', 'i');

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Strip non-alphanumeric chars to inspect the core character sequence
  const cleanChars = trimmed.replace(/[^a-zA-Z0-9]/g, '').split('');
  if (cleanChars.length === 0) {
    return new RegExp(escapeRegex(trimmed), 'i');
  }

  // Handle trailing plural 's' if word ends in 's'
  let isPlural = false;
  if (cleanChars.length > 3 && cleanChars[cleanChars.length - 1].toLowerCase() === 's' && cleanChars[cleanChars.length - 2].toLowerCase() !== 's') {
    isPlural = true;
  }

  // For compact terms / compound words (<= 15 alphanumeric characters),
  // insert optional separator between characters to achieve full bidirectional match.
  // Note: '-' must be escaped as \- inside character class for MongoDB PCRE compatibility.
  if (cleanChars.length <= 15) {
    let pattern;
    if (isPlural) {
      const baseChars = cleanChars.slice(0, -1);
      pattern = baseChars.map(escapeRegex).join('[\\s_\\-]*') + '([\\s_\\-]*s)?';
    } else {
      pattern = cleanChars.map(escapeRegex).join('[\\s_\\-]*') + '(s)?';
    }
    return new RegExp(pattern, 'i');
  }

  // For longer multi-word phrases, split by spaces and match words
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordPatterns = words.map(w => {
    const chars = w.replace(/[^a-zA-Z0-9]/g, '').split('');
    if (chars.length <= 1) return escapeRegex(w);
    let wordPlural = false;
    if (chars.length > 3 && chars[chars.length - 1].toLowerCase() === 's' && chars[chars.length - 2].toLowerCase() !== 's') {
      wordPlural = true;
    }
    if (wordPlural) {
      const base = chars.slice(0, -1);
      return base.map(escapeRegex).join('[\\s_\\-]*') + '([\\s_\\-]*s)?';
    }
    return chars.map(escapeRegex).join('[\\s_\\-]*') + '(s)?';
  });

  return new RegExp(wordPatterns.join('[\\s_\\-]+'), 'i');
};
