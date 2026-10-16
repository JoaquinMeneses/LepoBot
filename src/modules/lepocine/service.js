const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown,
  GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType,
} = require('discord.js');
const cfg = require('./config');
const repo = require('./repo');
const { nextFriday } = require('./time');

const esc = (s) => escapeMarkdown(String(s));

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
const getStaffChannel = (client) => fetchChannel(client, cfg.staffChannelId); // canal del equipo (opcional)

/** Canales donde hay panel: el público y, si está configurado, el del equipo. */
async function panelTargets(client) {
  const targets = [];
  const pub = await getChannel(client);
  if (pub) targets.push({ kind: 'public', channel: pub });
  const staff = await getStaffChannel(client);
  if (staff) targets.push({ kind: 'staff', channel: staff });
  return targets;
}

// ---------- Panel ----------

/**
 * kind 'public': botón de sugerir (y el de elegir solo si no hay canal del equipo).
 * kind 'staff':  botón de elegir.
 */
function buildPanel(guildId, kind = 'public', t = nextFriday()) {
  const night = repo.getNight(guildId, t.key);
  const closed = Boolean(night?.event_id);
  const open = repo.listOpen(guildId);
  const when = `<t:${Math.floor(t.startMs / 1000)}:F>`;

  let desc;
  if (closed) {
    desc = `🎟️ **Evento creado:** ${esc(night.title)}\n📅 ${when}\n\nLas sugerencias se abren de nuevo el lunes.`;
  } else if (night) {
    desc = `✅ **Elegida:** ${esc(night.title)} _(sugerida por ${esc(night.suggested_by)})_\n📅 ${when}\n\nEl evento se crea el miércoles. Hasta entonces el equipo todavía puede cambiar la elección.`;
  } else if (kind === 'staff') {
    desc = `Elegí la película del viernes 📅 ${when}`;
  } else {
    desc = `Sugerí qué película ver el viernes 📅 ${when}`;
  }

  if (!closed) {
    const lines = open.length
      ? open.map((s, i) => `${i + 1}. **${esc(s.title)}** · ${esc(s.user_name)}`).join('\n')
      : '_Todavía no hay sugerencias._';
    desc += `\n\n**Sugerencias (${open.length}/${cfg.maxSuggestions})**\n${lines}`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🎬 Lepocine')
    .setDescription(desc.slice(0, 4000))
    .setFooter({
      text: kind === 'staff'
        ? 'Panel del equipo'
        : 'Una sugerencia por persona: si sugerís de nuevo, reemplazás la anterior.',
    });

  const suggestBtn = new ButtonBuilder().setCustomId('lepocine:suggest').setLabel('Sugerir película').setEmoji('➕')
    .setStyle(ButtonStyle.Primary).setDisabled(closed);
  const pickBtn = new ButtonBuilder().setCustomId('lepocine:pick').setLabel('Elegir película').setEmoji('🎞️')
    .setStyle(ButtonStyle.Success).setDisabled(closed);

  let buttons;
  if (kind === 'staff') buttons = [pickBtn];
  else buttons = cfg.staffChannelId ? [suggestBtn] : [suggestBtn, pickBtn];

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(buttons)],
    allowedMentions: { parse: [] },
  };
}

/** Actualiza el panel existente; si no existe o se borró, publica uno nuevo. */
async function updateOne(channel, kind) {
  const guildId = channel.guild.id;
  const payload = buildPanel(guildId, kind);
  const saved = repo.getPanel(guildId, kind);

  if (saved && saved.channel_id === channel.id) {
    try {
      const msg = await channel.messages.fetch(saved.message_id);
      await msg.edit(payload);
      return;
    } catch { /* el mensaje ya no existe: se publica uno nuevo */ }
  }
  const msg = await channel.send(payload);
  repo.setPanel(guildId, kind, channel.id, msg.id);
}

/** Borra el panel anterior y publica uno nuevo. */
async function repostOne(channel, kind) {
  const guildId = channel.guild.id;
  const saved = repo.getPanel(guildId, kind);
  if (saved) {
    try {
      const old = await (await fetchChannel(channel.client, saved.channel_id))?.messages.fetch(saved.message_id);
      await old?.delete();
    } catch { /* ya no estaba */ }
  }
  const msg = await channel.send(buildPanel(guildId, kind));
  repo.setPanel(guildId, kind, channel.id, msg.id);
}

