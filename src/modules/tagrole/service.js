import { Routes } from 'discord.js';
import * as repo from './repo.js';
import cfg from './config.js';

const REASON_ADD = 'Etiqueta del servidor activada';
const REASON_REMOVE = 'Etiqueta del servidor desactivada';

/**
 * Estado de la etiqueta de un usuario (datos crudos de la API de Discord, campo `primary_guild`):
 *   'tagged'   -> muestra la etiqueta de ESTE servidor
 *   'untagged' -> no la muestra (otra etiqueta, etiqueta oculta, o sin etiqueta)
 *   'unknown'  -> Discord no mandó el campo; no se sabe, así que no se hace nada
 * Distinguir 'untagged' de 'unknown' evita quitar roles por error si faltara el dato.
 */
export function tagState(rawUser, guildId) {
  if (!rawUser || !('primary_guild' in rawUser)) return 'unknown';
  const pg = rawUser.primary_guild;
  return pg?.identity_guild_id === guildId && pg?.identity_enabled === true ? 'tagged' : 'untagged';
}

// Avisa de cada problema de configuración una sola vez por servidor, para no llenar la consola
const warned = new Map();
function warnOnce(guildId, key, message) {
  if (warned.get(guildId) === key) return;
  warned.set(guildId, key);
  console.warn(`[tagrole] ${message}`);
}

/**
 * Comprueba que se puede trabajar: módulo activo, el rol existe y el bot puede asignarlo.
 * Devuelve { ok: true, role, settings } o { ok: false, problem, settings }.
 */
export async function precheck(guild) {
  const settings = repo.getSettings(guild.id);
  if (!settings.enabled) return { ok: false, problem: 'disabled', settings };

  const role = guild.roles.cache.get(settings.roleId);
  if (!role) {
    warnOnce(guild.id, `no-role:${settings.roleId}`, `el rol ${settings.roleId} no existe en el servidor "${guild.name}"`);
    return { ok: false, problem: 'no-role', settings };
  }

  await guild.members.fetchMe().catch(() => {});
  if (!role.editable) {
    warnOnce(guild.id, `no-edit:${role.id}`, `el bot no puede asignar el rol "${role.name}": revisá el permiso Gestionar roles y que el rol del bot esté por encima`);
    return { ok: false, problem: 'not-manageable', settings };
  }

  warned.delete(guild.id);
  return { ok: true, role, settings };
}

/**
 * Decide y aplica el cambio de rol de una persona.
 * Devuelve 'added' | 'removed' | 'cleaned' | null (sin cambios).
 *  - Con etiqueta y sin rol: se agrega.
 *  - Sin etiqueta y con rol: se quita solo si lo asignó el bot y la opción está activada.
 *  - Estado desconocido: no se hace nada.
 */
export async function applyState(guild, role, settings, userId, hasRole, state) {
  if (state === 'unknown') return null;

  const granted = repo.wasGranted(guild.id, userId, role.id);

  if (state === 'tagged') {
    if (hasRole) return null;
    await guild.members.addRole({ user: userId, role: role.id, reason: REASON_ADD });
    repo.markGranted(guild.id, userId, role.id);
    return 'added';
  }

  if (hasRole && granted && settings.removeOnLoss) {
    await guild.members.removeRole({ user: userId, role: role.id, reason: REASON_REMOVE });
    repo.unmarkGranted(guild.id, userId, role.id);
    return 'removed';
  }
  if (!hasRole && granted) {
    // Alguien le quitó el rol a mano: ya no hace falta recordar que lo dio el bot
    repo.unmarkGranted(guild.id, userId, role.id);
    return 'cleaned';
  }
  return null;
}

// ---------- Tiempo real ----------

const inFlight = new Set();

/**
 * Procesa un paquete crudo del Gateway. Solo interesa GUILD_MEMBER_UPDATE:
 * discord.js NO emite guildMemberUpdate cuando cambia únicamente la etiqueta, por eso se usa el evento raw.
 */
export async function handleRaw(client, packet) {
  if (packet.t !== 'GUILD_MEMBER_UPDATE') return;

  const d = packet.d;
  if (!d?.user || d.user.bot) return;
  const guild = client.guilds.cache.get(d.guild_id);
  if (!guild) return;

  const state = tagState(d.user, guild.id);
  if (state === 'unknown') return;

  const key = `${guild.id}:${d.user.id}`;
  if (inFlight.has(key)) return; // ya se está procesando a esta persona
  inFlight.add(key);
  try {
    const pre = await precheck(guild);
    if (!pre.ok) return;
    await applyState(guild, pre.role, pre.settings, d.user.id, (d.roles ?? []).includes(pre.role.id), state);
  } finally {
    inFlight.delete(key);
  }
}

// ---------- Barrido ----------

const syncing = new Set();

/**
 * Recorre todos los miembros y corrige las diferencias. Cubre lo ocurrido con el bot apagado.
 * Pide la lista cruda a la API (no llena la caché de discord.js) para saber si Discord mandó la etiqueta.
 * Devuelve { ok: true, stats } o { ok: false, problem }.
 */
export async function syncGuild(client, guild, { pageSize = cfg.pageSize } = {}) {
  if (syncing.has(guild.id)) return { ok: false, problem: 'busy' };
  syncing.add(guild.id);
  try {
    const pre = await precheck(guild);
    if (!pre.ok) return { ok: false, problem: pre.problem };

    const stats = { checked: 0, tagged: 0, withRole: 0, added: 0, removed: 0, cleaned: 0, unknown: 0, errors: 0 };
    let after;
    for (;;) {
      const query = new URLSearchParams({ limit: String(pageSize) });
      if (after) query.set('after', after);
      const page = await client.rest.get(Routes.guildMembers(guild.id), { query });
      if (!page.length) break;

      for (const m of page) {
        if (m.user?.bot) continue;
        stats.checked++;
        const state = tagState(m.user, guild.id);
        const hasRole = (m.roles ?? []).includes(pre.role.id);
        if (state === 'tagged') stats.tagged++;
        if (state === 'unknown') stats.unknown++;
        try {
          const result = await applyState(guild, pre.role, pre.settings, m.user.id, hasRole, state);
          if (result) stats[result]++;
          if (result === 'added' || (hasRole && result !== 'removed')) stats.withRole++;
        } catch (err) {
          stats.errors++;
          console.error(`[tagrole] no pude actualizar a ${m.user.id}:`, err.message);
        }
      }
      after = page.at(-1).user.id;
      if (page.length < pageSize) break;
    }

    repo.saveSync(guild.id, stats);
    console.log(`[tagrole] barrido en "${guild.name}":`, JSON.stringify(stats));
    return { ok: true, stats };
  } finally {
    syncing.delete(guild.id);
  }
}
