import "./env.js";
import { REST, Routes } from "discord.js";
import { collectCommandsJSON } from "./loader.js";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const rest = new REST().setToken(DISCORD_TOKEN);
const body = await collectCommandsJSON();

const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);
await rest.put(route, { body });
console.log(
  `Registrados ${body.length} comando(s) ${GUILD_ID ? `en el servidor ${GUILD_ID}` : "globalmente"}.`,
);
