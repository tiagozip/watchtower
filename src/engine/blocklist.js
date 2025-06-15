const SPAM_PATTERNS = [
  /[﷽𒈙𒐫ဪ꧅]{3,}/g,

  /[\u200B-\u200D\uFEFF\u2060\u180E\u061C\u2066-\u2069]{3,}/g,

  /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{8,}/g,
];

const EXACT_SPAM_STRINGS = new Set([
  "﷽﷽𒈙𒐫ဪ𒐫𒈙𒈙﷽꧅",
  "𒈙𒐫ဪ𒐫𒈙𒈙﷽꧅﷽﷽",
  "﷽𒈙𒐫ဪ𒐫𒈙𒈙﷽꧅",

  "****",
  "____",
  "````",
  "||||",
  "~~~~",

  "\u200B\u200B\u200B",
  "\u200C\u200C\u200C",
  "\u200D\u200D\u200D",
  "\uFEFF\uFEFF\uFEFF",
]);

export function isSpamMessage(content) {
  if (!content || typeof content !== "string") return false;

  const normalizedContent = content.trim();
  if (!normalizedContent) return false;

  if (EXACT_SPAM_STRINGS.has(normalizedContent)) return true;

  const cleanContent = normalizedContent.replace(/\s/g, "");
  if (EXACT_SPAM_STRINGS.has(cleanContent)) return true;

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.global) pattern.lastIndex = 0;
    if (pattern.test(normalizedContent)) return true;
  }

  const invisibleChars = (
    normalizedContent.match(
      /[\u200B-\u200D\uFEFF\u00A0\u2060\u180E\u061C\u2066-\u2069]/g
    ) || []
  ).length;
  const totalChars = normalizedContent.length;
  if (invisibleChars > 0 && invisibleChars / totalChars > 0.9) return true;

  const emojiMatches =
    normalizedContent.match(
      /[\u{1F000}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
    ) || [];
  if (emojiMatches.length > 10) {
    const emojiCounts = {};
    emojiMatches.forEach((emoji) => {
      emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
    });
    const maxRepeats = Math.max(...Object.values(emojiCounts));
    if (maxRepeats >= 15) return true;
  }

  const contentWithoutFormatting = normalizedContent
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/``/g, "")
    .replace(/\|\|/g, "")
    .replace(/~~/g, "")
    .replace(/\s/g, "");

  if (
    contentWithoutFormatting.length === 0 &&
    normalizedContent.includes("*")
  ) {
    const formattingCount = (
      normalizedContent.match(/\*\*|__|``|\|\||~~/g) || []
    ).length;
    if (formattingCount >= 3) return true;
  }

  return false;
}

export function addSpamPattern(pattern) {
  if (typeof pattern === "string") {
    EXACT_SPAM_STRINGS.add(pattern);
  } else if (pattern instanceof RegExp) {
    SPAM_PATTERNS.push(pattern);
  }
}

export function getSpamPatterns() {
  return {
    patterns: SPAM_PATTERNS,
    exactStrings: Array.from(EXACT_SPAM_STRINGS),
  };
}
