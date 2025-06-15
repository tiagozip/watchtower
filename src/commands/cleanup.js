import {
  ApplicationCommandOptionType,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import colors from "../utils/colors.js";

const typingEmoji = `<a:typing:1383860014497665094> ‍`;

export default function (client) {
  const commandName = "cleanup";

  const commandData = {
    name: commandName,
    description:
      "mass delete messages in a channel or threads in a forum based on content",
    options: [
      {
        name: "channel",
        description:
          "channel to scan for messages or forum to scan for threads",
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ChannelType.GuildText, ChannelType.GuildForum],
        required: true,
      },
      {
        name: "content",
        description: "content to search for in messages or thread names",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "limit",
        description:
          "maximum number of messages to scan (default: 2000, max: 4000)",
        type: ApplicationCommandOptionType.Integer,
        required: false,
        min_value: 1,
        max_value: 4000,
      },
    ],
  };

  client.commands.set(commandName, {
    data: commandData,
    execute: async (interaction) => {
      const channel = interaction.options.getChannel("channel");
      const searchContent = interaction.options.getString("content");
      const messageLimit = interaction.options.getInteger("limit") || 2000;

      if (!interaction.member.permissions.has("ManageMessages")) {
        return await interaction.reply({
          embeds: [
            {
              description:
                "you need the 'Manage Messages' permission to use this command",
              color: colors.negative,
            },
          ],
          ephemeral: true,
        });
      }

      return await handleCleanup(
        interaction,
        channel,
        searchContent,
        messageLimit
      );
    },
  });

  async function handleCleanup(
    interaction,
    channel,
    searchContent,
    messageLimit
  ) {
    const abortButton = new ButtonBuilder()
      .setCustomId("abort_cleanup")
      .setLabel("Abort")
      .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(abortButton);

    const initialEmbed = {
      title: `${typingEmoji} Scanning...`,
      color: colors.warn,
    };

    await interaction.reply({
      embeds: [initialEmbed],
      components: [actionRow],
      ephemeral: true,
    });

    let aborted = false;
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
      filter: (i) =>
        i.customId === "abort_cleanup" && i.user.id === interaction.user.id,
    });

    collector.on("collect", async (buttonInteraction) => {
      aborted = true;
      await buttonInteraction.update({
        embeds: [
          {
            title: "Aborted",
            description:
              channel.type === ChannelType.GuildForum
                ? ""
                : `**Final results:**\n• Messages scanned: ${totalScanned}\n• Messages matched: ${totalMatched}\n• Messages deleted: ${totalDeleted}`,
            color: colors.negative,
          },
        ],
        components: [],
      });
    });

    let totalScanned = 0;
    let totalMatched = 0;
    let totalDeleted = 0;
    let totalFailed = 0;

    try {
      if (channel.type === ChannelType.GuildForum) {
        const [activeThreads, archivedThreads] = await Promise.all([
          channel.threads.fetchActive(),
          channel.threads.fetchArchived(),
        ]);

        const allThreads = [
          ...activeThreads.threads.values(),
          ...archivedThreads.threads.values(),
        ];

        const targetThreads = allThreads.filter((thread) =>
          thread.name.includes(searchContent)
        );

        if (aborted) return;

        totalMatched = targetThreads.length;

        const progressEmbed = {
          title: `${typingEmoji} Deleting threads...`,
          description: `Deleting ${targetThreads.length} threads...`,
          color: colors.warn,
        };

        await interaction.editReply({
          embeds: [progressEmbed],
          components: [actionRow],
        });

        for (const thread of targetThreads) {
          if (aborted) break;

          try {
            await thread.delete("[watchtower] /cleanup");
            totalDeleted++;
          } catch (err) {
            totalFailed++;
          }

          if ((totalDeleted + totalFailed) % 5 === 0 && !aborted) {
            const progressEmbed = {
              title: `${typingEmoji} Deleting threads...`,
              description: `**Progress:**\n• Threads found: ${targetThreads.length}\n• Threads deleted: ${totalDeleted}\n• Failed deletions: ${totalFailed}`,
              color: colors.warn,
            };

            try {
              await interaction.editReply({
                embeds: [progressEmbed],
                components: [actionRow],
              });
            } catch {}
          }
        }
      } else {
        const BATCH_SIZE = 80;
        let lastId;
        let running = true;

        while (running && !aborted && totalScanned < messageLimit) {
          const remainingMessages = messageLimit - totalScanned;
          const fetchLimit = Math.min(BATCH_SIZE, remainingMessages);

          const messages = await channel.messages.fetch({
            limit: fetchLimit,
            before: lastId,
          });

          if (messages.size === 0) {
            running = false;
            break;
          }

          totalScanned += messages.size;

          const messagesToDelete = messages.filter((msg) => {
            if (msg.content.includes(searchContent)) {
              return true;
            }

            if (msg.embeds && msg.embeds.length > 0) {
              return msg.embeds.some((embed) => {
                if (embed.title && embed.title.includes(searchContent))
                  return true;
                if (
                  embed.description &&
                  embed.description.includes(searchContent)
                )
                  return true;
                if (embed.fields && embed.fields.length > 0) {
                  return embed.fields.some(
                    (field) =>
                      (field.name && field.name.includes(searchContent)) ||
                      (field.value && field.value.includes(searchContent))
                  );
                }
                if (
                  embed.footer &&
                  embed.footer.text &&
                  embed.footer.text.includes(searchContent)
                )
                  return true;
                if (
                  embed.author &&
                  embed.author.name &&
                  embed.author.name.includes(searchContent)
                )
                  return true;
                return false;
              });
            }

            return false;
          });

          totalMatched += messagesToDelete.size;

          if (messagesToDelete.size > 0) {
            try {
              const deletedMessages = await channel.bulkDelete(
                messagesToDelete,
                true
              );
              totalDeleted += deletedMessages.size;
            } catch (error) {
              console.error("Error during bulk delete:", error);
            }
          }

          lastId = messages.last().id;

          if (totalScanned % (BATCH_SIZE * 3) === 0) {
            const progressEmbed = {
              title: `${typingEmoji} Scanning...`,
              description: `**Current progress:**\n• Messages scanned: ${totalScanned}/${messageLimit}\n• Messages matched: ${totalMatched}\n• Messages deleted: ${totalDeleted}`,
              color: colors.warn,
            };

            try {
              await interaction.editReply({
                embeds: [progressEmbed],
                components: [actionRow],
              });
            } catch (error) {
              console.error("Error updating progress:", error);
            }
          }
        }
      }

      if (!aborted) {
        const isForumCleanup = channel.type === ChannelType.GuildForum;
        const limitReached = !isForumCleanup && totalScanned >= messageLimit;

        const finalEmbed = {
          title: "Cleanup finished!",
          description: isForumCleanup
            ? `**Final results:**\n• Threads found: ${totalMatched}\n• Threads deleted: ${totalDeleted}\n• Failed deletions: ${totalFailed}`
            : `**Final results:**\n• Messages scanned: ${totalScanned}/${messageLimit}${
                limitReached ? ` (limit reached)` : ``
              }\n• Messages matched: ${totalMatched}\n• Messages deleted: ${totalDeleted}`,
          color: isForumCleanup ? colors.positive : colors.green,
          timestamp: new Date().toISOString(),
        };

        await interaction.editReply({
          embeds: [finalEmbed],
          components: [],
        });
      }
    } catch (error) {
      console.error(
        `Error during ${
          channel.type === ChannelType.GuildForum ? "forum" : ""
        } cleanup operation:`,
        error
      );

      const errorEmbed = {
        title: "❌ Error",
        description:
          error.message ||
          `Unknown error during ${
            channel.type === ChannelType.GuildForum ? "forum " : ""
          }cleanup`,
        color: colors.negative,
      };

      try {
        await interaction.editReply({
          embeds: [errorEmbed],
          components: [],
        });
      } catch {}
    }

    collector.stop();
  }
}
