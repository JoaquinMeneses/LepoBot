import cron from 'node-cron';
import { Events } from 'discord.js';
import globalConfig from '../../core/config.js';
import cfg from './config.js';
import * as service from './service.js';
import { updatePanel } from './panel.js';

const log = (err) => console.error('[tagrole]', err);

async function syncAll(client) {
  for (const guild of client.guilds.cache.values()) {
    await service.syncGuild(client, guild).catch(log);
    await updatePanel(client, guild.id);
  }
}

export function register(client) {
  // Tiempo real: Discord avisa cuando cambia un miembro, incluida su etiqueta
  client.on(Events.Raw, (packet) => {
    if (packet.t !== 'GUILD_MEMBER_UPDATE') return; // filtro rápido: pasan todos los eventos del Gateway por acá
    service.handleRaw(client, packet).catch(log);
  });

  // Al arrancar: se ponen al día los cambios ocurridos con el bot apagado
  client.once(Events.ClientReady, () => syncAll(client).catch(log));

  // Barrido diario de seguridad
  if (cfg.dailySyncHour != null) {
    cron.schedule(`0 ${cfg.dailySyncHour} * * *`, () => syncAll(client).catch(log), { timezone: globalConfig.TZ });
  }
}