/** Refresca todos los paneles (público y del equipo). */
async function updatePanel(client) {
  for (const { kind, channel } of await panelTargets(client)) {
    await updateOne(channel, kind).catch((e) => console.error(`[lepocine] panel ${kind}:`, e.message));
  }
}

/** Publica paneles nuevos en todos los canales. Devuelve los canales donde publicó. */
async function repostPanels(client) {
  const targets = await panelTargets(client);
  for (const { kind, channel } of targets) await repostOne(channel, kind);
  return targets.map((t) => t.channel);
}

/** Lunes: archiva las sugerencias de la semana pasada y abre paneles limpios. */
async function newWeek(client) {
  const channel = await getChannel(client);
  if (!channel) return;
  repo.archiveOpen(channel.guild.id);
  await repostPanels(client);
}

// ---------- Evento ----------

async function createEvent(guild, night, t) {
  const opts = {
    name: `Lepocine: "${night.title}"`.slice(0, 100),
    scheduledStartTime: new Date(t.startMs),
    scheduledEndTime: new Date(t.endMs),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    description: `Viernes de Lepocine 🎬\nPelícula: ${night.title}\nSugerida por ${night.suggested_by}`,
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

/** Avisa al equipo que falta elegir película (si ya hay una elegida, no hace nada). */
async function warnMissing(client) {
  const channel = await getChannel(client);
  if (!channel) return { status: 'no-channel' };
  if (repo.getNight(channel.guild.id, nextFriday().key)) return { status: 'has-night' };

  // El aviso va al canal del equipo si existe; si no, al público
  const warnChannel = (await getStaffChannel(client)) ?? channel;
  const roles = cfg.staffRoleIds.map((id) => `<@&${id}>`).join(' ');
  await warnChannel.send(`⚠️ Todavía no se eligió la película del viernes. ${roles} elíjanla desde el panel para crear el evento.`);
  return { status: 'warned', channel: warnChannel };
}

/** Solo para pruebas: deshace la elección de esta semana, borra su evento y reabre el panel. */
async function resetWeek(client) {
  const channel = await getChannel(client);
  if (!channel) return { status: 'no-channel' };

  const t = nextFriday();
  const night = repo.resetNight(channel.guild.id, t.key);
  if (!night) return { status: 'nothing' };

  let eventDeleted = false;
  if (night.event_id) {
    try {
      await channel.guild.scheduledEvents.delete(night.event_id);
      eventDeleted = true;
    } catch { /* ya no existía o falta permiso */ }
  }
  await updatePanel(client);
  return { status: 'reset', eventDeleted };
}

/**
 * Crea el evento de la próxima función si ya hay película elegida y todavía no existe.
 * warnIfMissing: avisa al equipo si nadie eligió (lo usa el cron del miércoles).
 */
async function processWeek(client, { warnIfMissing = false } = {}) {
  const channel = await getChannel(client);
  if (!channel) return { status: 'no-channel' };

  const guild = channel.guild;
  const t = nextFriday();
  const night = repo.getNight(guild.id, t.key);

  if (!night) {
    if (warnIfMissing) await warnMissing(client);
    return { status: 'no-night' };
  }
  if (night.event_id) return { status: 'exists' };

  try {
    const event = await createEvent(guild, night, t);
    repo.setNightEvent(guild.id, t.key, event.id);
    await channel.send(`🎬 ¡Ya está el evento del viernes! **${esc(night.title)}**\n${event.url}`);
    await updatePanel(client);
    return { status: 'created', event };
  } catch (err) {
    console.error('[lepocine] error creando el evento:', err);
    await channel.send(`⚠️ No pude crear el evento de **${esc(night.title)}**. Revisá que el bot tenga los permisos *Crear eventos* y *Gestionar eventos*.`).catch(() => {});
    return { status: 'error', error: err };
  }
}

module.exports = { buildPanel, updatePanel, repostPanels, newWeek, processWeek, warnMissing, resetWeek, getChannel };
