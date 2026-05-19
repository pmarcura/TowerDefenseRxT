import type { GameAction } from "../../game/actions/types";
import type { TowerDefinition } from "../../game/models/types";
import type { HeadlessGameState } from "../env/types";
import type { BotContext, HeadlessBot } from "./BotTypes";
import {
  chooseBuildAction,
  chooseReadyAction,
  chooseRewardOrNull,
  chooseUpgradeOrNull,
  chooseWaitAction
} from "./botUtils";

export const DefenseBot: HeadlessBot = {
  id: "defense",
  name: "DefenseBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    const reward = chooseRewardOrNull(state, context.rng, context.controlledPlayers);

    if (reward) {
      return reward;
    }

    if (state.phase !== "preparation") {
      return chooseWaitAction();
    }

    const upgrade = chooseUpgradeOrNull(state, context.controlledPlayers, context.rng);

    if (upgrade && context.rng.next() < 0.42) {
      return upgrade;
    }

    const build = chooseBuildAction(
      state,
      context.controlledPlayers,
      context.rng,
      scoreDefenseTower
    );

    return build ?? chooseReadyAction(state, context.controlledPlayers);
  }
};

const scoreDefenseTower = (tower: TowerDefinition): number => {
  if (tower.effect === "slow") {
    return 9;
  }

  if (tower.effect === "aura") {
    return 7;
  }

  if (tower.effect === "redirect" || tower.effect === "summon") {
    return 6;
  }

  if (tower.effect === "income") {
    return 1;
  }

  return 3;
};
