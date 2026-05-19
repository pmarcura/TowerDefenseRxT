import { ENEMY_REACHED_BASE_OFFSET_MS } from "../config/constants";
import { getEnemyDefinition } from "../data/enemies";
import { GameRegistry } from "../GameRegistry";
import type { EnemyEntity } from "../models/types";
import { buildPathWorldPoints } from "../utils/grid";
import { distance, moveToward } from "../utils/math";
import type { EconomySystem } from "./EconomySystem";
import type { GameSystem } from "./GameSystem";

export class EnemySystem implements GameSystem {
  constructor(
    private readonly registry: GameRegistry,
    private readonly economySystem: EconomySystem
  ) {}

  spawn(enemyTypeId: string, pathIndexId = 0): void {
    const definition = getEnemyDefinition(enemyTypeId);
    const pathPoints = buildPathWorldPoints(this.registry.state.activeMap, pathIndexId);
    const start = pathPoints[0];
    const enemy: EnemyEntity = {
      id: this.registry.createId("enemy"),
      typeId: enemyTypeId,
      position: { x: start.x, y: start.y },
      pathIndexId,
      pathIndex: 0,
      hp: definition.maxHp,
      damageSources: {},
      markMultiplier: 1,
      markTimerMs: 0,
      armorReduction: 0,
      armorReductionTimerMs: 0,
      slowMultiplier: 1,
      slowTimerMs: 0,
      reachedBaseTimerMs: 0,
      alive: true
    };

    this.registry.state.enemies.push(enemy);
  }

  update(deltaMs: number): void {
    const state = this.registry.state;

    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (enemy.reachedBaseTimerMs > 0) {
        enemy.reachedBaseTimerMs -= deltaMs;
        continue;
      }

      this.updateSlow(enemy, deltaMs);
      this.moveEnemy(enemy, deltaMs);
    }

    state.enemies = state.enemies.filter(
      (enemy) => enemy.alive || enemy.reachedBaseTimerMs > 0
    );
  }

  private updateSlow(enemy: EnemyEntity, deltaMs: number): void {
    if (enemy.slowTimerMs <= 0) {
      enemy.slowMultiplier = 1;
      return;
    }

    enemy.slowTimerMs = Math.max(0, enemy.slowTimerMs - deltaMs);
  }

  private moveEnemy(enemy: EnemyEntity, deltaMs: number): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const pathPoints = buildPathWorldPoints(this.registry.state.activeMap, enemy.pathIndexId);
    const nextPoint = pathPoints[enemy.pathIndex + 1];

    if (!nextPoint) {
      enemy.alive = false;
      enemy.reachedBaseTimerMs = ENEMY_REACHED_BASE_OFFSET_MS;
      this.economySystem.damageBase(definition.baseDamage);
      return;
    }

    const movement = (definition.speed * enemy.slowMultiplier * deltaMs) / 1000;
    enemy.position = moveToward(enemy.position, nextPoint, movement);

    if (distance(enemy.position, nextPoint) <= 0.1) {
      enemy.pathIndex += 1;
    }
  }
}
