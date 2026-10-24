import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags, escapeMarkdown,
} from 'discord.js';
import cfg from './config.js';
import * as repo from './repo.js';
import * as service from './service.js';
import { resolveStart } from './time.js';
import { isStaff } from '../../core/permissions.js';

const eph = { flags: MessageFlags.Ephemeral };
const esc = (s) => escapeMarkdown(String(s));
const clean = (s, max) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const DENIED = { content: 'Solo el equipo puede hacer esto.', ...eph };

const textRow = (input) => new ActionRowBuilder().addComponents(input);

// ---- Abrir la encuesta (equipo) ----

async function openRoundModal(interaction) {
  if (!isStaff(interaction)) return interaction.reply(DENIED);
  if (repo.getOpenRound(interaction.guildId)) {
    return interaction.reply({ content: 'Ya hay una encuesta abierta. Elegí una película o cancelala antes de abrir otra.', ...eph });
  }

  const modal = new ModalBuilder().setCustomId('lepocine:open-modal').setTitle('Abrir encuesta de película');
  modal.addComponents(
    textRow(new TextInputBuilder().setCustomId('day').setLabel('Día de la película')
      .setPlaceholder('viernes, mañana o 17/10').setValue(cfg.defaultDay)
      .setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(true)),
    textRow(new TextInputBuilder().setCustomId('time').setLabel('Hora')
      .setPlaceholder('21:00').setValue(cfg.defaultTime)
      .setStyle(TextInputStyle.Short).setMaxLength(8).setRequired(true)),
    textRow(new TextInputBuilder().setCustomId('theme').setLabel('Temática para sugerir (opcional)')
      .setPlaceholder('Ej: terror, años 90, animadas')
      .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)),
  );
  return interaction.showModal(modal);
}

async function submitOpenRound(interaction) {
  if (!isStaff(interaction)) return interaction.reply(DENIED);
  if (repo.getOpenRound(interaction.guildId)) {
    return interaction.reply({ content: 'Ya hay una encuesta abierta.', ...eph });
  }

  const r = resolveStart(
    interaction.fields.getTextInputValue('day'),
    interaction.fields.getTextInputValue('time'),
  );
  if (!r.ok) return interaction.reply({ content: `⚠️ ${r.error}`, ...eph });

  const theme = clean(interaction.fields.getTextInputValue('theme'), 100) || null;

  await interaction.deferReply(eph);
  const { channel: pub, mentioned, canMention } = await service.openRound(interaction.client, {
    theme, startMs: r.startMs, endMs: r.endMs, openedBy: interaction.user.id,
  });

  let notice = '';
  if (mentioned && canMention) notice = '\n📣 Avisé a la comunidad con @everyone.';
  if (mentioned && !canMention) {
    notice = '\n⚠️ No pude avisar con @everyone: al bot le falta el permiso *Mencionar @everyone, @here y todos los roles* en ese canal. La encuesta quedó publicada igual.';
  }
  await interaction.editReply(
    `✅ Encuesta abierta para <t:${Math.floor(r.startMs / 1000)}:F>${theme ? ` · temática: **${esc(theme)}**` : ''}.\nEl panel para sugerir ya está en ${pub}.${notice}`,
  );
}

// ---- Sugerir (comunidad) ----

async function openSuggestModal(interaction) {
  if (!repo.getOpenRound(interaction.guildId)) {
    return interaction.reply({ content: 'La encuesta ya cerró. Cuando el equipo abra otra, vas a poder sugerir.', ...eph });
  }

  const modal = new ModalBuilder().setCustomId('lepocine:suggest-modal').setTitle('Sugerir película');
  modal.addComponents(
    textRow(new TextInputBuilder().setCustomId('title').setLabel('Nombre de la película')
      .setPlaceholder('Ej: El Padrino').setStyle(TextInputStyle.Short)
      .setMinLength(1).setMaxLength(80).setRequired(true)),
  );
  return interaction.showModal(modal);
}

