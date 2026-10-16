import { Events } from 'discord.js';
import * as repo from './repo.js';
import * as service from './service.js';
import { emojiMatches } from './emoji.js';

/** Cuando alguien reacciona con el emoji configurado, el mensaje se copia al canal de copypastas. */
export async function handleReaction(client, reaction, user) {
  if (user.bot) return;

  const guildId = reaction.message.guildId;
  if (!guildId) return; // mensajes directos

  const settings = repo.getSettings(guildId);
  if (!settings.channelId) return;
  // Filtro barato antes de pedirle nada a Discord: la mayoría de las reacciones son de otros emojis
  if (!emojiMatches(reaction.emoji, settings.emoji)) return;

  // Con mensajes/reacciones que el bot no tenía en caché llegan "parciales": hay que completarlos
  if (reaction.partial) reaction = await reaction.fetch();
  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;

  if (message.channelId === settings.channelId) return; // no copiar lo que ya está en el canal destino
  if (message.author?.bot) return;
  if (reaction.count < settings.threshold) return;

  await service.forward(client, message, settings);
}

export function register(client) {
  client.on(Events.MessageReactionAdd, (reaction, user) => {
    handleReaction(client, reaction, user).catch((err) => console.error('[copypastas]', err));
  });
}
