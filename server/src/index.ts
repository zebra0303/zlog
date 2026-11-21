// Must be imported first so process.env is populated before DB/auth modules initialize
import "./env.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { bootstrap } from "./services/bootstrap.js";
import { startSyncWorker, stopSyncWorker } from "./services/syncService.js";
import { sqlite, analyticsSqlite } from "./db/index.js";

const app = createApp();
const port = Number(process.env.PORT) || 3000;

async function main() {
  await bootstrap();
  startSyncWorker();
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`🦓 zlog server running on port ${port}`);
    console.log(`📋 Environment loaded: ADMIN_EMAIL=${process.env.ADMIN_EMAIL ?? "(not set)"}`);
  });

  // Gracefully stop background workers and flush SQLite WAL on shutdown signals
  const shutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    stopSyncWorker();
    server.close(() => {
      try {
        sqlite.close();
        analyticsSqlite.close();
      } catch {
        // Ignore close errors if already closed
      }
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}

void main();
