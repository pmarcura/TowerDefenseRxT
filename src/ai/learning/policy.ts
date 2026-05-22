import { getEnemyDefinition } from "../../game/data/enemies";
import { getSkillDefinition } from "../../game/data/skills";
import { getTowerBranchDefinition, towerBranchDefinitions } from "../../game/data/towerBranches";
import { getTowerDefinitionsForClass } from "../../game/data/towers";
import { ENDLESS_BOSS_INTERVAL, getWaveDefinitionsForAnalysis } from "../../game/data/waves";
import type { GameAction } from "../../game/actions/types";
import type {
  GridPoint,
  PlayerId,
  SkillDefinition,
  TowerDefinition,
  TowerUpgradeBranchId,
  GameState
} from "../../game/models/types";
import { getPlayablePlayerIds } from "../../game/utils/players";
import { countPathTilesInRange, gridKey, isGridOnPath, isInsideGrid } from "../../game/utils/grid";
import type { Rng } from "../env/Rng";
import type {
  HeadlessGameState,
  HeadlessTowerState,
  HeadlessPlayerState,
  HeadlessRewardSelectionState,
  HeadlessRewardChoiceState,
  HeadlessPhase
} from "../env/types";
import {
  chooseReadyAction,
  chooseWaitAction,
  getCurrentMap,
  getCurrentWave,
  getTowerCostForState
} from "../bots/botUtils";

import championPolicyJson from "./champion-policy.json";

export type LearningPolicy = {
  id: string;
  generation: number;
  lineage: readonly string[];
  weights: PolicyWeights;
};

export type PolicyWeights = {
  spendPressure: number;
  reserveBase: number;
  reservePerWave: number;
  desiredTowersBase: number;
  desiredTowersPerWave: number;
  upgradeUrgency: number;
  carryUpgradeBias: number;
  cheapBias: number;
  duplicatePenalty: number;
  coverageBias: number;
  routeGrowthBias: number;
  lateGameSpendBias: number;
  buildNearPathBias: number;
  buildEndPathBias: number;
  buildChokeBias: number;
  buildSpacingBias: number;
  effectBias: Record<TowerDefinition["effect"], number>;
  enemyBias: {
    runner: number;
    swarm: number;
    shield: number;
    tank: number;
    boss: number;
  };
  branchBias: Record<TowerUpgradeBranchId, number>;
  rewardBias: {
    damage: number;
    range: number;
    economy: number;
    cost: number;
    rare: number;
    epic: number;
  };
};

export type PolicyDecisionTrace = {
  reason: string;
  score: number;
};

export const championPolicy: LearningPolicy = championPolicyJson as LearningPolicy;

export const getChampionPolicy = (): LearningPolicy => {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("aegis-champion-policy");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.weights) {
          return parsed as LearningPolicy;
        }
      }
    } catch (e) {
      console.warn("Failed to load aegis-champion-policy from localStorage:", e);
    }
  }
  return championPolicy;
};

export const defaultProPolicy: LearningPolicy = {
  id: "pro-seed-policy",
  generation: 0,
  lineage: [],
  weights: {
    spendPressure: 1.18,
    reserveBase: 10,
    reservePerWave: 0.9,
    desiredTowersBase: 4.2,
    desiredTowersPerWave: 1.58,
    upgradeUrgency: 0.44,
    carryUpgradeBias: 0.86,
    cheapBias: 0.46,
    duplicatePenalty: 0.96,
    coverageBias: 1.32,
    routeGrowthBias: 1.08,
    lateGameSpendBias: 2.1,
    buildNearPathBias: 1.18,
    buildEndPathBias: 0.72,
    buildChokeBias: 1.14,
    buildSpacingBias: 0.64,
    effectBias: {
      damage: 1.06,
      slow: 1.18,
      splash: 1.16,
      chain: 1.12,
      income: 0.62,
      summon: 1.08,
      aura: 1.02,
      cleanse: 1.14,
      mark: 1.24,
      "ritual-zone": 1.1,
      redirect: 0.98
    },
    enemyBias: {
      runner: 0.74,
      swarm: 1.14,
      shield: 1.2,
      tank: 1.16,
      boss: 1.36
    },
    branchBias: {
      focus: 1.3,
      reach: 0.86,
      tempo: 1.08,
      rupture: 1.04,
      synod: 0.94
    },
    rewardBias: {
      damage: 1.22,
      range: 0.86,
      economy: 0.88,
      cost: 1.0,
      rare: 1.12,
      epic: 1.24
    }
  }
};

