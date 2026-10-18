import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder,
} from 'discord.js';
import globalConfig from '../../core/config.js';
import * as repo from './repo.js';

async function fetchChannel(client, id) {
  try {
    return await client.channels.fetch(id);
  } catch (err) {
    console.error(`[tagrole] no pude acceder al canal ${id}:`, err.message);
    return null;
  }
}

function syncSummary(s) {
  if (!s.lastSyncAt) return '_Todavía no se hizo ninguno._';
  const t = s.lastSync ?? {};
  const lines = [
    `<t:${Math.floor(s.lastSyncAt / 1000)}:R>`,
    `Con etiqueta: **${t.tagged ?? 0}** · Con el rol: **${t.withRole ?? 0}**`,
    `Agregados: **${t.added ?? 0}** · Quitados: **${t.removed ?? 0}**`,
  ];
  if (t.unknown) lines.push(`⚠️ Sin dato de etiqueta: ${t.unknown}`);
  if (t.errors) lines.push(`⚠️ Con error: ${t.errors}`);
  return lines.join('\n');
}

export function buildPanel(guildId) {
  const s = repo.getSettings(guildId);

  const embed = new EmbedBuilder()
    .setColor(s.enabled ? 0x2ecc71 : 0x95a5a6)
    .setTitle('🏷️ Rol por etiqueta del servidor')
    .setDescription('Cuando alguien muestra la etiqueta de este servidor, el bot le da el rol. Solo se le quita el rol a quienes se lo dio el bot: los roles dados a mano no se tocan.')
    .addFields(
      { name: 'Estado', value: s.enabled ? '✅ Activo' : '⏸️ Pausado', inline: true },
      { name: 'Rol', value: `<@&${s.roleId}>`, inline: true },
      { name: 'Al dejar la etiqueta', value: s.removeOnLoss ? 'Se quita el rol' : 'Se mantiene el rol', inline: true },
      { name: 'Último barrido', value: syncSummary(s) },
    )
    .setFooter({ text: 'Panel del equipo' });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lc-tagrole:toggle')
      .setLabel(s.enabled ? 'Pausar' : 'Activar').setEmoji(s.enabled ? '⏸️' : '▶️')
      .setStyle(s.enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('lc-tagrole:remove')
      .setLabel(`Quitar el rol al perder la etiqueta: ${s.removeOnLoss ? 'Sí' : 'No'}`).setEmoji('🔁')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lc-tagrole:sync')
      .setLabel('Sincronizar ahora').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
  const roleSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('lc-tagrole:role')
      .setPlaceholder('Cambiar el rol que se asigna').setMinValues(1).setMaxValues(1),
  );

  return { embeds: [embed], components: [buttons, roleSelect], allowedMentions: { parse: [] } };
}

/** Publica el panel en el canal del equipo (borra el anterior). Devuelve el canal o null. */
export async function postPanel(client) {
  const staff = await fetchChannel(client, globalConfig.staffChannelId);
  if (!staff) return null;
  const guildId = staff.guild.id;

  const saved = repo.getPanel(guildId);
  if (saved) {
    try {
      const old = await (await fetchChannel(client, saved.channel_id))?.messages.fetch(saved.message_id);
      await old?.delete();
    } catch { /* ya no estaba */ }
  }
  const msg = await staff.send(buildPanel(guildId));
  repo.setPanel(guildId, staff.id, msg.id);
  return staff;
}

/** Refresca el panel publicado (si hay uno). */
export async function updatePanel(client, guildId) {
  const saved = repo.getPanel(guildId);
  if (!saved) return;
  try {
    const channel = await fetchChannel(client, saved.channel_id);
    const msg = await channel?.messages.fetch(saved.message_id);
    await msg?.edit(buildPanel(guildId));
  } catch (err) {
    console.error('[tagrole] no pude actualizar el panel:', err.message);
  }
}
