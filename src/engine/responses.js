import colors from "../utils/colors.js";
import { CONFIG } from "./config.js";
import { isSpamMessage } from "./blocklist.js";
import { isWhitelisted } from "./whitelist.js";
import { randomBytes } from "crypto";

export async function handleRateLimitViolation(message) {
  message.delete().catch(() => {});

  if (message.member) {
    message.member
      .timeout(
        CONFIG.RATE_LIMIT.TIMEOUT_DURATION_MS,
        "[watchtower] rate limit exceeded"
      )
      .catch(() => {});
  }

  const reply = await message.channel.send({
    embeds: [
      {
        description: `<@${message.author.id}> you're sending messages too quickly, slow down!`,
        color: colors.yellow,
      },
    ],
  });

  setTimeout(
    () => reply.delete().catch(() => {}),
    CONFIG.MODERATION.REPLY_DELETION_TIMEOUT
  );
}

export async function handleRepeatedMessage(message) {
  message.delete().catch(() => {});

  const reply = await message.channel.send({
    embeds: [
      {
        description: `<@${message.author.id}> you've already said that`,
        color: colors.yellow,
      },
    ],
  });

  setTimeout(
    () => reply.delete().catch(() => {}),
    CONFIG.MODERATION.REPLY_DELETION_TIMEOUT
  );
}

export async function handleSelfHarmContent(message) {
  await message.reply({
    embeds: [
      {
        title: "help is available",
        description:
          "if you're struggling with thoughts of self-harm, please know that help is available 24/7",
        color: colors.purple,
        fields: [
          {
            name: "International Crisis Helpline",
            value: "Call or text 988",
            inline: true,
          },
          {
            name: "Crisis Text Line",
            value: "Text HOME to 741741",
            inline: true,
          },
        ],
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "International Crisis Helpline",
            url: "https://988lifeline.org",
          },
          {
            type: 2,
            style: 5,
            label: "Crisis Text Line",
            url: "https://www.crisistextline.org",
          },
        ],
      },
    ],
  });
}

export async function handleFlaggedContent(message, scores, timeoutDuration) {
  const aggregatedReasonsString = Object.entries(scores)
    .map(([cat, score]) => `${cat} (${(score * 100).toFixed(1)}%)`)
    .join("; ");

  if (!aggregatedReasonsString?.trim()) return;

  message.delete().catch(() => {});

  if (message.member) {
    message.member
      .timeout(
        timeoutDuration,
        `[watchtower] flagged: ${aggregatedReasonsString}`
      )
      .catch(() => {});
  }

  const reply = await message.channel.send({
    embeds: [
      {
        description: `<@${message.author.id}> your message was flagged for: ${aggregatedReasonsString}\nfurther infractions may and will lead to longer timeouts`,
        color: colors.red,
      },
    ],
  });

  setTimeout(
    () => reply.delete().catch(() => {}),
    CONFIG.MODERATION.REPLY_DELETION_TIMEOUT
  );
}

export function formatViolationReasons(scores) {
  return Object.entries(scores)
    .map(([cat, score]) => `${cat} (${(score * 100).toFixed(1)}%)`)
    .join("; ");
}

export async function handleSpamMessage(message) {
  try {
    if (message.channel.isThread() && message.channel.parent?.type === 15) {
      const threadCreatedTime = message.channel.createdTimestamp;
      const messageTime = message.createdTimestamp;

      if (Math.abs(messageTime - threadCreatedTime) < 5000) {
        await message.channel.delete(
          "[watchtower] spam thread starter message"
        );

        if (message.member) {
          await message.member.timeout(15000, "[watchtower] spam forum thread");
        }
        return;
      }
    }

    await message.delete();
    if (message.member) {
      await message.member.timeout(15000, "[watchtower] spam message detected");
    }
  } catch {}
}

export async function handleSpamThread(thread) {
  try {
    if (!isSpamMessage(thread.name)) return;
    thread.delete("[watchtower] spam thread title detected");

    const guild = thread.guild;
    if (guild && thread.ownerId) {
      try {
        const member = await guild.members.fetch(thread.ownerId);
        if (member) {
          member.timeout(15000, "[watchtower] spam thread detected");
        }
      } catch {}
    }
  } catch {}
}

export async function handleSpamNickname(member) {
  try {
    if (member.permissions?.has("Administrator")) return;

    const mockMessage = {
      guildId: member.guild.id,
      author: { id: member.id },
      member: member,
      channelId: null,
    };

    if (await isWhitelisted(mockMessage)) return;

    const nickname = member.nickname || member.user.displayName;
    if (nickname && isSpamMessage(nickname)) {
      const randomSuffix = randomBytes(4).toString("hex");
      const moderatedNickname = `moderated username ${randomSuffix}`;

      await member.setNickname(
        moderatedNickname,
        "[watchtower] spam nickname detected"
      );

      await member.timeout(5000, "[watchtower] spam nickname");
    }
  } catch {}
}
