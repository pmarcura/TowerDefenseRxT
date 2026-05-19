import type { GameAction } from "../../game/actions/types";
import type { HeadlessGameState } from "../env/types";
import type { BotContext, HeadlessBot } from "./BotTypes";
import {
  chooseRewardOrNull,
  chooseWaitAction,
  makeInvalidBuildAction
} from "./botUtils";

export const BugHunterBot: HeadlessBot = {
  id: "bughunter",
  name: "BugHunterBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    const reward = chooseRewardOrNull(state, context.rng, context.controlledPlayers);

    if (reward && context.rng.next() < 0.55) {
      return reward;
    }

    if (context.rng.next() < 0.14) {
      return { type: "DEBUG_ADVANCE_WAVE" };
    }

    if (state.phase !== "preparation") {
      return context.rng.next() < 0.5
        ? { type: "WAIT", deltaMs: context.rng.int(0, 8000) }
        : { type: "PAUSE", paused: context.rng.next() < 0.5 };
    }

    const playerId = context.rng.pick(context.controlledPlayers);
    const roll = context.rng.next();

    if (roll < 0.42) {
      return makeInvalidBuildAction(state, playerId, context.rng);
    }

    if (roll < 0.58) {
      return {
        type: "UPGRADE_TOWER",
        playerId,
        towerId: `missing-${context.rng.int(0, 999)}`,
        branchId: "focus"
      };
    }

    if (roll < 0.7) {
      return {
        type: "SELECT_REWARD",
        playerId,
        skillId: "missing-skill"
      };
    }

    if (roll < 0.86) {
      return { type: "SET_READY", playerId, ready: context.rng.next() < 0.5 };
    }

    return chooseWaitAction();
  }
};
