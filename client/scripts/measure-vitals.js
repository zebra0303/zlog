import { spawn } from "child_process";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4173;
const URL = `http://localhost:${PORT}`;
const OUTPUT_FILE = path.resolve(__dirname, "../../.ai-vitals.md");

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Server did not start in time");
}

async function runLighthouse() {
  console.log("Building project and starting preview server...");
  const serverProcess = spawn(
    "npm",
    ["run", "build", "&&", "npm", "run", "preview", "--", "--port", PORT.toString()],
    {
      stdio: "ignore",
      shell: true,
    },
  );

  let chrome;
  try {
    await waitForServer();
    console.log(`Server is ready at ${URL}. Running Lighthouse...`);

    chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
    const options = {
      logLevel: "error", // Only log errors to keep console output clean
      output: "json",
      onlyCategories: ["performance"],
      port: chrome.port,
    };
    const runnerResult = await lighthouse(URL, options);

    const lhr = runnerResult.lhr;
    const score = lhr.categories.performance.score * 100;
    const lcp = lhr.audits["largest-contentful-paint"].displayValue;
    const cls = lhr.audits["cumulative-layout-shift"].displayValue;
    const tbt = lhr.audits["total-blocking-time"].displayValue;
    const fcp = lhr.audits["first-contentful-paint"].displayValue;

    // Print only Core Metrics to the console
    console.log("\n📊 Core Metrics:");
    console.log(`- Performance Score: ${score}`);
    console.log(`- LCP: ${lcp}`);
    console.log(`- CLS: ${cls}`);
    console.log(`- TBT: ${tbt}`);
    console.log(`- FCP: ${fcp}\n`);

    const markdownContent = `
# Lighthouse Performance Vitals

*Date: ${new Date().toISOString()}*
*Target: Local Preview Server*

## Core Metrics
- **Performance Score**: ${score}
- **Largest Contentful Paint (LCP)**: ${lcp}
- **Cumulative Layout Shift (CLS)**: ${cls}
- **Total Blocking Time (TBT)**: ${tbt}
- **First Contentful Paint (FCP)**: ${fcp}

> **AI Instruction**: Always check these metrics before making structural or rendering changes. Your goal is to keep the Performance Score high and CLS/LCP as low as possible.
`;

    await fs.writeFile(OUTPUT_FILE, markdownContent.trim(), "utf8");
    console.log(`Vitals saved to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error("Error running Lighthouse:", err);
    process.exitCode = 1;
  } finally {
    if (chrome) {
      await chrome.kill();
    }
    console.log("Stopping preview server...");
    serverProcess.kill();
  }
}

runLighthouse();
