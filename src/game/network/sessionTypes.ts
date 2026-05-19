export type SessionMode = "local" | "online" | "ai-assisted";

export type PlayerSeatKind = "human-local" | "human-online" | "ai-partner" | "spectator";

export type PlayerSeatId = `p${number}`;

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

export const createSessionSeats = (playerCount: number): PlayerSeat[] => {
  const count = Math.max(2, Math.min(12, Math.floor(playerCount)));

  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}` as PlayerSeatId,
    kind: index < 2 ? "human-local" : "ai-partner",
    displayName: `P${index + 1}`,
    classId: null,
    connected: index < 2,
    ready: false
  }));
};

export const createDefaultMultiplayerSession = (
  playerCount = 2,
  seed = 14729
): MultiplayerSessionConfig => ({
  mode: "local",
  minPlayers: 2,
  maxPlayers: 12,
  seed,
  mapId: "aegis-endless-procedural",
  seats: createSessionSeats(playerCount),
  aiFill: playerCount > 2
});
