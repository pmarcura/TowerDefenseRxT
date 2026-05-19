import type { GameAction } from "../../game/actions/types";
import { getTowerDefinitionsForClass } from "../../game/data/towers";
import type { HeadlessGameState } from "../env/types";
import type { BotContext, HeadlessBot } from "./BotTypes";
import {
  chooseBuildAction,
  chooseReadyAction,
  chooseRewardOrNull,
  chooseUpgradeOrNull,
  chooseWaitAction,
  makeInvalidBuildAction
} from "./botUtils";

export const RandomBot: HeadlessBot = {
  id: "random",
  name: "RandomBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    const reward = chooseRewardOrNull(state, context.rng, context.controlledPlayers);

    if (reward) {
      return reward;
    }

    if (state.phase !== "preparation") {
      return chooseWaitAction();
    }

    if (context.rng.next() < 0.18) {
      return makeInvalidBuildAction(state, context.rng.pick(context.controlledPlayers), context.rng);
    }

    const upgrade = chooseUpgradeOrNull(state, context.controlledPlayers, context.rng);

    if (upgrade && context.rng.next() < 0.22) {
      return upgrade;
    }

    if (context.rng.next() < 0.56) {
      const build = chooseBuildAction(
        state,
        context.controlledPlayers,
        context.rng,
        (tower) => tower.cost <= 84 ? 2 : 1
      );

      if (build) {
        return build;
      }
    }

    if (context.rng.next() < 0.08) {
      const playerId = context.rng.pick(context.controlledPlayers);
      const tower = context.rng.pick(getTowerDefinitionsForClass(state.players[playerId].classId));

      return {
        type: "BUILD_TOWER",
        playerId,
        towerId: tower.id,
        grid: { col: context.rng.int(0, 17), row: context.rng.int(0, 9) }
      };
    }

    return chooseReadyAction(state, context.controlledPlayers);
  }
};
