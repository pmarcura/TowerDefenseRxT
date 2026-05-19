import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const seed = readNumberArg("--seed", 14729);
const balanceRuns = readNumberArg("--balance-runs", 1200);
const aiEpisodes = readNumberArg("--ai-episodes", 1000);
const bugHunterEpisodes = readNumberArg("--bughunter-episodes", 1000);
const maxSteps = readNumberArg("--max-steps", 260);
const aiBot = readStringArg("--ai-bot") ?? "greedy";
const tmpDir = path.join(rootDir, ".tmp", "lab-report");
const bundledModule = path.join(tmpDir, "createGameLabReport.mjs");
const reportDir = path.join(rootDir, "reports", "lab");
const humanLearningPath = readStringArg("--human-learning") ?? path.join(rootDir, "reports", "human", "learning-dataset.jsonl");

await mkdir(tmpDir, { recursive: true });
await mkdir(reportDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, "src", "lab", "reports", "createGameLabReport.ts")],
  outfile: bundledModule,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  logLevel: "silent"
});

const lab = await import(`${pathToFileURL(bundledModule).href}?t=${Date.now()}`);
const humanLearningJsonl = await readOptionalFile(humanLearningPath);
const report = lab.createGameLabReport({
  seed,
  balanceRuns,
  aiBot,
  aiEpisodes,
  bugHunterEpisodes,
  maxSteps,
  humanLearningJsonl
});
const rows = lab.createLearningRows(report.balance, report.ai, report.qa, report.insights);
const markdown = lab.formatGameLabMarkdown(report);
const dashboard = lab.formatGameLabDashboardHtml(report);
const learningJsonl = lab.formatLearningJsonl(rows);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const files = {
  json: path.join(reportDir, `lab-${stamp}.json`),
  markdown: path.join(reportDir, `lab-${stamp}.md`),
  dashboard: path.join(reportDir, `dashboard-${stamp}.html`),
  dataset: path.join(reportDir, `learning-dataset-${stamp}.jsonl`),
  latestJson: path.join(reportDir, "latest.json"),
  latestMarkdown: path.join(reportDir, "latest.md"),
  latestDashboard: path.join(reportDir, "dashboard.html"),
  latestDataset: path.join(reportDir, "learning-dataset.jsonl")
};

await writeFile(files.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(files.markdown, markdown, "utf8");
await writeFile(files.dashboard, dashboard, "utf8");
await writeFile(files.dataset, learningJsonl, "utf8");
await writeFile(files.latestJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(files.latestMarkdown, markdown, "utf8");
await writeFile(files.latestDashboard, dashboard, "utf8");
await writeFile(files.latestDataset, learningJsonl, "utf8");

console.log(`Aegis Lab report generated.`);
console.log(`Health score: ${report.metrics.healthScore}/100 (${report.metrics.releaseReadiness}).`);
console.log(`Balance win rate: ${(report.metrics.balanceWinRate * 100).toFixed(1)}%.`);
console.log(`AI win rate: ${(report.metrics.aiWinRate * 100).toFixed(1)}%.`);
console.log(`QA invariants: ${report.metrics.qaInvariantFailures}.`);
console.log(`Learning rows: ${report.learning.rows}.`);
console.log(`Human learning rows: ${report.learning.humanRows}.`);
console.log(`Dashboard: ${path.relative(rootDir, files.latestDashboard)}`);
console.log(`Dataset: ${path.relative(rootDir, files.latestDataset)}`);

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function readNumberArg(name, fallback) {
  const value = readStringArg(name);
  const parsed = value ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStringArg(name) {
  const index = args.indexOf(name);

  if (index >= 0) {
    return args[index + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${name}=`));

  return inline ? inline.slice(name.length + 1) : undefined;
}
