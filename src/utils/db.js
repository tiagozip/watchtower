import { Database } from "bun:sqlite";

const db = new Database("./.data/db.sqlite", { create: true });

db.run(`CREATE TABLE IF NOT EXISTS whitelists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild TEXT NOT NULL,
  type TEXT NOT NULL,
  snowflake TEXT NOT NULL
)`);

export default db;
