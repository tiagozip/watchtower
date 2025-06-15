import {
  Client,
  GatewayIntentBits,
  Collection,
  DefaultWebSocketManagerOptions,
  REST,
  Routes,
  ActivityType,
} from "discord.js";
import fs from "fs/promises";
import scanMessage from "./engine/index.js";
import { handleSpamThread, handleSpamNickname } from "./engine/responses.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

client.on("interactionCreate", async (interaction) => {
  if (
    interaction.isChatInputCommand() &&
    client.commands.get(interaction.commandName)
  ) {
    return await client.commands
      .get(interaction.commandName)
      .execute(interaction);
  }
});

client.once("ready", async (readyClient) => {
  console.log(
    `logged in as ${readyClient.user.tag}\ninvite: https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}`
  );

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: process.env.VERSION,
        type: ActivityType.Watching,
      },
    ],
  });

  const commands = (await fs.readdir("./src/commands")).filter((file) =>
    file.endsWith(".js")
  );

  for (const command of commands) {
    try {
      const commandModule = await import(`./commands/${command}`);

      if (
        commandModule.default &&
        typeof commandModule.default === "function"
      ) {
        commandModule.default(client);
      }
    } catch (e) {
      console.error(`[${command}] error loading command:`, e);
    }
  }

  const commandsToRegister = [];
  client.commands.forEach((cmd) => {
    if (cmd.data && cmd.data.name && cmd.data.description) {
      commandsToRegister.push(cmd.data);
    } else {
      const commandKey =
        [...client.commands.entries()].find(([key, val]) => val === cmd)?.[0] ||
        "unknown command";
      console.warn(`[main] skipped registering command "${commandKey}"`);
    }
  });

  if (commandsToRegister.length) {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN
    );
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: commandsToRegister,
    });
  }
});

client.on("messageCreate", scanMessage);

client.on("messageUpdate", (_, message) => {
  scanMessage(message);
});

client.on("threadCreate", handleSpamThread);

client.on("guildMemberUpdate", (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    handleSpamNickname(newMember);
  }
});

DefaultWebSocketManagerOptions.identifyProperties.browser = "Discord iOS";
client.login(process.env.DISCORD_TOKEN);
