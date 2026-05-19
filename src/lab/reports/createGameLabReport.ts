import {
  formatBalanceReport,
  runBalanceSimulation,
  type BalanceSimulationReport,
  type TowerAggregate,
  type WaveAggregate
} from "../../game/simulation/headlessSimulator";
import { getTowerDefinition, towerDefinitions } from "../../game/data/towers";
import {
  formatAiSimulationReport,
  runAiSimulation,
  type AiEpisodeSummary,
  type AiSimulationReport
} from "../../ai/reports/runAiSimulation";
import type { LearningSample } from "../../ai/telemetry/learningSamples";

export type LabSeverity = "critical" | "high" | "medium" | "low";

export type LabInsight = {
  id: string;
  severity: LabSeverity;
  area: "balance" | "qa" | "waves" | "classes" | "towers" | "learning";
  title: string;
  detail: string;
  action: string;
};

export type GameLabReportOptions = {
  seed?: number;
  balanceRuns?: number;
  aiBot?: string;
  aiEpisodes?: number;
  bugHunterEpisodes?: number;
  maxSteps?: number;
  humanLearningJsonl?: string;
};

export type GameLabMetricSet = {
  healthScore: number;
  releaseReadiness: "blocked" | "needs-work" | "playtestable" | "stable";
  balanceWinRate: number;
  aiWinRate: number;
  qaInvariantFailures: number;
  qaInvalidActions: number;
  averageWavesCleared: number;
  averageCreditsRemaining: number;
  underusedTowerCount: number;
  hardestWaveId: string;
  humanLearningRows: number;
};

export type LearningDatasetSummary = {
  version: string;
  rows: number;
  humanRows: number;
  humanMatches: number;
  targetKinds: string[];
  recommendedUse: string[];
};

export type GameLabReport = {
  version: string;
  generatedAt: string;
  seed: number;
  options: Required<GameLabReportOptions>;
  metrics: GameLabMetricSet;
  insights: LabInsight[];
  learning: LearningDatasetSummary;
  humanLearning: HumanLearningSummary;
  balance: BalanceSimulationReport;
  ai: AiSimulationReport;
  qa: AiSimulationReport;
};

export type HumanLearningSummary = {
  rows: number;
  matches: number;
  sources: Record<string, number>;
  kinds: Record<string, number>;
  playerActions: number;
  aiDecisions: number;
  waveClears: number;
  runEnds: number;
};

export type LearningRow = {
  kind:
    | "episode_outcome"
    | "wave_pressure"
    | "tower_usage"
    | "qa_invalid_action"
    | "human_match_sample"
    | "design_insight";
  input: Record<string, unknown>;
  target: Record<string, unknown>;
  weight: number;
};

const LAB_VERSION = "aegis-lab-v1";

export const createGameLabReport = (
  options: GameLabReportOptions = {}
): GameLabReport => {
  const normalizedOptions: Required<GameLabReportOptions> = {
    seed: options.seed ?? 14729,
    balanceRuns: options.balanceRuns ?? 1200,
    aiBot: options.aiBot ?? "greedy",
    aiEpisodes: options.aiEpisodes ?? 1000,
    bugHunterEpisodes: options.bugHunterEpisodes ?? 1000,
    maxSteps: options.maxSteps ?? 260,
    humanLearningJsonl: options.humanLearningJsonl ?? ""
  };
  const balance = runBalanceSimulation({
    runs: normalizedOptions.balanceRuns,
    seed: normalizedOptions.seed
  });
  const ai = runAiSimulation({
    bot: normalizedOptions.aiBot,
    episodes: normalizedOptions.aiEpisodes,
    seed: normalizedOptions.seed,
    maxSteps: normalizedOptions.maxSteps
  });
  const qa = runAiSimulation({
    bot: "bughunter",
    episodes: normalizedOptions.bugHunterEpisodes,
    seed: normalizedOptions.seed,
    maxSteps: normalizedOptions.maxSteps,
    debug: true
  });
  const humanSamples = parseHumanLearningSamples(normalizedOptions.humanLearningJsonl);
  const humanLearning = createHumanLearningSummary(humanSamples);
  const insights = createInsights(balance, ai, qa);
  const learningRows = createLearningRows(balance, ai, qa, insights, humanSamples);
  const metrics = createMetrics(balance, ai, qa, humanLearning);

  return {
    version: LAB_VERSION,
    generatedAt: new Date().toISOString(),
    seed: normalizedOptions.seed,
    options: normalizedOptions,
    metrics,
    insights,
    learning: {
      version: "aegis-learning-jsonl-v1",
      rows: learningRows.length,
      humanRows: humanLearning.rows,
      humanMatches: humanLearning.matches,
      targetKinds: [
        "win_probability",
        "wave_risk",
        "tower_priority",
        "invalid_action_class",
        "human_action_context",
        "design_action"
      ],
      recommendedUse: [
        "treinar heuristicas de bot parceiro",
        "comparar decisoes humanas com decisoes da IA",
        "priorizar issues de balanceamento",
        "comparar regressao entre commits",
        "alimentar analise LLM opcional sem expor dados privados"
      ]
    },
    humanLearning,
    balance,
    ai,
    qa
  };
};

