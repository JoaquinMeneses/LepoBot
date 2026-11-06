import cfg from './config.js';

// ---------- Utilidades de HTML (sin dependencias) ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (all, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(Number(dec));
    return ENTITIES[name.toLowerCase()] ?? all;
  });
}

/** Contenido de <meta property="og:xxx" content="..."> (acepta cualquier orden de atributos). */
export function metaContent(html, prop) {
  const tag = html.match(new RegExp(`<meta\\s[^>]*?(?:property|name)=["']${prop}["'][^>]*>`, 'i'))?.[0];
  if (!tag) return null;
  const content = tag.match(/content=(?:"([^"]*)"|'([^']*)')/i);
  const value = content ? (content[1] ?? content[2]) : null;
  return value ? decodeEntities(value).trim() : null;
}

// ---------- Imagen de la nota de parche ----------

// Las imágenes de resumen que publica Riot son grandes (1920x1080); los iconos de
// campeón/hechizo y las fotos de autor son chicos y no llevan estas dimensiones.
const MIN_SUMMARY_WIDTH = 1200;

// La sección de resumen siempre es una de las dos primeras del artículo: a veces Riot
// antepone "Actualizaciones dentro de la versión".
const SUMMARY_SECTION_WINDOW = 2;

const IMAGE_EXT = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const URL_DIMENSIONS = /-(\d{2,5})x(\d{2,5})\.(?:png|jpe?g|webp|avif)(?:$|[?#])/i;

/** Ancho de la imagen: el atributo width o el que viene en el nombre del archivo. */
function imageWidth(src, attrs) {
  const attr = Number(attrs.match(/\bwidth=["']?(\d+)/i)?.[1] ?? 0);
  const fromUrl = Number(src.split('?')[0].match(URL_DIMENSIONS)?.[1] ?? 0);
  return Math.max(attr, fromUrl);
}

/** Imágenes de una sección, salteando las que están dentro de un bloque de cambios. */
function imagesOutsideChangeBlocks(sectionHtml) {
  const images = [];
  let divDepth = 0;
  let blockDepth = -1; // profundidad de divs del patch-change-block abierto, o -1

  for (const m of sectionHtml.matchAll(/<(\/?)(div|img)\b([^>]*)>/gi)) {
    const [, closing, rawName, attrs] = m;

    if (rawName.toLowerCase() === 'div') {
      if (closing) {
        if (blockDepth !== -1 && divDepth === blockDepth) blockDepth = -1;
        divDepth = Math.max(0, divDepth - 1);
      } else {
        divDepth++;
        if (blockDepth === -1 && /class=["'][^"']*patch-change-block/i.test(attrs)) blockDepth = divDepth;
      }
      continue;
    }

    if (closing || blockDepth !== -1) continue;
    const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!src || src.startsWith('data:')) continue;
    images.push({ src: decodeEntities(src).trim(), width: imageWidth(src, attrs) });
  }
  return images;
}

/** Parte el artículo en secciones de nivel superior (cada <header class="header-primary">). */
function splitSections(html) {
  const starts = [...html.matchAll(/<header\s+class=["']header-primary["']/gi)].map((m) => m.index);
  return starts.map((start, i) => html.slice(start, i + 1 < starts.length ? starts[i + 1] : html.length));
}

/**
 * Imagen que resume la versión: la imagen grande de una de las primeras secciones del
 * artículo. No se busca por título porque Riot lo cambia ("Versión en breve", "Lo mejor
 * de la versión"). Devuelve null si el artículo no tiene una, para que el que llama use
 * la imagen por defecto del artículo.
 */
export function findSummaryImage(html) {
  for (const sectionHtml of splitSections(html).slice(0, SUMMARY_SECTION_WINDOW)) {
    const image = imagesOutsideChangeBlocks(sectionHtml).find((i) => i.width >= MIN_SUMMARY_WIDTH);
    if (image) return image.src;
  }
  return null;
}

/** Normaliza una URL de imagen; los parámetros de recorte de Riot se descartan. */
function cleanImageUrl(url, base) {
  if (!url) return null;
  try {
    const u = new URL(url, base);
    if (IMAGE_EXT.test(u.pathname)) u.search = '';
    return u.href;
  } catch {
    return null;
  }
}

// ---------- Interpretar las páginas de Riot ----------

// Enlaces como /es-mx/news/game-updates/league-of-legends-patch-26-22-notes (también el formato viejo notas-de-la-version-12-22)
const PATCH_LINK = /href=["']([^"']*(?:patch-(\d+)-(\d+)-notes|notas-de-la-version-(\d+)-(\d+))[^"']*)["']/gi;

/**
 * Busca en el listado el parche de LoL más nuevo (por número de versión, no por el orden de la página).
 * Devuelve { url, major, minor } o null si no encuentra ninguno.
 */
export function findLatestPatch(html, pageUrl) {
  let best = null;
  for (const m of html.matchAll(PATCH_LINK)) {
    const href = decodeEntities(m[1]);
    if (/teamfight|\btft\b/i.test(href)) continue; // las notas de TFT son otro producto
    const major = Number(m[2] ?? m[4]);
    const minor = Number(m[3] ?? m[5]);
    if (!best || major > best.major || (major === best.major && minor > best.minor)) {
      best = { href, major, minor };
    }
  }
  if (!best) return null;
  return { url: new URL(best.href, pageUrl).href, major: best.major, minor: best.minor };
}

/** Lee título, resumen e imagen de la página de un parche. */
export function parsePatchPage(html, url) {
  const title = metaContent(html, 'og:title')
    ?? decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  if (!title) throw new Error('la página del parche no tiene título');

  const description = metaContent(html, 'og:description') ?? metaContent(html, 'description') ?? '';

  // Primero la imagen de resumen del artículo; si no tiene, se usa la imagen por
  // defecto del artículo (og:image, sin los parámetros de recorte).
  const image = cleanImageUrl(findSummaryImage(html) ?? metaContent(html, 'og:image'), url);

  const canonical = metaContent(html, 'og:url') ?? url;
  return { title, description, image, url: canonical };
}

// ---------- Pedidos a la web de Riot ----------

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': cfg.userAgent,
      'accept-language': 'es-MX,es;q=0.9',
      accept: 'text/html',
    },
    signal: AbortSignal.timeout(cfg.timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  return res.text();
}

async function fetchLatestPatch() {
  const listHtml = await fetchHtml(cfg.listUrl);
  const latest = findLatestPatch(listHtml, cfg.listUrl);
  if (!latest) throw new Error('no encontré enlaces a notas de parche en el listado (¿cambió la página de Riot?)');

  const patchHtml = await fetchHtml(latest.url);
  const patch = parsePatchPage(patchHtml, latest.url);
  return { ...patch, version: `${latest.major}.${latest.minor}` };
}

// ---------- Caché: no se consulta a Riot en cada comando ----------

const cache = { value: null, at: 0, pending: null };

/**
 * Devuelve las últimas notas de parche { title, description, image, url, version, stale? }.
 * Se guardan en memoria durante cfg.cacheMinutes. Si Riot falla pero hay una copia anterior, se usa esa.
 */
export function getLatestPatch() {
  if (cache.value && Date.now() - cache.at < cfg.cacheMinutes * 60_000) return Promise.resolve(cache.value);
  if (cache.pending) return cache.pending; // varios comandos a la vez comparten un solo pedido

  cache.pending = fetchLatestPatch()
    .then((value) => {
      cache.value = value;
      cache.at = Date.now();
      return value;
    })
    .catch((err) => {
      if (!cache.value) throw err;
      console.warn('[parche] no pude actualizar, uso la copia anterior:', err.message);
      return { ...cache.value, stale: true };
    })
    .finally(() => {
      cache.pending = null;
    });
  return cache.pending;
}

/** Solo para pruebas. */
export function clearCache() {
  cache.value = null;
  cache.at = 0;
  cache.pending = null;
}