export const normalizePolicy = (policy: LearningPolicy): LearningPolicy => ({
  ...policy,
  weights: {
    ...defaultProPolicy.weights,
    ...policy.weights,
    effectBias: {
      ...defaultProPolicy.weights.effectBias,
      ...policy.weights.effectBias
    },
    enemyBias: {
      ...defaultProPolicy.weights.enemyBias,
      ...policy.weights.enemyBias
    },
    branchBias: {
      ...defaultProPolicy.weights.branchBias,
      ...policy.weights.branchBias
    },
    rewardBias: {
      ...defaultProPolicy.weights.rewardBias,
      ...policy.weights.rewardBias
    }
  }
});

export const choosePolicyAction = (
  policy: LearningPolicy,
  state: HeadlessGameState,
  playerIds: readonly PlayerId[],
  rng: Rng
): GameAction => {
  let resolvedPolicy = policy;
  if (policy === championPolicy) {
    resolvedPolicy = getChampionPolicy();
  }
  const activePolicy = normalizePolicy(resolvedPolicy);
  const rewardAction = choosePolicyReward(activePolicy, state, playerIds);

  if (rewardAction) {
    return rewardAction;
  }

  if (state.phase !== "preparation") {
    return chooseWaitAction();
  }

  const upgradeAction = choosePolicyUpgrade(activePolicy, state, playerIds, rng);

  if (upgradeAction && rng.next() < activePolicy.weights.upgradeUrgency) {
    return upgradeAction;
  }

  const buildAction = choosePolicyBuild(activePolicy, state, playerIds, rng);

  if (buildAction) {
    return buildAction;
  }

  if (upgradeAction) {
    return upgradeAction;
  }

  return chooseReadyAction(state, playerIds);
};

export const createMutatedPolicy = (
  parent: LearningPolicy,
  rng: Rng,
  generation: number,
  mutationRate: number,
  mutationScale: number
): LearningPolicy => ({
  id: `policy-g${generation}-${Math.floor(rng.next() * 1_000_000)}`,
  generation,
  lineage: [parent.id, ...parent.lineage].slice(0, 6),
  weights: mutateWeights(parent.weights, rng, mutationRate, mutationScale)
});

export const createCrossoverPolicy = (
  a: LearningPolicy,
  b: LearningPolicy,
  rng: Rng,
  generation: number,
  mutationRate: number,
  mutationScale: number
): LearningPolicy => ({
  id: `policy-g${generation}-${Math.floor(rng.next() * 1_000_000)}`,
  generation,
  lineage: [a.id, b.id, ...a.lineage, ...b.lineage].slice(0, 8),
  weights: mutateWeights(crossoverWeights(a.weights, b.weights, rng), rng, mutationRate, mutationScale)
});

export const createRandomPolicy = (rng: Rng, generation = 0): LearningPolicy => ({
  id: `policy-random-${generation}-${Math.floor(rng.next() * 1_000_000)}`,
  generation,
  lineage: [],
  weights: mutateWeights(defaultProPolicy.weights, rng, 1, 0.42)
});

