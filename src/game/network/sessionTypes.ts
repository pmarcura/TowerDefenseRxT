export type SessionMode = "solo-ai" | "local-coop" | "online-lobby-preview";

export type PlayerSeatKind = "human-local" | "human-online" | "ai-partner" | "empty" | "spectator";

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
    kind: index === 0 ? "human-local" : index === 1 ? "ai-partner" : "empty",
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
  mode: playerCount <= 2 ? "solo-ai" : "online-lobby-preview",
  minPlayers: 2,
  maxPlayers: 12,
  seed,
  mapId: "aegis-endless-procedural",
  seats: createSessionSeats(playerCount),
  aiFill: playerCount > 2
});
