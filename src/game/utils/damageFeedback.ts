import { playerColor } from "../design/gameDesignSystem";
import type { EnemyEntity, EnemyPlayerDamageAccumulator, PlayerId } from "../models/types";

export const DAMAGE_ACCUMULATION_MS = 980;
export const CRITICAL_ACCUMULATION_MS = 1120;
export const DAMAGE_PULSE_MS = 180;

export const createEmptyDamageAccumulators = (
  playerIds: readonly PlayerId[]
): Record<PlayerId, EnemyPlayerDamageAccumulator> =>
  Object.fromEntries(
    playerIds.map((playerId) => [playerId, createEmptyDamageAccumulator(playerId)])
  ) as Record<PlayerId, EnemyPlayerDamageAccumulator>;

export const createEmptyDamageAccumulator = (playerId: PlayerId): EnemyPlayerDamageAccumulator => ({
  total: 0,
  timerMs: 0,
  color: playerColor(playerId),
  criticalTotal: 0,
  criticalTimerMs: 0,
  pulseMs: 0
});

export const addEnemyDamageFeedback = (
  enemy: EnemyEntity,
  playerId: PlayerId,
  amount: number,
  isCritical: boolean
): void => {
  const accumulator =
    enemy.recentDamageByPlayer[playerId] ?? createEmptyDamageAccumulator(playerId);
  enemy.recentDamageByPlayer[playerId] = accumulator;

  accumulator.total += amount;
  accumulator.timerMs = DAMAGE_ACCUMULATION_MS;
  accumulator.color = playerColor(playerId);
  accumulator.pulseMs = DAMAGE_PULSE_MS;

  if (isCritical) {
    accumulator.criticalTotal += amount;
    accumulator.criticalTimerMs = CRITICAL_ACCUMULATION_MS;
  }

  enemy.recentDamageTotal += amount;
  enemy.recentDamageTimerMs = DAMAGE_ACCUMULATION_MS;
  enemy.recentDamageColor = playerColor(playerId);
  enemy.recentDamageWasCritical = enemy.recentDamageWasCritical || isCritical;
};

export const updateEnemyDamageFeedback = (enemy: EnemyEntity, deltaMs: number): void => {
  enemy.lastHitFlashMs = Math.max(0, enemy.lastHitFlashMs - deltaMs);

  if (enemy.recentDamageTimerMs > 0) {
    enemy.recentDamageTimerMs = Math.max(0, enemy.recentDamageTimerMs - deltaMs);
  }

  if (enemy.recentDamageTimerMs <= 0) {
    enemy.recentDamageTotal = 0;
    enemy.recentDamageWasCritical = false;
  }

  for (const playerId of Object.keys(enemy.recentDamageByPlayer) as PlayerId[]) {
    const accumulator = enemy.recentDamageByPlayer[playerId];

    accumulator.timerMs = Math.max(0, accumulator.timerMs - deltaMs);
    accumulator.criticalTimerMs = Math.max(0, accumulator.criticalTimerMs - deltaMs);
    accumulator.pulseMs = Math.max(0, accumulator.pulseMs - deltaMs);

    if (accumulator.timerMs <= 0) {
      accumulator.total = 0;
    }

    if (accumulator.criticalTimerMs <= 0) {
      accumulator.criticalTotal = 0;
    }
  }
};