const choosePolicyReward = (
  policy: LearningPolicy,
  state: HeadlessGameState,
  playerIds: readonly PlayerId[]
): GameAction | null => {
  if (state.phase !== "reward-selection" || !state.rewardSelection) {
    return null;
  }

  const choice = playerIds
    .map((playerId) => state.rewardSelection?.choices[playerId])
    .filter((entry) => entry && entry.selectedSkillId === null && entry.skillIds.length > 0)
    .sort((a, b) => {
      if (!a || !b) {
        return 0;
      }

      return scoreBestSkill(policy, b.skillIds) - scoreBestSkill(policy, a.skillIds);
    })[0];

  if (!choice) {
    return { type: "WAIT", deltaMs: 250 };
  }

  const skillId = [...choice.skillIds].sort(
    (a, b) => scoreSkill(policy, getSkillDefinition(b)) - scoreSkill(policy, getSkillDefinition(a))
  )[0];

  return {
    type: "SELECT_REWARD",
    playerId: choice.playerId,
    skillId
  };
};

const choosePolicyUpgrade = (
  policy: LearningPolicy,
  state: HeadlessGameState,
  playerIds: readonly PlayerId[],
  rng: Rng
): GameAction | null => {
  const candidates = state.towers
    .filter((tower) => playerIds.includes(tower.ownerId) && tower.skillPoints > 0)
    .map((tower) => ({
      tower,
      branchId: chooseBranch(policy, tower),
      score: scoreUpgradeCandidate(policy, tower, state) + rng.next() * 0.15
    }))
    .filter((entry): entry is { tower: HeadlessTowerState; branchId: TowerUpgradeBranchId; score: number } =>
      entry.branchId !== null
    )
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];

  if (!best) {
    return null;
  }

  return {
    type: "UPGRADE_TOWER",
    playerId: best.tower.ownerId,
    towerId: best.tower.id,
    branchId: best.branchId
  };
};

const choosePolicyBuild = (
  policy: LearningPolicy,
  state: HeadlessGameState,
  playerIds: readonly PlayerId[],
  rng: Rng
): GameAction | null => {
  const currentWave = state.currentWaveIndex;
  const controlledTowers = state.towers.filter((tower) => playerIds.includes(tower.ownerId));
  const desiredTowers =
    playerIds.length *
    (policy.weights.desiredTowersBase +
      currentWave * policy.weights.desiredTowersPerWave +
      (currentWave >= 7 ? policy.weights.lateGameSpendBias * 2 : 0));
  const teamCredits = playerIds.reduce((sum, playerId) => sum + state.players[playerId].credits, 0);
  const reserve = playerIds.length * (policy.weights.reserveBase + currentWave * policy.weights.reservePerWave);
  const shouldSpend =
    controlledTowers.length < desiredTowers ||
    teamCredits > reserve * (1.35 - Math.min(0.55, policy.weights.spendPressure * 0.42));

  if (!shouldSpend) {
    return null;
  }

  const scored = playerIds.flatMap((playerId) => {
    const player = state.players[playerId];

    return getTowerDefinitionsForClass(player.classId)
      .filter((tower) => player.credits >= getTowerCostForState(state, playerId, tower))
      .map((tower) => ({
        playerId,
        tower,
        score: scoreTowerForPolicy(policy, tower, state, playerId) + rng.next() * 0.18
      }));
  });
  const best = scored.sort((a, b) => b.score - a.score)[0];

  if (!best) {
    return null;
  }

  const grid = choosePolicyBuildGrid(policy, state, best.tower, best.playerId, rng);

  if (!grid) {
    return null;
  }

  return {
    type: "BUILD_TOWER",
    playerId: best.playerId,
    towerId: best.tower.id,
    grid
  };
};