export const createLearningRows = (
  balance: BalanceSimulationReport,
  ai: AiSimulationReport,
  qa: AiSimulationReport,
  insights: readonly LabInsight[],
  humanSamples: readonly LearningSample[] = []
): LearningRow[] => {
  const rows: LearningRow[] = [];

  for (const episode of ai.episodesSummary) {
    rows.push(createEpisodeRow("ai", ai.bot, episode));
  }

  for (const episode of qa.episodesSummary.slice(0, 2000)) {
    rows.push(createEpisodeRow("qa", qa.bot, episode));
  }

  for (const wave of balance.waves) {
    rows.push({
      kind: "wave_pressure",
      input: {
        waveId: wave.id,
        waveName: wave.name,
        routeCount: wave.routeCount,
        mapStageIndex: wave.mapStageIndex,
        averageLeaks: round(wave.averageLeaks),
        averageBaseDamage: round(wave.averageBaseDamage)
      },
      target: {
        waveRisk: round(1 - wave.clearRate),
        shouldTune: wave.deaths / Math.max(1, balance.runs) > 0.16
      },
      weight: wave.deaths > 0 ? 1.25 : 0.75
    });
  }

  for (const [towerId, tower] of Object.entries(balance.towers)) {
    const definition = getTowerDefinition(towerId);

    rows.push({
      kind: "tower_usage",
      input: {
        towerId,
        towerName: definition.name,
        effect: definition.effect,
        cost: definition.cost,
        damage: definition.damage,
        range: definition.range,
        cooldownMs: definition.cooldownMs
      },
      target: {
        buildShare: round(tower.buildShare),
        averageLevel: round(tower.averageLevel),
        towerPriority: getTowerPriority(tower)
      },
      weight: tower.buildShare < 0.012 || tower.buildShare > 0.16 ? 1.35 : 0.8
    });
  }

  for (const replay of qa.replaySamples) {
    for (const step of replay.actions) {
      if (step.errors.length === 0 && step.invariantFailures.length === 0) {
        continue;
      }

      rows.push({
        kind: "qa_invalid_action",
        input: {
          seed: replay.seed,
          action: step.action,
          events: step.events.map((event) => event.kind)
        },
        target: {
          errorCodes: step.errors.map((error) => error.code),
          invariantFailures: step.invariantFailures,
          shouldCreateRegression: step.invariantFailures.length > 0
        },
        weight: step.invariantFailures.length > 0 ? 2 : 1
      });
    }
  }

  for (const sample of humanSamples.slice(-3000)) {
    rows.push({
      kind: "human_match_sample",
      input: {
        source: sample.source,
        kind: sample.kind,
        matchId: sample.matchId,
        action: sample.action,
        waveIndex: sample.waveIndex,
        waveId: sample.waveId,
        waveThreat: sample.waveThreat,
        baseHp: sample.baseHp,
        players: sample.players,
        towers: sample.towers.slice(0, 32),
        aiDecision: sample.aiDecision
      },
      target: {
        result: sample.result ?? null,
        shouldImitate: sample.kind === "player-action" || sample.kind === "wave-clear",
        shouldExplain: sample.kind === "ai-decision"
      },
      weight: sample.kind === "player-action" ? 1.35 : sample.kind === "run-end" ? 1.5 : 0.75
    });
  }

  for (const insight of insights) {
    rows.push({
      kind: "design_insight",
      input: {
        area: insight.area,
        severity: insight.severity,
        title: insight.title,
        detail: insight.detail
      },
      target: {
        designAction: insight.action
      },
      weight: insight.severity === "critical" ? 2 : insight.severity === "high" ? 1.5 : 1
    });
  }

  return rows;
};

