import { CONFIG } from "./config.js";

const userTokenBuckets = new Map();

const REFILL_PERIOD_MS = 1000 / CONFIG.RATE_LIMIT.TOKEN_REFILL_RATE_PER_SECOND;
const TOKENS_PER_REFILL_PERIOD = 1;

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_INACTIVE_TIME_MS = 30 * 60 * 1000; // 30 minutes

setInterval(cleanupInactiveUsers, CLEANUP_INTERVAL_MS);

function cleanupInactiveUsers() {
	const now = Date.now();
	const toDelete = [];

	for (const [userId, bucket] of userTokenBuckets.entries()) {
		if (now - bucket.lastRefillTime > MAX_INACTIVE_TIME_MS) {
			toDelete.push(userId);
		}
	}

	toDelete.forEach((userId) => userTokenBuckets.delete(userId));
}

export function attemptConsumeToken(userId) {
	const now = Date.now();

	if (!userTokenBuckets.has(userId)) {
		userTokenBuckets.set(userId, {
			tokens: CONFIG.RATE_LIMIT.MAX_TOKENS_PER_USER,
			lastRefillTime: now,
		});
	}

	const bucket = userTokenBuckets.get(userId);

	if (bucket.tokens < CONFIG.RATE_LIMIT.MAX_TOKENS_PER_USER) {
		const elapsedTime = now - bucket.lastRefillTime;
		if (elapsedTime >= REFILL_PERIOD_MS) {
			const numPeriodsPassed = Math.floor(elapsedTime / REFILL_PERIOD_MS);
			const tokensToAdd = numPeriodsPassed * TOKENS_PER_REFILL_PERIOD;

			bucket.tokens = Math.min(
				CONFIG.RATE_LIMIT.MAX_TOKENS_PER_USER,
				bucket.tokens + tokensToAdd,
			);
			bucket.lastRefillTime += numPeriodsPassed * REFILL_PERIOD_MS;
		}
	}

	if (bucket.tokens >= 1) {
		bucket.tokens--;
		return true;
	} else {
		bucket.lastRefillTime = now;
		return false;
	}
}
