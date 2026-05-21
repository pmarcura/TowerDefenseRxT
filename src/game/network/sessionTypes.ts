import type { PlayerId } from "../models/types";

export type SessionMode = "solo-ai" | "local-coop" | "online-lobby-preview";

export type PlayerSeatKind = "human-local" | "human-online" | "ai-partner" | "empty" | "spectator";

export type PlayerSeatId = PlayerId;

export type PlayerSeat = {
  id: PlayerSeatId;
  kind: PlayerSeatKind;
  displayName: string;
  classId: string | null;
  connected: boolean;
  ready: boolean;
};

export type MultiplayerSessionConfig = {
  mode: SessionMode;
  minPlayers: 2;
  maxPlayers: 12;
  seed: number;
  mapId: "aegis-endless-procedural";
  seats: PlayerSeat[];
  aiFill: boolean;
};

export const createSessionSeats = (
  playerCount: number,
  mode: SessionMode = playerCount <= 2 ? "solo-ai" : "online-lobby-preview"
): PlayerSeat[] => {
  const count = Math.max(2, Math.min(12, Math.floor(playerCount)));

  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}` as PlayerSeatId,
    kind:
      index === 0
        ? "human-local"
        : mode === "solo-ai"
          ? index === 1
            ? "ai-partner"
            : "empty"
          : mode === "local-coop"
            ? index === 1
              ? "human-local"
              : "empty"
            : "human-online",
    displayName: `P${index + 1}`,
    classId: null,
    connected: mode === "online-lobby-preview" ? true : index < 2,
    ready: false
  }));
};

export const createDefaultMultiplayerSession = (
  playerCount = 2,
  seed = 14729,
  mode: SessionMode = playerCount <= 2 ? "solo-ai" : "online-lobby-preview"
): MultiplayerSessionConfig => ({
  mode,
  minPlayers: 2,
  maxPlayers: 12,
  seed,
  mapId: "aegis-endless-procedural",
  seats: createSessionSeats(playerCount, mode),
  aiFill: mode === "solo-ai"
});
