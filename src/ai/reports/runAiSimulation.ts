import { playerClassDefinitions } from "../../game/data/playerClasses";
import { getTowerDefinition, towerDefinitions } from "../../game/data/towers";
import type { GameAction } from "../../game/actions/types";
import type { PlayerId } from "../../game/models/types";
import { getHeadlessBot, type BotId } from "../bots";
import { Rng } from "../env/Rng";
import { TowerDefenseEnv } from "../env/TowerDefenseEnv";
import type { HeadlessGameState } from "../env/types";
import { choosePolicyAction, type LearningPolicy } from "../learning/policy";
import { ReplayRecorder, type ReplayRecord } from "../replay/ReplayRecorder";
import {
  createLearningSampleFromHeadlessState,
  type LearningSample
} from "../telemetry/learningSamples";

export type AiSimulationOptions = {
  bot?: string;
  episodes?: number;
  seed?: number;
  maxSteps?: number;
  targetWaveCount?: number;
  maxLearningSamples?: number;
  debug?: boolean;
  players?: Partial<Record<PlayerId, string>>;
  policy?: LearningPolicy;
};

export type AiEpisodeSummary = {
  seed: number;
  result: "victory" | "defeat" | "timeout";
  wavesCleared: number;
  baseHp: number;
  steps: number;
  invalidActions: number;
  invariantFailures: number;
  classPair: string;
};

export type AiSimulationReport = {
  version: string;
  generatedAt: string;
  bot: string;
  episodes: number;
  seed: number;
  maxSteps: number;
  targetWaveCount: number;
  winRate: number;
  timeoutRate: number;
  averageWavesCleared: number;
  averageBaseHp: number;
  invalidActions: number;
  invariantFailures: number;
  bugsPerThousandEpisodes: number;
  classPairs: Record<string, ClassPairStats>;
  towerUsage: Record<string, TowerUsageStats>;
  episodesSummary: AiEpisodeSummary[];
  replaySamples: ReplayRecord[];
  recommendations: string[];
  learningSamples: LearningSample[];
};

export type ClassPairStats = {
  attempts: number;
  wins: number;
  winRate: number;
  averageWavesCleared: number;
};

export type TowerUsageStats = {
  built: number;
  damage: number;
  kills: number;
  buildShare: number;
};

type MutableClassPairStats = {
  attempts: number;
  wins: number;
  wavesCleared: number;
};

type MutableTowerUsageStats = {
  built: number;
  damage: number;
  kills: number;
};

const REPORT_VERSION = "ai-playtest-lab-v1";
const playerIds: readonly PlayerId[] = ["p1", "p2"];