export const formatLearningJsonl = (rows: readonly LearningRow[]): string =>
  `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;

export const parseHumanLearningSamples = (jsonl: string): LearningSample[] => {
  if (!jsonl.trim()) {
    return [];
  }

  const samples: LearningSample[] = [];

  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as LearningSample;

      if (parsed.schemaVersion === "aegis-learning-sample-v1" && parsed.source !== "headless") {
        samples.push(parsed);
      }
    } catch {
      // Invalid local rows are ignored so one bad export does not break the whole report.
    }
  }

  return samples;
};

export const createHumanLearningSummary = (
  samples: readonly LearningSample[]
): HumanLearningSummary => {
  const matches = new Set<string>();
  const sources: Record<string, number> = {};
  const kinds: Record<string, number> = {};

  for (const sample of samples) {
    matches.add(sample.matchId);
    sources[sample.source] = (sources[sample.source] ?? 0) + 1;
    kinds[sample.kind] = (kinds[sample.kind] ?? 0) + 1;
  }

  return {
    rows: samples.length,
    matches: matches.size,
    sources,
    kinds,
    playerActions: kinds["player-action"] ?? 0,
    aiDecisions: kinds["ai-decision"] ?? 0,
    waveClears: kinds["wave-clear"] ?? 0,
    runEnds: kinds["run-end"] ?? 0
  };
};

export const formatGameLabMarkdown = (report: GameLabReport): string => {
  const lines = [
    "# Aegis Lab Report",
    "",
    `- Version: ${report.version}`,
    `- Generated: ${report.generatedAt}`,
    `- Seed: ${report.seed}`,
    `- Health score: ${report.metrics.healthScore}/100`,
    `- Release readiness: ${report.metrics.releaseReadiness}`,
    `- Balance win rate: ${formatPercent(report.metrics.balanceWinRate)}`,
    `- AI win rate (${report.ai.bot}): ${formatPercent(report.metrics.aiWinRate)}`,
    `- QA invariant failures: ${report.metrics.qaInvariantFailures}`,
    `- Learning rows: ${report.learning.rows}`,
    `- Human learning rows: ${report.learning.humanRows}`,
    `- Human matches: ${report.learning.humanMatches}`,
    "",
    "## Highest Priority",
    ""
  ];

  for (const insight of report.insights.slice(0, 10)) {
    lines.push(`- [${insight.severity}] ${insight.title}: ${insight.action}`);
  }

  lines.push(
    "",
    "## Balance Summary",
    "",
    formatBalanceReport(report.balance).trim(),
    "",
    "## AI Summary",
    "",
    formatAiSimulationReport(report.ai).trim(),
    "",
    "## QA Summary",
    "",
    formatAiSimulationReport(report.qa).trim()
  );

  return `${lines.join("\n")}\n`;
};

export const formatGameLabDashboardHtml = (report: GameLabReport): string => {
  const view = createDashboardView(report);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aegis Lab - Game Intelligence</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #05070d;
      --panel: rgba(13, 17, 26, 0.82);
      --panel-strong: rgba(18, 24, 36, 0.94);
      --line: rgba(212, 226, 255, 0.14);
      --line-strong: rgba(212, 226, 255, 0.26);
      --text: #f4f8ff;
      --muted: #92a0b3;
      --soft: #c7d4e8;
      --cyan: #66e7ff;
      --gold: #ffd36d;
      --pink: #ff5e9c;
      --green: #9cff88;
      --blue: #8aa8ff;
      --shadow: 0 18px 60px rgba(0, 0, 0, 0.34);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.035), transparent 240px),
        radial-gradient(circle at 18% 0%, rgba(102, 231, 255, 0.16), transparent 28%),
        radial-gradient(circle at 86% 8%, rgba(255, 94, 156, 0.13), transparent 26%),
        var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    main { width: min(1440px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 56px; }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
      margin-bottom: 20px;
    }
    h1 { margin: 0; font-size: 30px; line-height: 36px; font-weight: 780; }
    h2 { margin: 0; font-size: 15px; line-height: 20px; font-weight: 740; }
    p { margin: 0; color: var(--muted); font-size: 13px; line-height: 20px; }
    .eyebrow { color: var(--cyan); font-size: 11px; line-height: 16px; font-weight: 760; text-transform: uppercase; }
    .headerMeta { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .chip {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.045);
      border-radius: 999px;
      padding: 7px 10px;
      color: var(--soft);
      font-size: 12px;
      line-height: 14px;
      font-weight: 650;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .scorePanel, .panel, .metric, .insight, .tableWrap {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 10px;
      box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .scorePanel { padding: 20px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: center; }
    .ring { width: 142px; height: 142px; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(var(--cyan) calc(var(--score) * 1%), rgba(255,255,255,0.08) 0); position: relative; }
    .ring::after { content: ""; position: absolute; inset: 12px; border-radius: 50%; background: #07101b; border: 1px solid var(--line); }
    .ring strong { position: relative; z-index: 1; font-size: 34px; line-height: 38px; }
    .statusLine { display: grid; gap: 8px; }
    .statusLine h2 { font-size: 22px; line-height: 28px; }
    .statusLine p { max-width: 620px; }
    .metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .metric { padding: 14px; min-height: 104px; }
    .metric span { display: block; color: var(--muted); font-size: 11px; line-height: 14px; font-weight: 760; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 10px; font-size: 25px; line-height: 30px; }
    .metric small { display: block; margin-top: 8px; color: var(--soft); font-size: 12px; line-height: 16px; }
    .tabs { display: flex; gap: 8px; margin: 16px 0; overflow: auto; padding-bottom: 2px; }
    .tabs button {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.045);
      color: var(--soft);
      border-radius: 999px;
      padding: 9px 12px;
      font: inherit;
      font-size: 12px;
      line-height: 14px;
      font-weight: 720;
      cursor: pointer;
      white-space: nowrap;
    }
    .tabs button.active { color: #031018; background: var(--cyan); border-color: transparent; }
    .view { display: none; }
    .view.active { display: grid; gap: 14px; }
    .twoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .panel { padding: 16px; overflow: hidden; }
    .panelHead { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .chart { width: 100%; min-height: 260px; }
    .bars { display: grid; gap: 10px; }
    .barRow { display: grid; grid-template-columns: 138px minmax(0, 1fr) 54px; gap: 10px; align-items: center; }
    .barRow label { color: var(--soft); font-size: 12px; line-height: 15px; font-weight: 660; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .barTrack { height: 10px; border-radius: 999px; background: rgba(255,255,255,0.075); overflow: hidden; }
    .barTrack i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--cyan), var(--gold)); }
    .barRow output { color: var(--muted); font-size: 12px; text-align: right; }
    .insightList { display: grid; gap: 10px; }
    .insight { padding: 13px 14px; border-left: 3px solid var(--cyan); }
    .insight.high, .insight.critical { border-left-color: var(--pink); }
    .insight.medium { border-left-color: var(--gold); }
    .insight h3 { margin: 0 0 6px; font-size: 14px; line-height: 18px; }
    .insight p { font-size: 12px; line-height: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 16px; }
    th { color: var(--muted); text-align: left; font-size: 10px; line-height: 12px; font-weight: 780; text-transform: uppercase; }
    td, th { padding: 10px 8px; border-bottom: 1px solid rgba(212,226,255,0.1); vertical-align: middle; }
    tr:last-child td { border-bottom: 0; }
    .pill { display: inline-block; border-radius: 999px; padding: 4px 7px; background: rgba(255,255,255,0.06); color: var(--soft); font-size: 11px; font-weight: 700; }
    .mono { font-family: ui-monospace, "SFMono-Regular", Consolas, monospace; }
    .footerNote { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 18px; }
    @media (max-width: 980px) {
      header, .hero, .twoCol { grid-template-columns: 1fr; }
      .headerMeta { justify-content: flex-start; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .scorePanel { grid-template-columns: 1fr; }
      .ring { width: 116px; height: 116px; }
    }
    @media (max-width: 620px) {
      main { width: min(100vw - 20px, 1440px); padding-top: 18px; }
      h1 { font-size: 24px; line-height: 30px; }
      .metrics { grid-template-columns: 1fr; }
      .barRow { grid-template-columns: 104px minmax(0, 1fr) 46px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">Aegis Lab / Game Intelligence</div>
        <h1>Relatório unificado de balanceamento, QA e aprendizado</h1>
        <p>Dashboard offline, sem CDN e sem dados privados. Feito para orientar design, bots, regressões e futuras análises com IA.</p>
      </div>
      <div class="headerMeta">
        <span class="chip">seed ${report.seed}</span>
        <span class="chip">${escapeHtml(report.generatedAt)}</span>
        <span class="chip">${report.learning.rows} linhas de aprendizado</span>
        <span class="chip">${report.learning.humanRows} linhas humanas</span>
      </div>
    </header>
    <section class="hero">
      <div class="scorePanel">
        <div class="ring" style="--score:${report.metrics.healthScore}"><strong>${report.metrics.healthScore}</strong></div>
        <div class="statusLine">
          <span class="eyebrow">${escapeHtml(report.metrics.releaseReadiness)}</span>
          <h2>${escapeHtml(getReadinessTitle(report.metrics.releaseReadiness))}</h2>
          <p>${escapeHtml(getReadinessCopy(report.metrics.releaseReadiness))}</p>
        </div>
      </div>
      <div class="metrics">
        ${metricCard("Balance", formatPercent(report.metrics.balanceWinRate), "win rate agregado")}
        ${metricCard("IA jogadora", formatPercent(report.metrics.aiWinRate), `${escapeHtml(report.ai.bot)} / ${report.ai.episodes} eps`)}
        ${metricCard("BugHunter", String(report.metrics.qaInvariantFailures), `${report.metrics.qaInvalidActions} ações inválidas`)}
        ${metricCard("Wave crítica", escapeHtml(report.metrics.hardestWaveId), `${report.metrics.averageWavesCleared.toFixed(2)} waves médias`)}
        ${metricCard("Humano", String(report.metrics.humanLearningRows), `${report.learning.humanMatches} partidas exportadas`)}
      </div>
    </section>
    <nav class="tabs" aria-label="Seções do relatório">
      <button class="active" data-tab="overview">Visão geral</button>
      <button data-tab="waves">Waves</button>
      <button data-tab="classes">Classes</button>
      <button data-tab="towers">Torres</button>
      <button data-tab="qa">QA</button>
      <button data-tab="learning">Aprendizado</button>
    </nav>
    <section id="overview" class="view active">
      <div class="twoCol">
        <div class="panel">
          <div class="panelHead"><div><h2>Prioridades</h2><p>Ordenado por severidade e impacto no próximo playtest.</p></div></div>
          <div class="insightList" id="insights"></div>
        </div>
        <div class="panel">
          <div class="panelHead"><div><h2>Saúde do build</h2><p>Indicadores que decidem se a próxima etapa é balance, QA ou UX.</p></div></div>
          <div class="bars" id="healthBars"></div>
        </div>
      </div>
    </section>
    <section id="waves" class="view">
      <div class="panel">
        <div class="panelHead"><div><h2>Pressão por wave</h2><p>Clear rate, vazamentos e dano médio na base.</p></div></div>
        <div class="chart" id="waveChart"></div>
      </div>
      <div class="tableWrap panel"><table id="waveTable"></table></div>
    </section>
    <section id="classes" class="view">
      <div class="panel">
        <div class="panelHead"><div><h2>Duplas de classe</h2><p>Top e bottom combinações pela IA jogadora.</p></div></div>
        <div class="bars" id="classBars"></div>
      </div>
    </section>
    <section id="towers" class="view">
      <div class="twoCol">
        <div class="panel">
          <div class="panelHead"><div><h2>Uso de torres</h2><p>Share global no simulador de balanceamento.</p></div></div>
          <div class="bars" id="towerBars"></div>
        </div>
        <div class="tableWrap panel"><table id="towerTable"></table></div>
      </div>
    </section>
    <section id="qa" class="view">
      <div class="twoCol">
        <div class="panel">
          <div class="panelHead"><div><h2>BugHunter</h2><p>Stress test de ações inválidas, softlocks e invariantes.</p></div></div>
          <div class="bars" id="qaBars"></div>
        </div>
        <div class="tableWrap panel"><table id="replayTable"></table></div>
      </div>
    </section>
    <section id="learning" class="view">
      <div class="twoCol">
        <div class="panel">
          <div class="panelHead"><div><h2>Dataset para IA</h2><p>JSONL local para heurísticas, regressão e análise LLM opcional.</p></div></div>
          <div class="bars" id="learningBars"></div>
          <p class="footerNote">Arquivo final: <span class="mono">reports/lab/learning-dataset.jsonl</span>. Partidas humanas entram por <span class="mono">reports/human/learning-dataset.jsonl</span>. Não contém usuário, login, rede ou chave de API.</p>
        </div>
        <div class="panel">
          <div class="panelHead"><div><h2>Uso recomendado</h2><p>Como a IA deve aprender sem virar jogador em tempo real.</p></div></div>
          <div class="insightList" id="learningUse"></div>
        </div>
      </div>
    </section>
  </main>
  <script id="lab-data" type="application/json">${escapeJsonForHtml(JSON.stringify(view))}</script>
  <script>
    const data = JSON.parse(document.getElementById("lab-data").textContent);
    const pct = value => (value * 100).toFixed(1) + "%";
    const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
    const setTable = (id, headers, rows) => {
      document.getElementById(id).innerHTML =
        "<thead><tr>" + headers.map(header => "<th>" + esc(header) + "</th>").join("") + "</tr></thead><tbody>" +
        rows.map(row => "<tr>" + row.map(cell => "<td>" + cell + "</td>").join("") + "</tr>").join("") +
        "</tbody>";
    };
    const setBars = (id, rows, maxValue = 1) => {
      document.getElementById(id).innerHTML = rows.map(row => {
        const width = Math.max(0, Math.min(100, (row.value / maxValue) * 100));
        return '<div class="barRow"><label title="' + esc(row.label) + '">' + esc(row.label) + '</label><div class="barTrack"><i style="width:' + width.toFixed(1) + '%"></i></div><output>' + esc(row.display) + '</output></div>';
      }).join("");
    };
    document.querySelectorAll(".tabs button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tabs button").forEach(item => item.classList.remove("active"));
        document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        document.getElementById(button.dataset.tab).classList.add("active");
      });
    });
    document.getElementById("insights").innerHTML = data.insights.map(item =>
      '<article class="insight ' + esc(item.severity) + '"><h3>' + esc(item.title) + '</h3><p>' + esc(item.detail) + '</p><p><strong>Ação:</strong> ' + esc(item.action) + '</p></article>'
    ).join("");
    setBars("healthBars", [
      { label: "Balance win", value: data.metrics.balanceWinRate, display: pct(data.metrics.balanceWinRate) },
      { label: "IA win", value: data.metrics.aiWinRate, display: pct(data.metrics.aiWinRate) },
      { label: "Waves médias", value: data.metrics.averageWavesCleared / 10, display: data.metrics.averageWavesCleared.toFixed(2) },
      { label: "Torres subusadas", value: 1 - Math.min(1, data.metrics.underusedTowerCount / 16), display: String(data.metrics.underusedTowerCount) }
    ]);
    setBars("waveChart", data.waves.map(wave => ({ label: wave.id, value: wave.risk, display: pct(wave.risk) })), Math.max(...data.waves.map(wave => wave.risk), 0.01));
    setTable("waveTable", ["Wave", "Clear", "Leaks", "Base dmg", "Rotas"], data.waves.map(wave => [
      esc(wave.name),
      pct(wave.clearRate),
      wave.averageLeaks.toFixed(2),
      wave.averageBaseDamage.toFixed(2),
      String(wave.routeCount)
    ]));
    setBars("classBars", data.classPairs.map(pair => ({ label: pair.pair, value: pair.winRate, display: pct(pair.winRate) })));
    setBars("towerBars", data.towers.slice(0, 24).map(tower => ({ label: tower.name, value: tower.buildShare, display: pct(tower.buildShare) })), Math.max(...data.towers.map(tower => tower.buildShare), 0.01));
    setTable("towerTable", ["Torre", "Uso", "Dano", "Kills", "Nível"], data.towers.slice(0, 30).map(tower => [
      esc(tower.name),
      pct(tower.buildShare),
      String(Math.round(tower.damage)),
      String(tower.kills),
      tower.averageLevel.toFixed(2)
    ]));
    setBars("qaBars", [
      { label: "Ações inválidas", value: data.qa.invalidActions, display: String(data.qa.invalidActions) },
      { label: "Falhas de invariante", value: data.qa.invariantFailures, display: String(data.qa.invariantFailures) },
      { label: "Timeout", value: data.qa.timeoutRate, display: pct(data.qa.timeoutRate) },
      { label: "Bugs por 1000", value: data.qa.bugsPerThousandEpisodes, display: data.qa.bugsPerThousandEpisodes.toFixed(1) }
    ], Math.max(data.qa.invalidActions, 1));
    setTable("replayTable", ["Seed", "Ações", "Crash", "Última ação"], data.replays.map(replay => [
      String(replay.seed),
      String(replay.actions),
      esc(replay.crash || "não"),
      esc(replay.lastAction)
    ]));
    setBars("learningBars", [
      { label: "linhas humanas", value: data.learning.humanRows, display: String(data.learning.humanRows) },
      { label: "partidas humanas", value: data.learning.humanMatches, display: String(data.learning.humanMatches) },
      { label: "ações humanas", value: data.learning.humanPlayerActions, display: String(data.learning.humanPlayerActions) },
      { label: "decisões da IA local", value: data.learning.humanAiDecisions, display: String(data.learning.humanAiDecisions) },
      ...data.learning.targets.map((target, index) => ({ label: target, value: index + 1, display: "ativo" }))
    ], Math.max(data.learning.humanRows, data.learning.targets.length, 1));
    document.getElementById("learningUse").innerHTML = data.learning.recommendedUse.map(item =>
      '<article class="insight low"><h3>' + esc(item) + '</h3><p>Usar como dado local e versionado; análise OpenAI só entra quando uma chave for configurada fora do repositório.</p></article>'
    ).join("");
  </script>
</body>
</html>`;
};

