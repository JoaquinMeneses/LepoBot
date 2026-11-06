import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import cfg from './config.js';
import { getLatestPatch } from './service.js';

// Comando para todos los miembros: no tiene permisos por defecto.
export const data = new SlashCommandBuilder()
  .setName('lc-parche')
  .setDescription('Muestra las últimas notas de la versión de League of Legends')
  .setContexts(0);

const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function buildReply(patch) {
  const embed = new EmbedBuilder()
    .setColor(0x0a6fdb)
    .setTitle(patch.title)
    .setURL(patch.url)
    .setFooter({ text: `Parche ${patch.version} · Notas de la versión · Riot Games` });
  if (patch.description) embed.setDescription(cut(patch.description, cfg.maxDescription));
  if (patch.image) embed.setImage(patch.image);

  const link = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Leer las notas completas').setURL(patch.url);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(link)] };
}

export async function execute(interaction) {
  await interaction.deferReply(); // pública: así la ven todos en el canal
  try {
    const patch = await getLatestPatch();
    await interaction.editReply(buildReply(patch));
  } catch (err) {
    console.error('[parche] no pude obtener las notas:', err);
    await interaction.editReply(`No pude obtener las notas del parche ahora. Probá de nuevo en un rato o mirá el listado acá: <${cfg.listUrl}>`);
  }
}
