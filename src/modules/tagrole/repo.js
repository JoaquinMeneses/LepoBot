import db from '../../core/db.js';
import cfg from './config.js';

db.exec(`
  -- Configuración por servidor. Lo que esté en NULL usa el valor por defecto de config.js
  CREATE TABLE IF NOT EXISTS tagrole_settings (
    guild_id       TEXT PRIMARY KEY,
    role_id        TEXT,
    enabled        INTEGER,
    remove_on_loss INTEGER,
    last_sync_at   INTEGER,
    last_sync_json TEXT
  );

  -- Roles que asignó el bot (para quitar solo esos cuando se pierde la etiqueta)
  CREATE TABLE IF NOT EXISTS tagrole_granted (
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role_id    TEXT NOT NULL,
    granted_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, role_id)
  );

  -- Mensaje del panel de configuración
  CREATE TABLE IF NOT EXISTS tagrole_panel (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  );
`);

const q = {
  get: db.prepare('SELECT * FROM tagrole_settings WHERE guild_id = ?'),
  setRole: db.prepare(`INSERT INTO tagrole_settings (guild_id, role_id) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET role_id = excluded.role_id`),
  setEnabled: db.prepare(`INSERT INTO tagrole_settings (guild_id, enabled) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`),
  setRemove: db.prepare(`INSERT INTO tagrole_settings (guild_id, remove_on_loss) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET remove_on_loss = excluded.remove_on_loss`),
  setSync: db.prepare(`INSERT INTO tagrole_settings (guild_id, last_sync_at, last_sync_json) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET last_sync_at = excluded.last_sync_at, last_sync_json = excluded.last_sync_json`),

  wasGranted: db.prepare('SELECT 1 AS ok FROM tagrole_granted WHERE guild_id = ? AND user_id = ? AND role_id = ?'),
  markGranted: db.prepare('INSERT OR IGNORE INTO tagrole_granted (guild_id, user_id, role_id, granted_at) VALUES (?, ?, ?, ?)'),
  unmarkGranted: db.prepare('DELETE FROM tagrole_granted WHERE guild_id = ? AND user_id = ? AND role_id = ?'),

  getPanel: db.prepare('SELECT * FROM tagrole_panel WHERE guild_id = ?'),
  setPanel: db.prepare(`INSERT INTO tagrole_panel (guild_id, channel_id, message_id) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`),
};

/** Configuración efectiva del servidor: lo guardado desde el panel, o los valores por defecto. */
export function getSettings(guildId) {
  const row = q.get.get(guildId);
  return {
    roleId: row?.role_id ?? cfg.defaultRoleId,
    enabled: row?.enabled == null ? true : Boolean(row.enabled),
    removeOnLoss: row?.remove_on_loss == null ? cfg.defaultRemoveOnLoss : Boolean(row.remove_on_loss),
    lastSyncAt: row?.last_sync_at ?? null,
    lastSync: row?.last_sync_json ? JSON.parse(row.last_sync_json) : null,
  };
}

export const setRole = (guildId, roleId) => q.setRole.run(guildId, roleId);
export const setEnabled = (guildId, enabled) => q.setEnabled.run(guildId, enabled ? 1 : 0);
export const setRemoveOnLoss = (guildId, value) => q.setRemove.run(guildId, value ? 1 : 0);
export const saveSync = (guildId, stats) => q.setSync.run(guildId, Date.now(), JSON.stringify(stats));

export const wasGranted = (guildId, userId, roleId) => Boolean(q.wasGranted.get(guildId, userId, roleId));
export const markGranted = (guildId, userId, roleId) => q.markGranted.run(guildId, userId, roleId, Date.now());
export const unmarkGranted = (guildId, userId, roleId) => q.unmarkGranted.run(guildId, userId, roleId);

export const getPanel = (guildId) => q.getPanel.get(guildId) ?? null;
export const setPanel = (guildId, channelId, messageId) => q.setPanel.run(guildId, channelId, messageId);
