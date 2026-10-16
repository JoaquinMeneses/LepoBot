const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const service = require('./service');

// Comando solo de administración: los miembros usan los botones del panel.
// (Los comandos de prueba viven en el módulo `debug`.)
const data = new SlashCommandBuilder()
  .setName('lepocine')
  .setDescription('Administración de Lepocine')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(0)
  .addSubcommand((s) => s.setName('panel').setDescription('Publica paneles nuevos en los canales de Lepocine'))
  .addSubcommand((s) => s.setName('evento').setDescription('Crea ahora el evento del viernes con la película elegida'));

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = await service.getChannel(interaction.client);
  if (!channel) {
    return interaction.editReply('No encuentro el canal. Revisá `LEPOCINE_CHANNEL_ID` en el `.env` y los permisos del bot.');
  }

  if (interaction.options.getSubcommand() === 'panel') {
    const posted = await service.repostPanels(interaction.client);
    return interaction.editReply(`Panel publicado en ${posted.join(' y ')}.`);
  }

  const { status } = await service.processWeek(interaction.client);
  const msg = {
    created: 'Evento creado.',
    exists: 'El evento de este viernes ya estaba creado.',
    'no-night': 'Todavía no hay película elegida para este viernes.',
    error: 'No pude crear el evento. Mirá el canal y la consola.',
  }[status] ?? 'Listo.';
  return interaction.editReply(msg);
}

module.exports = { data, execute };