const choosePolicyBuildGrid = (
  policy: LearningPolicy,
  state: HeadlessGameState,
  tower: TowerDefinition,
  playerId: PlayerId,
  rng: Rng
): GridPoint | null => {
  const map = getCurrentMap(state);
  const occupied = new Set(state.towers.map((towerEntity) => gridKey(towerEntity.grid)));
  const candidates: { grid: GridPoint; score: number }[] = [];
  const preferredPathIndex = getPreferredPathIndex(playerId, map.paths.length);
  const preferredPath = map.paths[preferredPathIndex] ?? map.paths[0];
  const preferredLaneRow = preferredPath?.[0]?.row ?? Math.floor(map.rows / 2);
  const largeLaneMap = map.columns >= 80 && map.rows >= 80;

  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.columns; col += 1) {
      const grid = { col, row };

      if (!isInsideGrid(grid, map) || isGridOnPath(grid, map) || occupied.has(gridKey(grid))) {
        continue;
      }

      if (
        largeLaneMap &&
        (Math.abs(row - preferredLaneRow) > 6 || col > Math.floor(map.columns * 0.78))
      ) {
        continue;
      }

      const rangeTiles = tower.range / map.tileSize;
      const pathScore = scoreGridAgainstPaths(policy, map.paths, grid, rangeTiles);
      const laneScore = preferredPath
        ? scoreGridAgainstPath(preferredPath, grid, rangeTiles) * (largeLaneMap ? 1.2 : 2.8)
        : 0;
      const coveredPathCount = countCoveredPaths(map.paths, grid, rangeTiles);
      const laneBandScore = largeLaneMap
        ? Math.max(0, 10 - Math.abs(row - preferredLaneRow)) * 3.2
        : 0;
      const lateMergePenalty = largeLaneMap ? Math.max(0, col - Math.floor(map.columns * 0.74)) * 0.72 : 0;
      const nearbyTowerPenalty = state.towers.reduce((penalty, existing) => {
        const distance = Math.abs(existing.grid.col - col) + Math.abs(existing.grid.row - row);

        return penalty + Math.max(0, 4 - distance);
      }, 0);
      const overSharedChokePenalty = Math.max(0, coveredPathCount - 3) * (largeLaneMap ? 8.4 : 2.4);

      candidates.push({
        grid,
        score:
          pathScore +
          laneScore -
          lateMergePenalty +
          laneBandScore -
          overSharedChokePenalty -
          nearbyTowerPenalty * policy.weights.buildSpacingBias * 0.28 +
          rng.next() * 0.35
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0]?.grid ?? null;
};

const getPreferredPathIndex = (playerId: PlayerId, pathCount: number): number => {
  const numericId = Number(playerId.slice(1));
  const safeNumber = Number.isFinite(numericId) ? numericId : 1;

  return Math.max(0, safeNumber - 1) % Math.max(1, pathCount);
};

const countCoveredPaths = (
  paths: readonly (readonly GridPoint[])[],
  grid: GridPoint,
  rangeTiles: number
): number =>
  paths.filter((path) => getBestDistanceToPath(path, grid).distance <= rangeTiles).length;

const scoreGridAgainstPath = (
  path: readonly GridPoint[],
  grid: GridPoint,
  rangeTiles: number
): number => {
  const { distance, progress } = getBestDistanceToPath(path, grid);
  const coverage = distance <= rangeTiles ? 5.5 : -Math.min(5, distance - rangeTiles);
  const tilesInRange = countPathTilesInRange(grid, rangeTiles, path);
  const tileCoverageBonus = Math.min(tilesInRange, 12) * 0.28;

  return coverage + Math.max(0, 7 - distance) * 0.62 + progress * 4.2 + tileCoverageBonus;
};

const getBestDistanceToPath = (
  path: readonly GridPoint[],
  grid: GridPoint
): { distance: number; progress: number } => {
  let distance = Number.POSITIVE_INFINITY;
  let progress = 0;

  path.forEach((point, index) => {
    const dx = point.col - grid.col;
    const dy = point.row - grid.row;
    const candidateDistance = Math.sqrt(dx * dx + dy * dy);

    if (candidateDistance < distance) {
      distance = candidateDistance;
      progress = path.length <= 1 ? 1 : index / (path.length - 1);
    }
  });

  return { distance, progress };
};

const scoreGridAgainstPaths = (
  policy: LearningPolicy,
  paths: readonly (readonly GridPoint[])[],
  grid: GridPoint,
  rangeTiles: number
): number => {
  let score = 0;
  let coveredPaths = 0;

  for (const path of paths) {
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestProgress = 0;

    path.forEach((point, index) => {
      const dx = point.col - grid.col;
      const dy = point.row - grid.row;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestProgress = path.length <= 1 ? 1 : index / (path.length - 1);
      }
    });

    const tilesInRange = countPathTilesInRange(grid, rangeTiles, path);

    if (bestDistance <= rangeTiles) {
      coveredPaths += 1;
      score += 3.5 + Math.min(tilesInRange, 10) * 0.22;
    } else {
      score -= Math.min(4, bestDistance - rangeTiles);
    }

    score += Math.max(0, 6 - bestDistance) * policy.weights.buildNearPathBias;
    score += bestProgress * policy.weights.buildEndPathBias * 3;
  }

  score += Math.max(0, coveredPaths - 1) * policy.weights.buildChokeBias * 4;

  return score;
};

