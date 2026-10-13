const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChannelType } = require('discord.js');
const repo = require('./repo');
const { daysInMonth, daysUntil } = require('./dates');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmt = (b) => `${b.day} de ${MESES[b.month - 1]}`;
const eph = { flags: MessageFlags.Ephemeral };

const data = new SlashCommandBuilder()
  .setName('cumple')
  .setDescription('Cumpleaños del servidor')
  .setContexts(0) // solo servidores
  .addSubcommand((s) => s.setName('set').setDescription('Registrar tu cumpleaños')
    .addIntegerOption((o) => o.setName('dia').setDescription('Día').setRequired(true).setMinValue(1).setMaxValue(31))
    .addIntegerOption((o) => o.setName('mes').setDescription('Mes (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
    .addIntegerOption((o) => o.setName('anio').setDescription('Año de nacimiento (opcional)').setMinValue(1900).setMaxValue(new Date().getFullYear())))
  .addSubcommand((s) => s.setName('ver').setDescription('Ver el cumpleaños de alguien')
    .addUserOption((o) => o.setName('usuario').setDescription('Usuario (por defecto, vos)')))
  .addSubcommand((s) => s.setName('proximos').setDescription('Próximos cumpleaños del servidor'))
  .addSubcommand((s) => s.setName('borrar').setDescription('Borrar tu cumpleaños'))
  .addSubcommand((s) => s.setName('canal').setDescription('Definir el canal de saludos (admin)')
    .addChannelOption((o) => o.setName('canal').setDescription('Canal de texto').setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)));

async function execute(interaction) {
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const day = interaction.options.getInteger('dia');
    const month = interaction.options.getInteger('mes');
    const year = interaction.options.getInteger('anio');
    if (day > daysInMonth(month)) {
      return interaction.reply({ content: `${MESES[month - 1]} no tiene ${day} días.`, ...eph });
    }
    repo.set(guildId, interaction.user.id, day, month, year);
    return interaction.reply({ content: `Listo, guardé tu cumpleaños: **${fmt({ day, month })}**.`, ...eph });
  }

  if (sub === 'ver') {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    const b = repo.get(guildId, user.id);
    if (!b) return interaction.reply({ content: `${user} no registró su cumpleaños.`, ...eph });
    const dias = daysUntil(b.day, b.month);
    const when = dias === 0 ? '¡es hoy!' : `faltan ${dias} día${dias === 1 ? '' : 's'}`;
    return interaction.reply({ content: `🎂 ${user} cumple el **${fmt(b)}** (${when}).`, allowedMentions: { parse: [] } });
  }

  if (sub === 'proximos') {
    const lista = repo.allInGuild(guildId)
      .map((b) => ({ ...b, dias: daysUntil(b.day, b.month) }))
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 10);
    if (!lista.length) return interaction.reply({ content: 'Todavía no hay cumpleaños registrados.', ...eph });
    const txt = lista.map((b) => `• <@${b.user_id}> — ${fmt(b)} (${b.dias === 0 ? 'hoy' : `en ${b.dias}d`})`).join('\n');
    return interaction.reply({ content: `**Próximos cumpleaños**\n${txt}`, allowedMentions: { parse: [] } });
  }

  if (sub === 'borrar') {
    const ok = repo.remove(guildId, interaction.user.id);
    return interaction.reply({ content: ok ? 'Borré tu cumpleaños.' : 'No tenías ninguno registrado.', ...eph });
  }

  if (sub === 'canal') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Necesitás el permiso *Gestionar servidor*.', ...eph });
    }
    const canal = interaction.options.getChannel('canal');
    repo.setChannel(guildId, canal.id);
    return interaction.reply({ content: `Los saludos se enviarán en ${canal}.`, ...eph });
  }
}

module.exports = { data, execute };
