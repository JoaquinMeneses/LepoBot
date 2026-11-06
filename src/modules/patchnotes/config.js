export default {
  // Página con el listado de notas de la versión de League of Legends (LAS / es-mx).
  // Los enlaces de cada parche se resuelven a partir de esta URL, no hace falta un dominio base aparte.
  listUrl: 'https://www.leagueoflegends.com/es-mx/news/tags/patch-notes/',

  // Cada cuántos minutos se vuelve a consultar la web de Riot. Entre medio se responde desde memoria.
  cacheMinutes: 30,
  // Tiempo máximo de espera por cada pedido a la web de Riot
  timeoutMs: 8000,
  userAgent: 'LepoBot/1.0 (bot de Discord de la comunidad de Lepore)',

  // Largo máximo del resumen que se muestra
  maxDescription: 400,
};
