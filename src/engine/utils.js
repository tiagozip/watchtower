import { CONFIG } from "./config.js";

const userRecentMessages = new Map();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_INACTIVE_TIME_MS = 60 * 60 * 1000; // 1 hour

const userLastActivity = new Map();

setInterval(cleanupInactiveMessages, CLEANUP_INTERVAL_MS);

function cleanupInactiveMessages() {
	const now = Date.now();
	const toDelete = [];

	for (const [userId, lastActivity] of userLastActivity.entries()) {
		if (now - lastActivity > MAX_INACTIVE_TIME_MS) {
			toDelete.push(userId);
		}
	}

	toDelete.forEach((userId) => {
		userRecentMessages.delete(userId);
		userLastActivity.delete(userId);
	});
}

export function extractMessageContent(message) {
	let combinedTextContent = message.content || "";

	message.embeds?.forEach((embed) => {
		if (embed.title) combinedTextContent += `\n${embed.title}`;
		if (embed.description) combinedTextContent += `\n${embed.description}`;

		embed.fields?.forEach((field) => {
			combinedTextContent += `\n${field.name}\n${field.value}`;
		});

		if (embed.footer?.text) combinedTextContent += `\n${embed.footer.text}`;
		if (embed.author?.name) combinedTextContent += `\n${embed.author.name}`;
	});

	return combinedTextContent;
}

export function extractImageUrls(message) {
	const imageUrls = [];

	message.attachments?.forEach((attachment) => {
		if (attachment.contentType?.startsWith("image/") && attachment.url) {
			imageUrls.push(attachment.url);
		}
	});

	message.embeds?.forEach((embed) => {
		if (embed.image?.url) {
			imageUrls.push(embed.image.url);
		}
		if (embed.thumbnail?.url) {
			imageUrls.push(embed.thumbnail.url);
		}
	});

	return [...new Set(imageUrls)];
}

export function isRepeatedMessage(message) {
	const userId = message.author.id;
	const currentContent = message.content || "";
	const normalizedCurrentContent = currentContent.trim().toLowerCase();

	if (!normalizedCurrentContent) return false;

	userLastActivity.set(userId, Date.now());

	const userMessages = userRecentMessages.get(userId) || [];
	const isRepeated = userMessages.some(
		(msg) => msg.trim().toLowerCase() === normalizedCurrentContent,
	);

	if (isRepeated) return true;

	const updatedUserMessages = [currentContent, ...userMessages].slice(
		0,
		CONFIG.MESSAGES.RECENT_MESSAGES_TO_TRACK,
	);
	userRecentMessages.set(userId, updatedUserMessages);

	return false;
}

export function createModerationCacheKey(textContent, imageUrls) {
	return Bun.hash(textContent + JSON.stringify(imageUrls.sort())).toString();
}

export function prepareOpenAIInput(textContent, imageUrls) {
	const inputs = [];

	if (textContent) {
		inputs.push({ type: "text", text: textContent });
	}

	imageUrls.forEach((url) => {
		inputs.push({ type: "image_url", image_url: { url } });
	});

	return inputs;
}
