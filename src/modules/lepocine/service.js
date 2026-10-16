import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown,
  GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType,
} from 'discord.js';
import cfg from './config.js';
import * as repo from './repo.js';
import { dateKey } from './time.js';

const esc = (s) => escapeMarkdown(String(s));
const when = (round) => `<t:${Math.floor(round.start_ms / 1000)}:F>`;
const roleMentions = () => cfg.staffRoleIds.map((id) => `<@&${id}>`).join(' ');

// ---------- Canales ----------

async function fetchChannel(client, id) {
  if (!id) return null;
  try {
    return await client.channels.fetch(id);
  } catch (err) {
    console.error(`[lepocine] no pude acceder al canal ${id}:`, err.message);
    return null;
  }
}

const getChannel = (client) => fetchChannel(client, cfg.channelId);          // canal público
const getStaffChannel = (client) => fetchChannel(client, cfg.staffChannelId); // canal del equipo

// ---------- Paneles ----------

function suggestionLines(list) {
  return list.length
    ? list.map((s, i) => `${i + 1}. **${esc(s.title)}** · ${esc(s.user_name)}`).join('\n')
    : '_Todavía no hay sugerencias._';
}

const button = (id, label, emoji, style, disabled = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style).setDisabled(disabled);

/** Último evento creado que todavía no terminó (para mostrarlo en los paneles). */
function upcomingEvent(guildId) {
  const last = repo.getLastRound(guildId);
  return last?.status === 'done' && last.end_ms > Date.now() ? last : null;
}

function buildPublicPanel(guildId) {
  const open = repo.getOpenRound(guildId);
  const upcoming = upcomingEvent(guildId);
  let desc;
  let buttons;

  if (open) {
    desc = `Sugerí qué película ver el 📅 ${when(open)}`;
    if (open.theme) desc += `\n🎯 **Temática:** ${esc(open.theme)}`;
    const list = repo.listSuggestions(open.id);
    desc += `\n\n**Sugerencias (${list.length}/${cfg.maxSuggestions})**\n${suggestionLines(list)}`;
    buttons = [button('lepocine:suggest', 'Sugerir película', '➕', ButtonStyle.Primary)];
  } else if (upcoming) {
    desc = `🎟️ **Evento creado:** ${esc(upcoming.title)}\n📅 ${when(upcoming)}\n\nLa próxima encuesta la abre el equipo.`;
    buttons = [button('lepocine:suggest', 'Sugerir película', '➕', ButtonStyle.Primary, true)];
  } else {
    desc = 'No hay una encuesta abierta por ahora. La abre el equipo cuando toca elegir película.';
    buttons = [button('lepocine:suggest', 'Sugerir película', '➕', ButtonStyle.Primary, true)];
  }

  const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('🎬 Lepocine').setDescription(desc.slice(0, 4000));
  if (open) embed.setFooter({ text: 'Una sugerencia por persona: si sugerís de nuevo, reemplazás la anterior.' });

  return { content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)], allowedMentions: { parse: [] } };
}

function buildStaffPanel(guildId) {
  const open = repo.getOpenRound(guildId);
  let desc;
  let buttons;

  if (open) {
    desc = `**Encuesta abierta** · 📅 ${when(open)}`;
    if (open.theme) desc += `\n🎯 **Temática:** ${esc(open.theme)}`;
    const list = repo.listSuggestions(open.id);
    desc += `\n\n**Sugerencias (${list.length}/${cfg.maxSuggestions})**\n${suggestionLines(list)}`;
    buttons = [
      button('lepocine:pick', 'Elegir película', '🎞️', ButtonStyle.Success),
      button('lepocine:cancel', 'Cancelar encuesta', '✖️', ButtonStyle.Secondary),
    ];
  } else {
    desc = 'Abrí una encuesta para que la comunidad sugiera la próxima película.';
    const upcoming = upcomingEvent(guildId);
    if (upcoming) desc += `\n\n🎟️ **Próximo evento:** ${esc(upcoming.title)} · ${when(upcoming)}`;
    buttons = [button('lepocine:open', 'Abrir encuesta', '🗳️', ButtonStyle.Primary)];
  }

  const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('🎬 Lepocine').setDescription(desc.slice(0, 4000))
    .setFooter({ text: 'Panel del equipo' });

  return { content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)], allowedMentions: { parse: [] } };
}

