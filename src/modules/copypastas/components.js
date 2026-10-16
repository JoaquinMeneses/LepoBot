import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelSelectMenuBuilder,
  ChannelType, PermissionFlagsBits, MessageFlags, escapeMarkdown,
} from 'discord.js';
import { isStaff, STAFF_ONLY } from '../../core/permissions.js';
import cfg from './config.js';
import * as repo from './repo.js';
import * as service from './service.js';
import { parseEmojiInput } from './emoji.js';

const eph = { flags: MessageFlags.Ephemeral };
const textRow = (input) => new ActionRowBuilder().addComponents(input);
const refresh = (interaction) => service.updatePanel(interaction.client, interaction.guildId);

// ---- Emoji ----

async function openEmojiModal(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);

  const modal = new ModalBuilder().setCustomId('lc-copypastas:emoji-modal').setTitle('Emoji que activa la copia');
  modal.addComponents(textRow(
    new TextInputBuilder().setCustomId('emoji').setLabel('Emoji')
      .setPlaceholder('Pegá un emoji, por ejemplo 📋')
      .setValue(repo.getSettings(interaction.guildId).emoji)
      .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(64).setRequired(true),
  ));
  return interaction.showModal(modal);
}

async function submitEmoji(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);

  const res = parseEmojiInput(interaction.fields.getTextInputValue('emoji'), interaction.guild);
  if (!res.ok) return interaction.reply({ content: `⚠️ ${res.error}`, ...eph });

  repo.setEmoji(interaction.guildId, res.value);
  await interaction.reply({ content: `✅ Ahora el emoji que activa la copia es ${res.value}`, ...eph });
  await refresh(interaction);
}

// ---- Canal ----

async function openChannelMenu(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);

  const menu = new ChannelSelectMenuBuilder()
    .setCustomId('lc-copypastas:channel-select')
    .setPlaceholder('Elegí el canal de copypastas')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1).setMaxValues(1);

  return interaction.reply({
    content: '📢 **¿A qué canal se mandan los copypastas?**',
    components: [new ActionRowBuilder().addComponents(menu)],
    ...eph,
  });
}

const NEEDED = [
  [PermissionFlagsBits.ViewChannel, 'Ver canal'],
  [PermissionFlagsBits.SendMessages, 'Enviar mensajes'],
  [PermissionFlagsBits.EmbedLinks, 'Insertar enlaces'],
  [PermissionFlagsBits.AttachFiles, 'Adjuntar archivos'],
  [PermissionFlagsBits.AddReactions, 'Añadir reacciones'],
];

/** Permisos que el bot necesita en el canal destino y no tiene. */
async function missingPermissions(channel, guild) {
  try {
    const me = await guild.members.fetchMe();
    const perms = channel.permissionsFor(me);
    return NEEDED.filter(([flag]) => !perms?.has(flag)).map(([, name]) => name);
  } catch {
    return []; // si no se puede comprobar, no se bloquea
  }
}

async function submitChannel(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);
  await interaction.deferUpdate();

  const channel = interaction.channels?.first();
  if (!channel) return interaction.editReply({ content: 'No pude leer el canal elegido.', components: [] });

  repo.setChannel(interaction.guildId, channel.id);
  const missing = await missingPermissions(channel, interaction.guild);
  const warn = missing.length ? `\n⚠️ Al bot le faltan permisos en ese canal: ${missing.join(', ')}.` : '';

  await interaction.editReply({ content: `✅ Los copypastas se mandan a ${channel}.${warn}`, components: [] });
  await refresh(interaction);
}

// ---- Mínimo de reacciones ----

async function openThresholdModal(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);

  const modal = new ModalBuilder().setCustomId('lc-copypastas:threshold-modal').setTitle('Mínimo de reacciones');
  modal.addComponents(textRow(
    new TextInputBuilder().setCustomId('threshold').setLabel(`Cantidad de reacciones (1 a ${cfg.maxThreshold})`)
      .setPlaceholder('1 = con una sola reacción alcanza')
      .setValue(String(repo.getSettings(interaction.guildId).threshold))
      .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2).setRequired(true),
  ));
  return interaction.showModal(modal);
}

async function submitThreshold(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);

  const raw = interaction.fields.getTextInputValue('threshold').trim();
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!(n >= 1 && n <= cfg.maxThreshold)) {
    return interaction.reply({ content: `⚠️ Escribí un número entre 1 y ${cfg.maxThreshold}.`, ...eph });
  }

  repo.setThreshold(interaction.guildId, n);
  await interaction.reply({
    content: `✅ Ahora hacen falta **${n}** ${n === 1 ? 'reacción' : 'reacciones'} con ese emoji para copiar un mensaje.`,
    ...eph,
  });
  await refresh(interaction);
}

export async function handle(interaction) {
  switch (interaction.customId) {
    case 'lc-copypastas:emoji': return openEmojiModal(interaction);
    case 'lc-copypastas:emoji-modal': return submitEmoji(interaction);
    case 'lc-copypastas:channel': return openChannelMenu(interaction);
    case 'lc-copypastas:channel-select': return submitChannel(interaction);
    case 'lc-copypastas:threshold': return openThresholdModal(interaction);
    case 'lc-copypastas:threshold-modal': return submitThreshold(interaction);
    default: return undefined;
  }
}
