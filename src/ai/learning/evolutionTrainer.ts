import { playerClassDefinitions } from "../../game/data/playerClasses";
import type { PlayerId } from "../../game/models/types";
import { Rng } from "../env/Rng";
import { TowerDefenseEnv } from "../env/TowerDefenseEnv";
import type { HeadlessGameState } from "../env/types";
import {
  choosePolicyAction,
  createCrossoverPolicy,
  createMutatedPolicy,
  createRandomPolicy,
  defaultProPolicy,
  normalizePolicy,
  type LearningPolicy
} from "./policy";

export type TrainingOptions = {
  seed?: number;
  generations?: number;
  population?: number;
  episodesPerPolicy?: number;
  eliteCount?: number;
  mutationRate?: number;
  mutationScale?: number;
  maxSteps?: number;
  curriculum?: boolean;
  promotionEpisodes?: number;
  seedPolicies?: readonly LearningPolicy[];
};

type NormalizedTrainingOptions = Required<Omit<TrainingOptions, "seedPolicies">> & {
  seedPolicies: readonly LearningPolicy[];
  seedPolicyIds: readonly string[];
};

export type PolicyEvaluation = {
  policy: LearningPolicy;
  fitness: number;
  winRate: number;
  averageWavesCleared: number;
  averageBaseHp: number;
  averageSteps: number;
  invalidActions: number;
  invariantFailures: number;
  timeoutRate: number;
};

export type GenerationSummary = {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  bestWinRate: number;
  bestAverageWaves: number;
  bestPolicyId: string;
};

export type TrainingReport = {
  version: string;
  generatedAt: string;
  options: NormalizedTrainingOptions;
  champion: PolicyEvaluation;
  baseline: PolicyEvaluation;
  improvement: {
    fitness: number;
    winRate: number;
    averageWavesCleared: number;
  };
  generations: GenerationSummary[];
  recommendations: string[];
};

const TRAINING_VERSION = "aegis-self-learning-v1";
const playerIds: readonly PlayerId[] = ["p1", "p2"];