const scoreTowerForPolicy = (
  policy: LearningPolicy,
  tower: TowerDefinition,
  state: HeadlessGameState,
  playerId: PlayerId
): number => {
  const wave = getCurrentWave(state);
  const map = getCurrentMap(state);
  const enemyMix = getEnemyMix();
  const cost = getTowerCostForState(state, playerId, tower);
  const existingSameType = state.towers.filter(
    (candidate) => candidate.ownerId === playerId && candidate.typeId === tower.id
  ).length;
  const alliedTowerCount = state.towers.filter((candidate) => candidate.ownerId === playerId).length;
  const dps = tower.damage > 0 ? tower.damage / Math.max(0.2, tower.cooldownMs / 1000) : 0;
  const costEfficiency = dps / Math.max(32, cost);
  const routePressure = map.paths.length * policy.weights.routeGrowthBias;
  const bossSoon =
    Boolean(wave?.isBoss) ||
    (state.currentWaveIndex + 1) % ENDLESS_BOSS_INTERVAL >= ENDLESS_BOSS_INTERVAL - 1;
  let score =
    3 +
    costEfficiency * 11 +
    policy.weights.effectBias[tower.effect] * 2.2 +
    policy.weights.coverageBias * Math.min(2.2, tower.range / 100) +
    policy.weights.cheapBias * (100 / Math.max(40, cost)) +
    routePressure -
    existingSameType * policy.weights.duplicatePenalty;

  if (tower.effect === "income") {
    score += state.currentWaveIndex <= 3 ? 4.5 * policy.weights.effectBias.income : -5.5;
    score -= existingSameType * 4.2;
  }

  if (tower.effect === "aura") {
    score += alliedTowerCount >= 3 ? alliedTowerCount * 0.9 : -4;
    score -= existingSameType * 3.5;
  }

  if (tower.effect === "mark") {
    score += bossSoon ? policy.weights.enemyBias.boss * 4.8 : enemyMix.tank * 0.16;
  }

  if (tower.effect === "cleanse") {
    score += enemyMix.shield * 0.22 + enemyMix.tank * 0.16;
  }

  if (tower.effect === "splash" || tower.effect === "ritual-zone") {
    score += enemyMix.swarm * 0.08 + enemyMix.shield * 0.14;
  }

  if (tower.effect === "chain") {
    score += enemyMix.runner * 0.05 + enemyMix.swarm * 0.065;
  }

  if (tower.effect === "slow" || tower.effect === "redirect" || tower.effect === "summon") {
    score += map.paths.length > 1 ? 1.6 : 0.6;
    score += bossSoon ? 0.9 : 0.4;
  }

  return score;
};

