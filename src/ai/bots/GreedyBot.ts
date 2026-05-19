import type { GameAction } from "../../game/actions/types";
import type { TowerDefinition } from "../../game/models/types";
import type { HeadlessGameState } from "../env/types";
import type { BotContext, HeadlessBot } from "./BotTypes";
import {
  chooseBuildAction,
  chooseReadyAction,
  chooseRewardOrNull,
  chooseUpgradeOrNull,
  chooseWaitAction,
  countPlayerTowers,
  getCurrentWave
} from "./botUtils";

export const GreedyBot: HeadlessBot = {
  id: "greedy",
  name: "GreedyBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    const reward = chooseRewardOrNull(state, context.rng, context.controlledPlayers);

    if (reward) {
      return reward;
    }

    if (state.phase !== "preparation") {
      return chooseWaitAction();
    }

    const upgrade = chooseUpgradeOrNull(state, context.controlledPlayers, context.rng);

    if (upgrade && context.rng.next() < 0.35) {
      return upgrade;
    }

    const towerBudgetReady = context.controlledPlayers.some(
      (playerId) => countPlayerTowers(state, playerId) < 1 + Math.floor(state.currentWaveIndex * 0.8)
    );

    if (towerBudgetReady) {
      const build = chooseBuildAction(
        state,
        context.controlledPlayers,
        context.rng,
        scoreGreedyTower
      );

      if (build) {
        return build;
      }
    }

    return chooseReadyAction(state, context.controlledPlayers);
  }
};

const scoreGreedyTower = (tower: TowerDefinition, state: HeadlessGameState): number => {
  const wave = getCurrentWave(state);
  const boss = wave?.isBoss ?? false;
  const damageScore = tower.damage / Math.max(1, tower.cooldownMs / 1000);
  let effectScore = 0;

  if (tower.effect === "damage") {
    effectScore += boss ? 7 : 2;
  }

  if (tower.effect === "splash") {
    effectScore += 5;
  }

  if (tower.effect === "chain") {
    effectScore += boss ? -1 : 4;
  }

  if (tower.effect === "mark") {
    effectScore += boss ? 9 : 2;
  }

  if (tower.effect === "income") {
    effectScore -= state.currentWaveIndex < 2 ? 1 : 6;
  }

  return damageScore / Math.max(40, tower.cost) + effectScore;
};