export const trainPolicy = (options: TrainingOptions = {}): TrainingReport => {
  const normalized: NormalizedTrainingOptions = {
    seed: options.seed ?? 14729,
    generations: options.generations ?? 8,
    population: options.population ?? 28,
    episodesPerPolicy: options.episodesPerPolicy ?? 60,
    eliteCount: options.eliteCount ?? 6,
    mutationRate: options.mutationRate ?? 0.38,
    mutationScale: options.mutationScale ?? 0.18,
    maxSteps: options.maxSteps ?? 280,
    curriculum: options.curriculum ?? true,
    promotionEpisodes: options.promotionEpisodes ?? Math.max(180, Math.floor((options.episodesPerPolicy ?? 60) * 3)),
    seedPolicies: options.seedPolicies ?? [],
    seedPolicyIds: (options.seedPolicies ?? []).map((policy) => policy.id)
  };
  const rng = new Rng(normalized.seed);
  const seededPolicies = dedupePolicies([defaultProPolicy, ...normalized.seedPolicies]).map(normalizePolicy);
  const randomCount = Math.max(0, normalized.population - seededPolicies.length);
  const population: LearningPolicy[] = [
    ...seededPolicies,
    ...Array.from({ length: randomCount }, () => createRandomPolicy(rng))
  ].slice(0, normalized.population);
  const startingChampion = [
    defaultProPolicy,
    ...normalized.seedPolicies.map(normalizePolicy)
  ]
    .map((policy, index) =>
      evaluatePolicy(policy, normalized, normalized.seed + 11 + index * 997, normalized.generations)
    )
    .sort((a, b) => b.fitness - a.fitness)[0];
  const generationSummaries: GenerationSummary[] = [];
  let currentPopulation = population;
  let champion = startingChampion;

  for (let generation = 0; generation < normalized.generations; generation += 1) {
    const evaluations = currentPopulation
      .map((policy, index) =>
        evaluatePolicy(policy, normalized, normalized.seed + generation * 100_003 + index * 4099, generation)
      )
      .sort((a, b) => b.fitness - a.fitness);
    const generationBest = evaluations[0];

    if (generationBest.fitness > champion.fitness) {
      champion = generationBest;
    }

    generationSummaries.push({
      generation,
      bestFitness: generationBest.fitness,
      averageFitness:
        evaluations.reduce((sum, evaluation) => sum + evaluation.fitness, 0) / evaluations.length,
      bestWinRate: generationBest.winRate,
      bestAverageWaves: generationBest.averageWavesCleared,
      bestPolicyId: generationBest.policy.id
    });

    const elites = evaluations.slice(0, normalized.eliteCount).map((evaluation) => evaluation.policy);
    const nextPopulation: LearningPolicy[] = [champion.policy, ...elites.slice(0, normalized.eliteCount - 1)];

    while (nextPopulation.length < normalized.population) {
      const parentA = tournamentPick(evaluations, rng).policy;
      const parentB = tournamentPick(evaluations, rng).policy;
      const child =
        rng.next() < 0.68
          ? createCrossoverPolicy(
              parentA,
              parentB,
              rng,
              generation + 1,
              normalized.mutationRate,
              normalized.mutationScale
            )
          : createMutatedPolicy(
              parentA,
              rng,
              generation + 1,
              normalized.mutationRate,
              normalized.mutationScale
            );

      nextPopulation.push(child);
    }

    currentPopulation = nextPopulation;
  }

  const promotionOptions: NormalizedTrainingOptions = {
    ...normalized,
    episodesPerPolicy: normalized.promotionEpisodes,
    curriculum: false
  };
  const promotionSeed = normalized.seed + 9911;
  const baseline = evaluatePolicy(defaultProPolicy, promotionOptions, promotionSeed, normalized.generations);
  const candidateChampion = evaluatePolicy(
    champion.policy,
    promotionOptions,
    promotionSeed,
    normalized.generations
  );
  const incumbentEvaluations = dedupePolicies([defaultProPolicy, ...normalized.seedPolicies.map(normalizePolicy)])
    .map((policy) => evaluatePolicy(policy, promotionOptions, promotionSeed, normalized.generations));
  const finalChampion = [candidateChampion, baseline, ...incumbentEvaluations].sort(
    (a, b) => b.fitness - a.fitness
  )[0];

  return {
    version: TRAINING_VERSION,
    generatedAt: new Date().toISOString(),
    options: normalized,
    champion: finalChampion,
    baseline,
    improvement: {
      fitness: finalChampion.fitness - baseline.fitness,
      winRate: finalChampion.winRate - baseline.winRate,
      averageWavesCleared: finalChampion.averageWavesCleared - baseline.averageWavesCleared
    },
    generations: generationSummaries,
    recommendations: createTrainingRecommendations(finalChampion, baseline, generationSummaries)
  };
};

