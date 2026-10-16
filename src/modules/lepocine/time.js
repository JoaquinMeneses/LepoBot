const cfg = require('./config');

// Fecha/hora "de pared" de un instante en una zona horaria
function partsInTZ(epochMs, tz = cfg.TZ) {
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
function zonedEpoch(y, m, d, h, min, tz = cfg.TZ) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let e = guess - offsetMs(guess, tz);
  e = guess - offsetMs(e, tz); // segunda pasada por si hay cambio de horario
  return e;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Próxima función (viernes) cuyo inicio todavía no pasó.
 * Devuelve: key 'YYYY-MM-DD', inicio/fin en ms y el "cutoff" (miércoles a la hora del evento).
 */
function nextFriday(nowMs = Date.now()) {
  const n = partsInTZ(nowMs);
  const weekday = new Date(Date.UTC(n.year, n.month - 1, n.day)).getUTCDay(); // 0 = domingo
  let add = (5 - weekday + 7) % 7;

  const at = (days) => {
    const d = new Date(Date.UTC(n.year, n.month - 1, n.day + days));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  };

  let f = at(add);
  let startMs = zonedEpoch(f.year, f.month, f.day, cfg.start.hour, cfg.start.minute);
  if (startMs <= nowMs) {
    add += 7;
    f = at(add);
    startMs = zonedEpoch(f.year, f.month, f.day, cfg.start.hour, cfg.start.minute);
  }

  const endMs = zonedEpoch(f.year, f.month, f.day, cfg.end.hour, cfg.end.minute);
  const wed = new Date(Date.UTC(f.year, f.month - 1, f.day - 2));
  const cutoffMs = zonedEpoch(wed.getUTCFullYear(), wed.getUTCMonth() + 1, wed.getUTCDate(), cfg.eventHour, 0);

  return { key: `${f.year}-${pad(f.month)}-${pad(f.day)}`, ...f, startMs, endMs, cutoffMs };
}

module.exports = { nextFriday, zonedEpoch, partsInTZ };
