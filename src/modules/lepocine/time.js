import cfg from './config.js';

// Fecha/hora "de pared" de un instante en una zona horaria
export function partsInTZ(epochMs, tz = cfg.TZ) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(epochMs));
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return { year: g('year'), month: g('month'), day: g('day'), hour: g('hour'), minute: g('minute') };
}

function offsetMs(epochMs, tz) {
  const p = partsInTZ(epochMs, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(epochMs / 60000) * 60000;
}

// Instante UTC (ms) que corresponde a una fecha/hora de pared en la zona horaria
export function zonedEpoch(y, m, d, h, min, tz = cfg.TZ) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let e = guess - offsetMs(guess, tz);
  e = guess - offsetMs(e, tz); // segunda pasada por si hay cambio de horario
  return e;
}

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' de un instante, en la zona horaria del bot. */
export function dateKey(epochMs) {
  const p = partsInTZ(epochMs);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// ---------- Lo que escribe el equipo en el formulario ----------

const DAY_MS = 86_400_000;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** "21", "21:00", "21.30", "21h", "21hs", "21h30" -> { hour, minute } */
export function parseTime(text) {
  const m = norm(text).match(/^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(?:hs?|hrs?)?$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const validDate = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/**
 * Interpreta día y hora escritos por una persona.
 *   día:  "viernes" | "hoy" | "mañana" | "17/10" | "17/10/2026"
 *   hora: "21" | "21:00" | "21h30"
 * Devuelve { ok: true, startMs, endMs } o { ok: false, error }.
 */
export function resolveStart(dayText, timeText, nowMs = Date.now()) {
  const time = parseTime(timeText);
  if (!time) return { ok: false, error: 'No entendí la hora. Probá con `21:00` o `21`.' };

  const n = partsInTZ(nowMs);
  const todayUTC = Date.UTC(n.year, n.month - 1, n.day);
  const startAt = (y, m, d) => zonedEpoch(y, m, d, time.hour, time.minute);
  const inDays = (add) => {
    const d = new Date(todayUTC + add * DAY_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  };

  const text = norm(dayText);
  let date;

  if (text === 'hoy') {
    date = inDays(0);
  } else if (text === 'manana') {
    date = inDays(1);
  } else if (text in WEEKDAYS) {
    const add = (WEEKDAYS[text] - new Date(todayUTC).getUTCDay() + 7) % 7;
    date = inDays(add);
    // "viernes" dicho un viernes después de la hora: se entiende el viernes siguiente
    if (startAt(date.y, date.m, date.d) <= nowMs) date = inDays(add + 7);
  } else {
    const m = text.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/);
    if (!m) return { ok: false, error: 'No entendí el día. Probá con `viernes`, `mañana` o `17/10`.' };

    const d = Number(m[1]);
    const mo = Number(m[2]);
    let year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : n.year;
    if (!validDate(year, mo, d)) return { ok: false, error: 'Esa fecha no existe.' };

    // Sin año y ya pasó este año: se entiende el año que viene
    if (!m[3] && startAt(year, mo, d) <= nowMs) {
      year += 1;
      if (!validDate(year, mo, d)) return { ok: false, error: 'Esa fecha no existe.' };
    }
    date = { y: year, m: mo, d };
  }

  const startMs = startAt(date.y, date.m, date.d);
  if (startMs <= nowMs) return { ok: false, error: 'Esa fecha y hora ya pasaron.' };
  if (startMs - nowMs > cfg.maxDaysAhead * DAY_MS) {
    return { ok: false, error: `Esa fecha está a más de ${cfg.maxDaysAhead} días. ¿Está bien escrita?` };
  }
  return { ok: true, startMs, endMs: startMs + cfg.durationMinutes * 60_000 };
}
