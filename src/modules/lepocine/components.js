const {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder,
  MessageFlags, escapeMarkdown,
} = require('discord.js');
const cfg = require('./config');
const repo = require('./repo');
const service = require('./service');
const { nextFriday } = require('./time');

const eph = { flags: MessageFlags.Ephemeral };
const esc = (s) => escapeMarkdown(String(s));
const clean = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 80);

function isStaff(interaction) {
  const roles = interaction.member?.roles;
  if (!roles) return false;
  const has = (id) => (Array.isArray(roles) ? roles.includes(id) : roles.cache.has(id));
  return cfg.staffRoleIds.some(has);
}

function isClosed(guildId) {
  return Boolean(repo.getNight(guildId, nextFriday().key)?.event_id);
}

// ---- Sugerir ----

async function openSuggestModal(interaction) {
  if (isClosed(interaction.guildId)) {
    return interaction.reply({ content: 'Las sugerencias ya cerraron: el evento de esta semana está creado. Se abren de nuevo el lunes.', ...eph });
  }

  const modal = new ModalBuilder().setCustomId('lepocine:suggest-modal').setTitle('Sugerir película');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Nombre de la película')
        .setPlaceholder('Ej: El Padrino')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(80)
        .setRequired(true),
    ),
  );
  return interaction.showModal(modal);
}

async function submitSuggestion(interaction) {
  if (isClosed(interaction.guildId)) {
    return interaction.reply({ content: 'Las sugerencias ya cerraron: el evento de esta semana está creado. Se abren de nuevo el lunes.', ...eph });
  }

  const title = clean(interaction.fields.getTextInputValue('title'));
  if (!title) return interaction.reply({ content: 'Escribí el nombre de la película.', ...eph });

  const name = (interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username).slice(0, 32);
  const res = repo.addSuggestion(interaction.guildId, interaction.user.id, name, title);

  if (!res.ok) {
    const msg = res.reason === 'duplicate'
      ? `**${esc(title)}** ya fue sugerida por ${esc(res.by)}.`
      : `La lista ya tiene ${cfg.maxSuggestions} sugerencias. Esperá a que se elija o a la semana próxima.`;
    return interaction.reply({ content: msg, ...eph });
  }

  await interaction.reply({
    content: res.replaced
      ? `Cambié tu sugerencia: ~~${esc(res.replaced)}~~ → **${esc(title)}**`
      : `✅ Anotada: **${esc(title)}**`,
    ...eph,
  });
  await service.updatePanel(interaction.client).catch((e) => console.error('[lepocine] panel:', e));
}

// ---- Elegir (solo equipo) ----

async function openPickMenu(interaction) {
  if (!isStaff(interaction)) {
    return interaction.reply({ content: 'Solo el equipo puede elegir la película.', ...eph });
  }
  if (isClosed(interaction.guildId)) {
    return interaction.reply({ content: 'El evento de esta semana ya está creado.', ...eph });
  }

  const open = repo.listOpen(interaction.guildId);
  if (!open.length) {
    return interaction.reply({ content: 'Todavía no hay películas sugeridas.', ...eph });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('lepocine:pick-select')
    .setPlaceholder('Elegí la película del viernes')
    .addOptions(open.map((s) => ({
      label: s.title.slice(0, 100),
      description: `Sugerida por ${s.user_name}`.slice(0, 100),
      value: String(s.id),
    })));

  return interaction.reply({
    content: '🎞️ **¿Qué película vemos el viernes?**',
    components: [new ActionRowBuilder().addComponents(menu)],
    ...eph,
  });
}

async function submitPick(interaction) {
  if (!isStaff(interaction)) {
    return interaction.reply({ content: 'Solo el equipo puede elegir la película.', ...eph });
  }
  await interaction.deferUpdate();

  const guildId = interaction.guildId;
  const t = nextFriday();
  if (repo.getNight(guildId, t.key)?.event_id) {
    return interaction.editReply({ content: 'El evento de esta semana ya está creado.', components: [] });
  }

  const picked = repo.pickSuggestion(guildId, t.key, Number(interaction.values[0]), interaction.user.id);
  if (!picked) {
    return interaction.editReply({ content: 'Esa sugerencia ya no está disponible. Volvé a abrir el selector.', components: [] });
  }

  let note = 'El evento se crea el miércoles.';
  if (Date.now() >= t.cutoffMs) {
    // Ya pasó el miércoles: se crea el evento en el momento
    const r = await service.processWeek(interaction.client);
    note = r.status === 'created' ? '¡Evento creado!' : 'No pude crear el evento, revisá el canal.';
  }

  await interaction.editReply({ content: `🎞️ Elegiste **${esc(picked.title)}**. ${note}`, components: [] });
  await service.updatePanel(interaction.client).catch((e) => console.error('[lepocine] panel:', e));
}

async function handle(interaction) {
  switch (interaction.customId) {
    case 'lepocine:suggest': return openSuggestModal(interaction);
    case 'lepocine:suggest-modal': return submitSuggestion(interaction);
    case 'lepocine:pick': return openPickMenu(interaction);
    case 'lepocine:pick-select': return submitPick(interaction);
    default: return undefined;
  }
}

module.exports = { handle };
