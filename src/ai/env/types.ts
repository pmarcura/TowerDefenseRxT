import type {
  GridPoint,
  PlayerId,
  TowerAutoBuildId,
  TowerBranchRanks
} from "../../game/models/types";

export type HeadlessPhase =
  | "preparation"
  | "combat"
  | "reward-selection"
  | "paused"
  | "victory"
  | "defeat";

export type HeadlessPlayerState = {
  id: PlayerId;
  classId: string;
  credits: number;
  sigils: number;
  ready: boolean;
  skillRanks: Record<string, number>;
  damage: number;
  kills: number;
  towersBuilt: number;
};

export type HeadlessTowerState = {
  id: string;
  typeId: string;
  ownerId: PlayerId;
  grid: GridPoint;
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  branchRanks: TowerBranchRanks;
  autoBuildId: TowerAutoBuildId;
  kills: number;
  damageDealt: number;
};

export type HeadlessRewardChoiceState = {
  playerId: PlayerId;
  skillIds: string[];
  selectedSkillId: string | null;
};

export type HeadlessRewardSelectionState = {
  bossWaveId: string;
  choices: Record<PlayerId, HeadlessRewardChoiceState>;
};

export type HeadlessWaveLog = {
  waveId: string;
  waveName: string;
  cleared: boolean;
  baseDamage: number;
  leaks: number;
  kills: number;
  routeCount: number;
};

export type HeadlessGameState = {
  version: string;
  seed: number;
  mapId: string;
  phase: HeadlessPhase;
  previousPhase: HeadlessPhase | null;
  debug: boolean;
  tick: number;
  elapsedMs: number;
  currentWaveIndex: number;
  targetWaveCount: number;
  baseHp: number;
  readyCountdownMs: number;
  players: Record<PlayerId, HeadlessPlayerState>;
  towers: HeadlessTowerState[];
  rewardSelection: HeadlessRewardSelectionState | null;
  waveLog: HeadlessWaveLog[];
};

export type HeadlessResetOptions = {
  seed?: number;
  mapId?: string;
  debug?: boolean;
  playerCount?: number;
  players?: Partial<Record<PlayerId, string>>;
  targetWaveCount?: number;
};
