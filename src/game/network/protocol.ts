import type { GameAction } from "../actions/types";
import type { PlayerId } from "../models/types";
import type { MultiplayerSessionConfig, PlayerSeat } from "./sessionTypes";

export const DEFAULT_MULTIPLAYER_URL = "ws://127.0.0.1:8787";

export type OnlineConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type OnlineRoomSeat = PlayerSeat & {
  clientId: string | null;
  isHost: boolean;
};

export type OnlineRoomState = {
  code: string;
  hostClientId: string | null;
  minPlayers: 2;
  maxPlayers: 12;
  seed: number;
  mapId: MultiplayerSessionConfig["mapId"];
  aiFill: boolean;
  started: boolean;
  seats: OnlineRoomSeat[];
  connectedCount: number;
  readyCount: number;
  createdAt: number;
  updatedAt: number;
};

export type OnlineClientState = {
  status: OnlineConnectionStatus;
  serverUrl: string;
  clientId: string | null;
  localPlayerId: PlayerId | null;
  room: OnlineRoomState | null;
  error: string | null;
};

export type OnlineClientMessage =
  | {
      type: "create-room";
      displayName: string;
      aiFill: boolean;
    }
  | {
      type: "join-room";
      roomCode: string;
      displayName: string;
    }
  | {
      type: "leave-room";
    }
  | {
      type: "select-class";
      classId: string;
    }
  | {
      type: "set-ready";
      ready: boolean;
    }
  | {
      type: "start-room";
    }
  | {
      type: "add-bot";
      seatId?: string;
    }
  | {
      type: "remove-bot";
      seatId: string;
    }
  | {
      type: "game-action";
      action: GameAction;
    };

export type OnlineServerMessage =
  | {
      type: "connected";
      clientId: string;
    }
  | {
      type: "room-state";
      room: OnlineRoomState;
    }
  | {
      type: "room-started";
      room: OnlineRoomState;
    }
  | {
      type: "game-action";
      action: GameAction;
      fromClientId: string;
    }
  | {
      type: "error";
      message: string;
    };