const createMetrics = (
  balance: BalanceSimulationReport,
  ai: AiSimulationReport,
  qa: AiSimulationReport,
  humanLearning: HumanLearningSummary
): GameLabMetricSet => {
  const underusedTowerCount = Object.values(balance.towers).filter(
    (tower) => tower.buildShare < 0.012
  ).length;
  const hardestWave =
    [...balance.waves].sort((a, b) => b.deaths - a.deaths || b.averageLeaks - a.averageLeaks)[0] ??
    balance.waves[0];
  const invariantPenalty = Math.min(35, qa.invariantFailures * 4);
  const timeoutPenalty = Math.min(16, (ai.timeoutRate + qa.timeoutRate) * 160);
  const balancePenalty = Math.abs(balance.winRate - 0.6) * 54;
  const towerPenalty = Math.min(12, underusedTowerCount * 0.35);
  const healthScore = Math.max(
    0,
    Math.min(100, Math.round(100 - invariantPenalty - timeoutPenalty - balancePenalty - towerPenalty))
  );

  return {
    healthScore,
    releaseReadiness:
      qa.invariantFailures > 0
        ? "blocked"
        : healthScore >= 82
          ? "stable"
          : healthScore >= 66
            ? "playtestable"
            : "needs-work",
    balanceWinRate: balance.winRate,
    aiWinRate: ai.winRate,
    qaInvariantFailures: qa.invariantFailures,
    qaInvalidActions: qa.invalidActions,
    averageWavesCleared: balance.averageWavesCleared,
    averageCreditsRemaining: balance.averageCreditsRemaining,
    underusedTowerCount,
    hardestWaveId: hardestWave?.id ?? "none",
    humanLearningRows: humanLearning.rows
  };
};

