import { GameRegistry } from "../GameRegistry";
import type { EnemyEntity } from "../models/types";
import { distanceSquared } from "../utils/math";
import type { GameSystem } from "./GameSystem";

export class StatusEffectSystem implements GameSystem {
  constructor(private readonly registry: GameRegistry) {}

  update(deltaMs: number): void {
    const state = this.registry.state;

    for (const enemy of state.enemies) {
      this.updateEnemyStatus(enemy, deltaMs);
    }

    for (const zone of state.ritualZones) {
      zone.durationMs -= deltaMs;
      zone.tickMs -= deltaMs;

      const radiusSquared = zone.radius * zone.radius;

      for (const enemy of state.enemies) {
        if (!enemy.alive || distanceSquared(enemy.position, zone.position) > radiusSquared) {
          continue;
        }

        enemy.markMultiplier = Math.max(enemy.markMultiplier, zone.damageMultiplier);
        enemy.markTimerMs = Math.max(enemy.markTimerMs, 360);
        enemy.armorReduction = Math.max(enemy.armorReduction, zone.armorReduction);
        enemy.armorReductionTimerMs = Math.max(enemy.armorReductionTimerMs, 360);
      }
    }

    state.ritualZones = state.ritualZones.filter((zone) => zone.durationMs > 0);
  }

  private updateEnemyStatus(enemy: EnemyEntity, deltaMs: number): void {
    if (enemy.markTimerMs > 0) {
      enemy.markTimerMs = Math.max(0, enemy.markTimerMs - deltaMs);
    }

    if (enemy.markTimerMs <= 0) {
      enemy.markMultiplier = 1;
    }

    if (enemy.armorReductionTimerMs > 0) {
      enemy.armorReductionTimerMs = Math.max(0, enemy.armorReductionTimerMs - deltaMs);
    }

    if (enemy.armorReductionTimerMs <= 0) {
      enemy.armorReduction = 0;
    }
  }
}
