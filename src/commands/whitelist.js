import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import db from "../utils/db.js";
import colors from "../utils/colors.js";

const listWhitelistedQuery = db.prepare(
  `SELECT * FROM whitelists WHERE guild = $guild`
);
const listWhitelistedSnowflake = db.prepare(
  `SELECT * FROM whitelists WHERE guild = $guild AND snowflake = $snowflake AND type = $type`
);
const insertWhitelistQuery = db.prepare(
  `INSERT INTO whitelists (guild, type, snowflake) VALUES ($guild, $type, $snowflake)`
);
const deleteWhitelistQuery = db.prepare(
  `DELETE FROM whitelists WHERE guild = $guild AND type = $type AND snowflake = $snowflake`
);

export default function (client) {
  const commandName = "whitelist";

  const commandData = {
    name: commandName,
    description: "whitelist users, channels or roles",
    defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "list",
        description: "lists all whitelisted users, channels or roles",
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: "user",
        description: "toggles whitelist status for a user",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "user",
            description: "user to whitelist",
            type: ApplicationCommandOptionType.User,
            required: true,
          },
        ],
      },
      {
        name: "channel",
        description: "toggles whitelist status for a channel",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "channel",
            description: "channel to whitelist",
            type: ApplicationCommandOptionType.Channel,
            required: true,
          },
        ],
      },
      {
        name: "role",
        description: "toggles whitelist status for a role",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "role",
            description: "role to whitelist",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
        ],
      },
    ],
  };

  client.commands.set(commandName, {
    data: commandData,
    execute: async (interaction) => {
      const subCommand = interaction.options.getSubcommand();

      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({
          embeds: [
            {
              description: "you don't have permission to use this command",
              color: colors.red,
            },
          ],
          ephemeral: true,
        });

      const user = interaction.options.getUser("user");
      const channel = interaction.options.getChannel("channel");
      const role = interaction.options.getRole("role");
      const guild = interaction.guild;
      const guildId = guild.id;

      if (subCommand === "list") {
        const whitelisted = listWhitelistedQuery.all({ $guild: guildId });

        const users =
          whitelisted
            .filter((w) => w.type === "user")
            .map((w) => `<@${w.snowflake}>`)
            .join(", ") || "none";
        const channels =
          whitelisted
            .filter((w) => w.type === "channel")
            .map((w) => `<#${w.snowflake}>`)
            .join(", ") || "none";
        const roles =
          whitelisted
            .filter((w) => w.type === "role")
            .map((w) => `<@&${w.snowflake}>`)
            .join(", ") || "none";

        return interaction.reply({
          embeds: [
            {
              title: "whitelisted items",
              fields: [
                {
                  name: "users",
                  value: users || "_none_",
                },
                {
                  name: "channels",
                  value: channels || "_none_",
                },
                {
                  name: "roles",
                  value: roles || "_none_",
                },
              ],
              color: colors.accent,
            },
          ],
          ephemeral: true,
        });
      }

      const isWhitelisted = listWhitelistedSnowflake.get({
        $guild: guildId,
        $snowflake: (user || channel || role).id,
        $type: subCommand,
      });

      const tag = (user || channel || role).id
        ? subCommand === "user"
          ? `<@${user?.id}>`
          : `<#${channel?.id}>` || `<@&${role?.id}>`
        : subCommand;

      await interaction.reply({
        embeds: [
          {
            title: `${isWhitelisted ? "un-" : ""}whitelist ${
              (user || channel || role).tag || (user || channel || role).id
            }?`,
            description: `are you sure you want to ${
              isWhitelisted ? "un-" : ""
            }whitelist ${tag}?`,
            color: colors.accent,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: "yes",
                style: 1,
                custom_id: `${
                  isWhitelisted ? "un-" : ""
                }whitelist:${subCommand}:${(user || channel || role).id}`,
              },
            ],
          },
        ],
        ephemeral: true,
      });
    },
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const [command, subCommand, id] = interaction.customId.split(":");

    if (command !== "whitelist" && command !== "un-whitelist") return;

    if (!interaction.member.permissions.has("Administrator"))
      return interaction.update({
        embeds: [
          {
            description: "you don't have permission to use this command",
            color: colors.red,
          },
        ],
        components: [],
        ephemeral: true,
      });

    const guildId = interaction.guild.id;

    const tag = subCommand === "user" ? `<@${id}>` : `<#${id}>` || `<@&${id}>`;

    if (command === "un-whitelist") {
      deleteWhitelistQuery.run({
        $guild: guildId,
        $type: subCommand,
        $snowflake: id,
      });
      return interaction.update({
        embeds: [
          {
            description: `${tag} has been removed from the whitelist`,
            color: colors.red,
          },
        ],
        components: [],
        ephemeral: true,
      });
    }

    insertWhitelistQuery.run({
      $guild: guildId,
      $type: subCommand,
      $snowflake: id,
    });

    return interaction.update({
      embeds: [
        {
          description: `${tag} has been added to the whitelist`,
          color: colors.green,
        },
      ],
      components: [],
      ephemeral: true,
    });
  });
}