const scoreUpgradeCandidate = (
  policy: LearningPolicy,
  tower: HeadlessTowerState,
  state: HeadlessGameState
): number => {
  const carryScore =
    tower.damageDealt / 1200 +
    tower.kills * 0.18 +
    tower.level * 0.42 +
    tower.skillPoints * 0.7;
  const bossWave = Boolean(getCurrentWave(state)?.isBoss);

  return carryScore * (1 + policy.weights.carryUpgradeBias) + (bossWave ? 1.2 : 0);
};

const chooseBranch = (
  policy: LearningPolicy,
  tower: HeadlessTowerState
): TowerUpgradeBranchId | null => {
  return [...towerBranchDefinitions]
    .filter((branch) => tower.branchRanks[branch.id] < getTowerBranchDefinition(branch.id).maxRank)
    .sort((a, b) => {
      const aScore = policy.weights.branchBias[a.id] - tower.branchRanks[a.id] * 0.16;
      const bScore = policy.weights.branchBias[b.id] - tower.branchRanks[b.id] * 0.16;

      return bScore - aScore;
    })[0]?.id ?? null;
};

const scoreBestSkill = (policy: LearningPolicy, skillIds: readonly string[]): number =>
  Math.max(...skillIds.map((skillId) => scoreSkill(policy, getSkillDefinition(skillId))));

const scoreSkill = (policy: LearningPolicy, skill: SkillDefinition): number => {
  let score = skill.weight * 0.12;

  score += (skill.effect.damageMultiplier ? 1 : 0) * policy.weights.rewardBias.damage;
  score += (skill.effect.rangeBonus ? 1 : 0) * policy.weights.rewardBias.range;
  score += (skill.effect.rewardMultiplier ? 1 : 0) * policy.weights.rewardBias.economy;
  score += (skill.effect.costMultiplier ? 1 : 0) * policy.weights.rewardBias.cost;
  score += skill.rarity === "rare" ? policy.weights.rewardBias.rare : 0;
  score += skill.rarity === "epic" ? policy.weights.rewardBias.epic : 0;
  score -= skill.costSigils * 0.18;

  return score;
};

const getEnemyMix = () => {
  const mix = {
    runner: 0,
    swarm: 0,
    shield: 0,
    tank: 0,
    boss: 0
  };

  for (const wave of getWaveDefinitionsForAnalysis(24)) {
    for (const group of wave.groups) {
      const enemy = getEnemyDefinition(group.enemyTypeId);

      if (enemy.traits.includes("boss")) {
        mix.boss += group.count;
      } else if (enemy.traits.includes("enxame")) {
        mix.swarm += group.count;
      } else if (enemy.traits.includes("escudo")) {
        mix.shield += group.count;
      } else if (enemy.traits.includes("blindado")) {
        mix.tank += group.count;
      } else {
        mix.runner += group.count;
      }
    }
  }

  return mix;
};

