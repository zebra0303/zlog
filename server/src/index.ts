// .env 로딩: tsx --env-file=../.env 로 이미 로드됨
// 프로덕션 fallback: dotenv로 명시적 경로 지정
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
// 루트 .env를 명시적으로 로드 (--env-file로 이미 로드된 경우 중복은 무시됨)
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
    console.log(`🦓 zlog 서버가 포트 ${port}에서 실행 중입니다.`);
    console.log(`📋 환경변수 로드됨: ADMIN_EMAIL=${process.env.ADMIN_EMAIL ?? "(미설정)"}`);
  });
}

main();
