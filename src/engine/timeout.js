import { CONFIG } from "./config.js";

const userFlagHistory = new Map();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupExpiredHistory() {
	const now = Date.now();
	let cleanedCount = 0;

	for (const [userId, history] of userFlagHistory.entries()) {
		const filteredHistory = history.filter(
			(entry) => now - entry.timestamp < CONFIG.TIMEOUT.HISTORY_RETENTION_MS,
		);

		if (filteredHistory.length === 0) {
			userFlagHistory.delete(userId);
			cleanedCount++;
		} else if (filteredHistory.length !== history.length) {
			userFlagHistory.set(userId, filteredHistory);
		}
	}

	if (cleanedCount > 0) {
		console.log(`Cleaned up ${cleanedCount} expired timeout history entries`);
	}
}

setInterval(cleanupExpiredHistory, CLEANUP_INTERVAL_MS);

export function calculateTimeoutDuration(userId, currentAggregatedScores) {
	const now = Date.now();
	const history = userFlagHistory.get(userId) || [];

	const relevantHistory = history.filter(
		(entry) => now - entry.timestamp < CONFIG.TIMEOUT.CALCULATION_WINDOW_MS,
	);

	let newTimeout = CONFIG.TIMEOUT.BASE_FLAG_TIMEOUT_MS;

	const currentMaxScore = Math.max(
		0,
		...Object.values(currentAggregatedScores),
	);
	const normalizedScoreSeverity = Math.max(
		0,
		(currentMaxScore - CONFIG.MODERATION.FLAGGING_THRESHOLD) /
			(1 - CONFIG.MODERATION.FLAGGING_THRESHOLD),
	);
	const scoreMultiplier = 1 + normalizedScoreSeverity * 4;
	newTimeout *= scoreMultiplier;

	const recentFlagsCount = relevantHistory.length;
	const repeatOffenseMultiplier = 1.75 ** recentFlagsCount;
	newTimeout *= repeatOffenseMultiplier;

	if (relevantHistory.length > 0) {
		const lastIncident = relevantHistory[relevantHistory.length - 1];
		const lastTimeoutApplied = lastIncident.appliedTimeout;

		if (lastTimeoutApplied > CONFIG.TIMEOUT.BASE_FLAG_TIMEOUT_MS) {
			newTimeout = Math.max(
				newTimeout,
				lastTimeoutApplied +
					CONFIG.TIMEOUT.BASE_FLAG_TIMEOUT_MS * scoreMultiplier * 0.5,
			);
		}

		if (relevantHistory.length > 1) {
			const averageMaxScorePastIncidents =
				relevantHistory
					.map((entry) => Math.max(0, ...Object.values(entry.scores)))
					.reduce((sum, val) => sum + val, 0) / relevantHistory.length;

			if (
				currentMaxScore > averageMaxScorePastIncidents &&
				averageMaxScorePastIncidents >
					CONFIG.MODERATION.FLAGGING_THRESHOLD + 0.05
			) {
				newTimeout *= 1.3;
			}
		}
	}

	return Math.min(
		Math.max(newTimeout, CONFIG.TIMEOUT.BASE_FLAG_TIMEOUT_MS),
		CONFIG.TIMEOUT.MAX_DISCORD_TIMEOUT_MS,
	);
}

export function recordFlagIncident(userId, scores, appliedTimeout) {
	const now = Date.now();
	const userHistory = userFlagHistory.get(userId) || [];

	userHistory.push({
		timestamp: now,
		scores: { ...scores },
		appliedTimeout,
	});

	const prunedHistory = userHistory.filter(
		(entry) => now - entry.timestamp < CONFIG.TIMEOUT.HISTORY_RETENTION_MS,
	);

	userFlagHistory.set(userId, prunedHistory);
}
