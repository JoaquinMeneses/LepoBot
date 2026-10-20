import cron from 'node-cron';
import cfg from './config.js';
import * as service from './service.js';

const log = (e) => console.error('[lepocine]', e);

export function start(client) {
  if (!cfg.channelId || !cfg.staffChannelId) {
    console.warn('[lepocine] faltan el canal público (LEPOCINE_CHANNEL_ID) o el del equipo (staffChannelId): módulo inactivo');
    return;
  }
  const opts = { timezone: cfg.TZ };

  // Lunes: llega al canal del equipo el aviso para abrir la encuesta
  cron.schedule(`0 ${cfg.mondayHour} * * 1`, () => service.mondayPrompt(client).catch(log), opts);
  // Todos los días: recordatorio para elegir película (solo si hay sugerencias sin elegir)
  cron.schedule(`0 ${cfg.reminderHour} * * *`, () => service.dailyReminder(client).catch(log), opts);

  console.log(`[lepocine] aviso: lunes ${cfg.mondayHour}:00 · recordatorio: todos los días ${cfg.reminderHour}:00 (${cfg.TZ})`);
}
