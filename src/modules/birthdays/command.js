import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import repo from './repo.js';
import { daysInMonth, daysUntil } from './dates.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmt = (b) => `${b.day} de ${MESES[b.month - 1]}`;
const eph = { flags: MessageFlags.Ephemeral };
const PREFIX = 'lc-birthdays';

export const data = new SlashCommandBuilder()
  .setName('lc-cumple')
  .setDescription('Panel de cumpleaños del servidor')
  .setContexts(0)
  .addSubcommand((s) => s.setName('panel').setDescription('Abrir el panel de cumpleaños'))
  .addSubcommand((s) => s.setName('canal').setDescription('Definir el canal de saludos (admin)')
    .addChannelOption((o) => o.setName('canal').setDescription('Canal de texto').setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)));

function panelComponents() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:register`).setLabel('Registrar / editar').setEmoji('🎂').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${PREFIX}:mine`).setLabel('Mi cumpleaños').setEmoji('📅').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PREFIX}:upcoming`).setLabel('Próximos').setEmoji('🎉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PREFIX}:delete`).setLabel('Borrar').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  )];
}

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🎂 Cumpleaños de la comunidad')
    .setDescription('Usá los botones para registrar o consultar cumpleaños. Solo vos podés ver tu fecha desde este panel.');
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'panel') {
    return interaction.reply({ embeds: [panelEmbed()], components: panelComponents(), ...eph });
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'Necesitás el permiso *Gestionar servidor*.', ...eph });
  }
  const channel = interaction.options.getChannel('canal');
  repo.setChannel(interaction.guildId, channel.id);
  return interaction.reply({ content: `Los saludos se enviarán en ${channel}.`, ...eph });
}

function registerModal() {
  const modal = new ModalBuilder().setCustomId(`${PREFIX}:register-modal`).setTitle('Registrar cumpleaños');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('day').setLabel('Día').setPlaceholder('1-31')
        .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2).setRequired(true)),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('month').setLabel('Mes').setPlaceholder('1-12')
        .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(2).setRequired(true)),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('year').setLabel('Año de nacimiento (opcional)').setPlaceholder('Por ejemplo, 2000')
        .setStyle(TextInputStyle.Short).setMaxLength(4).setRequired(false)),
  );
  return modal;
}

async function handleRegister(interaction) {
  const day = Number(interaction.fields.getTextInputValue('day'));
  const month = Number(interaction.fields.getTextInputValue('month'));
  const rawYear = interaction.fields.getTextInputValue('year').trim();
  const year = rawYear ? Number(rawYear) : null;
  if (!Number.isInteger(day) || !Number.isInteger(month) || (rawYear && !Number.isInteger(year))) {
    return interaction.reply({ content: 'Ingresá números válidos para el día, mes y año.', ...eph });
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) {
    return interaction.reply({ content: 'Esa fecha no existe. Revisá el día y el mes.', ...eph });
  }
  if (year !== null && (year < 1900 || year > new Date().getFullYear())) {
    return interaction.reply({ content: `El año debe estar entre 1900 y ${new Date().getFullYear()}.`, ...eph });
  }

  repo.set(interaction.guildId, interaction.user.id, day, month, year);
  return interaction.reply({
    content: `Listo, guardé tu cumpleaños: **${fmt({ day, month })}**${year ? '. Con el año registrado también te saludamos con tu edad.' : '.'}`,
    ...eph,
  });
}

async function handleMine(interaction) {
  const birthday = repo.get(interaction.guildId, interaction.user.id);
  if (!birthday) {
    return interaction.reply({ content: 'Todavía no registraste tu cumpleaños. Usá **Registrar / editar** para agregarlo.', ...eph });
  }
  const days = daysUntil(birthday.day, birthday.month);
  const when = days === 0 ? '¡es hoy!' : `faltan ${days} día${days === 1 ? '' : 's'}`;
  return interaction.reply({ content: `Tu cumpleaños es el **${fmt(birthday)}** (${when}).`, ...eph });
}

async function handleUpcoming(interaction) {
  const list = repo.allInGuild(interaction.guildId)
    .map((birthday) => ({ ...birthday, days: daysUntil(birthday.day, birthday.month) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 10);
  if (!list.length) {
    return interaction.reply({ content: 'Todavía no hay cumpleaños registrados.', ...eph });
  }
  const content = list.map((b) => `• <@${b.user_id}> — ${fmt(b)} (${b.days === 0 ? 'hoy' : `en ${b.days}d`})`).join('\n');
  return interaction.reply({ content: `**Próximos cumpleaños**\n${content}`, allowedMentions: { parse: [] }, ...eph });
}

async function handleDelete(interaction) {
  const confirm = new ButtonBuilder().setCustomId(`${PREFIX}:delete-confirm`).setLabel('Sí, borrar').setStyle(ButtonStyle.Danger);
  const cancel = new ButtonBuilder().setCustomId(`${PREFIX}:delete-cancel`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary);
  return interaction.reply({
    content: '¿Querés borrar tu cumpleaños registrado?',
    components: [new ActionRowBuilder().addComponents(confirm, cancel)],
    ...eph,
  });
}

export async function handle(interaction) {
  switch (interaction.customId) {
    case `${PREFIX}:register`: return interaction.showModal(registerModal());
    case `${PREFIX}:register-modal`: return handleRegister(interaction);
    case `${PREFIX}:mine`: return handleMine(interaction);
    case `${PREFIX}:upcoming`: return handleUpcoming(interaction);
    case `${PREFIX}:delete`: return handleDelete(interaction);
    case `${PREFIX}:delete-confirm`: {
      const removed = repo.remove(interaction.guildId, interaction.user.id);
      return interaction.update({
        content: removed ? 'Borré tu cumpleaños.' : 'No tenías un cumpleaños registrado.',
        components: [],
      });
    }
    case `${PREFIX}:delete-cancel`: return interaction.update({ content: 'No hice cambios.', components: [] });
    default: return undefined;
  }
}
