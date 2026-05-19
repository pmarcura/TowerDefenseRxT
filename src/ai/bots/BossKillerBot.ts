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
  getCurrentWave
} from "./botUtils";

export const BossKillerBot: HeadlessBot = {
  id: "bosskiller",
  name: "BossKillerBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    const reward = chooseRewardOrNull(state, context.rng, context.controlledPlayers);

    if (reward) {
      return reward;
    }

    if (state.phase !== "preparation") {
      return chooseWaitAction();
    }

    const upgrade = chooseUpgradeOrNull(state, context.controlledPlayers, context.rng);

    if (upgrade && context.rng.next() < 0.55) {
      return upgrade;
    }

    const build = chooseBuildAction(
      state,
      context.controlledPlayers,
      context.rng,
      scoreBossTower
    );

    return build ?? chooseReadyAction(state, context.controlledPlayers);
  }
};

const scoreBossTower = (tower: TowerDefinition, state: HeadlessGameState): number => {
  const bossSoon = getCurrentWave(state)?.isBoss || state.currentWaveIndex >= 3;

  if (tower.effect === "mark") {
    return bossSoon ? 12 : 5;
  }

  if (tower.effect === "damage") {
    return bossSoon ? 9 + tower.damage / 8 : 4;
  }

  if (tower.effect === "cleanse") {
    return 7;
  }

  if (tower.effect === "slow") {
    return 5;
  }

  if (tower.effect === "income") {
    return state.currentWaveIndex < 3 ? 3 : -3;
  }

  return 3;
};
