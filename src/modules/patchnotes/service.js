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

  // La imagen viene con parámetros de recorte (y un "?" duplicado): sin ellos es la imagen original
  let image = metaContent(html, 'og:image');
  if (image) {
    try {
      const u = new URL(image);
      u.search = '';
      image = u.href;
    } catch {
      image = null;
    }
  }

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
