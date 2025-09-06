import { CONFIG, ENV } from "./config.js";

const moderationResultCache = new Map();

export async function analyzeTextWithPerspective(text) {
	if (!ENV.GOOGLE_API_KEY || !text || text.trim().length === 0) {
		return {
			flagged: false,
			categories: {},
			category_scores: {},
			_error: !ENV.GOOGLE_API_KEY && !!text && text.trim().length > 0,
		};
	}

	try {
		const data = await (
			await fetch(
				`${CONFIG.APIS.PERSPECTIVE_URL_BASE}?key=${ENV.GOOGLE_API_KEY}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						comment: { text },
						requestedAttributes: CONFIG.PERSPECTIVE_ATTRIBUTES,
						languages: ["en"],
						doNotStore: true,
					}),
				},
			)
		).json();

		const results = { flagged: false, categories: {}, category_scores: {} };

		if (data && data.attributeScores) {
			for (const attrName in data.attributeScores) {
				if (attrName in CONFIG.PERSPECTIVE_ATTRIBUTES) {
					const score = data.attributeScores[attrName].summaryScore.value;
					if (score > CONFIG.MODERATION.PERSPECTIVE_FLAGGING_THRESHOLD) {
						results.flagged = true;
						let categoryKey = attrName.toLowerCase();
						if (attrName === "SEXUALLY_EXPLICIT") categoryKey = "sexual";

						results.categories[categoryKey] = true;
						results.category_scores[categoryKey] = Math.max(
							results.category_scores[categoryKey] || 0,
							score,
						);
					}
				}
			}
		}
		return results;
	} catch (error) {
		console.error("[moderation/perspective]", error);
		return {
			flagged: false,
			categories: {},
			category_scores: {},
			_error: true,
		};
	}
}

export async function moderateWithOpenAI(inputs) {
	if (!ENV.OPENAI_API_KEY || !inputs || inputs.length === 0) {
		return {
			results: [],
			_error: !ENV.OPENAI_API_KEY && !!inputs && inputs.length > 0,
		};
	}

	try {
		const data = await (
			await fetch(CONFIG.APIS.OPENAI_MODERATION_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
				},
				body: JSON.stringify({
					model: "omni-moderation-latest",
					input: inputs,
				}),
			})
		).json();

		if (!data.results) {
			return { results: [], _error: true };
		}

		return data;
	} catch (error) {
		console.error("[moderation/openai]", error);
		return { results: [], _error: true };
	}
}

export function getCachedModerationResult(cacheKey) {
	const now = Date.now();
	const cached = moderationResultCache.get(cacheKey);

	if (cached && now - cached.timestamp < CONFIG.CACHE.MODERATION_TTL_MS) {
		return cached.data;
	}

	return null;
}

export function cacheModerationResult(cacheKey, data) {
	moderationResultCache.set(cacheKey, {
		data,
		timestamp: Date.now(),
	});
}

export function aggregateModerationResults(openaiResult, perspectiveResult) {
	const finalAggregatedScores = {};
	let overallFlagged = false;

	if (!openaiResult._error && openaiResult.results) {
		openaiResult.results.forEach((itemResult) => {
			if (itemResult && itemResult.flagged) {
				overallFlagged = true;
				Object.entries(itemResult.category_scores).forEach(
					([category, score]) => {
						if (
							itemResult.categories[category] &&
							score > CONFIG.MODERATION.FLAGGING_THRESHOLD
						) {
							const mainCategory = category.split("/")[0];
							finalAggregatedScores[mainCategory] = Math.max(
								finalAggregatedScores[mainCategory] || 0,
								score,
							);
						}
					},
				);
			}
		});
	}

	if (!perspectiveResult._error && perspectiveResult.flagged) {
		Object.entries(perspectiveResult.category_scores).forEach(
			([category, score]) => {
				if (
					openaiResult._error ||
					!finalAggregatedScores[category] ||
					score > (finalAggregatedScores[category] || 0)
				) {
					overallFlagged = true;
					finalAggregatedScores[category] = Math.max(
						finalAggregatedScores[category] || 0,
						score,
					);
				}
			},
		);
	}

	return { finalAggregatedScores, overallFlagged };
}
