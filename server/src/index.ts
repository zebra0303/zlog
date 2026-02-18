// .env loading: already loaded via tsx --env-file=../.env
// Production fallback: explicitly specify path with dotenv
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
// Explicitly load root .env (duplicates are ignored if already loaded via --env-file)
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { bootstrap } from "./services/bootstrap.js";
import { startSyncWorker } from "./services/syncService.js";

const app = createApp();
const port = Number(process.env.PORT) || 3000;

function main() {
  bootstrap();
  startSyncWorker();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`🦓 zlog server running on port ${port}`);
    console.log(`📋 Environment loaded: ADMIN_EMAIL=${process.env.ADMIN_EMAIL ?? "(not set)"}`);
  });
}

main();
