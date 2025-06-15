import { ApplicationCommandOptionType } from "discord.js";
import colors from "../utils/colors.js";
import os from "os";

export default function (client) {
  const commandName = "watchtower";

  const commandData = {
    name: commandName,
    description: "watchtower commands",
    options: [
      {
        name: "ping",
        description: "returns bot info and ping",
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  };

  const getCpuUsage = () => {
    const [idle, total] = os
      .cpus()
      .reduce(
        ([idle, total], cpu) => [
          idle + cpu.times.idle,
          total + Object.values(cpu.times).reduce((sum, time) => sum + time, 0),
        ],
        [0, 0]
      );

    return ((1 - idle / total) * 100).toFixed(2);
  };

  client.commands.set(commandName, {
    data: commandData,
    execute: async (interaction) => {
      const subCommand = interaction.options.getSubcommand();

      if (subCommand === "ping") {
        await interaction.reply({
          embeds: [
            {
              title: `${process.env.VERSION}`,
              fields: [
                {
                  name: "bun",
                  value: `\`${process.versions.bun}\``,
                  inline: true,
                },
                {
                  name: "ping",
                  value: `\`${client.ws.ping}ms\``,
                  inline: true,
                },
                {
                  name: "cpu usage",
                  value: `\`${getCpuUsage()}%\``,
                  inline: true,
                },
              ],
              color: colors.accent,
            },
          ],
        });
      }
    },
  });
}