export const runAiSimulation = (
  options: AiSimulationOptions = {}
): AiSimulationReport => {
  const episodes = Math.max(1, Math.floor(options.episodes ?? 1000));
  const seed = options.seed ?? 14729;
  const maxSteps = Math.max(20, Math.floor(options.maxSteps ?? 260));
  const targetWaveCount = Math.max(1, Math.floor(options.targetWaveCount ?? 20));
  const maxLearningSamples = Math.max(0, Math.floor(options.maxLearningSamples ?? 12000));
  const bot = options.policy ? null : getHeadlessBot(options.bot ?? "random");
  const botId = options.policy?.id ?? bot?.id ?? "random";
  const classPairs: Record<string, MutableClassPairStats> = {};
  const towerUsage = createTowerUsage();
  const episodesSummary: AiEpisodeSummary[] = [];
  const replaySamples: ReplayRecord[] = [];
  const learningSamples: LearningSample[] = [];

  let wins = 0;
  let timeouts = 0;
  let wavesClearedTotal = 0;
  let baseHpTotal = 0;
  let invalidActions = 0;
  let invariantFailures = 0;

  for (let episode = 0; episode < episodes; episode += 1) {
    const episodeSeed = seed + episode * 9973;
    const rng = new Rng(episodeSeed);
    const env = new TowerDefenseEnv();
    const players =
      options.players ??
      ({
        p1: rng.pick(playerClassDefinitions).id,
        p2: rng.pick(playerClassDefinitions).id
      } satisfies Partial<Record<PlayerId, string>>);
    const initialState = env.reset({
      seed: episodeSeed,
      debug: options.debug ?? botId === "bughunter",
      players,
      targetWaveCount
    });
    const recorder = new ReplayRecorder(
      episodeSeed,
      initialState.mapId,
      initialState.version,
      botId,
      initialState
    );
    let lastState: HeadlessGameState = initialState;
    let crashed = false;
    let steps = 0;
    const matchId = `headless-${episodeSeed}`;

    pushLearningSample(
      learningSamples,
      maxLearningSamples,
      createLearningSampleFromHeadlessState(matchId, "headless", "run-start", initialState)
    );

    try {
      for (; steps < maxSteps; steps += 1) {
        const action = options.policy
          ? choosePolicyAction(options.policy, lastState, playerIds, rng)
          : bot?.chooseAction(lastState, {
              controlledPlayers: playerIds,
              rng
            }) ?? { type: "WAIT", deltaMs: 1000 };
        const result = env.step(action);

        recorder.record(
          action,
          result.reward,
          result.events,
          result.errors,
          result.invariantFailures
        );
        invalidActions += result.errors.length;
        invariantFailures += result.invariantFailures.length;
        if (
          result.errors.length > 0 ||
          result.events.some((event) =>
            event.kind === "wave-started" ||
            event.kind === "wave-cleared" ||
            event.kind === "game-ended"
          )
        ) {
          pushLearningSample(
            learningSamples,
            maxLearningSamples,
            createLearningSampleFromHeadlessState(
              matchId,
              "headless",
              result.events.some((event) => event.kind === "wave-started")
                ? "wave-start"
                : result.events.some((event) => event.kind === "wave-cleared")
                  ? "wave-clear"
                  : "player-action",
              result.state,
              action,
              undefined,
              result.errors.map((error) => error.message)
            )
          );
        }
        lastState = result.state;

        if (result.done) {
          break;
        }
      }
    } catch (error) {
      crashed = true;
      recorder.fail(error);
    }

    recorder.finish(lastState);
    collectTowerUsage(towerUsage, lastState);

    const result = getEpisodeResult(lastState, crashed, steps, maxSteps);
    pushLearningSample(
      learningSamples,
      maxLearningSamples,
      createLearningSampleFromHeadlessState(matchId, "headless", "run-end", lastState, undefined, result)
    );
    const wavesCleared = lastState.waveLog.filter((wave) => wave.cleared).length;
    const classPair = `${getClassShortName(lastState.players.p1.classId)} + ${getClassShortName(
      lastState.players.p2.classId
    )}`;
    const pairBucket = (classPairs[classPair] ??= {
      attempts: 0,
      wins: 0,
      wavesCleared: 0
    });
    const episodeInvalidActions = recorder
      .toJSON()
      .actions.reduce((sum, step) => sum + step.errors.length, 0);
    const episodeInvariantFailures = recorder
      .toJSON()
      .actions.reduce((sum, step) => sum + step.invariantFailures.length, 0);

    pairBucket.attempts += 1;
    pairBucket.wavesCleared += wavesCleared;

    if (result === "victory") {
      wins += 1;
      pairBucket.wins += 1;
    }

    if (result === "timeout") {
      timeouts += 1;
    }

    wavesClearedTotal += wavesCleared;
    baseHpTotal += lastState.baseHp;
    episodesSummary.push({
      seed: episodeSeed,
      result,
      wavesCleared,
      baseHp: lastState.baseHp,
      steps,
      invalidActions: episodeInvalidActions,
      invariantFailures: episodeInvariantFailures,
      classPair
    });

    if (
      replaySamples.length < 8 &&
      (crashed || episodeInvalidActions > 0 || episodeInvariantFailures > 0 || result === "timeout")
    ) {
      replaySamples.push(recorder.toJSON());
    }
  }

  const totalBuilt = Object.values(towerUsage).reduce((sum, tower) => sum + tower.built, 0);
  const report: AiSimulationReport = {
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    bot: botId,
    episodes,
    seed,
    maxSteps,
    targetWaveCount,
    winRate: wins / episodes,
    timeoutRate: timeouts / episodes,
    averageWavesCleared: wavesClearedTotal / episodes,
    averageBaseHp: baseHpTotal / episodes,
    invalidActions,
    invariantFailures,
    bugsPerThousandEpisodes: ((invalidActions + invariantFailures) / episodes) * 1000,
    classPairs: finalizeClassPairs(classPairs),
    towerUsage: finalizeTowerUsage(towerUsage, totalBuilt),
    episodesSummary,
    replaySamples,
    recommendations: [],
    learningSamples
  };

  report.recommendations = createRecommendations(report);

  return report;
};

