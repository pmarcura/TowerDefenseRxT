import type { GameAction } from "../../game/actions/types";
import { getWaveDefinition, getWaveThreat } from "../../game/data/waves";
import type { GameState, PlayerId } from "../../game/models/types";
import type { HeadlessGameState } from "../env/types";

export type MatchSource = "local-human" | "local-ai" | "online-human" | "online-ai" | "headless";

export type LearningSampleKind =
  | "run-start"
  | "state-snapshot"
  | "player-action"
  | "ai-decision"
  | "wave-start"
  | "wave-clear"
  | "run-end";

export type LearningPlayerSnapshot = {
  playerId: PlayerId;
  classId: string;
  credits: number;
  damage: number;
  kills: number;
  towersBuilt: number;
};

export type LearningTowerSnapshot = {
  typeId: string;
  ownerId: PlayerId;
  level: number;
  kills: number;
  damage: number;
  grid?: { col: number; row: number };
};

export type LearningAiDecisionSnapshot = {
  kind: string;
  title: string;
  detail: string;
  confidence: number;
  score: number;
  routeIndex?: number;
  towerId?: string;
  tags: string[];
};

export type LearningSample = {
  schemaVersion: "aegis-learning-sample-v1";
  matchId: string;
  source: MatchSource;
  kind: LearningSampleKind;
  createdAt: string;
  tick: number;
  elapsedMs: number;
  seed?: number;
  waveIndex: number;
  waveId: string;
  waveName: string;
  waveThreat: number;
  phase: string;
  baseHp: number;
  playerCount: number;
  players: LearningPlayerSnapshot[];
  towers: LearningTowerSnapshot[];
  aiDecision?: LearningAiDecisionSnapshot;
  action?: GameAction;
  result?: "victory" | "defeat" | "timeout";
  errors?: readonly string[];
};

export const createLearningSampleFromGameState = (
  matchId: string,
  source: MatchSource,
  kind: LearningSampleKind,
  state: GameState,
  action?: GameAction,
  result?: "victory" | "defeat" | "timeout",
  errors: readonly string[] = []
): LearningSample => {
  const wave = getWaveDefinition(state.wave.currentWaveIndex);
  const playerIds = Object.keys(state.playerClasses) as PlayerId[];

  return {
    schemaVersion: "aegis-learning-sample-v1",
    matchId,
    source,
    kind,
    createdAt: new Date().toISOString(),
    tick: state.nextId,
    elapsedMs: state.elapsedMs,
    waveIndex: state.wave.currentWaveIndex,
    waveId: wave.id,
    waveName: wave.name,
    waveThreat: getWaveThreat(wave),
    phase: state.phase,
    baseHp: state.baseHp,
    playerCount: playerIds.length,
    players: playerIds.map((playerId) => ({
      playerId,
      classId: state.playerClasses[playerId],
      credits: state.economies[playerId].credits,
      damage: state.combatStats[playerId].totalDamageDealt,
      kills: state.combatStats[playerId].kills,
      towersBuilt: state.combatStats[playerId].towersBuilt
    })),
    towers: state.towers.map((tower) => ({
      typeId: tower.typeId,
      ownerId: tower.ownerId,
      level: tower.level,
      kills: tower.kills,
      damage: tower.damageDealt,
      grid: tower.grid
    })),
    aiDecision: state.aiPartner.lastDecision
      ? {
          kind: state.aiPartner.lastDecision.kind,
          title: state.aiPartner.lastDecision.title,
          detail: state.aiPartner.lastDecision.detail,
          confidence: state.aiPartner.lastDecision.confidence,
          score: state.aiPartner.lastDecision.score,
          routeIndex: state.aiPartner.lastDecision.routeIndex,
          towerId: state.aiPartner.lastDecision.towerId,
          tags: state.aiPartner.lastDecision.tags
        }
      : undefined,
    action,
    result,
    errors
  };
};

export const createLearningSampleFromHeadlessState = (
  matchId: string,
  source: MatchSource,
  kind: LearningSampleKind,
  state: HeadlessGameState,
  action?: GameAction,
  result?: "victory" | "defeat" | "timeout",
  errors: readonly string[] = []
): LearningSample => {
  const wave = getWaveDefinition(state.currentWaveIndex);
  const playerIds = Object.keys(state.players) as PlayerId[];

  return {
    schemaVersion: "aegis-learning-sample-v1",
    matchId,
    source,
    kind,
    createdAt: new Date().toISOString(),
    tick: state.tick,
    elapsedMs: state.elapsedMs,
    seed: state.seed,
    waveIndex: state.currentWaveIndex,
    waveId: wave.id,
    waveName: wave.name,
    waveThreat: getWaveThreat(wave),
    phase: state.phase,
    baseHp: state.baseHp,
    playerCount: playerIds.length,
    players: playerIds.map((playerId) => ({
      playerId,
      classId: state.players[playerId].classId,
      credits: state.players[playerId].credits,
      damage: state.players[playerId].damage,
      kills: state.players[playerId].kills,
      towersBuilt: state.players[playerId].towersBuilt
    })),
    towers: state.towers.map((tower) => ({
      typeId: tower.typeId,
      ownerId: tower.ownerId,
      level: tower.level,
      kills: tower.kills,
      damage: tower.damageDealt,
      grid: tower.grid
    })),
    action,
    result,
    errors
  };
};

export const formatLearningSamplesJsonl = (samples: readonly LearningSample[]): string =>
  `${samples.map((sample) => JSON.stringify(sample)).join("\n")}\n`;
