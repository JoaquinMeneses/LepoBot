import db from '../../core/db.js';
import cfg from './config.js';

db.exec(`
  -- Configuración por servidor. Lo que esté en NULL usa el valor por defecto de config.js
  CREATE TABLE IF NOT EXISTS copypasta_settings (
    guild_id   TEXT PRIMARY KEY,
    emoji      TEXT,
    channel_id TEXT,
    threshold  INTEGER
  );

  -- Mensajes ya copiados (evita publicar el mismo mensaje dos veces)
  CREATE TABLE IF NOT EXISTS copypasta_posts (
    guild_id          TEXT NOT NULL,
    source_message_id TEXT NOT NULL,
    source_channel_id TEXT NOT NULL,
    posted_message_id TEXT,
    created_at        INTEGER NOT NULL,
    PRIMARY KEY (guild_id, source_message_id)
  );

  -- Mensaje del panel de configuración
  CREATE TABLE IF NOT EXISTS copypasta_panel (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  );
`);

const q = {
  getSettings: db.prepare('SELECT * FROM copypasta_settings WHERE guild_id = ?'),
  setEmoji: db.prepare(`INSERT INTO copypasta_settings (guild_id, emoji) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET emoji = excluded.emoji`),
  setChannel: db.prepare(`INSERT INTO copypasta_settings (guild_id, channel_id) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id`),
  setThreshold: db.prepare(`INSERT INTO copypasta_settings (guild_id, threshold) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET threshold = excluded.threshold`),

  claim: db.prepare('INSERT OR IGNORE INTO copypasta_posts (guild_id, source_message_id, source_channel_id, created_at) VALUES (?, ?, ?, ?)'),
  setPosted: db.prepare('UPDATE copypasta_posts SET posted_message_id = ? WHERE guild_id = ? AND source_message_id = ?'),
  release: db.prepare('DELETE FROM copypasta_posts WHERE guild_id = ? AND source_message_id = ?'),

  getPanel: db.prepare('SELECT * FROM copypasta_panel WHERE guild_id = ?'),
  setPanel: db.prepare(`INSERT INTO copypasta_panel (guild_id, channel_id, message_id) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`),
};

/** Configuración efectiva del servidor: lo guardado desde el panel, o los valores por defecto. */
export function getSettings(guildId) {
  const row = q.getSettings.get(guildId);
  return {
    emoji: row?.emoji ?? cfg.defaultEmoji,
    channelId: row?.channel_id ?? cfg.defaultChannelId,
    threshold: row?.threshold ?? cfg.defaultThreshold,
  };
}

export const setEmoji = (guildId, emoji) => q.setEmoji.run(guildId, emoji);
export const setChannel = (guildId, channelId) => q.setChannel.run(guildId, channelId);
export const setThreshold = (guildId, n) => q.setThreshold.run(guildId, n);

/** Reserva un mensaje para copiarlo. Devuelve false si ya fue copiado (o se está copiando). */
export function claim(guildId, messageId, channelId) {
  return Number(q.claim.run(guildId, messageId, channelId, Date.now()).changes) === 1;
}
export const setPosted = (guildId, messageId, postedId) => q.setPosted.run(postedId, guildId, messageId);
/** Libera la reserva si el envío falló, para poder reintentar con otra reacción. */
export const release = (guildId, messageId) => q.release.run(guildId, messageId);

export const getPanel = (guildId) => q.getPanel.get(guildId) ?? null;
export const setPanel = (guildId, channelId, messageId) => q.setPanel.run(guildId, channelId, messageId);
