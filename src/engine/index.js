import { ENV } from "./config.js";
import { attemptConsumeToken } from "./ratelimit.js";
import {
  analyzeTextWithPerspective,
  moderateWithOpenAI,
  getCachedModerationResult,
  cacheModerationResult,
  aggregateModerationResults,
} from "./moderation.js";
import { calculateTimeoutDuration, recordFlagIncident } from "./timeout.js";
import { isWhitelisted } from "./whitelist.js";
import {
  extractMessageContent,
  extractImageUrls,
  isRepeatedMessage,
  createModerationCacheKey,
  prepareOpenAIInput,
} from "./utils.js";
import {
  handleRateLimitViolation,
  handleRepeatedMessage,
  handleSelfHarmContent,
  handleFlaggedContent,
  handleSpamMessage,
} from "./responses.js";
import { isSpamMessage } from "./blocklist.js";

// 1349458276970004542 is happy devices' client id,
// it frequently gets flagged when it shouldn't
const defaultWhitelist = [ENV.DISCORD_CLIENT_ID, "1349458276970004542"];

async function processFlaggedContent(message, scores) {
  const timeoutDuration = calculateTimeoutDuration(message.author.id, scores);

  recordFlagIncident(message.author.id, scores, timeoutDuration);
  await handleFlaggedContent(message, scores, timeoutDuration);
}

export default async function processMessage(message) {
  if (!message) return;

  if (defaultWhitelist.includes(message.author.id)) return;
  if (message.author.bot && !message.webhookId) return;

  if (message.member?.permissions.has("Administrator")) return;
  if (await isWhitelisted(message)) return;

  let textContent = extractMessageContent(message);

  if (!textContent || textContent.length < 3) {
    return;
  }

  if (isSpamMessage(textContent)) {
    await handleSpamMessage(message);
    return;
  }

  if (isRepeatedMessage(message)) {
    await handleRepeatedMessage(message);
    return;
  }

  if (!attemptConsumeToken(message.author.id)) {
    await handleRateLimitViolation(message);
    return;
  }

  const imageUrls = extractImageUrls(message);

  if (!(textContent.length > 2 || imageUrls.length > 0)) return;

  const cacheKey = createModerationCacheKey(textContent, imageUrls);
  const cachedResult = getCachedModerationResult(cacheKey);

  if (cachedResult) {
    if (cachedResult.overallFlagged) {
      await processFlaggedContent(message, cachedResult.finalAggregatedScores);
    }
    return;
  }

  const openaiInput = prepareOpenAIInput(textContent, imageUrls);

  const [openaiResult, perspectiveResult] = await Promise.allSettled([
    moderateWithOpenAI(openaiInput),
    analyzeTextWithPerspective(textContent),
  ]);

  const openaiModeration =
    openaiResult.status === "fulfilled"
      ? openaiResult.value
      : { results: [], _error: true };

  const perspectiveModeration =
    perspectiveResult.status === "fulfilled"
      ? perspectiveResult.value
      : { flagged: false, categories: {}, category_scores: {}, _error: true };

  const { finalAggregatedScores, overallFlagged } = aggregateModerationResults(
    openaiModeration,
    perspectiveModeration
  );

  cacheModerationResult(cacheKey, { finalAggregatedScores, overallFlagged });

  if (!overallFlagged) return;

  if (
    openaiModeration?.results?.[0]?.category_scores?.["self-harm/intent"] > 0.88
  ) {
    return handleSelfHarmContent(message);
  }

  processFlaggedContent(message, finalAggregatedScores);
}
