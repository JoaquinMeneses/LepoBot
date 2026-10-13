require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { collectCommandsJSON } = require('./loader');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const rest = new REST().setToken(DISCORD_TOKEN);
const body = collectCommandsJSON();

(async () => {
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body });
  console.log(`Registrados ${body.length} comando(s) ${GUILD_ID ? `en el servidor ${GUILD_ID}` : 'globalmente'}.`);
})().catch(console.error);
