import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const runs = readNumberArg("--runs", 200);
const seed = readNumberArg("--seed", 14729);

const tmpDir = path.join(rootDir, ".tmp", "balance-sim");
const bundledModule = path.join(tmpDir, "headlessSimulator.mjs");
const toolsDir = path.join(rootDir, "tools");
const overridesPath = path.join(rootDir, "server", "balance-overrides.json");
const outputPath = path.join(toolsDir, "latest-balance-results.json");

await mkdir(tmpDir, { recursive: true });
await mkdir(toolsDir, { recursive: true });

// 1. Load overrides if present
let overrides = {};
if (existsSync(overridesPath)) {
  try {
    const raw = await readFile(overridesPath, "utf8");
    overrides = JSON.parse(raw);
    console.log("Loaded balance overrides from server/balance-overrides.json:", JSON.stringify(overrides));
  } catch (err) {
    console.error("Failed to parse balance overrides:", err.message);
  }
} else {
  console.log("No overrides found at server/balance-overrides.json. Running with default balance.");
}

// 2. Build the headless simulator module using esbuild
console.log("Bundling simulator with esbuild...");
await build({
  entryPoints: [path.join(rootDir, "src", "game", "simulation", "headlessSimulator.ts")],
  outfile: bundledModule,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  logLevel: "silent"
});

// 3. Import and configure simulator
const simulator = await import(`${pathToFileURL(bundledModule).href}?t=${Date.now()}`);

// Set overrides in the compiled balanceConfig singleton
simulator.balanceConfig.setTemporaryOverrides(overrides);

// 4. Run simulations
console.log(`Running ${runs} simulation games (seed ${seed})...`);
const report = simulator.runBalanceSimulation({
  runs,
  seed
});

// 5. Save report
const resultPayload = {
  timestamp: new Date().toISOString(),
  overrides,
  runs,
  seed,
  winRate: report.winRate,
  averageWavesCleared: report.averageWavesCleared,
  averageBaseHpRemaining: report.averageBaseHpRemaining,
  averageCreditsRemaining: report.averageCreditsRemaining,
  averageTowersBuilt: report.averageTowersBuilt,
  botProfiles: report.botProfiles,
  classPairs: report.classPairs,
  waves: report.waves,
  towers: report.towers,
  deathWaves: report.deathWaves,
  recommendations: report.recommendations
};

await writeFile(outputPath, JSON.stringify(resultPayload, null, 2), "utf8");

console.log("\n========================================");
console.log("SIMULATION COMPLETED");
console.log(`Win Rate: ${(report.winRate * 100).toFixed(1)}%`);
console.log(`Avg Waves Cleared: ${report.averageWavesCleared.toFixed(2)} / 20`);
console.log(`Avg Base HP Left: ${report.averageBaseHpRemaining.toFixed(1)}`);
console.log(`Avg Towers Built: ${report.averageTowersBuilt.toFixed(1)}`);
console.log("========================================");
console.log(`Results saved to: tools/latest-balance-results.json`);
console.log("Open tools/balance-playground.html and drop this file to view the analysis dashboard.");

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
