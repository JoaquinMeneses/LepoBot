import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import * as service from './service.js';

// Comando solo de administración: el equipo y la comunidad usan los botones de los paneles.
// (Los comandos de prueba viven en el módulo `debug`.)
export const data = new SlashCommandBuilder()
  .setName('lc-lepocine')
  .setDescription('Administración de Lepocine')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(0)
  .addSubcommand((s) => s.setName('panel').setDescription('Publica de nuevo el panel del equipo en su canal'));

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const staff = await service.repostStaffPanel(interaction.client);
  if (!staff) {
    return interaction.editReply('No encuentro el canal del equipo. Revisá `staffChannelId` en `src/core/config.js` y los permisos del bot.');
  }
  return interaction.editReply(`Panel publicado en ${staff}.`);
}
