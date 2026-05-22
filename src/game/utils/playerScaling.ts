export const getOpeningMapStageIndex = (playerCount: number): number => {
  if (playerCount >= 10) {
    return 8;
  }

  if (playerCount >= 7) {
    return 6;
  }

  if (playerCount >= 4) {
    return 4;
  }

  return 0;
};

export const getWaveMapStageBoost = (playerCount: number): number => {
  if (playerCount >= 10) {
    return 8;
  }

  if (playerCount >= 8) {
    return 6;
  }

  if (playerCount >= 4) {
    return 4;
  }

  return 0;
};

export const getEnemyPressureScale = (playerCount: number): number => {
  const extraPlayers = Math.max(0, playerCount - 2);
  const largeTeamPressure = Math.max(0, playerCount - 6);
  const fullRoomPressure = Math.max(0, playerCount - 10);

  return 1 + extraPlayers * 0.36 + largeTeamPressure * 0.2 + fullRoomPressure * 0.18;
};

export const getEnemyTempoScale = (playerCount: number): number => {
  const extraPlayers = Math.max(0, playerCount - 2);

  return 1 + extraPlayers * 0.045;
};

export const getRouteCopies = (playerCount: number, routeCount: number): number => {
  if (playerCount >= 10) {
    return Math.min(routeCount, 12);
  }

  if (playerCount >= 8) {
    return Math.min(routeCount, 5);
  }

  if (playerCount >= 4) {
    return Math.min(routeCount, 3);
  }

  return 1;
};

export const getStartingCreditScale = (playerCount: number): number =>
  1 + Math.min(0.24, Math.max(0, playerCount - 2) * 0.024);

export const getTeamRewardScale = (playerCount: number): number =>
  1 / (1 + Math.max(0, playerCount - 2) * 0.09);
