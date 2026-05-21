import type { GameState, PlayerId } from "../models/types";
import type { MultiplayerSessionConfig, PlayerSeat } from "../network/sessionTypes";

export const MIN_PLAYER_COUNT = 2;
export const MAX_PLAYER_COUNT = 12;

const PLAYER_ID_PATTERN = /^p([1-9]|1[0-2])$/;

export const clampPlayerCount = (playerCount: number): number =>
  Math.max(MIN_PLAYER_COUNT, Math.min(MAX_PLAYER_COUNT, Math.floor(playerCount)));

export const createPlayerId = (index: number): PlayerId =>
  `p${Math.max(1, Math.min(MAX_PLAYER_COUNT, Math.floor(index)))}` as PlayerId;

export const isValidPlayerId = (value: string): value is PlayerId => PLAYER_ID_PATTERN.test(value);

export const getPlayerNumber = (playerId: PlayerId): number => {
  const raw = Number(playerId.slice(1));

  return Number.isFinite(raw) ? raw : 1;
};

export const getPlayerLabel = (playerId: PlayerId): string => `P${getPlayerNumber(playerId)}`;

export const isPlayableSeat = (seat: PlayerSeat): boolean =>
  seat.connected && seat.kind !== "empty" && seat.kind !== "spectator";

export const getSessionPlayerIds = (session: MultiplayerSessionConfig): PlayerId[] =>
  session.seats.filter(isPlayableSeat).map((seat) => seat.id);

export const getLocalPlayerIds = (session: MultiplayerSessionConfig): PlayerId[] =>
  session.seats
    .filter((seat) => isPlayableSeat(seat) && seat.kind === "human-local")
    .map((seat) => seat.id);

export const getPlayablePlayerIds = (state: GameState): PlayerId[] =>
  getSessionPlayerIds(state.session).filter((playerId) => Boolean(state.playerClasses[playerId]));

export const getRemoteOrAiPlayerIds = (state: GameState): PlayerId[] => {
  const localIds = new Set(getLocalPlayerIds(state.session));

  return getPlayablePlayerIds(state).filter((playerId) => !localIds.has(playerId));
};

export const createPlayerRecord = <T>(
  playerIds: readonly PlayerId[],
  factory: (playerId: PlayerId, index: number) => T
): Record<PlayerId, T> =>
  Object.fromEntries(playerIds.map((playerId, index) => [playerId, factory(playerId, index)])) as Record<
    PlayerId,
    T
  >;

export const forEachPlayer = (
  state: GameState,
  callback: (playerId: PlayerId, index: number) => void
): void => {
  getPlayablePlayerIds(state).forEach(callback);
};
