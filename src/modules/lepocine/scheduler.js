const cron = require('node-cron');
const { Events } = require('discord.js');
const cfg = require('./config');
const service = require('./service');
const { nextFriday } = require('./time');

const log = (e) => console.error('[lepocine]', e);

function start(client) {
  if (!cfg.channelId) {
    console.warn('[lepocine] falta LEPOCINE_CHANNEL_ID en el .env: el módulo queda inactivo');
    return;
  }
  const opts = { timezone: cfg.TZ };

  // Lunes: panel nuevo
  cron.schedule(`0 ${cfg.panelHour} * * 1`, () => service.newWeek(client).catch(log), opts);
  // Miércoles: crea el evento (o avisa al equipo si nadie eligió)
  cron.schedule(`0 ${cfg.eventHour} * * 3`, () => service.processWeek(client, { warnIfMissing: true }).catch(log), opts);

  // Si el bot estuvo caído el miércoles, lo recupera al arrancar
  client.once(Events.ClientReady, () => {
    if (Date.now() >= nextFriday().cutoffMs) service.processWeek(client).catch(log);
  });

  console.log(`[lepocine] panel: lunes ${cfg.panelHour}:00 · evento: miércoles ${cfg.eventHour}:00 (${cfg.TZ})`);
}

module.exports = { start };