const createInsights = (
  balance: BalanceSimulationReport,
  ai: AiSimulationReport,
  qa: AiSimulationReport
): LabInsight[] => {
  const insights: LabInsight[] = [];

  if (qa.invariantFailures > 0) {
    insights.push({
      id: "qa-invariants",
      severity: "critical",
      area: "qa",
      title: "BugHunter encontrou falhas de invariante",
      detail: `${qa.invariantFailures} falhas apareceram em ${qa.episodes} episodios.`,
      action: "Corrigir replays antes de adicionar novas mecanicas ou treinar IA."
    });
  }

  if (ai.timeoutRate > 0 || qa.timeoutRate > 0) {
    insights.push({
      id: "softlock-risk",
      severity: "critical",
      area: "qa",
      title: "Risco de softlock detectado",
      detail: `Timeout IA ${formatPercent(ai.timeoutRate)}, BugHunter ${formatPercent(qa.timeoutRate)}.`,
      action: "Salvar replay completo e criar teste de regressao para ready, recompensa e avanço de wave."
    });
  }

  if (balance.winRate < 0.5 || balance.winRate > 0.72) {
    insights.push({
      id: "balance-window",
      severity: "high",
      area: "balance",
      title: "Win rate fora da janela alvo",
      detail: `Balanceamento agregado esta em ${formatPercent(balance.winRate)}; alvo atual e 50-70%.`,
      action: balance.winRate < 0.5
        ? "Reduzir picos das waves com maior death share antes de buffar classes inteiras."
        : "Aumentar pressao nas waves 8-10 sem mexer nas primeiras waves."
    });
  }

  for (const wave of balance.waves) {
    const deathShare = wave.deaths / Math.max(1, balance.runs);

    if (deathShare > 0.16) {
      insights.push({
        id: `wave-${wave.id}`,
        severity: "high",
        area: "waves",
        title: `${wave.id} mata runs demais`,
        detail: `${wave.name} responde por ${formatPercent(deathShare)} das derrotas e vaza ${wave.averageLeaks.toFixed(2)} inimigos em media.`,
        action: "Revisar contagem, intervalo de spawn, rotas simultaneas e aviso visual de preparacao."
      });
    }
  }

  if (balance.averageCreditsRemaining > 900) {
    insights.push({
      id: "economy-surplus",
      severity: "medium",
      area: "balance",
      title: "Economia sobra no late game",
      detail: `Sobra media de ${balance.averageCreditsRemaining.toFixed(0)} creditos.`,
      action: "Criar gastos uteis de late game, melhorar IA de compra ou reduzir renda de forma localizada."
    });
  }

  const underused = Object.entries(balance.towers).filter(([, tower]) => tower.buildShare < 0.012);

  if (underused.length > 0) {
    insights.push({
      id: "underused-towers",
      severity: "medium",
      area: "towers",
      title: "Torres subusadas",
      detail: `${underused.length} torres aparecem abaixo do limite global esperado para torres por classe.`,
      action: "Comparar custo, função e clareza de descrição; nao adicionar torres novas antes de dar identidade para essas."
    });
  }

  if (qa.invalidActions > 0 && qa.invariantFailures === 0) {
    insights.push({
      id: "qa-good",
      severity: "low",
      area: "qa",
      title: "Regras resistiram ao BugHunter",
      detail: `${qa.invalidActions} acoes invalidas foram rejeitadas sem corromper estado.`,
      action: "Manter esses replays como suite de regressao para proximas mudanças."
    });
  }

  insights.push({
    id: "learning-loop",
    severity: "low",
    area: "learning",
    title: "Dataset de aprendizado gerado",
    detail: "O JSONL combina resultados de episodio, risco de wave, uso de torre, acoes invalidas e insights de design.",
    action: "Usar esse dataset para comparar commits e alimentar o futuro bot parceiro."
  });

  return insights.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
};