const buildPanel = (guildId, kind) => (kind === 'staff' ? buildStaffPanel(guildId) : buildPublicPanel(guildId));

/** Edita el panel existente. Si no existe (o se borró), lo publica solo si createIfMissing. */
async function updateOne(channel, kind, createIfMissing) {
  const guildId = channel.guild.id;
  const saved = repo.getPanel(guildId, kind);

  if (saved && saved.channel_id === channel.id) {
    try {
      const msg = await channel.messages.fetch(saved.message_id);
      await msg.edit(buildPanel(guildId, kind));
      return;
    } catch { /* el mensaje ya no existe */ }
  }
  if (!createIfMissing) return;
  const msg = await channel.send(buildPanel(guildId, kind));
  repo.setPanel(guildId, kind, channel.id, msg.id);
}

/** Borra el panel anterior y publica uno nuevo (llega como mensaje nuevo, con notificación). */
async function repostOne(channel, kind, { content, ping = false } = {}) {
  const guildId = channel.guild.id;
  const saved = repo.getPanel(guildId, kind);
  if (saved) {
    try {
      const old = await (await fetchChannel(channel.client, saved.channel_id))?.messages.fetch(saved.message_id);
      await old?.delete();
    } catch { /* ya no estaba */ }
  }
  const payload = buildPanel(guildId, kind);
  if (content) payload.content = content;
  if (ping) payload.allowedMentions = { roles: cfg.staffRoleIds };

  const msg = await channel.send(payload);
  repo.setPanel(guildId, kind, channel.id, msg.id);
}

/** Refresca los dos paneles. El público solo se edita si ya existe; el del equipo siempre queda publicado. */
async function updatePanels(client) {
  const pub = await getChannel(client);
  if (pub) await updateOne(pub, 'public', false).catch((e) => console.error('[lepocine] panel público:', e.message));
  const staff = await getStaffChannel(client);
  if (staff) await updateOne(staff, 'staff', true).catch((e) => console.error('[lepocine] panel del equipo:', e.message));
}

// ---------- Encuesta ----------

/** Abre una encuesta: publica el panel público nuevo y actualiza el del equipo. */
async function openRound(client, { theme, startMs, endMs, openedBy }) {
  const pub = await getChannel(client);
  if (!pub) throw new Error('No encuentro el canal público de Lepocine');

  repo.openRound(pub.guild.id, { theme, startMs, endMs, openedBy });
  await repostOne(pub, 'public');
  await updatePanels(client);
  return pub;
}

async function cancelRound(client) {
  const pub = await getChannel(client);
  if (!pub) return false;
  const round = repo.getOpenRound(pub.guild.id);
  if (!round) return false;
  repo.setRoundStatus(round.id, 'cancelled');
  await updatePanels(client);
  return true;
}

async function createEvent(guild, round, suggestion) {
  const opts = {
    name: `Lepocine: "${suggestion.title}"`.slice(0, 100),
    scheduledStartTime: new Date(round.start_ms),
    scheduledEndTime: new Date(round.end_ms),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    description: [
      'Lepocine 🎬',
      `Película: ${suggestion.title}`,
      round.theme ? `Temática: ${round.theme}` : null,
      `Sugerida por ${suggestion.user_name}`,
    ].filter(Boolean).join('\n'),
  };

  if (cfg.voiceChannelId) {
    opts.entityType = GuildScheduledEventEntityType.Voice;
    opts.channel = cfg.voiceChannelId;
  } else {
    opts.entityType = GuildScheduledEventEntityType.External;
    opts.entityMetadata = { location: cfg.location };
  }
  return guild.scheduledEvents.create(opts);
}