async function submitSuggestion(interaction) {
  const round = repo.getOpenRound(interaction.guildId);
  if (!round) {
    return interaction.reply({ content: 'La encuesta ya cerró. Cuando el equipo abra otra, vas a poder sugerir.', ...eph });
  }

  const title = clean(interaction.fields.getTextInputValue('title'), 80);
  if (!title) return interaction.reply({ content: 'Escribí el nombre de la película.', ...eph });

  const name = (interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username).slice(0, 32);
  const res = repo.addSuggestion(round.id, interaction.user.id, name, title);

  if (!res.ok) {
    const msg = res.reason === 'duplicate'
      ? `**${esc(title)}** ya fue sugerida por ${esc(res.by)}.`
      : `La lista ya tiene ${cfg.maxSuggestions} sugerencias.`;
    return interaction.reply({ content: msg, ...eph });
  }

  await interaction.reply({
    content: res.replaced
      ? `Cambié tu sugerencia: ~~${esc(res.replaced)}~~ → **${esc(title)}**`
      : `✅ Anotada: **${esc(title)}**`,
    ...eph,
  });
  await service.updatePanels(interaction.client).catch((e) => console.error('[lepocine] panel:', e));
}

// ---- Elegir (equipo) ----

async function openPickMenu(interaction) {
  if (!isStaff(interaction)) return interaction.reply(DENIED);

  const round = repo.getOpenRound(interaction.guildId);
  if (!round) return interaction.reply({ content: 'No hay una encuesta abierta.', ...eph });

  const list = repo.listSuggestions(round.id);
  if (!list.length) return interaction.reply({ content: 'Todavía no hay películas sugeridas.', ...eph });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('lepocine:pick-select')
    .setPlaceholder('Elegí la película')
    .addOptions(list.map((s) => ({
      label: s.title.slice(0, 100),
      description: `Sugerida por ${s.user_name}`.slice(0, 100),
      value: String(s.id),
    })));

  return interaction.reply({
    content: `🎞️ **¿Qué película vemos?** · <t:${Math.floor(round.start_ms / 1000)}:F>`,
    components: [new ActionRowBuilder().addComponents(menu)],
    ...eph,
  });
}

async function submitPick(interaction) {
  if (!isStaff(interaction)) return interaction.reply(DENIED);
  await interaction.deferUpdate();

  const round = repo.getOpenRound(interaction.guildId);
  if (!round) {
    return interaction.editReply({ content: 'La encuesta ya no está abierta (la fecha pasó o se cerró).', components: [] });
  }

  const suggestion = repo.getSuggestion(Number(interaction.values[0]));
  if (!suggestion || suggestion.round_id !== round.id) {
    return interaction.editReply({ content: 'Esa sugerencia ya no está disponible. Volvé a abrir el selector.', components: [] });
  }

  try {
    await service.finishPick(interaction.client, round, suggestion, interaction.user.id);
  } catch (err) {
    console.error('[lepocine] error creando el evento:', err);
    return interaction.editReply({
      content: '⚠️ No pude crear el evento. Revisá que el bot tenga los permisos *Crear eventos* y *Gestionar eventos*, y volvé a elegir.',
      components: [],
    });
  }
  await interaction.editReply({ content: `🎞️ Elegiste **${esc(suggestion.title)}**. ¡Evento creado!`, components: [] });
}

// ---- Cancelar (equipo) ----

async function askCancel(interaction) {
  if (!isStaff(interaction)) return interaction.reply(DENIED);

  const round = repo.getOpenRound(interaction.guildId);
  if (!round) return interaction.reply({ content: 'No hay una encuesta abierta.', ...eph });

  const count = repo.listSuggestions(round.id).length;
  const confirm = new ButtonBuilder().setCustomId('lepocine:cancel-confirm').setLabel('Sí, cancelar encuesta')
    .setStyle(ButtonStyle.Danger);
  return interaction.reply({
    content: `¿Cancelar la encuesta? Se pierden las ${count} sugerencia${count === 1 ? '' : 's'}. Después podés abrir una nueva con otro día u hora.`,
    components: [new ActionRowBuilder().addComponents(confirm)],
    ...eph,
  });
}

async function confirmCancel(interaction) {
  if (!isStaff(interaction)) return interaction.reply(DENIED);
  await interaction.deferUpdate();
  const ok = await service.cancelRound(interaction.client);
  await interaction.editReply({ content: ok ? 'Encuesta cancelada.' : 'No había una encuesta abierta.', components: [] });
}

export async function handle(interaction) {
  switch (interaction.customId) {
    case 'lepocine:open': return openRoundModal(interaction);
    case 'lepocine:open-modal': return submitOpenRound(interaction);
    case 'lepocine:suggest': return openSuggestModal(interaction);
    case 'lepocine:suggest-modal': return submitSuggestion(interaction);
    case 'lepocine:pick': return openPickMenu(interaction);
    case 'lepocine:pick-select': return submitPick(interaction);
    case 'lepocine:cancel': return askCancel(interaction);
    case 'lepocine:cancel-confirm': return confirmCancel(interaction);
    default: return undefined;
  }
}
