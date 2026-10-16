const TZ = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (m, y = 2000) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // 2000 = bisiesto (permite 29/02)

function todayInTZ(tz = TZ) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// En años no bisiestos, el 29/02 se celebra el 28/02
function occurrence(day, month, year) {
  if (day === 29 && month === 2 && !isLeap(year)) return Date.UTC(year, 1, 28);
  return Date.UTC(year, month - 1, day);
}

function daysUntil(day, month) {
  const t = todayInTZ();
  const today = Date.UTC(t.year, t.month - 1, t.day);
  let next = occurrence(day, month, t.year);
  if (next < today) next = occurrence(day, month, t.year + 1);
  return Math.round((next - today) / 86_400_000);
}

// ¿Este cumpleaños cae en la fecha dada?
function matchesDate(b, { year, month, day }) {
  return occurrence(b.day, b.month, year) === Date.UTC(year, month - 1, day);
}

export { TZ, isLeap, daysInMonth, todayInTZ, daysUntil, matchesDate };
