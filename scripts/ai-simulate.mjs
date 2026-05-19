import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const bot = readStringArg("--bot") ?? "random";
const episodes = readNumberArg("--episodes", 1000);
const seed = readNumberArg("--seed", 14729);
const maxSteps = readNumberArg("--max-steps", 260);
const policyPath = readStringArg("--policy");
const tmpDir = path.join(rootDir, ".tmp", "ai-sim");
const bundledModule = path.join(tmpDir, "runAiSimulation.mjs");
const reportDir = path.join(rootDir, "reports", "ai");

await mkdir(tmpDir, { recursive: true });
await mkdir(reportDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, "src", "ai", "reports", "runAiSimulation.ts")],
  outfile: bundledModule,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  logLevel: "silent"
});

const simulator = await import(`${pathToFileURL(bundledModule).href}?t=${Date.now()}`);
const policy = policyPath
  ? JSON.parse(await readFile(path.resolve(rootDir, policyPath), "utf8"))
  : undefined;
const report = simulator.runAiSimulation({ bot, episodes, seed, maxSteps, policy });
const markdown = simulator.formatAiSimulationReport(report);
const dashboard = simulator.formatAiDashboardHtml(report);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = path.join(reportDir, `ai-${stamp}.json`);
const mdPath = path.join(reportDir, `ai-${stamp}.md`);
const htmlPath = path.join(reportDir, `dashboard-${stamp}.html`);
const latestJsonPath = path.join(reportDir, "latest.json");
const latestMdPath = path.join(reportDir, "latest.md");
const latestHtmlPath = path.join(reportDir, "dashboard.html");

await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(mdPath, markdown, "utf8");
await writeFile(htmlPath, dashboard, "utf8");
await writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(latestMdPath, markdown, "utf8");
await writeFile(latestHtmlPath, dashboard, "utf8");

console.log(`AI simulated ${report.episodes} episodes with ${report.bot}.`);
console.log(`Win rate: ${(report.winRate * 100).toFixed(1)}%.`);
console.log(`Timeout rate: ${(report.timeoutRate * 100).toFixed(1)}%.`);
console.log(`Invalid actions: ${report.invalidActions}.`);
console.log(`Invariant failures: ${report.invariantFailures}.`);
console.log(`Dashboard: ${path.relative(rootDir, latestHtmlPath)}`);

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
