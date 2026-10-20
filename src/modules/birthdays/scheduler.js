import cron from 'node-cron';
import * as repo from './repo.js';
import { TZ, todayInTZ, matchesDate } from './dates.js';

export async function announceToday(client) {
  const today = todayInTZ();

  for (const { guild_id, birthday_channel_id } of repo.guildChannels()) {
    const cumpleaneros = repo.allInGuild(guild_id).filter((b) => matchesDate(b, today));
    if (!cumpleaneros.length) continue;

    try {
      const channel = await client.channels.fetch(birthday_channel_id);
      const menciones = cumpleaneros.map((b) => {
        const edad = b.year ? ` (${today.year - b.year})` : '';
        return `<@${b.user_id}>${edad}`;
      }).join(', ');
      await channel.send(`🎉 ¡Feliz cumpleaños ${menciones}! 🎂`);
    } catch (err) {
      console.error(`[cumples] no pude enviar en guild ${guild_id}:`, err.message);
    }
  }
}

export function start(client) {
  const hour = 9;
  cron.schedule(`0 ${hour} * * *`, () => announceToday(client), { timezone: TZ });
  console.log(`[cumples] saludos diarios a las ${hour}:00 (${TZ})`);
}
