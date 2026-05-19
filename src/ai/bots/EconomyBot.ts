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
  countPlayerTowers
} from "./botUtils";

export const EconomyBot: HeadlessBot = {
  id: "economy",
  name: "EconomyBot",
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction {
    const reward = chooseRewardOrNull(state, context.rng, context.controlledPlayers);

    if (reward) {
      return reward;
    }

    if (state.phase !== "preparation") {
      return chooseWaitAction();
    }

    const upgrade = chooseUpgradeOrNull(state, context.controlledPlayers, context.rng);

    if (upgrade && context.rng.next() < 0.28) {
      return upgrade;
    }

    const build = chooseBuildAction(
      state,
      context.controlledPlayers,
      context.rng,
      (tower, currentState, playerId) => scoreEconomyTower(tower, currentState, playerId)
    );

    return build ?? chooseReadyAction(state, context.controlledPlayers);
  }
};

const scoreEconomyTower = (
  tower: TowerDefinition,
  state: HeadlessGameState,
  playerId: string
): number => {
  const incomeBuilt = countPlayerTowers(
    state,
    playerId as "p1" | "p2",
    (candidate) => candidate.typeId === tower.id
  );
  const needsIncome = state.currentWaveIndex < 6 && incomeBuilt < 2;

  if (tower.effect === "income") {
    return needsIncome ? 12 - incomeBuilt * 3 : -3;
  }

  if (tower.effect === "slow" || tower.effect === "aura") {
    return 4;
  }

  return tower.cost <= 76 ? 5 : 2;
};
