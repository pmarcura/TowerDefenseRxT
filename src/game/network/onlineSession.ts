import type { MultiplayerSessionConfig, PlayerSeat } from "./sessionTypes";
import type { OnlineRoomState } from "./protocol";
import type { PlayerId } from "../models/types";

export const createSessionFromOnlineRoom = (
  room: OnlineRoomState,
  localPlayerId: PlayerId | null
): MultiplayerSessionConfig => ({
  mode: "online-lobby-preview",
  minPlayers: 2,
  maxPlayers: 12,
  seed: room.seed,
  mapId: room.mapId,
  aiFill: room.aiFill,
  seats: room.seats.map((seat): PlayerSeat => {
    const isLocalSeat = seat.id === localPlayerId && seat.kind === "human-online";

    return {
      id: seat.id,
      kind: isLocalSeat ? "human-local" : seat.kind,
      displayName: seat.displayName,
      classId: seat.classId,
      connected: seat.connected,
      ready: seat.ready
    };
  })
});
