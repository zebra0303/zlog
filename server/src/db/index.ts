import Database, { type Database as DatabaseType } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";
import { mkdirSync } from "fs";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "zlog.db");

// Auto-create data directory
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite: DatabaseType = new Database(DB_PATH);

// WAL mode — improves concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
