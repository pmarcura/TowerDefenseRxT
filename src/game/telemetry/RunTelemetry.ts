import {
  createLearningSampleFromGameState,
  formatLearningSamplesJsonl,
  type LearningSample,
  type LearningSampleKind,
  type MatchSource
} from "../../ai/telemetry/learningSamples";
import type { GameAction } from "../actions/types";
import type { GameState } from "../models/types";

const STORAGE_KEY = "aegis-sacra-learning-samples-v1";
const MAX_STORED_SAMPLES = 2400;

export class RunTelemetry {
  private static instance: RunTelemetry | null = null;
  private matchId = createMatchId();
  private source: MatchSource = "local-human";
  private samples: LearningSample[] = [];

  static getInstance(): RunTelemetry {
    RunTelemetry.instance ??= new RunTelemetry();

    return RunTelemetry.instance;
  }

  startRun(state: GameState, source: MatchSource = "local-human"): void {
    this.matchId = createMatchId();
    this.source = source;
    this.record("run-start", state);
  }

  record(
    kind: LearningSampleKind,
    state: GameState,
    action?: GameAction,
    errors: readonly string[] = []
  ): void {
    const result =
      state.phase === "victory" || state.phase === "defeat" ? state.phase : undefined;
    const sample = createLearningSampleFromGameState(
      this.matchId,
      this.source,
      kind,
      state,
      action,
      result,
      errors
    );

    this.samples = [...this.samples, sample].slice(-MAX_STORED_SAMPLES);
    this.persist();
  }

  exportJsonl(): string {
    return formatLearningSamplesJsonl(this.samples);
  }

  getSamples(): readonly LearningSample[] {
    return this.samples;
  }

  private persist(): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, this.exportJsonl());
    } catch {
      this.samples = this.samples.slice(-Math.floor(MAX_STORED_SAMPLES / 2));
    }
  }
}

const createMatchId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `match-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};
