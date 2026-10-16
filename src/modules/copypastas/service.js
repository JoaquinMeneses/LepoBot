import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import globalConfig from '../../core/config.js';
import cfg from './config.js';
import * as repo from './repo.js';

export async function fetchChannel(client, id) {
  if (!id) return null;
  try {
    return await client.channels.fetch(id);
  } catch (err) {
    console.error(`[copypastas] no pude acceder al canal ${id}:`, err.message);
    return null;
  }
}

// ---------- Panel de configuración (canal del equipo) ----------

export function buildPanel(guildId) {
  const s = repo.getSettings(guildId);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('📌 Copypastas')
    .setDescription('Cuando alguien reacciona a un mensaje con el emoji elegido, el bot lo copia al canal de copypastas para que la comunidad lo vote.')
    .addFields(
      { name: 'Emoji que activa la copia', value: s.emoji, inline: true },
      { name: 'Canal destino', value: s.channelId ? `<#${s.channelId}>` : '_sin configurar_', inline: true },
      { name: 'Mínimo de reacciones', value: String(s.threshold), inline: true },
      { name: 'Votación', value: `${cfg.votes.up} a favor · ${cfg.votes.down} en contra`, inline: true },
    )
    .setFooter({ text: 'Panel del equipo' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lc-copypastas:emoji').setLabel('Cambiar emoji').setEmoji('🔣').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('lc-copypastas:channel').setLabel('Cambiar canal').setEmoji('📢').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('lc-copypastas:threshold').setLabel('Mínimo de reacciones').setEmoji('🔢').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

/** Publica el panel en el canal del equipo (borra el anterior). Devuelve el canal o null. */
export async function postPanel(client) {
  const staff = await fetchChannel(client, globalConfig.staffChannelId);
  if (!staff) return null;
  const guildId = staff.guild.id;

  const saved = repo.getPanel(guildId);
  if (saved) {
    try {
      const old = await (await fetchChannel(client, saved.channel_id))?.messages.fetch(saved.message_id);
      await old?.delete();
    } catch { /* ya no estaba */ }
  }
  const msg = await staff.send(buildPanel(guildId));
  repo.setPanel(guildId, staff.id, msg.id);
  return staff;
}

/** Refresca el panel publicado después de cambiar la configuración. */
export async function updatePanel(client, guildId) {
  const saved = repo.getPanel(guildId);
  if (!saved) return;
  try {
    const channel = await fetchChannel(client, saved.channel_id);
    const msg = await channel?.messages.fetch(saved.message_id);
    await msg?.edit(buildPanel(guildId));
  } catch (err) {
    console.error('[copypastas] no pude actualizar el panel:', err.message);
  }
}

// ---------- Copiar el mensaje ----------

function buildCopypasta(message) {
  const author = message.member ?? message.author;
  const name = message.member?.displayName ?? message.author.globalName ?? message.author.username;

  // Los archivos se vuelven a subir: los enlaces de adjuntos de Discord vencen
  const files = [];
  const skipped = [];
  let bytes = 0;
  for (const att of message.attachments.values()) {
    if (files.length < cfg.maxAttachments && bytes + att.size <= cfg.maxAttachmentBytes) {
      files.push({ attachment: att.url, name: att.name });
      bytes += att.size;
    } else {
      skipped.push(att);
    }
  }

  const text = message.content ?? '';
  if (!text && !files.length) return null;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name, iconURL: author.displayAvatarURL() })
    .setTimestamp(message.createdAt)
    .addFields({ name: '\u200b', value: `[Ir al mensaje original](${message.url}) · <#${message.channelId}>` });
  if (text) embed.setDescription(text.length > 4096 ? `${text.slice(0, 4095)}…` : text);
  if (skipped.length) {
    embed.addFields({
      name: 'Archivos no copiados',
      value: skipped.map((a) => `[${a.name}](${a.url})`).join('\n').slice(0, 1024),
    });
  }

  return { embeds: [embed], files, allowedMentions: { parse: [] } };
}

/**
 * Copia un mensaje al canal de copypastas y le agrega las reacciones de votación.
 * Devuelve true si lo publicó. Un mismo mensaje se copia una sola vez.
 */
export async function forward(client, message, settings) {
  const payload = buildCopypasta(message);
  if (!payload) return false; // sin texto ni archivos (solo stickers o embeds)

  const guildId = message.guild.id;
  if (!repo.claim(guildId, message.id, message.channelId)) return false;

  let sent;
  try {
    const channel = await fetchChannel(client, settings.channelId);
    if (!channel?.isTextBased()) throw new Error(`el canal ${settings.channelId} no existe o no es de texto`);
    sent = await channel.send(payload);
    repo.setPosted(guildId, message.id, sent.id);
  } catch (err) {
    repo.release(guildId, message.id);
    console.error('[copypastas] no pude publicar el mensaje:', err.message);
    return false;
  }

  // Votación: primero verde, después rojo. Si falla una reacción el mensaje igual quedó publicado.
  for (const emoji of [cfg.votes.up, cfg.votes.down]) {
    await sent.react(emoji).catch((err) => console.error(`[copypastas] no pude reaccionar con ${emoji}:`, err.message));
  }
  return true;
}
