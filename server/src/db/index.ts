import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";
import { mkdirSync } from "fs";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "zlog.db");

// data 디렉토리 자동 생성
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

// WAL mode — 동시 읽기 성능 향상
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