/**
 * Confirma la película: crea el evento y cierra la encuesta.
 * Si Discord rechaza el evento, lanza el error y no cambia nada (se puede volver a intentar).
 */
async function finishPick(client, round, suggestion, pickedBy) {
  const pub = await getChannel(client);
  if (!pub) throw new Error('No encuentro el canal público de Lepocine');

  const event = await createEvent(pub.guild, round, suggestion);
  repo.finishRound(round.id, suggestion.title, suggestion.user_name, pickedBy, event.id);

  await pub.send(`🎬 ¡Ya está el evento! **${esc(suggestion.title)}**\n${event.url}`)
    .catch((e) => console.error('[lepocine] anuncio:', e.message));
  await updatePanels(client);
  return event;
}

// ---------- Avisos ----------

/** Lunes: llega el mensaje al canal del equipo para abrir la encuesta. */
async function mondayPrompt(client) {
  const staff = await getStaffChannel(client);
  if (!staff) return { status: 'no-channel' };

  const idle = !repo.getOpenRound(staff.guild.id);
  await repostOne(staff, 'staff', idle
    ? { content: `¡Nueva semana de Lepocine! ${roleMentions()} ¿Abrimos la encuesta de películas?`, ping: true }
    : {});

  const pub = await getChannel(client);
  if (pub) await updateOne(pub, 'public', false).catch(() => {});
  return { status: idle ? 'prompted' : 'open-round' };
}

/**
 * Recordatorio diario al equipo: hay encuesta abierta, hay sugerencias y falta elegir.
 * No avisa el mismo día en que se abrió la encuesta, salvo force (pruebas).
 */
async function dailyReminder(client, { force = false } = {}) {
  const pub = await getChannel(client);
  const staff = await getStaffChannel(client);
  if (!pub || !staff) return { status: 'no-channel' };

  const round = repo.getOpenRound(pub.guild.id);
  if (!round) return { status: 'no-round' };

  const count = repo.listSuggestions(round.id).length;
  if (!count) return { status: 'no-suggestions' };
  if (!force && dateKey(round.created_at) === dateKey(Date.now())) return { status: 'opened-today' };

  const panel = repo.getPanel(staff.guild.id, 'staff');
  const link = panel ? `\n[Ir al panel](https://discord.com/channels/${staff.guild.id}/${panel.channel_id}/${panel.message_id})` : '';
  await staff.send({
    content: `⏰ ${roleMentions()} Falta elegir la película del ${when(round)}. Hay ${count} sugerencia${count === 1 ? '' : 's'}.${link}`,
    allowedMentions: { roles: cfg.staffRoleIds },
  });
  return { status: 'sent', channel: staff };
}

/** Solo para pruebas: borra la última encuesta (y su evento, si lo tiene) y refresca los paneles. */
async function resetLast(client) {
  const pub = await getChannel(client);
  if (!pub) return { status: 'no-channel' };

  const last = repo.getLastRound(pub.guild.id);
  if (!last) return { status: 'nothing' };

  let eventDeleted = false;
  if (last.event_id) {
    try {
      await pub.guild.scheduledEvents.delete(last.event_id);
      eventDeleted = true;
    } catch { /* ya no existía o falta permiso */ }
  }
  repo.deleteRound(last.id);
  await updatePanels(client);
  return { status: 'reset', eventDeleted };
}

/** Publica un panel nuevo en el canal del equipo (sin mención). */
async function repostStaffPanel(client) {
  const staff = await getStaffChannel(client);
  if (!staff) return null;
  await repostOne(staff, 'staff');
  return staff;
}

export {
  getChannel, getStaffChannel,
  updatePanels, repostStaffPanel,
  openRound, cancelRound, finishPick,
  mondayPrompt, dailyReminder, resetLast,
};