export const evaluatePolicy = (
  policy: LearningPolicy,
  options: NormalizedTrainingOptions,
  seed: number,
  generation: number
): PolicyEvaluation => {
  const rng = new Rng(seed);
  const episodes = getCurriculumEpisodes(options, generation);
  let wins = 0;
  let waves = 0;
  let baseHp = 0;
  let stepsTotal = 0;
  let invalidActions = 0;
  let invariantFailures = 0;
  let timeouts = 0;

  for (let episode = 0; episode < episodes; episode += 1) {
    const episodeSeed = seed + episode * 13_337;
    const env = new TowerDefenseEnv();
    let state = env.reset({
      seed: episodeSeed,
      players: pickTrainingClasses(rng, episode)
    });
    let steps = 0;

    for (; steps < options.maxSteps; steps += 1) {
      const action = choosePolicyAction(policy, state, playerIds, rng);
      const result = env.step(action);

      invalidActions += result.errors.length;
      invariantFailures += result.invariantFailures.length;
      state = result.state;

      if (result.done) {
        break;
      }
    }

    const result = getEpisodeResult(state, steps, options.maxSteps);

    if (result === "victory") {
      wins += 1;
    }

    if (result === "timeout") {
      timeouts += 1;
    }

    waves += state.waveLog.filter((wave) => wave.cleared).length;
    baseHp += state.baseHp;
    stepsTotal += steps;
  }

  const winRate = wins / episodes;
  const averageWavesCleared = waves / episodes;
  const averageBaseHp = baseHp / episodes;
  const timeoutRate = timeouts / episodes;
  const fitness =
    winRate * 1250 +
    averageWavesCleared * 58 +
    averageBaseHp * 7 -
    timeoutRate * 250 -
    invariantFailures * 20 -
    invalidActions * 0.6;

  return {
    policy,
    fitness,
    winRate,
    averageWavesCleared,
    averageBaseHp,
    averageSteps: stepsTotal / episodes,
    invalidActions,
    invariantFailures,
    timeoutRate
  };
};

export const formatTrainingMarkdown = (report: TrainingReport): string => {
  const lines = [
    "# Aegis Self-Learning Training",
    "",
    `- Version: ${report.version}`,
    `- Generated: ${report.generatedAt}`,
    `- Seed: ${report.options.seed}`,
    `- Generations: ${report.options.generations}`,
    `- Population: ${report.options.population}`,
    `- Episodes per policy: ${report.options.episodesPerPolicy}`,
    `- Promotion episodes: ${report.options.promotionEpisodes}`,
    `- Champion: ${report.champion.policy.id}`,
    `- Champion win rate: ${formatPercent(report.champion.winRate)}`,
    `- Baseline win rate: ${formatPercent(report.baseline.winRate)}`,
    `- Win-rate improvement: ${formatSignedPercent(report.improvement.winRate)}`,
    `- Champion average waves: ${report.champion.averageWavesCleared.toFixed(2)}`,
    "",
    "## Recommendations",
    ""
  ];

  for (const recommendation of report.recommendations) {
    lines.push(`- ${recommendation}`);
  }

  lines.push("", "## Generations", "");
  lines.push("| Gen | Best fitness | Avg fitness | Best win | Avg waves | Policy |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | --- |");

  for (const generation of report.generations) {
    lines.push(
      `| ${generation.generation} | ${generation.bestFitness.toFixed(1)} | ${generation.averageFitness.toFixed(
        1
      )} | ${formatPercent(generation.bestWinRate)} | ${generation.bestAverageWaves.toFixed(2)} | ${generation.bestPolicyId} |`
    );
  }

  lines.push("", "## Champion Policy", "");
  lines.push("```json");
  lines.push(JSON.stringify(report.champion.policy, null, 2));
  lines.push("```");

  return `${lines.join("\n")}\n`;
};

