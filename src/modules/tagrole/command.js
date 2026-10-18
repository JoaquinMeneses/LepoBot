import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { postPanel } from './panel.js';

// Comando solo de administración: la configuración se maneja desde el panel del equipo.
export const data = new SlashCommandBuilder()
  .setName('lc-tagrole')
  .setDescription('Administración del rol por etiqueta del servidor')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(0)
  .addSubcommand((s) => s.setName('panel').setDescription('Publica el panel de configuración en el canal del equipo'));

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const staff = await postPanel(interaction.client);
  if (!staff) {
    return interaction.editReply('No encuentro el canal del equipo. Revisá `staffChannelId` en `src/core/config.js` y los permisos del bot.');
  }
  return interaction.editReply(`Panel publicado en ${staff}.`);
}
