import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aiPath = path.join(rootDir, "reports", "ai", "latest.json");
const balancePath = path.join(rootDir, "reports", "balance", "latest.json");
const outputPath = path.join(rootDir, "reports", "ai", "analysis.md");
const aiReport = await readJsonOrNull(aiPath);
const balanceReport = await readJsonOrNull(balancePath);
const lines = [
  "# Aegis Sacra TD - Local Balance Analysis",
  "",
  `- Generated: ${new Date().toISOString()}`,
  `- OpenAI key detected: ${process.env.OPENAI_API_KEY ? "yes" : "no"}`,
  ""
];

if (!aiReport && !balanceReport) {
  lines.push("Nenhum relatorio encontrado. Rode `npm run ai:simulate` ou `npm run simulate:balance` primeiro.");
} else {
  if (aiReport) {
    lines.push("## AI Simulation", "");
    lines.push(`- Bot: ${aiReport.bot}`);
    lines.push(`- Episodes: ${aiReport.episodes}`);
    lines.push(`- Win rate: ${pct(aiReport.winRate)}`);
    lines.push(`- Timeout rate: ${pct(aiReport.timeoutRate)}`);
    lines.push(`- Invalid actions: ${aiReport.invalidActions}`);
    lines.push(`- Invariant failures: ${aiReport.invariantFailures}`);
    lines.push("");
    lines.push("### Actionable");
    for (const item of aiReport.recommendations ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (balanceReport) {
    lines.push("## Balance Simulation", "");
    lines.push(`- Runs: ${balanceReport.runs}`);
    lines.push(`- Win rate: ${pct(balanceReport.winRate)}`);
    lines.push(`- Avg waves cleared: ${Number(balanceReport.averageWavesCleared).toFixed(2)}`);
    lines.push("");
    lines.push("### Actionable");
    for (const item of balanceReport.recommendations ?? []) {
      lines.push(`- ${item}`);
    }
  }
}

lines.push(
  "",
  "## Nota",
  "Este comando ainda e local e deterministico. A etapa OpenAI completa deve ler estes JSONs e abrir issues automaticamente quando `OPENAI_API_KEY` e GitHub remoto estiverem configurados."
);

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Analysis written to ${path.relative(rootDir, outputPath)}`);

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}
