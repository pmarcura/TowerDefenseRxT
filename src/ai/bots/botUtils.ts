import { getMapStage } from "../../game/data/map";
import { getPlayerClassDefinition } from "../../game/data/playerClasses";
import { getSkillEffectTotals } from "../../game/data/skills";
import { getTowerDefinitionsForClass } from "../../game/data/towers";
import { towerBranchDefinitions } from "../../game/data/towerBranches";
import { getWaveDefinition } from "../../game/data/waves";
import type { GameAction } from "../../game/actions/types";
import type { GridPoint, PlayerId, TowerDefinition } from "../../game/models/types";
import { gridKey, isGridOnPath, isInsideGrid } from "../../game/utils/grid";
import type { Rng } from "../env/Rng";
import type {
  HeadlessGameState,
  HeadlessRewardChoiceState,
  HeadlessTowerState
} from "../env/types";
import type { ScoredTower, UpgradeCandidate } from "./BotTypes";

export const chooseRewardOrNull = (
  state: HeadlessGameState,
  rng: Rng,
  playerIds: readonly PlayerId[]
): GameAction | null => {
  if (state.phase !== "reward-selection" || !state.rewardSelection) {
    return null;
  }

  const pending = playerIds
    .map((playerId) => state.rewardSelection?.choices[playerId])
    .filter(
      (choice): choice is HeadlessRewardChoiceState =>
        choice !== undefined && choice.selectedSkillId === null && choice.skillIds.length > 0
    );

  if (pending.length === 0) {
    return { type: "WAIT", deltaMs: 250 };
  }

  const choice = rng.pick(pending);

  return {
    type: "SELECT_REWARD",
    playerId: choice.playerId,
    skillId: rng.pick(choice.skillIds)
  };
};

export const chooseUpgradeOrNull = (
  state: HeadlessGameState,
  playerIds: readonly PlayerId[],
  rng: Rng
): GameAction | null => {
  const candidates: UpgradeCandidate[] = state.towers
    .filter((tower) => playerIds.includes(tower.ownerId) && tower.skillPoints > 0)
    .map((tower) => ({ tower, playerId: tower.ownerId }));

  if (candidates.length === 0) {
    return null;
  }

  const candidate = rng.pick(candidates);
  const branch = [...towerBranchDefinitions]
    .filter((definition) => candidate.tower.branchRanks[definition.id] < definition.maxRank)
    .sort((a, b) => candidate.tower.branchRanks[a.id] - candidate.tower.branchRanks[b.id])[0];

  if (!branch) {
    return null;
  }

  return {
    type: "UPGRADE_TOWER",
    playerId: candidate.playerId,
    towerId: candidate.tower.id,
    branchId: branch.id
  };
};

export const chooseBuildAction = (
  state: HeadlessGameState,
  playerIds: readonly PlayerId[],
  rng: Rng,
  scoreTower: (tower: TowerDefinition, state: HeadlessGameState, playerId: PlayerId) => number
): GameAction | null => {
  const scored: ScoredTower[] = [];

  for (const playerId of playerIds) {
    const player = state.players[playerId];

    for (const tower of getTowerDefinitionsForClass(player.classId)) {
      const cost = getTowerCostForState(state, playerId, tower);

      if (player.credits < cost) {
        continue;
      }

      scored.push({
        tower,
        playerId,
        score: scoreTower(tower, state, playerId) + rng.next() * 0.8
      });
    }
  }

  const best = scored.sort((a, b) => b.score - a.score)[0];

  if (!best) {
    return null;
  }

  const grid = chooseBuildGrid(state, best.tower, rng);

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

export const chooseReadyAction = (
  state: HeadlessGameState,
  playerIds: readonly PlayerId[]
): GameAction => {
  const playerId = playerIds.find((candidate) => !state.players[candidate].ready) ?? playerIds[0];

  return { type: "SET_READY", playerId, ready: true };
};

export const chooseWaitAction = (): GameAction => ({ type: "WAIT", deltaMs: 1000 });

export const getCurrentWave = (state: HeadlessGameState) =>
  getWaveDefinition(state.currentWaveIndex);

export const getCurrentMap = (state: HeadlessGameState) => {
  if (state.activeMap) {
    return state.activeMap;
  }

  const wave = getCurrentWave(state);

  return getMapStage(wave.mapStageIndex);
};

export const getTowerCostForState = (
  state: HeadlessGameState,
  playerId: PlayerId,
  tower: TowerDefinition
): number => {
  const player = state.players[playerId];
  const playerClass = getPlayerClassDefinition(player.classId);
  const skills = getSkillEffectTotals(player.id, player.skillRanks);

  return Math.ceil(tower.cost * playerClass.costMultiplier * skills.costMultiplier);
};

export const countPlayerTowers = (
  state: HeadlessGameState,
  playerId: PlayerId,
  predicate?: (tower: HeadlessTowerState) => boolean
): number =>
  state.towers.filter(
    (tower) => tower.ownerId === playerId && (!predicate || predicate(tower))
  ).length;

export const chooseBuildGrid = (
  state: HeadlessGameState,
  tower: TowerDefinition,
  rng: Rng
): GridPoint | null => {
  const map = getCurrentMap(state);
  const occupied = new Set(state.towers.map((towerEntity) => gridKey(towerEntity.grid)));
  const candidates: { grid: GridPoint; score: number }[] = [];

  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.columns; col += 1) {
      const grid = { col, row };

      if (!isInsideGrid(grid, map) || isGridOnPath(grid, map) || occupied.has(gridKey(grid))) {
        continue;
      }

      const distanceToPath = map.paths.reduce((best, path) => {
        const pathBest = path.reduce((min, point) => {
          const distance = Math.abs(point.col - col) + Math.abs(point.row - row);

          return Math.min(min, distance);
        }, Number.POSITIVE_INFINITY);

        return Math.min(best, pathBest);
      }, Number.POSITIVE_INFINITY);
      const rangeTiles = tower.range / map.tileSize;
      const nearPath = Math.max(0, 6 - distanceToPath);
      const rangeFit = distanceToPath <= rangeTiles ? 3 : -5;
      const centrality = -Math.abs(col - map.columns / 2) * 0.08;

      candidates.push({
        grid,
        score: nearPath + rangeFit + centrality + rng.next()
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0]?.grid ?? null;
};

export const makeInvalidBuildAction = (
  state: HeadlessGameState,
  playerId: PlayerId,
  rng: Rng
): GameAction => {
  const tower = rng.pick(getTowerDefinitionsForClass(state.players[playerId].classId));
  const map = getCurrentMap(state);
  const pathTile = rng.pick(map.paths[0]);
  const useOutOfBounds = rng.next() < 0.45;

  return {
    type: "BUILD_TOWER",
    playerId,
    towerId: rng.next() < 0.18 ? "missing-tower" : tower.id,
    grid: useOutOfBounds ? { col: -rng.int(1, 4), row: map.rows + rng.int(0, 4) } : pathTile
  };
};
