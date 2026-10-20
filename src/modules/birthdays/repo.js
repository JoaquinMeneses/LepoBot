import db from '../../core/db.js';

const q = {
  upsert: db.prepare(`
    INSERT INTO birthdays (guild_id, user_id, day, month, year)
    VALUES (@guildId, @userId, @day, @month, @year)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET day=@day, month=@month, year=@year`),
  get: db.prepare('SELECT * FROM birthdays WHERE guild_id = ? AND user_id = ?'),
  del: db.prepare('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?'),
  allInGuild: db.prepare('SELECT * FROM birthdays WHERE guild_id = ?'),
  setChannel: db.prepare(`
    INSERT INTO guild_settings (guild_id, birthday_channel_id) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET birthday_channel_id = excluded.birthday_channel_id`),
  channels: db.prepare('SELECT guild_id, birthday_channel_id FROM guild_settings WHERE birthday_channel_id IS NOT NULL'),
};

export const set = (guildId, userId, day, month, year) => q.upsert.run({ guildId, userId, day, month, year: year ?? null });
export const get = (guildId, userId) => q.get.get(guildId, userId);
export const remove = (guildId, userId) => q.del.run(guildId, userId).changes > 0;
export const allInGuild = (guildId) => q.allInGuild.all(guildId);
export const setChannel = (guildId, channelId) => q.setChannel.run(guildId, channelId);
export const guildChannels = () => q.channels.all();
