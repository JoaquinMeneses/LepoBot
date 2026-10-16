import "./core/env.js";
import {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags,
  Partials,
} from "discord.js";
import { loadModules } from "./core/loader.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // Copypastas: reacciones y lectura del texto de los mensajes.
    // MessageContent es un intent privilegiado: hay que activarlo en el Developer Portal.
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  // Permite recibir reacciones en mensajes que el bot no tiene en caché
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

await loadModules(client);

client.once(Events.ClientReady, (c) =>
  console.log(`Conectado como ${c.user.tag}`),
);

function findHandler(interaction) {
  if (interaction.isChatInputCommand()) {
    return client.commands.get(interaction.commandName)?.execute;
  }
  if (
    interaction.isButton() ||
    interaction.isModalSubmit() ||
    interaction.isAnySelectMenu()
  ) {
    return client.components.find((c) =>
      interaction.customId.startsWith(`${c.prefix}:`),
    )?.handle;
  }
  return undefined;
}

client.on(Events.InteractionCreate, async (interaction) => {
  const handler = findHandler(interaction);
  if (!handler) return;

  try {
    await handler(interaction);
  } catch (err) {
    console.error(err);
    const msg = {
      content: "Hubo un error procesando la acción.",
      flags: MessageFlags.Ephemeral,
    };
    try {
      if (interaction.replied || interaction.deferred)
        await interaction.followUp(msg);
      else await interaction.reply(msg);
    } catch {
      /* la interacción ya expiró */
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
