import type { GameAction } from "../../game/actions/types";
import type { HeadlessGameState } from "../env/types";
import { choosePolicyAction, championPolicy } from "../learning/policy";
import type { BotContext, HeadlessBot } from "./BotTypes";

export const ProBot: HeadlessBot = {
  id: "pro",
  name: "ProBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    return choosePolicyAction(championPolicy, state, context.controlledPlayers, context.rng);
  }
};
