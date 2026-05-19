import type { GameAction } from "../../game/actions/types";
import type { PlayerId, TowerDefinition } from "../../game/models/types";
import type { Rng } from "../env/Rng";
import type { HeadlessGameState, HeadlessTowerState } from "../env/types";

export type BotId =
  | "random"
  | "greedy"
  | "economy"
  | "defense"
  | "bosskiller"
  | "bughunter";

export type BotContext = {
  readonly controlledPlayers: readonly PlayerId[];
  readonly rng: Rng;
};

export type HeadlessBot = {
  readonly id: BotId;
  readonly name: string;
  chooseAction(state: HeadlessGameState, context: BotContext): GameAction;
};

export type ScoredTower = {
  readonly tower: TowerDefinition;
  readonly score: number;
  readonly playerId: PlayerId;
};

export type UpgradeCandidate = {
  readonly tower: HeadlessTowerState;
  readonly playerId: PlayerId;
};
