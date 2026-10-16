const db = require('../../core/db');
const cfg = require('./config');

db.exec(`
  CREATE TABLE IF NOT EXISTS lepocine_suggestions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL,
    title      TEXT NOT NULL,
    title_key  TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open',   -- open | picked | archived
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lepocine_nights (
    guild_id      TEXT NOT NULL,
    friday        TEXT NOT NULL,               -- YYYY-MM-DD de la función
    title         TEXT NOT NULL,
    suggestion_id INTEGER,
    suggested_by  TEXT,
    picked_by     TEXT NOT NULL,
    event_id      TEXT,
    PRIMARY KEY (guild_id, friday)
  );

  -- un panel por tipo: 'public' (sugerir) y 'staff' (elegir)
  CREATE TABLE IF NOT EXISTS lepocine_panels (
    guild_id   TEXT NOT NULL,
    kind       TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, kind)
  );
`);

// Migración: el panel único de la versión anterior pasa a ser el panel público
try {
  db.exec(`INSERT OR IGNORE INTO lepocine_panels (guild_id, kind, channel_id, message_id)
           SELECT guild_id, 'public', channel_id, message_id FROM lepocine_panel`);
} catch { /* instalación nueva: no existe la tabla anterior */ }

const q = {
  listOpen: db.prepare("SELECT * FROM lepocine_suggestions WHERE guild_id = ? AND status = 'open' ORDER BY id"),
  getSuggestion: db.prepare('SELECT * FROM lepocine_suggestions WHERE id = ?'),
  insert: db.prepare('INSERT INTO lepocine_suggestions (guild_id, user_id, user_name, title, title_key, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  deleteById: db.prepare('DELETE FROM lepocine_suggestions WHERE id = ?'),
  setStatus: db.prepare('UPDATE lepocine_suggestions SET status = ? WHERE id = ?'),
  archiveOpen: db.prepare("UPDATE lepocine_suggestions SET status = 'archived' WHERE guild_id = ? AND status = 'open'"),

  getNight: db.prepare('SELECT * FROM lepocine_nights WHERE guild_id = ? AND friday = ?'),
  upsertNight: db.prepare(`
    INSERT INTO lepocine_nights (guild_id, friday, title, suggestion_id, suggested_by, picked_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, friday) DO UPDATE SET
      title = excluded.title, suggestion_id = excluded.suggestion_id,
      suggested_by = excluded.suggested_by, picked_by = excluded.picked_by`),
  deleteNight: db.prepare('DELETE FROM lepocine_nights WHERE guild_id = ? AND friday = ?'),
  setNightEvent: db.prepare('UPDATE lepocine_nights SET event_id = ? WHERE guild_id = ? AND friday = ?'),

  getPanel: db.prepare('SELECT * FROM lepocine_panels WHERE guild_id = ? AND kind = ?'),
  setPanel: db.prepare(`
    INSERT INTO lepocine_panels (guild_id, kind, channel_id, message_id) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, kind) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`),
};

// "El Padrino" == "el  padrino" == "El Pádrino"
const normalize = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** Una sugerencia por persona: si ya tenía una abierta, se reemplaza. */
function addSuggestion(guildId, userId, userName, title) {
  const key = normalize(title);
  const open = q.listOpen.all(guildId);

  const dup = open.find((r) => r.title_key === key && r.user_id !== userId);
  if (dup) return { ok: false, reason: 'duplicate', by: dup.user_name };

  const mine = open.filter((r) => r.user_id === userId);
  if (!mine.length && open.length >= cfg.maxSuggestions) return { ok: false, reason: 'full' };

  for (const m of mine) q.deleteById.run(m.id);
  q.insert.run(guildId, userId, userName, title, key, Date.now());
  return { ok: true, replaced: mine[0]?.title ?? null };
}

/** Marca una sugerencia como elegida para la función `friday`. Devuelve la sugerencia o null. */
function pickSuggestion(guildId, friday, suggestionId, pickedBy) {
  const s = q.getSuggestion.get(suggestionId) ?? null;
  if (!s || s.guild_id !== guildId || s.status !== 'open') return null;

  // Si ya había otra elegida para esa función, vuelve a la lista
  const prev = q.getNight.get(guildId, friday);
  if (prev?.suggestion_id) {
    const old = q.getSuggestion.get(prev.suggestion_id);
    if (old?.status === 'picked') q.setStatus.run('open', old.id);
  }

  q.setStatus.run('picked', s.id);
  q.upsertNight.run(guildId, friday, s.title, s.id, s.user_name, pickedBy);
  return s;
}

/** Deshace la elección de una función: la película vuelve a la lista y se borra el registro. */
function resetNight(guildId, friday) {
  const night = q.getNight.get(guildId, friday);
  if (!night) return null;
  if (night.suggestion_id) {
    const s = q.getSuggestion.get(night.suggestion_id);
    if (s?.status === 'picked') q.setStatus.run('open', s.id);
  }
  q.deleteNight.run(guildId, friday);
  return night;
}

module.exports = {
  resetNight,
  listOpen: (guildId) => q.listOpen.all(guildId),
  getSuggestion: (id) => q.getSuggestion.get(id) ?? null,
  addSuggestion,
  pickSuggestion,
  archiveOpen: (guildId) => q.archiveOpen.run(guildId),
  getNight: (guildId, friday) => q.getNight.get(guildId, friday) ?? null,
  setNightEvent: (guildId, friday, eventId) => q.setNightEvent.run(eventId, guildId, friday),
  getPanel: (guildId, kind) => q.getPanel.get(guildId, kind) ?? null,
  setPanel: (guildId, kind, channelId, messageId) => q.setPanel.run(guildId, kind, channelId, messageId),
};
