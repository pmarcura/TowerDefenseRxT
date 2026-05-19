import type {
  GridPoint,
  PlayerId,
  TowerAutoBuildId,
  TowerUpgradeBranchId
} from "../models/types";

export type GameAction =
  | {
      readonly type: "BUILD_TOWER";
      readonly playerId: PlayerId;
      readonly towerId: string;
      readonly grid: GridPoint;
    }
  | {
      readonly type: "UPGRADE_TOWER";
      readonly playerId: PlayerId;
      readonly towerId: string;
      readonly branchId: TowerUpgradeBranchId;
    }
  | {
      readonly type: "SET_READY";
      readonly playerId: PlayerId;
      readonly ready: boolean;
    }
  | {
      readonly type: "SELECT_CLASS";
      readonly playerId: PlayerId;
      readonly classId: string;
    }
  | {
      readonly type: "SELECT_REWARD";
      readonly playerId: PlayerId;
      readonly skillId: string;
    }
  | {
      readonly type: "SET_AUTO_BUILD";
      readonly playerId: PlayerId;
      readonly towerId: string;
      readonly buildId: TowerAutoBuildId;
    }
  | {
      readonly type: "WAIT";
      readonly deltaMs: number;
    }
  | {
      readonly type: "PAUSE";
      readonly paused: boolean;
    }
  | {
      readonly type: "DEBUG_ADVANCE_WAVE";
    };

export type ActionEventKind =
  | "class-selected"
  | "tower-built"
  | "tower-upgraded"
  | "auto-build-set"
  | "ready"
  | "wave-started"
  | "wave-cleared"
  | "reward-opened"
  | "reward-selected"
  | "game-ended"
  | "debug"
  | "wait";

export type ActionEvent = {
  readonly kind: ActionEventKind;
  readonly message: string;
  readonly playerId?: PlayerId;
  readonly amount?: number;
  readonly refId?: string;
};

export type ActionErrorCode =
  | "GAME_DONE"
  | "WRONG_PHASE"
  | "UNKNOWN_PLAYER"
  | "UNKNOWN_CLASS"
  | "UNKNOWN_TOWER"
  | "UNKNOWN_SKILL"
  | "CLASS_MISMATCH"
  | "OUT_OF_BOUNDS"
  | "PATH_BLOCKED"
  | "TILE_OCCUPIED"
  | "NOT_ENOUGH_CREDITS"
  | "NO_SKILL_POINTS"
  | "BRANCH_MAXED"
  | "REWARD_NOT_AVAILABLE"
  | "DEBUG_DISABLED";

export type ActionError = {
  readonly code: ActionErrorCode;
  readonly message: string;
  readonly playerId?: PlayerId;
  readonly deficit?: number;
  readonly refId?: string;
};

export type ActionStepResult<TState> = {
  readonly state: TState;
  readonly reward: number;
  readonly done: boolean;
  readonly events: readonly ActionEvent[];
  readonly errors: readonly ActionError[];
  readonly invariantFailures: readonly string[];
};
