import { MessageFlags } from 'discord.js';
import config from './config.js';

/** ¿Quien hizo la interacción tiene alguno de los roles del equipo (config global)? */
export function isStaff(interaction) {
  const roles = interaction.member?.roles;
  if (!roles) return false;
  const has = (id) => (Array.isArray(roles) ? roles.includes(id) : roles.cache.has(id));
  return config.staffRoleIds.some(has);
}

/** Respuesta estándar (solo la ve quien hizo clic) cuando no tiene permiso. */
export const STAFF_ONLY = { content: 'Solo el equipo puede hacer esto.', flags: MessageFlags.Ephemeral };