const createDashboardView = (report: GameLabReport) => ({
  metrics: report.metrics,
  insights: report.insights.slice(0, 14),
  waves: report.balance.waves.map((wave) => ({
    id: wave.id,
    name: wave.name,
    clearRate: wave.clearRate,
    risk: 1 - wave.clearRate,
    averageLeaks: wave.averageLeaks,
    averageBaseDamage: wave.averageBaseDamage,
    routeCount: wave.routeCount
  })),
  classPairs: Object.entries(report.ai.classPairs)
    .map(([pair, stats]) => ({
      pair,
      attempts: stats.attempts,
      winRate: stats.winRate,
      averageWavesCleared: stats.averageWavesCleared
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 28),
  towers: Object.entries(report.balance.towers)
    .map(([towerId, stats]) => ({
      id: towerId,
      name: getTowerDefinition(towerId).shortName,
      effect: getTowerDefinition(towerId).effect,
      built: stats.built,
      buildShare: stats.buildShare,
      damage: stats.damage,
      kills: stats.kills,
      averageLevel: stats.averageLevel
    }))
    .sort((a, b) => b.buildShare - a.buildShare),
  qa: {
    invalidActions: report.qa.invalidActions,
    invariantFailures: report.qa.invariantFailures,
    timeoutRate: report.qa.timeoutRate,
    bugsPerThousandEpisodes: report.qa.bugsPerThousandEpisodes
  },
  replays: report.qa.replaySamples.map((replay) => ({
    seed: replay.seed,
    actions: replay.actions.length,
    crash: replay.crash,
    lastAction: replay.actions.at(-1)?.action.type ?? "none"
  })),
  learning: {
    rows: report.learning.rows,
    humanRows: report.learning.humanRows,
    humanMatches: report.learning.humanMatches,
    humanPlayerActions: report.humanLearning.playerActions,
    humanAiDecisions: report.humanLearning.aiDecisions,
    targets: report.learning.targetKinds,
    recommendedUse: report.learning.recommendedUse
  }
});

const createEpisodeRow = (
  source: "ai" | "qa",
  bot: string,
  episode: AiEpisodeSummary
): LearningRow => ({
  kind: "episode_outcome",
  input: {
    source,
    bot,
    seed: episode.seed,
    classPair: episode.classPair,
    steps: episode.steps,
    invalidActions: episode.invalidActions,
    invariantFailures: episode.invariantFailures
  },
  target: {
    result: episode.result,
    wavesCleared: episode.wavesCleared,
    baseHp: episode.baseHp,
    winProbability: episode.result === "victory" ? 1 : 0
  },
  weight: episode.invariantFailures > 0 ? 2 : episode.result === "timeout" ? 1.5 : 1
});

const getTowerPriority = (tower: TowerAggregate): "underused" | "dominant" | "healthy" =>
  tower.buildShare < 0.012 ? "underused" : tower.buildShare > 0.16 ? "dominant" : "healthy";

const severityRank = (severity: LabSeverity): number =>
  severity === "critical" ? 4 : severity === "high" ? 3 : severity === "medium" ? 2 : 1;

const getReadinessTitle = (readiness: GameLabMetricSet["releaseReadiness"]): string => {
  if (readiness === "blocked") {
    return "Bloqueado para expansão";
  }

  if (readiness === "needs-work") {
    return "Precisa de ajuste antes do próximo pacote";
  }

  if (readiness === "playtestable") {
    return "Pronto para playtest orientado";
  }

  return "Estável para iteração pública";
};

const getReadinessCopy = (readiness: GameLabMetricSet["releaseReadiness"]): string => {
  if (readiness === "blocked") {
    return "Corrija invariantes, softlocks e replays críticos antes de tocar em conteúdo novo.";
  }

  if (readiness === "needs-work") {
    return "A base roda, mas os dados apontam picos de dificuldade, sobra de economia ou uso fraco de torres.";
  }

  if (readiness === "playtestable") {
    return "A fundação está boa para uma rodada de playtest com foco nas prioridades listadas.";
  }

  return "O build está em boa forma para publicar relatórios e coletar feedback externo.";
};

const metricCard = (label: string, value: string, detail: string): string =>
  `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(detail)}</small></div>`;

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const round = (value: number): number => Math.round(value * 1000) / 1000;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeJsonForHtml = (value: string): string =>
  value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
