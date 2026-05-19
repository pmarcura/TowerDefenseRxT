import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const runs = readNumberArg("--runs", 1000);
const seed = readNumberArg("--seed", 14729);
const profiles = readStringArg("--profiles");
const tmpDir = path.join(rootDir, ".tmp", "balance-sim");
const bundledModule = path.join(tmpDir, "headlessSimulator.mjs");
const reportDir = path.join(rootDir, "reports", "balance");

await mkdir(tmpDir, { recursive: true });
await mkdir(reportDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, "src", "game", "simulation", "headlessSimulator.ts")],
  outfile: bundledModule,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  logLevel: "silent"
});

const simulator = await import(`${pathToFileURL(bundledModule).href}?t=${Date.now()}`);
const options = {
  runs,
  seed,
  profiles: profiles ? profiles.split(",").map((value) => value.trim()).filter(Boolean) : undefined
};
const report = simulator.runBalanceSimulation(options);
const markdown = simulator.formatBalanceReport(report);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = path.join(reportDir, `balance-${stamp}.json`);
const mdPath = path.join(reportDir, `balance-${stamp}.md`);
const latestJsonPath = path.join(reportDir, "latest.json");
const latestMdPath = path.join(reportDir, "latest.md");

await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(mdPath, markdown, "utf8");
await writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(latestMdPath, markdown, "utf8");

console.log(`Simulated ${report.runs} runs with seed ${report.seed}.`);
console.log(`Win rate: ${(report.winRate * 100).toFixed(1)}%.`);
console.log(`Average waves cleared: ${report.averageWavesCleared.toFixed(2)}.`);
console.log(`Markdown report: ${path.relative(rootDir, latestMdPath)}`);
console.log(`JSON report: ${path.relative(rootDir, latestJsonPath)}`);

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
