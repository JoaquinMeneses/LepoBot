import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dir = path.join(__dirname, "..", "..", "data");
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, "bot.sqlite"));
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    day      INTEGER NOT NULL,
    month    INTEGER NOT NULL,
    year     INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    birthday_channel_id TEXT
  );
`);

export default db;
