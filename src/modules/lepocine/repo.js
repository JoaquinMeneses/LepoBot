import db from '../../core/db.js';
import cfg from './config.js';

db.exec(`
  -- Una "ronda" es una encuesta: día/hora de la película, temática y, al final, la película elegida
  CREATE TABLE IF NOT EXISTS lepocine_rounds (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',   -- open | done | cancelled | expired
    theme        TEXT,
    start_ms     INTEGER NOT NULL,
    end_ms       INTEGER NOT NULL,
    opened_by    TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    title        TEXT,                           -- película elegida
    suggested_by TEXT,
    picked_by    TEXT,
    event_id     TEXT
  );

  CREATE TABLE IF NOT EXISTS lepocine_round_suggestions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id   INTEGER NOT NULL,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL,
    title      TEXT NOT NULL,
    title_key  TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- un panel por tipo: 'public' (sugerir) y 'staff' (abrir encuesta / elegir)
  CREATE TABLE IF NOT EXISTS lepocine_panels (
    guild_id   TEXT NOT NULL,
    kind       TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, kind)
  );
`);

const q = {
  insertRound: db.prepare('INSERT INTO lepocine_rounds (guild_id, theme, start_ms, end_ms, opened_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  getOpen: db.prepare("SELECT * FROM lepocine_rounds WHERE guild_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1"),
  getLast: db.prepare('SELECT * FROM lepocine_rounds WHERE guild_id = ? ORDER BY id DESC LIMIT 1'),
  expire: db.prepare("UPDATE lepocine_rounds SET status = 'expired' WHERE guild_id = ? AND status = 'open' AND start_ms <= ?"),
  setStatus: db.prepare('UPDATE lepocine_rounds SET status = ? WHERE id = ?'),
  finish: db.prepare("UPDATE lepocine_rounds SET status = 'done', title = ?, suggested_by = ?, picked_by = ?, event_id = ? WHERE id = ?"),
  deleteRound: db.prepare('DELETE FROM lepocine_rounds WHERE id = ?'),

  listSug: db.prepare('SELECT * FROM lepocine_round_suggestions WHERE round_id = ? ORDER BY id'),
  getSug: db.prepare('SELECT * FROM lepocine_round_suggestions WHERE id = ?'),
  insertSug: db.prepare('INSERT INTO lepocine_round_suggestions (round_id, user_id, user_name, title, title_key, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  deleteSug: db.prepare('DELETE FROM lepocine_round_suggestions WHERE id = ?'),
  deleteSugByRound: db.prepare('DELETE FROM lepocine_round_suggestions WHERE round_id = ?'),

  getPanel: db.prepare('SELECT * FROM lepocine_panels WHERE guild_id = ? AND kind = ?'),
  setPanel: db.prepare(`
    INSERT INTO lepocine_panels (guild_id, kind, channel_id, message_id) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, kind) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`),
};

// "El Padrino" == "el  padrino" == "El Pádrino"
const normalize = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** Encuesta abierta del servidor. Si su fecha ya pasó sin elegir película, la marca como vencida. */
function getOpenRound(guildId, nowMs = Date.now()) {
  q.expire.run(guildId, nowMs);
  return q.getOpen.get(guildId) ?? null;
}

function openRound(guildId, { theme, startMs, endMs, openedBy }) {
  const r = q.insertRound.run(guildId, theme ?? null, startMs, endMs, openedBy, Date.now());
  return Number(r.lastInsertRowid);
}

/** Una sugerencia por persona: si ya tenía una en esta encuesta, se reemplaza. */
function addSuggestion(roundId, userId, userName, title) {
  const key = normalize(title);
  const all = q.listSug.all(roundId);

  const dup = all.find((r) => r.title_key === key && r.user_id !== userId);
  if (dup) return { ok: false, reason: 'duplicate', by: dup.user_name };

  const mine = all.filter((r) => r.user_id === userId);
  if (!mine.length && all.length >= cfg.maxSuggestions) return { ok: false, reason: 'full' };

  for (const m of mine) q.deleteSug.run(m.id);
  q.insertSug.run(roundId, userId, userName, title, key, Date.now());
  return { ok: true, replaced: mine[0]?.title ?? null };
}

/** Borra una encuesta y sus sugerencias. */
function deleteRound(roundId) {
  q.deleteSugByRound.run(roundId);
  q.deleteRound.run(roundId);
}

export { getOpenRound, openRound, deleteRound, addSuggestion };
export const getLastRound = (guildId) => q.getLast.get(guildId) ?? null;
export const setRoundStatus = (roundId, status) => q.setStatus.run(status, roundId);
export const finishRound = (roundId, title, suggestedBy, pickedBy, eventId) =>
  q.finish.run(title, suggestedBy, pickedBy, eventId, roundId);
export const listSuggestions = (roundId) => q.listSug.all(roundId);
export const getSuggestion = (id) => q.getSug.get(id) ?? null;
export const getPanel = (guildId, kind) => q.getPanel.get(guildId, kind) ?? null;
export const setPanel = (guildId, kind, channelId, messageId) =>
  q.setPanel.run(guildId, kind, channelId, messageId);
