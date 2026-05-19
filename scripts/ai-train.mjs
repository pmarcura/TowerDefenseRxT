import { build } from "esbuild";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const seed = readNumberArg("--seed", 14729);
const generations = readNumberArg("--generations", 8);
const population = readNumberArg("--population", 28);
const episodesPerPolicy = readNumberArg("--episodes", 60);
const eliteCount = readNumberArg("--elites", 6);
const mutationRate = readNumberArg("--mutation-rate", 0.38);
const mutationScale = readNumberArg("--mutation-scale", 0.18);
const maxSteps = readNumberArg("--max-steps", 280);
const targetWaveCount = readNumberArg("--target-waves", 20);
const promotionEpisodes = readNumberArg("--promotion-episodes", Number.NaN);
const fresh = args.includes("--fresh");
const seedPolicyPath = readStringArg("--seed-policy");
const tmpDir = path.join(rootDir, ".tmp", "ai-train");
const bundledModule = path.join(tmpDir, "evolutionTrainer.mjs");
const reportDir = path.join(rootDir, "reports", "learning");
const championPolicyPath = path.join(reportDir, "champion-policy.json");

await mkdir(tmpDir, { recursive: true });
await mkdir(reportDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, "src", "ai", "learning", "evolutionTrainer.ts")],
  outfile: bundledModule,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  logLevel: "silent"
});

const trainer = await import(`${pathToFileURL(bundledModule).href}?t=${Date.now()}`);
const seedPolicies = await readSeedPolicies();
const report = trainer.trainPolicy({
  seed,
  generations,
  population,
  episodesPerPolicy,
  eliteCount,
  mutationRate,
  mutationScale,
  maxSteps,
  targetWaveCount,
  promotionEpisodes: Number.isFinite(promotionEpisodes) ? promotionEpisodes : undefined,
  seedPolicies
});
const markdown = trainer.formatTrainingMarkdown(report);
const dashboard = trainer.formatTrainingDashboardHtml(report);
const dataset = trainer.formatChampionDatasetJsonl(report);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const files = {
  json: path.join(reportDir, `training-${stamp}.json`),
  md: path.join(reportDir, `training-${stamp}.md`),
  html: path.join(reportDir, `dashboard-${stamp}.html`),
  dataset: path.join(reportDir, `champion-dataset-${stamp}.jsonl`),
  champion: path.join(reportDir, "champion-policy.json"),
  latestJson: path.join(reportDir, "latest.json"),
  latestMd: path.join(reportDir, "latest.md"),
  latestHtml: path.join(reportDir, "dashboard.html"),
  latestDataset: path.join(reportDir, "champion-dataset.jsonl")
};

await writeFile(files.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(files.md, markdown, "utf8");
await writeFile(files.html, dashboard, "utf8");
await writeFile(files.dataset, dataset, "utf8");
await writeFile(files.champion, `${JSON.stringify(report.champion.policy, null, 2)}\n`, "utf8");
await writeFile(files.latestJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(files.latestMd, markdown, "utf8");
await writeFile(files.latestHtml, dashboard, "utf8");
await writeFile(files.latestDataset, dataset, "utf8");

console.log("Aegis self-learning completed.");
console.log(`Champion: ${report.champion.policy.id}`);
console.log(`Champion win rate: ${(report.champion.winRate * 100).toFixed(1)}%.`);
console.log(`Baseline win rate: ${(report.baseline.winRate * 100).toFixed(1)}%.`);
console.log(`Improvement: ${(report.improvement.winRate * 100).toFixed(1)}pp.`);
console.log(`Average waves: ${report.champion.averageWavesCleared.toFixed(2)}.`);
console.log(`Seed policies: ${report.options.seedPolicyIds.join(", ") || "none"}.`);
console.log(`Dashboard: ${path.relative(rootDir, files.latestHtml)}`);
console.log(`Champion policy: ${path.relative(rootDir, files.champion)}`);

async function readSeedPolicies() {
  const policies = [];

  if (seedPolicyPath) {
    policies.push(JSON.parse(await readFile(path.resolve(rootDir, seedPolicyPath), "utf8")));
  }

  if (!fresh && await fileExists(championPolicyPath)) {
    const champion = JSON.parse(await readFile(championPolicyPath, "utf8"));

    if (!policies.some((policy) => policy.id === champion.id)) {
      policies.push(champion);
    }
  }

  return policies;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
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
