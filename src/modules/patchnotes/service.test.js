import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePatchPage } from './service.js';

const OG_IMAGE = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/hero-1920x1080.jpg?w=1200&h=630&fm=webp&fit=crop';
const OG_IMAGE_CLEAN = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/hero-1920x1080.jpg';
const SUMMARY_IMAGE = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/resumen-1920x1080.png';
const SKINS_IMAGE = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/skins-1920x1080.png';

const section = (title, body = '') => `
  <header class="header-primary"><h2 id="sec">${title}</h2></header>
  <div class="content-border"><div class="white-stone accent-before"><div>${body}</div></div></div>`;

const summaryBlock = (src = SUMMARY_IMAGE, attrs = 'width="1920" height="1080"') => `
  <a class="skins cboxElement" target="_blank" href="https://cdn/full.png">
    <span class="content-border"><img src="${src}" ${attrs}></span>
  </a>`;

const championBlock = `<div class="patch-change-block white-stone accent-before"><div>
  <p><a class="reference-link" href="https://leagueoflegends.com/es-mx/champions/ahri/">
  <img src="https://am-a.akamaihd.net/image?f=https://ddragon.leagueoflegends.com/cdn/16.19.1/img/champion/Ahri.png"></a></p>
  <h3 class="change-title">Ahri</h3></div></div>`;

function page(sections, { ogImage = OG_IMAGE } = {}) {
  return `<html><head>
    <meta property="og:title" content="Notas de la versión 26.22" />
    <meta property="og:image" content="${ogImage}" />
  </head><body>
    <p>Introducción de la nota.</p>
    ${sections.join('\n')}
  </body></html>`;
}

test('usa la imagen de resumen de la primera sección', () => {
  const html = page([section('Versión en breve', summaryBlock()), section('Campeones', championBlock)]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, SUMMARY_IMAGE);
});

test('la encuentra aunque haya una sección de actualizaciones antes', () => {
  const html = page([
    section('Actualizaciones dentro de la versión', '<p>Solo texto.</p>'),
    section('Versión en breve', summaryBlock()),
    section('Campeones', championBlock),
  ]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, SUMMARY_IMAGE);
});

test('funciona con cualquier título de sección, sin lista de nombres', () => {
  const html = page([section('Lo mejor de la versión', summaryBlock()), section('Campeones', championBlock)]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, SUMMARY_IMAGE);
});

test('sin imagen de resumen arriba usa la imagen por defecto del artículo', () => {
  // Caso 26.20: la nota arranca con campeones y la única imagen grande está al final.
  const html = page([
    section('Campeones', championBlock),
    section('Objetos', '<p>Sin imágenes.</p>'),
    section('Próximos aspectos y chromas', summaryBlock(SKINS_IMAGE)),
  ]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, OG_IMAGE_CLEAN);
});

test('ignora imágenes chicas de las primeras secciones', () => {
  const small = '<div><img src="https://cmsassets.rgpub.io/autor-143x148.png" width="143" height="148"></div>';
  const html = page([section('Versión en breve', small), section('Campeones', summaryBlock()), section('Objetos')]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, SUMMARY_IMAGE);
});

test('ignora imágenes grandes dentro de bloques de cambios de campeones', () => {
  const html = page([
    section('Campeones', `<div class="patch-change-block"><div>${summaryBlock()}</div></div>`),
    section('Objetos', '<p>Sin imágenes.</p>'),
  ]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, OG_IMAGE_CLEAN);
});

test('detecta el ancho desde el nombre del archivo cuando falta el atributo', () => {
  const html = page([section('Versión en breve', summaryBlock(SUMMARY_IMAGE, ''))]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, SUMMARY_IMAGE);
});

test('sin secciones header-primary cae a la imagen por defecto', () => {
  const html = `<html><head><meta property="og:title" content="Notas" />
    <meta property="og:image" content="${OG_IMAGE}" /></head>
    <body><div><img src="${SUMMARY_IMAGE}" width="1920"></div></body></html>`;
  assert.equal(parsePatchPage(html, 'https://x/y').image, OG_IMAGE_CLEAN);
});

test('la imagen de resumen también pierde los parámetros de recorte', () => {
  const withQuery = `${SUMMARY_IMAGE}?w=1200&h=630&fm=webp`;
  const html = page([section('Versión en breve', summaryBlock(withQuery))]);
  assert.equal(parsePatchPage(html, 'https://x/y').image, SUMMARY_IMAGE);
});

test('ignora placeholders data: y resuelve URLs relativas', () => {
  const body = `<img src="data:image/svg+xml,%3Csvg%3E"><img src="/sanity/resumen-1920x1080.png" width="1920">`;
  const html = page([section('Versión en breve', body)]);
  assert.equal(parsePatchPage(html, 'https://www.leagueoflegends.com/es-mx/news/x').image,
    'https://www.leagueoflegends.com/sanity/resumen-1920x1080.png');
});