export const formatTrainingDashboardHtml = (report: TrainingReport): string => {
  const data = {
    champion: {
      id: report.champion.policy.id,
      winRate: report.champion.winRate,
      fitness: report.champion.fitness,
      waves: report.champion.averageWavesCleared,
      baseHp: report.champion.averageBaseHp
    },
    baseline: {
      winRate: report.baseline.winRate,
      fitness: report.baseline.fitness,
      waves: report.baseline.averageWavesCleared
    },
    improvement: report.improvement,
    generations: report.generations,
    recommendations: report.recommendations
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aegis AI Training</title>
  <style>
    :root { color-scheme: dark; --bg:#05070d; --panel:#0e1522; --line:rgba(220,232,255,.16); --text:#f4f8ff; --muted:#94a3b8; --cyan:#65e8ff; --gold:#ffd36d; --pink:#ff5e9c; --green:#9cff88; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:radial-gradient(circle at 20% 0%, rgba(101,232,255,.14), transparent 32%), radial-gradient(circle at 80% 0%, rgba(255,94,156,.12), transparent 30%), var(--bg); color:var(--text); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing:0; }
    main { width:min(1200px, calc(100vw - 32px)); margin:0 auto; padding:32px 0 48px; }
    h1 { margin:0; font-size:30px; line-height:36px; }
    h2 { margin:0 0 12px; font-size:15px; line-height:20px; color:var(--cyan); }
    p { margin:8px 0 0; color:var(--muted); font-size:13px; line-height:20px; max-width:760px; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin:22px 0 14px; }
    .card, section { border:1px solid var(--line); background:rgba(14,21,34,.88); border-radius:10px; box-shadow:0 18px 60px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04); }
    .card { padding:16px; }
    .label { color:var(--muted); font-size:11px; line-height:14px; font-weight:760; text-transform:uppercase; }
    .value { margin-top:8px; font-size:28px; line-height:34px; font-weight:780; }
    section { padding:18px; margin-top:14px; }
    .bars { display:grid; gap:10px; }
    .bar { display:grid; grid-template-columns:90px minmax(0,1fr) 72px; gap:10px; align-items:center; }
    .bar label { color:#dce8ff; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .track { height:10px; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; }
    .track i { display:block; height:100%; background:linear-gradient(90deg,var(--cyan),var(--gold)); }
    output { color:var(--muted); font-size:12px; text-align:right; }
    ul { margin:0; padding-left:18px; color:#dce8ff; }
    li { margin:8px 0; font-size:13px; line-height:20px; }
    @media (max-width: 820px) { .grid { grid-template-columns:repeat(2,1fr); } }
    @media (max-width: 560px) { main { width:calc(100vw - 20px); } .grid { grid-template-columns:1fr; } .bar { grid-template-columns:70px minmax(0,1fr) 58px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="label">Aegis Sacra TD / Self-Learning</div>
      <h1>Treinamento evolutivo da IA</h1>
      <p>População de políticas, curriculum por geração, mutação/crossover e avaliação headless. Inspirado na disciplina de treino em massa dos bots competitivos, sem depender de tela ou LLM em tempo real.</p>
    </header>
    <div class="grid">
      <div class="card"><div class="label">Champion win</div><div class="value" style="color:var(--green)">${formatPercent(report.champion.winRate)}</div></div>
      <div class="card"><div class="label">Baseline win</div><div class="value" style="color:var(--cyan)">${formatPercent(report.baseline.winRate)}</div></div>
      <div class="card"><div class="label">Melhoria</div><div class="value" style="color:var(--gold)">${formatSignedPercent(report.improvement.winRate)}</div></div>
      <div class="card"><div class="label">Fitness</div><div class="value" style="color:var(--pink)">${report.champion.fitness.toFixed(0)}</div></div>
    </div>
    <section>
      <h2>Evolução por geração</h2>
      <div class="bars" id="generation-bars"></div>
    </section>
    <section>
      <h2>Recomendações</h2>
      <ul>${report.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  </main>
  <script type="application/json" id="training-data">${escapeJsonForHtml(JSON.stringify(data))}</script>
  <script>
    const data = JSON.parse(document.getElementById("training-data").textContent);
    const maxFitness = Math.max(...data.generations.map(g => g.bestFitness), 1);
    const pct = value => (value * 100).toFixed(1) + "%";
    document.getElementById("generation-bars").innerHTML = data.generations.map(g => {
      const width = Math.max(0, Math.min(100, (g.bestFitness / maxFitness) * 100));
      return '<div class="bar"><label>G' + g.generation + '</label><div class="track"><i style="width:' + width.toFixed(1) + '%"></i></div><output>' + pct(g.bestWinRate) + '</output></div>';
    }).join("");
  </script>
</body>
</html>`;
};

export const formatChampionDatasetJsonl = (report: TrainingReport): string => {
  const rows: {
    kind: string;
    input: Record<string, unknown>;
    target: Record<string, unknown>;
  }[] = report.generations.map((generation) => ({
    kind: "policy_generation",
    input: {
      generation: generation.generation,
      population: report.options.population,
      episodesPerPolicy: report.options.episodesPerPolicy
    },
    target: {
      bestFitness: generation.bestFitness,
      averageFitness: generation.averageFitness,
      bestWinRate: generation.bestWinRate,
      bestAverageWaves: generation.bestAverageWaves
    }
  }));

  rows.push({
    kind: "champion_policy",
    input: {
      baselineWinRate: report.baseline.winRate,
      baselineFitness: report.baseline.fitness
    },
    target: {
      championPolicy: report.champion.policy,
      championWinRate: report.champion.winRate,
      championFitness: report.champion.fitness,
      improvement: report.improvement
    }
  });

  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
};

const getCurriculumEpisodes = (
  options: NormalizedTrainingOptions,
  generation: number
): number => {
  if (!options.curriculum) {
    return options.episodesPerPolicy;
  }

  const ramp = 0.42 + Math.min(0.58, generation / Math.max(1, options.generations - 1) * 0.58);

  return Math.max(10, Math.floor(options.episodesPerPolicy * ramp));
};

const pickTrainingClasses = (
  rng: Rng,
  episode: number
): Partial<Record<PlayerId, string>> => {
  const p1 = playerClassDefinitions[episode % playerClassDefinitions.length];
  const p2 = rng.pick(playerClassDefinitions);

  return { p1: p1.id, p2: p2.id };
};

const tournamentPick = (
  evaluations: readonly PolicyEvaluation[],
  rng: Rng
): PolicyEvaluation => {
  const sample = Array.from({ length: 4 }, () => rng.pick(evaluations));

  return sample.sort((a, b) => b.fitness - a.fitness)[0];
};

const dedupePolicies = (policies: readonly LearningPolicy[]): LearningPolicy[] => {
  const byId = new Map<string, LearningPolicy>();

  for (const policy of policies) {
    byId.set(policy.id, policy);
  }

  return [...byId.values()];
};

const getEpisodeResult = (
  state: HeadlessGameState,
  steps: number,
  maxSteps: number
): "victory" | "defeat" | "timeout" => {
  if (state.phase === "victory") {
    return "victory";
  }

  if (state.phase === "defeat") {
    return "defeat";
  }

  return steps >= maxSteps ? "timeout" : "defeat";
};

const createTrainingRecommendations = (
  champion: PolicyEvaluation,
  baseline: PolicyEvaluation,
  generations: readonly GenerationSummary[]
): string[] => {
  const recommendations: string[] = [];

  if (champion.winRate <= baseline.winRate) {
    recommendations.push("Campeao ainda nao superou a baseline em win rate. Aumentar population/generations ou melhorar espaco de ações.");
  } else {
    recommendations.push("Campeao superou a baseline. Usar como candidato para ProBot ou parceiro IA.");
  }

  if (champion.invariantFailures > 0) {
    recommendations.push("Treinamento encontrou falha de invariante. Promover replay para teste de regressao antes de continuar.");
  }

  if (champion.averageWavesCleared < 9) {
    recommendations.push("Campeao ainda morre antes do fim com frequencia. Aumentar peso de preparo anti-boss e rotas novas.");
  }

  if (generations.length >= 3) {
    const last = generations.at(-1);
    const previous = generations.at(-3);

    if (last && previous && last.bestFitness <= previous.bestFitness * 1.015) {
      recommendations.push("Evolucao entrou em plato. Aumentar mutacao, adicionar busca por posicionamento ou diversificar classes por curriculum.");
    }
  }

  recommendations.push("Proxima etapa forte: gravar replay de campeoes e comparar heatmap de tiles para ensinar posicionamento real.");

  return recommendations;
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const formatSignedPercent = (value: number): string =>
  `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeJsonForHtml = (value: string): string =>
  value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