const mutateWeights = (
  weights: PolicyWeights,
  rng: Rng,
  mutationRate: number,
  mutationScale: number
): PolicyWeights => ({
  spendPressure: mutateNumber(weights.spendPressure, rng, mutationRate, mutationScale, 0.05, 1.6),
  reserveBase: mutateNumber(weights.reserveBase, rng, mutationRate, mutationScale * 14, 0, 80),
  reservePerWave: mutateNumber(weights.reservePerWave, rng, mutationRate, mutationScale * 2, 0, 12),
  desiredTowersBase: mutateNumber(weights.desiredTowersBase, rng, mutationRate, mutationScale * 1.8, 1, 8),
  desiredTowersPerWave: mutateNumber(weights.desiredTowersPerWave, rng, mutationRate, mutationScale * 0.55, 0.2, 2.4),
  upgradeUrgency: mutateNumber(weights.upgradeUrgency, rng, mutationRate, mutationScale, 0.05, 1),
  carryUpgradeBias: mutateNumber(weights.carryUpgradeBias, rng, mutationRate, mutationScale, 0, 2),
  cheapBias: mutateNumber(weights.cheapBias, rng, mutationRate, mutationScale, -1, 2),
  duplicatePenalty: mutateNumber(weights.duplicatePenalty, rng, mutationRate, mutationScale, 0, 4),
  coverageBias: mutateNumber(weights.coverageBias, rng, mutationRate, mutationScale, 0, 3),
  routeGrowthBias: mutateNumber(weights.routeGrowthBias, rng, mutationRate, mutationScale, 0, 3),
  lateGameSpendBias: mutateNumber(weights.lateGameSpendBias, rng, mutationRate, mutationScale, 0, 3),
  buildNearPathBias: mutateNumber(weights.buildNearPathBias, rng, mutationRate, mutationScale, 0, 3),
  buildEndPathBias: mutateNumber(weights.buildEndPathBias, rng, mutationRate, mutationScale, 0, 3),
  buildChokeBias: mutateNumber(weights.buildChokeBias, rng, mutationRate, mutationScale, 0, 3),
  buildSpacingBias: mutateNumber(weights.buildSpacingBias, rng, mutationRate, mutationScale, 0, 3),
  effectBias: Object.fromEntries(
    Object.entries(weights.effectBias).map(([key, value]) => [
      key,
      mutateNumber(value, rng, mutationRate, mutationScale, -1, 3)
    ])
  ) as PolicyWeights["effectBias"],
  enemyBias: Object.fromEntries(
    Object.entries(weights.enemyBias).map(([key, value]) => [
      key,
      mutateNumber(value, rng, mutationRate, mutationScale, 0, 3)
    ])
  ) as PolicyWeights["enemyBias"],
  branchBias: Object.fromEntries(
    Object.entries(weights.branchBias).map(([key, value]) => [
      key,
      mutateNumber(value, rng, mutationRate, mutationScale, 0, 3)
    ])
  ) as PolicyWeights["branchBias"],
  rewardBias: Object.fromEntries(
    Object.entries(weights.rewardBias).map(([key, value]) => [
      key,
      mutateNumber(value, rng, mutationRate, mutationScale, 0, 3)
    ])
  ) as PolicyWeights["rewardBias"]
});

const crossoverWeights = (
  a: PolicyWeights,
  b: PolicyWeights,
  rng: Rng
): PolicyWeights => ({
  spendPressure: pick(a.spendPressure, b.spendPressure, rng),
  reserveBase: pick(a.reserveBase, b.reserveBase, rng),
  reservePerWave: pick(a.reservePerWave, b.reservePerWave, rng),
  desiredTowersBase: pick(a.desiredTowersBase, b.desiredTowersBase, rng),
  desiredTowersPerWave: pick(a.desiredTowersPerWave, b.desiredTowersPerWave, rng),
  upgradeUrgency: pick(a.upgradeUrgency, b.upgradeUrgency, rng),
  carryUpgradeBias: pick(a.carryUpgradeBias, b.carryUpgradeBias, rng),
  cheapBias: pick(a.cheapBias, b.cheapBias, rng),
  duplicatePenalty: pick(a.duplicatePenalty, b.duplicatePenalty, rng),
  coverageBias: pick(a.coverageBias, b.coverageBias, rng),
  routeGrowthBias: pick(a.routeGrowthBias, b.routeGrowthBias, rng),
  lateGameSpendBias: pick(a.lateGameSpendBias, b.lateGameSpendBias, rng),
  buildNearPathBias: pick(a.buildNearPathBias, b.buildNearPathBias, rng),
  buildEndPathBias: pick(a.buildEndPathBias, b.buildEndPathBias, rng),
  buildChokeBias: pick(a.buildChokeBias, b.buildChokeBias, rng),
  buildSpacingBias: pick(a.buildSpacingBias, b.buildSpacingBias, rng),
  effectBias: crossoverRecord(a.effectBias, b.effectBias, rng),
  enemyBias: crossoverRecord(a.enemyBias, b.enemyBias, rng),
  branchBias: crossoverRecord(a.branchBias, b.branchBias, rng),
  rewardBias: crossoverRecord(a.rewardBias, b.rewardBias, rng)
});