const pushLearningSample = (
  samples: LearningSample[],
  maxLearningSamples: number,
  sample: LearningSample
): void => {
  if (maxLearningSamples <= 0) {
    return;
  }

  samples.push(sample);

  if (samples.length > maxLearningSamples) {
    samples.splice(0, samples.length - maxLearningSamples);
  }
};

export const formatAiSimulationReport = (report: AiSimulationReport): string => {
  const lines = [
    "# Aegis Sacra TD - AI Simulation",
    "",
    `- Version: ${report.version}`,
    `- Bot: ${report.bot}`,
    `- Episodes: ${report.episodes}`,
    `- Seed: ${report.seed}`,
    `- Target waves: ${report.targetWaveCount}`,
    `- Win rate: ${formatPercent(report.winRate)}`,
    `- Timeout rate: ${formatPercent(report.timeoutRate)}`,
    `- Avg waves cleared: ${report.averageWavesCleared.toFixed(2)}`,
    `- Avg base HP: ${report.averageBaseHp.toFixed(2)}`,
    `- Invalid actions: ${report.invalidActions}`,
    `- Invariant failures: ${report.invariantFailures}`,
    `- Bugs per 1000 episodes: ${report.bugsPerThousandEpisodes.toFixed(1)}`,
    "",
    "## Recommendations",
    ""
  ];

  for (const recommendation of report.recommendations) {
    lines.push(`- ${recommendation}`);
  }

  lines.push("", "## Class Pairs", "");
  lines.push("| Pair | Attempts | Win | Avg waves |");
  lines.push("| --- | ---: | ---: | ---: |");

  for (const [pair, stats] of Object.entries(report.classPairs).sort(
    (a, b) => b[1].attempts - a[1].attempts
  )) {
    lines.push(
      `| ${pair} | ${stats.attempts} | ${formatPercent(
        stats.winRate
      )} | ${stats.averageWavesCleared.toFixed(2)} |`
    );
  }

  lines.push("", "## Tower Usage", "");
  lines.push("| Tower | Built | Share | Kills | Damage |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");

  for (const tower of towerDefinitions) {
    const usage = report.towerUsage[tower.id];

    lines.push(
      `| ${tower.shortName} | ${usage.built} | ${formatPercent(
        usage.buildShare
      )} | ${usage.kills} | ${Math.round(usage.damage)} |`
    );
  }

  lines.push("", "## Replay Samples", "");

  for (const replay of report.replaySamples) {
    const lastAction = replay.actions.at(-1);

    lines.push(
      `- seed ${replay.seed}: ${replay.bot}, ${replay.actions.length} actions, last=${lastAction?.action.type ?? "none"}, crash=${replay.crash ?? "no"}`
    );
  }

  return `${lines.join("\n")}\n`;
};

