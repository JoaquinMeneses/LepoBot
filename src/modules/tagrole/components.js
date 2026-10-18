import { MessageFlags } from 'discord.js';
import { isStaff, STAFF_ONLY } from '../../core/permissions.js';
import * as repo from './repo.js';
import * as service from './service.js';
import { buildPanel, updatePanel } from './panel.js';

const eph = { flags: MessageFlags.Ephemeral };

const PROBLEMS = {
  disabled: 'El módulo está pausado. Activalo desde el panel.',
  'no-role': 'No encuentro el rol configurado en este servidor. Elegí otro desde el panel.',
  'not-manageable': 'El bot no puede asignar ese rol: necesita el permiso *Gestionar roles* y su rol tiene que estar **por encima** de ese rol en la lista de roles del servidor.',
  busy: 'Ya hay un barrido en curso. Esperá a que termine.',
};

function summarize(stats) {
  let msg = `✅ Sincronizado. Revisé **${stats.checked}** miembros: **${stats.tagged}** con etiqueta.\nRoles agregados: **${stats.added}** · quitados: **${stats.removed}**.`;
  if (stats.unknown) msg += `\n⚠️ Discord no mandó el dato de la etiqueta de ${stats.unknown} miembros (no se tocaron).`;
  if (stats.errors) msg += `\n⚠️ ${stats.errors} miembros dieron error (mirá la consola del bot).`;
  return msg;
}

/** Barrido en segundo plano que después refresca el panel. */
function syncInBackground(interaction) {
  service.syncGuild(interaction.client, interaction.guild)
    .then(() => updatePanel(interaction.client, interaction.guildId))
    .catch((err) => console.error('[tagrole] barrido:', err));
}

async function toggleEnabled(interaction) {
  const now = !repo.getSettings(interaction.guildId).enabled;
  repo.setEnabled(interaction.guildId, now);
  await interaction.update(buildPanel(interaction.guildId));
  if (now) syncInBackground(interaction); // al reactivar, se ponen al día los cambios que se perdieron
}

async function toggleRemove(interaction) {
  repo.setRemoveOnLoss(interaction.guildId, !repo.getSettings(interaction.guildId).removeOnLoss);
  await interaction.update(buildPanel(interaction.guildId));
}

async function syncNow(interaction) {
  await interaction.deferReply(eph);
  const res = await service.syncGuild(interaction.client, interaction.guild);
  await interaction.editReply(res.ok ? summarize(res.stats) : `⚠️ ${PROBLEMS[res.problem] ?? 'No pude sincronizar.'}`);
  await updatePanel(interaction.client, interaction.guildId);
}

async function changeRole(interaction) {
  const role = interaction.roles?.first();
  if (!role) return interaction.reply({ content: 'No pude leer el rol elegido.', ...eph });
  if (role.id === interaction.guildId || role.managed) {
    return interaction.reply({ content: '⚠️ Ese rol no se puede usar (es @everyone o lo gestiona una integración o un bot).', ...eph });
  }

  repo.setRole(interaction.guildId, role.id);
  await interaction.update(buildPanel(interaction.guildId));

  await interaction.guild.members.fetchMe().catch(() => {});
  if (!role.editable) {
    await interaction.followUp({ content: `⚠️ Guardé ${role}, pero el bot todavía no puede asignarlo: necesita *Gestionar roles* y su rol tiene que estar **por encima** de ese rol.`, ...eph });
    return;
  }
  syncInBackground(interaction); // da el nuevo rol a quienes ya muestran la etiqueta
}

export async function handle(interaction) {
  if (!isStaff(interaction)) return interaction.reply(STAFF_ONLY);

  switch (interaction.customId) {
    case 'lc-tagrole:toggle': return toggleEnabled(interaction);
    case 'lc-tagrole:remove': return toggleRemove(interaction);
    case 'lc-tagrole:sync': return syncNow(interaction);
    case 'lc-tagrole:role': return changeRole(interaction);
    default: return undefined;
  }
}
