import type { ActionError, ActionEvent, GameAction } from "../../game/actions/types";
import type { HeadlessGameState } from "../env/types";

export type ReplayStep = {
  readonly index: number;
  readonly action: GameAction;
  readonly reward: number;
  readonly events: readonly ActionEvent[];
  readonly errors: readonly ActionError[];
  readonly invariantFailures: readonly string[];
};

export type ReplayRecord = {
  readonly seed: number;
  readonly mapId: string;
  readonly gameVersion: string;
  readonly bot: string;
  readonly initialState: HeadlessGameState;
  readonly actions: readonly ReplayStep[];
  readonly finalState: HeadlessGameState | null;
  readonly crash: string | null;
};

export class ReplayRecorder {
  private readonly steps: ReplayStep[] = [];
  private finalState: HeadlessGameState | null = null;
  private crash: string | null = null;

  constructor(
    private readonly seed: number,
    private readonly mapId: string,
    private readonly gameVersion: string,
    private readonly bot: string,
    private readonly initialState: HeadlessGameState
  ) {}

  record(
    action: GameAction,
    reward: number,
    events: readonly ActionEvent[],
    errors: readonly ActionError[],
    invariantFailures: readonly string[]
  ): void {
    this.steps.push({
      index: this.steps.length,
      action,
      reward,
      events,
      errors,
      invariantFailures
    });
  }

  finish(finalState: HeadlessGameState): void {
    this.finalState = finalState;
  }

  fail(error: unknown): void {
    this.crash = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  toJSON(): ReplayRecord {
    return {
      seed: this.seed,
      mapId: this.mapId,
      gameVersion: this.gameVersion,
      bot: this.bot,
      initialState: this.initialState,
      actions: this.steps,
      finalState: this.finalState,
      crash: this.crash
    };
  }
}
