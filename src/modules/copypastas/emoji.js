const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const stripVariation = (s) => s.replace(/\uFE0F/g, '');

const CUSTOM = /^<(a?):(\w{2,32}):(\d{17,20})>$/; // <:nombre:id> o <a:nombre:id>
const BY_NAME = /^:(\w{2,32}):$/; // :nombre:
const UNICODE_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)/u;

/**
 * Interpreta el emoji que escribió el admin.
 * Acepta un emoji común, uno personalizado pegado como <:nombre:id>, o :nombre: de un emoji del servidor.
 * Devuelve { ok: true, value } (value es lo que se guarda) o { ok: false, error }.
 */
export function parseEmojiInput(text, guild) {
  const raw = text.trim();
  if (!raw) return { ok: false, error: 'Escribí un emoji.' };

  if (CUSTOM.test(raw)) return { ok: true, value: raw };

  const byName = raw.match(BY_NAME);
  if (byName) {
    const found = guild?.emojis?.cache.find((e) => e.name === byName[1]);
    if (!found) return { ok: false, error: `No encuentro un emoji llamado \`${raw}\` en este servidor.` };
    return { ok: true, value: found.toString() };
  }

  const graphemes = [...segmenter.segment(raw)];
  if (graphemes.length === 1 && UNICODE_EMOJI.test(raw)) return { ok: true, value: raw };

  return { ok: false, error: 'No reconocí un emoji. Pegá uno solo: un emoji común o uno personalizado del servidor.' };
}

/** ¿El emoji de una reacción es el que está guardado en la configuración? */
export function emojiMatches(reactionEmoji, stored) {
  const custom = stored.match(CUSTOM);
  if (custom) return reactionEmoji.id === custom[3];
  return !reactionEmoji.id && stripVariation(reactionEmoji.name ?? '') === stripVariation(stored);
}