export const formatAiDashboardHtml = (report: AiSimulationReport): string => {
  const topTowers = Object.entries(report.towerUsage)
    .map(([towerId, stats]) => ({
      tower: getTowerDefinition(towerId),
      stats
    }))
    .sort((a, b) => b.stats.built - a.stats.built)
    .slice(0, 14);
  const classRows = Object.entries(report.classPairs)
    .sort((a, b) => b[1].attempts - a[1].attempts)
    .slice(0, 16);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aegis Sacra TD - AI Balance Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #05070d;
      --panel: rgba(13, 18, 28, 0.88);
      --line: rgba(194, 214, 255, 0.16);
      --text: #edf5ff;
      --muted: #8e9caf;
      --cyan: #65e8ff;
      --gold: #ffd679;
      --pink: #ff5f9d;
      --green: #a8ff91;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 20% 0%, rgba(101, 232, 255, 0.12), transparent 32%),
        radial-gradient(circle at 80% 0%, rgba(255, 95, 157, 0.12), transparent 30%),
        var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0 48px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 28px; line-height: 34px; font-weight: 760; }
    h2 { margin: 0 0 14px; font-size: 16px; line-height: 22px; font-weight: 700; color: var(--cyan); }
    .meta { color: var(--muted); font-size: 12px; line-height: 18px; font-weight: 600; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .card, section {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .card { padding: 16px; }
    .label { color: var(--muted); font-size: 11px; line-height: 14px; font-weight: 700; text-transform: uppercase; }
    .value { margin-top: 6px; font-size: 28px; line-height: 32px; font-weight: 780; }
    .cyan { color: var(--cyan); }
    .gold { color: var(--gold); }
    .pink { color: var(--pink); }
    .green { color: var(--green); }
    section { padding: 18px; margin-top: 16px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 18px; }
    th { color: var(--muted); text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0; }
    td, th { padding: 10px 8px; border-bottom: 1px solid rgba(194, 214, 255, 0.1); }
    tr:last-child td { border-bottom: 0; }
    .bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; min-width: 120px; }
    .bar > i { display:block; height: 100%; background: linear-gradient(90deg, var(--cyan), var(--gold)); }
    ul { margin: 0; padding-left: 18px; color: var(--text); }
    li { margin: 8px 0; }
    @media (max-width: 760px) {
      header { display: block; }
      .grid { grid-template-columns: repeat(2, 1fr); }
      .value { font-size: 22px; line-height: 28px; }
      main { width: min(100vw - 24px, 1180px); padding-top: 20px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="meta">Aegis Sacra TD / ${escapeHtml(report.version)}</div>
        <h1>AI Balance Dashboard</h1>
      </div>
      <div class="meta">Bot ${escapeHtml(report.bot)} · ${report.episodes} episódios · seed ${report.seed}</div>
    </header>
    <div class="grid">
      <div class="card"><div class="label">Win rate</div><div class="value cyan">${formatPercent(report.winRate)}</div></div>
      <div class="card"><div class="label">Waves médias</div><div class="value gold">${report.averageWavesCleared.toFixed(2)}</div></div>
      <div class="card"><div class="label">Inválidas</div><div class="value pink">${report.invalidActions}</div></div>
      <div class="card"><div class="label">Bugs / 1000</div><div class="value green">${report.bugsPerThousandEpisodes.toFixed(1)}</div></div>
    </div>
    <section>
      <h2>Recomendações</h2>
      <ul>${report.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Duplas de classes</h2>
      <table>
        <thead><tr><th>Dupla</th><th>Tentativas</th><th>Vitória</th><th>Waves</th></tr></thead>
        <tbody>
          ${classRows
            .map(
              ([pair, stats]) => `<tr><td>${escapeHtml(pair)}</td><td>${stats.attempts}</td><td>${formatPercent(
                stats.winRate
              )}</td><td>${stats.averageWavesCleared.toFixed(2)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Torres mais usadas</h2>
      <table>
        <thead><tr><th>Torre</th><th>Uso</th><th>Abates</th><th>Dano</th><th>Share</th></tr></thead>
        <tbody>
          ${topTowers
            .map(
              ({ tower, stats }) => `<tr><td>${escapeHtml(tower.shortName)}</td><td>${stats.built}</td><td>${
                stats.kills
              }</td><td>${Math.round(stats.damage)}</td><td><div class="bar"><i style="width:${Math.min(
                100,
                stats.buildShare * 100
              ).toFixed(1)}%"></i></div></td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
};

const getEpisodeResult = (
  state: HeadlessGameState,
  crashed: boolean,
  steps: number,
  maxSteps: number
): "victory" | "defeat" | "timeout" => {
  if (crashed) {
    return "defeat";
  }

  if (state.phase === "victory") {
    return "victory";
  }

  if (state.phase === "defeat") {
    return "defeat";
  }

  return steps >= maxSteps ? "timeout" : "defeat";
};

const createTowerUsage = (): Record<string, MutableTowerUsageStats> =>
  Object.fromEntries(
    towerDefinitions.map((tower) => [
      tower.id,
      {
        built: 0,
        damage: 0,
        kills: 0
      }
    ])
  );

const collectTowerUsage = (
  usage: Record<string, MutableTowerUsageStats>,
  state: HeadlessGameState
): void => {
  for (const tower of state.towers) {
    const bucket = usage[tower.typeId];

    if (!bucket) {
      continue;
    }

    bucket.built += 1;
    bucket.damage += tower.damageDealt;
    bucket.kills += tower.kills;
  }
};

const finalizeClassPairs = (
  stats: Record<string, MutableClassPairStats>
): Record<string, ClassPairStats> =>
  Object.fromEntries(
    Object.entries(stats).map(([pair, value]) => [
      pair,
      {
        attempts: value.attempts,
        wins: value.wins,
        winRate: value.attempts > 0 ? value.wins / value.attempts : 0,
        averageWavesCleared:
          value.attempts > 0 ? value.wavesCleared / value.attempts : 0
      }
    ])
  );

const finalizeTowerUsage = (
  usage: Record<string, MutableTowerUsageStats>,
  totalBuilt: number
): Record<string, TowerUsageStats> =>
  Object.fromEntries(
    Object.entries(usage).map(([towerId, value]) => [
      towerId,
      {
        built: value.built,
        damage: value.damage,
        kills: value.kills,
        buildShare: totalBuilt > 0 ? value.built / totalBuilt : 0
      }
    ])
  );

const createRecommendations = (report: AiSimulationReport): string[] => {
  const recommendations: string[] = [];

  if (report.timeoutRate > 0.03) {
    recommendations.push(
      `Timeout alto (${formatPercent(report.timeoutRate)}). Investigar replays: pode haver softlock de pronto, recompensa ou wave.`
    );
  }

  if (report.invariantFailures > 0) {
    recommendations.push(
      `${report.invariantFailures} falhas de invariante. Corrigir antes de treinar RL ou publicar build.`
    );
  }

  if (report.bot === "bughunter" && report.invalidActions < report.episodes * 0.8) {
    recommendations.push(
      "BugHunter esta gerando poucas acoes invalidas por episodio. Aumentar agressividade para cobrir mais bordas de regra."
    );
  }

  if (report.winRate < 0.42 && report.bot !== "bughunter") {
    recommendations.push(
      `Dificuldade alta para ${report.bot}: ${formatPercent(report.winRate)} de vitoria. Revisar waves com mais derrotas no replay.`
    );
  }

  if (report.winRate > 0.78 && report.bot !== "bughunter") {
    recommendations.push(
      `Dificuldade baixa para ${report.bot}: ${formatPercent(report.winRate)} de vitoria. Aumentar pressao nas waves 8-10.`
    );
  }

  const unusedTowers = Object.entries(report.towerUsage).filter(([, tower]) => tower.buildShare < 0.015);

  if (unusedTowers.length > 0) {
    recommendations.push(
      `${unusedTowers.length} torres quase nunca usadas. Melhorar descrição, custo ou função situacional antes de adicionar novas.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Sem alerta crítico nesta bateria. Proxima etapa: ampliar seeds e comparar por dupla de religioes.");
  }

  return recommendations;
};

const getClassShortName = (classId: string): string =>
  playerClassDefinitions.find((definition) => definition.id === classId)?.shortName ?? classId;

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type { BotId, GameAction };
