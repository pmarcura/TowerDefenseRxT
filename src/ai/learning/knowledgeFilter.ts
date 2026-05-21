/**
 * AI Knowledge Filter & Distillation System
 *
 * Filters game experience to extract only "relevant and eternal" knowledge:
 * - Positioning patterns that reliably work (choke coverage, path overlap)
 * - Build-order heuristics that correlate with wins
 * - Tower synergy discoveries (e.g. mark + high-damage = effective)
 * - Bug/exploit detection (unintended mechanics the AI discovers)
 * - Anti-patterns (things that consistently lose)
 *
 * This module runs after batch training episodes and condenses raw episode
 * data into compact strategy knowledge objects.
 */

import type { PlayerId, TowerDefinition } from "../../game/models/types";
import type { HeadlessGameState, HeadlessTowerState } from "../env/types";
import type { LearningPolicy, PolicyWeights } from "./policy";

// ── Types ──

/** A discovered technique or pattern the AI should remember */
export type AiKnowledge = {
  id: string;
  category: KnowledgeCategory;
  description: string;
  confidence: number;       // 0..1 — how reliable this knowledge is
  sampleSize: number;       // how many episodes contributed
  discoveredAt: string;     // ISO timestamp
  generation: number;
  data: KnowledgeData;
};

export type KnowledgeCategory =
  | "positioning"
  | "build-order"
  | "synergy"
  | "economy"
  | "exploit"
  | "anti-pattern";

export type KnowledgeData =
  | PositioningKnowledge
  | BuildOrderKnowledge
  | SynergyKnowledge
  | EconomyKnowledge
  | ExploitKnowledge
  | AntiPatternKnowledge;

export type PositioningKnowledge = {
  type: "positioning";
  /** Grid zones that reliably contribute to wins */
  hotZones: { col: number; row: number; winCorrelation: number }[];
  /** Average path coverage ratio for winning layouts */
  pathCoverageThreshold: number;
  /** Choke-point utilization rate */
  chokeUtilization: number;
};

export type BuildOrderKnowledge = {
  type: "build-order";
  /** Ordered list of tower effects that correlate with early wins */
  earlyGamePriority: string[];
  /** Wave index where switching to late-game build matters */
  transitionWave: number;
  /** Optimal income tower count discovered */
  optimalIncomeTowers: number;
};

export type SynergyKnowledge = {
  type: "synergy";
  /** Pairs of tower effects that boost win rate when used together */
  effectPairs: { a: string; b: string; winBoost: number }[];
  /** Branch upgrade combos that are especially effective */
  branchCombos: { branchId: string; towerEffect: string; boost: number }[];
};

export type EconomyKnowledge = {
  type: "economy";
  /** Optimal credit reserve per wave for winning games */
  reserveByWave: number[];
  /** Average spend-to-wave ratio in victories */
  spendRatioInWins: number;
  /** Wave where over-saving becomes detrimental */
  savingDeadline: number;
};

export type ExploitKnowledge = {
  type: "exploit";
  /** Description of the discovered mechanic */
  mechanic: string;
  /** Steps to reproduce */
  reproSteps: string[];
  /** Fitness advantage it provides */
  fitnessBoost: number;
};

export type AntiPatternKnowledge = {
  type: "anti-pattern";
  /** What the AI should NOT do */
  pattern: string;
  /** Fitness penalty when this pattern appears */
  fitnessPenalty: number;
  /** How frequently this appeared in losing games */
  lossCorrelation: number;
};

// ── Episode Snapshot ──

export type EpisodeSnapshot = {
  seed: number;
  result: "victory" | "defeat" | "timeout";
  wavesCleared: number;
  baseHpRemaining: number;
  steps: number;
  towerPlacements: TowerPlacement[];
  economyLog: EconomyLogEntry[];
  policy: LearningPolicy;
};

export type TowerPlacement = {
  wave: number;
  typeId: string;
  effect: string;
  grid: { col: number; row: number };
  ownerId: string;
};

export type EconomyLogEntry = {
  wave: number;
  creditsAtStart: number;
  creditsSpent: number;
  creditsEarned: number;
};

// ── Knowledge Extraction ──

/**
 * Extract relevant knowledge from a batch of episodes.
 * This is the "filter for eternal knowledge" the user requested.
 */
export const extractKnowledge = (
  episodes: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge[] => {
  const knowledge: AiKnowledge[] = [];
  const wins = episodes.filter((e) => e.result === "victory");
  const losses = episodes.filter((e) => e.result !== "victory");

  if (episodes.length < 10) {
    return knowledge;
  }

  // 1. Positioning analysis
  const posKnowledge = extractPositioningKnowledge(wins, losses, generation);
  if (posKnowledge) knowledge.push(posKnowledge);

  // 2. Build order analysis
  const buildKnowledge = extractBuildOrderKnowledge(wins, losses, generation);
  if (buildKnowledge) knowledge.push(buildKnowledge);

  // 3. Synergy detection
  const synergyKnowledge = extractSynergyKnowledge(wins, losses, generation);
  if (synergyKnowledge) knowledge.push(synergyKnowledge);

  // 4. Economy patterns
  const econKnowledge = extractEconomyKnowledge(wins, losses, generation);
  if (econKnowledge) knowledge.push(econKnowledge);

  // 5. Exploit detection (anomalous strategies that win far too often)
  const exploits = detectExploits(wins, episodes, generation);
  knowledge.push(...exploits);

  // 6. Anti-pattern detection (things that always lose)
  const antiPatterns = detectAntiPatterns(losses, episodes, generation);
  knowledge.push(...antiPatterns);

  return knowledge;
};

/** Only keep knowledge above a confidence threshold */
export const filterRelevantKnowledge = (
  knowledge: readonly AiKnowledge[],
  minConfidence = 0.6
): AiKnowledge[] =>
  knowledge.filter((k) => k.confidence >= minConfidence && k.sampleSize >= 5);

/** Merge new knowledge with existing, keeping the highest-confidence version */
export const mergeKnowledge = (
  existing: readonly AiKnowledge[],
  incoming: readonly AiKnowledge[]
): AiKnowledge[] => {
  const byId = new Map<string, AiKnowledge>();

  for (const k of existing) {
    byId.set(k.id, k);
  }

  for (const k of incoming) {
    const prev = byId.get(k.id);
    if (!prev || k.confidence > prev.confidence || k.sampleSize > prev.sampleSize) {
      byId.set(k.id, k);
    }
  }

  return [...byId.values()];
};

// ── Internal Extractors ──

const extractPositioningKnowledge = (
  wins: readonly EpisodeSnapshot[],
  losses: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge | null => {
  if (wins.length < 5) return null;

  const gridScores = new Map<string, { wins: number; losses: number }>();

  for (const ep of wins) {
    for (const placement of ep.towerPlacements) {
      const key = `${placement.grid.col},${placement.grid.row}`;
      const entry = gridScores.get(key) ?? { wins: 0, losses: 0 };
      entry.wins += 1;
      gridScores.set(key, entry);
    }
  }

  for (const ep of losses) {
    for (const placement of ep.towerPlacements) {
      const key = `${placement.grid.col},${placement.grid.row}`;
      const entry = gridScores.get(key) ?? { wins: 0, losses: 0 };
      entry.losses += 1;
      gridScores.set(key, entry);
    }
  }

  const hotZones = [...gridScores.entries()]
    .map(([key, counts]) => {
      const [col, row] = key.split(",").map(Number);
      const total = counts.wins + counts.losses;
      return {
        col,
        row,
        winCorrelation: total > 0 ? counts.wins / total : 0,
        total
      };
    })
    .filter((z) => z.total >= 3 && z.winCorrelation > 0.6)
    .sort((a, b) => b.winCorrelation - a.winCorrelation)
    .slice(0, 12)
    .map(({ col, row, winCorrelation }) => ({ col, row, winCorrelation }));

  if (hotZones.length === 0) return null;

  return {
    id: `positioning-g${generation}`,
    category: "positioning",
    description: `${hotZones.length} zonas quentes descobertas com correlação de vitória > 60%`,
    confidence: Math.min(1, wins.length / 20),
    sampleSize: wins.length + losses.length,
    discoveredAt: new Date().toISOString(),
    generation,
    data: {
      type: "positioning",
      hotZones,
      pathCoverageThreshold: 0.7,
      chokeUtilization: hotZones.length > 3 ? 0.8 : 0.5
    }
  };
};

const extractBuildOrderKnowledge = (
  wins: readonly EpisodeSnapshot[],
  losses: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge | null => {
  if (wins.length < 5) return null;

  // Count tower effects in early waves (0-3) for winning games
  const earlyEffects = new Map<string, number>();
  let totalIncomeTowers = 0;

  for (const ep of wins) {
    const earlyPlacements = ep.towerPlacements.filter((p) => p.wave <= 3);
    for (const p of earlyPlacements) {
      earlyEffects.set(p.effect, (earlyEffects.get(p.effect) ?? 0) + 1);
    }
    totalIncomeTowers += ep.towerPlacements.filter((p) => p.effect === "income").length;
  }

  const earlyGamePriority = [...earlyEffects.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([effect]) => effect)
    .slice(0, 5);

  // Find the wave where tower effect diversity spikes (transition point)
  const effectDiversityByWave = new Map<number, Set<string>>();
  for (const ep of wins) {
    for (const p of ep.towerPlacements) {
      const set = effectDiversityByWave.get(p.wave) ?? new Set();
      set.add(p.effect);
      effectDiversityByWave.set(p.wave, set);
    }
  }

  let transitionWave = 5;
  let maxDiversityJump = 0;
  const sortedWaves = [...effectDiversityByWave.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sortedWaves.length; i++) {
    const jump = sortedWaves[i][1].size - sortedWaves[i - 1][1].size;
    if (jump > maxDiversityJump) {
      maxDiversityJump = jump;
      transitionWave = sortedWaves[i][0];
    }
  }

  return {
    id: `build-order-g${generation}`,
    category: "build-order",
    description: `Build order otimizado: ${earlyGamePriority.slice(0, 3).join(" → ")} (transição wave ${transitionWave})`,
    confidence: Math.min(1, wins.length / 15),
    sampleSize: wins.length,
    discoveredAt: new Date().toISOString(),
    generation,
    data: {
      type: "build-order",
      earlyGamePriority,
      transitionWave,
      optimalIncomeTowers: Math.round(totalIncomeTowers / wins.length)
    }
  };
};

const extractSynergyKnowledge = (
  wins: readonly EpisodeSnapshot[],
  losses: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge | null => {
  if (wins.length < 5) return null;

  const pairCounts = new Map<string, { wins: number; losses: number }>();

  const countPairs = (episodes: readonly EpisodeSnapshot[], isWin: boolean) => {
    for (const ep of episodes) {
      const effects = [...new Set(ep.towerPlacements.map((p) => p.effect))];
      for (let i = 0; i < effects.length; i++) {
        for (let j = i + 1; j < effects.length; j++) {
          const key = [effects[i], effects[j]].sort().join("+");
          const entry = pairCounts.get(key) ?? { wins: 0, losses: 0 };
          if (isWin) entry.wins += 1;
          else entry.losses += 1;
          pairCounts.set(key, entry);
        }
      }
    }
  };

  countPairs(wins, true);
  countPairs(losses, false);

  const effectPairs = [...pairCounts.entries()]
    .map(([key, counts]) => {
      const [a, b] = key.split("+");
      const total = counts.wins + counts.losses;
      return { a, b, winBoost: total > 0 ? counts.wins / total - 0.5 : 0, total };
    })
    .filter((p) => p.total >= 3 && p.winBoost > 0.1)
    .sort((a, b) => b.winBoost - a.winBoost)
    .slice(0, 8)
    .map(({ a, b, winBoost }) => ({ a, b, winBoost }));

  if (effectPairs.length === 0) return null;

  return {
    id: `synergy-g${generation}`,
    category: "synergy",
    description: `${effectPairs.length} sinergias de torre detectadas`,
    confidence: Math.min(1, (wins.length + losses.length) / 30),
    sampleSize: wins.length + losses.length,
    discoveredAt: new Date().toISOString(),
    generation,
    data: {
      type: "synergy",
      effectPairs,
      branchCombos: []
    }
  };
};

const extractEconomyKnowledge = (
  wins: readonly EpisodeSnapshot[],
  losses: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge | null => {
  if (wins.length < 5) return null;

  // Compute average credit reserve by wave for winners
  const reserveByWave: number[] = [];
  const waveSpendRatios: number[] = [];

  for (const ep of wins) {
    for (const log of ep.economyLog) {
      while (reserveByWave.length <= log.wave) reserveByWave.push(0);
      reserveByWave[log.wave] += log.creditsAtStart;
      if (log.creditsEarned > 0) {
        waveSpendRatios.push(log.creditsSpent / log.creditsEarned);
      }
    }
  }

  // Normalize by number of winning episodes
  for (let i = 0; i < reserveByWave.length; i++) {
    reserveByWave[i] = Math.round(reserveByWave[i] / wins.length);
  }

  const spendRatioInWins =
    waveSpendRatios.length > 0
      ? waveSpendRatios.reduce((a, b) => a + b, 0) / waveSpendRatios.length
      : 0.7;

  // Find wave where not spending correlates with losses
  let savingDeadline = 10;
  for (const ep of losses) {
    const lateHoarding = ep.economyLog.filter(
      (log) => log.wave >= 5 && log.creditsAtStart > 150 && log.creditsSpent < 30
    );
    if (lateHoarding.length > 0) {
      savingDeadline = Math.min(savingDeadline, lateHoarding[0].wave);
    }
  }

  return {
    id: `economy-g${generation}`,
    category: "economy",
    description: `Reserva ótima por wave definida. Spend ratio em vitórias: ${(spendRatioInWins * 100).toFixed(0)}%`,
    confidence: Math.min(1, wins.length / 15),
    sampleSize: wins.length,
    discoveredAt: new Date().toISOString(),
    generation,
    data: {
      type: "economy",
      reserveByWave,
      spendRatioInWins,
      savingDeadline
    }
  };
};

const detectExploits = (
  wins: readonly EpisodeSnapshot[],
  allEpisodes: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge[] => {
  const exploits: AiKnowledge[] = [];
  const winRate = wins.length / Math.max(1, allEpisodes.length);

  // Detect anomalous tower stacking (same tower type > 5x in wins)
  const towerStackCounts = new Map<string, number>();
  for (const ep of wins) {
    const typeCounts = new Map<string, number>();
    for (const p of ep.towerPlacements) {
      typeCounts.set(p.typeId, (typeCounts.get(p.typeId) ?? 0) + 1);
    }
    for (const [typeId, count] of typeCounts) {
      if (count >= 5) {
        towerStackCounts.set(typeId, (towerStackCounts.get(typeId) ?? 0) + 1);
      }
    }
  }

  for (const [typeId, freq] of towerStackCounts) {
    const stackWinRate = freq / wins.length;
    if (stackWinRate > 0.3 && freq >= 3) {
      exploits.push({
        id: `exploit-stack-${typeId}-g${generation}`,
        category: "exploit",
        description: `Empilhamento de ${typeId} (5+) aparece em ${(stackWinRate * 100).toFixed(0)}% das vitórias`,
        confidence: Math.min(1, freq / 10),
        sampleSize: freq,
        discoveredAt: new Date().toISOString(),
        generation,
        data: {
          type: "exploit",
          mechanic: `Tower stacking: ${typeId} x5+`,
          reproSteps: [
            `Construir 5+ torres do tipo ${typeId}`,
            "Posicionar próximo ao caminho",
            "Resultado: win rate elevado detectado"
          ],
          fitnessBoost: stackWinRate - winRate
        }
      });
    }
  }

  return exploits;
};

const detectAntiPatterns = (
  losses: readonly EpisodeSnapshot[],
  allEpisodes: readonly EpisodeSnapshot[],
  generation: number
): AiKnowledge[] => {
  const antiPatterns: AiKnowledge[] = [];

  // Detect "no damage towers" anti-pattern
  let noDamageCount = 0;
  for (const ep of losses) {
    const hasDamage = ep.towerPlacements.some((p) =>
      ["damage", "splash", "chain", "mark"].includes(p.effect)
    );
    if (!hasDamage && ep.towerPlacements.length > 0) {
      noDamageCount += 1;
    }
  }

  if (noDamageCount >= 3) {
    antiPatterns.push({
      id: `anti-no-damage-g${generation}`,
      category: "anti-pattern",
      description: "Construir apenas torres utilitárias (sem dano) correlaciona com derrota",
      confidence: Math.min(1, noDamageCount / 8),
      sampleSize: noDamageCount,
      discoveredAt: new Date().toISOString(),
      generation,
      data: {
        type: "anti-pattern",
        pattern: "Nenhuma torre de dano direto (damage/splash/chain/mark) construída",
        fitnessPenalty: 150,
        lossCorrelation: noDamageCount / Math.max(1, losses.length)
      }
    });
  }

  // Detect "late building" anti-pattern (no towers before wave 3)
  let lateBuildCount = 0;
  for (const ep of losses) {
    const earlyTowers = ep.towerPlacements.filter((p) => p.wave <= 2);
    if (earlyTowers.length <= 1 && ep.wavesCleared >= 3) {
      lateBuildCount += 1;
    }
  }

  if (lateBuildCount >= 3) {
    antiPatterns.push({
      id: `anti-late-build-g${generation}`,
      category: "anti-pattern",
      description: "Construir poucas torres antes da wave 3 leva a derrotas frequentes",
      confidence: Math.min(1, lateBuildCount / 8),
      sampleSize: lateBuildCount,
      discoveredAt: new Date().toISOString(),
      generation,
      data: {
        type: "anti-pattern",
        pattern: "Menos de 2 torres construídas até wave 2",
        fitnessPenalty: 200,
        lossCorrelation: lateBuildCount / Math.max(1, losses.length)
      }
    });
  }

  return antiPatterns;
};

/** Format knowledge database as readable markdown for review */
export const formatKnowledgeMarkdown = (knowledge: readonly AiKnowledge[]): string => {
  const lines = [
    "# Aegis AI Knowledge Base",
    "",
    `Total entries: ${knowledge.length}`,
    `Last updated: ${new Date().toISOString()}`,
    ""
  ];

  const categories = [...new Set(knowledge.map((k) => k.category))];

  for (const cat of categories) {
    const items = knowledge.filter((k) => k.category === cat);
    lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length})`);
    lines.push("");

    for (const item of items) {
      lines.push(`### ${item.id}`);
      lines.push(`- **Confidence:** ${(item.confidence * 100).toFixed(0)}%`);
      lines.push(`- **Sample size:** ${item.sampleSize}`);
      lines.push(`- **Description:** ${item.description}`);
      lines.push(`- **Generation:** ${item.generation}`);
      lines.push("");
    }
  }

  return lines.join("\n");
};