const crossoverRecord = <TKey extends string>(
  a: Record<TKey, number>,
  b: Record<TKey, number>,
  rng: Rng
): Record<TKey, number> =>
  Object.fromEntries(
    Object.keys(a).map((key) => [key, pick(a[key as TKey], b[key as TKey], rng)])
  ) as Record<TKey, number>;

const mutateNumber = (
  value: number,
  rng: Rng,
  rate: number,
  scale: number,
  min: number,
  max: number
): number => {
  if (rng.next() > rate) {
    return value;
  }

  return Math.max(min, Math.min(max, value + gaussianish(rng) * scale));
};

const gaussianish = (rng: Rng): number =>
  (rng.next() + rng.next() + rng.next() + rng.next() - 2) / 2;

const pick = (a: number, b: number, rng: Rng): number => (rng.next() < 0.5 ? a : b);

export const mapGameStateToHeadless = (fullState: GameState): HeadlessGameState => {
  const players: Record<PlayerId, HeadlessPlayerState> = {} as any;
  for (const playerId of getPlayablePlayerIds(fullState)) {
    const eco = fullState.economies[playerId];
    const stats = fullState.combatStats[playerId];
    const skillTree = fullState.skillTrees[playerId];
    const ready = fullState.wave.readyPlayers[playerId] ?? false;

    players[playerId] = {
      id: playerId,
      classId: fullState.playerClasses[playerId] ?? "",
      credits: eco?.credits ?? 0,
      sigils: skillTree?.bossSigils ?? 0,
      ready,
      skillRanks: skillTree?.skillRanks ?? {},
      damage: stats?.totalDamageDealt ?? 0,
      kills: stats?.kills ?? 0,
      towersBuilt: stats?.towersBuilt ?? 0
    };
  }

  const towers: HeadlessTowerState[] = fullState.towers.map((t) => ({
    id: t.id,
    typeId: t.typeId,
    ownerId: t.ownerId,
    grid: { ...t.grid },
    level: t.level,
    xp: t.xp,
    xpToNext: t.xpToNext,
    skillPoints: t.skillPoints,
    branchRanks: { ...t.branchRanks },
    autoBuildId: t.autoBuildId ?? "balanced",
    kills: t.kills,
    damageDealt: t.damageDealt
  }));

  const rewardSelection: HeadlessRewardSelectionState | null = fullState.rewardSelection ? {
    bossWaveId: fullState.rewardSelection.bossWaveId,
    choices: Object.fromEntries(
      Object.entries(fullState.rewardSelection.choices).map(([pId, choice]) => [
        pId,
        {
          playerId: choice.playerId as PlayerId,
          skillIds: [...choice.skillIds],
          selectedSkillId: choice.selectedSkillId
        }
      ])
    ) as Record<PlayerId, HeadlessRewardChoiceState>
  } : null;

  let mappedPhase: HeadlessPhase = fullState.phase as HeadlessPhase;
  if (fullState.phase === "playing") {
    mappedPhase = fullState.wave.active ? "combat" : "preparation";
  }

  let mappedPrevPhase: HeadlessPhase | null = fullState.previousPhase as HeadlessPhase | null;
  if (fullState.previousPhase === "playing") {
    mappedPrevPhase = "preparation";
  }

  return {
    version: "1.0.0",
    seed: fullState.session.seed,
    mapId: fullState.activeMap.id,
    activeMap: fullState.activeMap,
    phase: mappedPhase,
    previousPhase: mappedPrevPhase,
    debug: fullState.debug,
    tick: 0,
    elapsedMs: fullState.elapsedMs,
    currentWaveIndex: fullState.wave.currentWaveIndex,
    targetWaveCount: fullState.session.maxPlayers,
    baseHp: fullState.baseHp,
    readyCountdownMs: 0,
    players,
    towers,
    rewardSelection,
    waveLog: []
  };
};
