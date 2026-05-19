import { getMapStage } from "../../game/data/map";
import { getTowerDefinition } from "../../game/data/towers";
import { getWaveDefinition } from "../../game/data/waves";
import type { PlayerId } from "../../game/models/types";
import { gridKey, isInsideGrid } from "../../game/utils/grid";
import type { HeadlessGameState } from "./types";

const playerIds: readonly PlayerId[] = ["p1", "p2"];

export const checkHeadlessInvariants = (state: HeadlessGameState): string[] => {
  const failures: string[] = [];
  const map = getMapStageForState(state);
  const occupiedTiles = new Set<string>();

  if (!Number.isFinite(state.baseHp) || state.baseHp < 0) {
    failures.push(`baseHp invalido: ${state.baseHp}`);
  }

  if (!Number.isInteger(state.currentWaveIndex) || state.currentWaveIndex < 0) {
    failures.push(`currentWaveIndex invalido: ${state.currentWaveIndex}`);
  }

  for (const playerId of playerIds) {
    const player = state.players[playerId];

    if (!player) {
      failures.push(`player ausente: ${playerId}`);
      continue;
    }

    if (!Number.isFinite(player.credits) || player.credits < 0) {
      failures.push(`${playerId} creditos invalidos: ${player.credits}`);
    }

    if (!Number.isFinite(player.sigils) || player.sigils < 0) {
      failures.push(`${playerId} sigils invalidos: ${player.sigils}`);
    }
  }

  for (const tower of state.towers) {
    const key = gridKey(tower.grid);

    try {
      getTowerDefinition(tower.typeId);
    } catch {
      failures.push(`torre com typeId desconhecido: ${tower.id}/${tower.typeId}`);
    }

    if (occupiedTiles.has(key)) {
      failures.push(`duas torres no mesmo tile: ${key}`);
    }

    occupiedTiles.add(key);

    if (!isInsideGrid(tower.grid, map)) {
      failures.push(`torre fora do mapa: ${tower.id} ${key}`);
    }

    if (tower.skillPoints < 0 || !Number.isFinite(tower.skillPoints)) {
      failures.push(`pontos invalidos na torre ${tower.id}: ${tower.skillPoints}`);
    }
  }

  if (state.phase === "reward-selection" && !state.rewardSelection) {
    failures.push("phase reward-selection sem rewardSelection");
  }

  if (state.phase !== "reward-selection" && state.rewardSelection) {
    failures.push(`rewardSelection preso fora da fase de recompensa: ${state.phase}`);
  }

  return failures;
};

const getMapStageForState = (state: HeadlessGameState) => {
  const wave = getWaveDefinition(Math.max(0, state.currentWaveIndex));

  return getMapStage(wave.mapStageIndex);
};
