// Load root .env before any other module evaluates process.env (avoids ESM import hoisting issues)
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });
