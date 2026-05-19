import { getEnemyDefinition } from "../data/enemies";
import { getTowerDefinition } from "../data/towers";
import { getTowerXpToNextLevel, towerProgression } from "../data/towerProgression";
import { GameRegistry } from "../GameRegistry";
import type { AllyEntity, EnemyEntity, PlayerId, TowerEntity } from "../models/types";
import { buildPathWorldPoints } from "../utils/grid";
import { distanceSquared, moveToward } from "../utils/math";
import type { EconomySystem } from "./EconomySystem";
import type { GameSystem } from "./GameSystem";

const ALLY_ATTACK_RANGE = 28;
const ALLY_ATTACK_COOLDOWN_MS = 460;

export class AllySystem implements GameSystem {
  constructor(
    private readonly registry: GameRegistry,
    private readonly economySystem: EconomySystem
  ) {}

  spawnFromTower(tower: TowerEntity): void {
    const definition = getTowerDefinition(tower.typeId);
    const activeRoutes = this.registry.state.wave.snapshot.activePathIndexes;
    const pathIndexId = activeRoutes[0] ?? 0;
    const path = buildPathWorldPoints(this.registry.state.activeMap, pathIndexId);
    const startIndex = Math.max(0, path.length - 1);
    const spawnPoint = path[startIndex];
    const count = definition.summonCount ?? 1;

    for (let index = 0; index < count; index += 1) {
      this.registry.state.allies.push({
        id: this.registry.createId("ally"),
        ownerId: tower.ownerId,
        sourceTowerId: tower.id,
        pathIndexId,
        pathIndex: startIndex,
        position: {
          x: spawnPoint.x + index * 7 - (count - 1) * 3.5,
          y: spawnPoint.y
        },
        hp: definition.summonHp ?? 3,
        damage: definition.summonDamage ?? Math.max(4, definition.damage),
        speed: Math.max(42, definition.projectileSpeed || 88),
        attackCooldownMs: 140 + index * 80,
        durationMs: definition.summonDurationMs ?? 6200,
        alive: true,
        color: definition.glow
      });
    }

    this.registry.pushPresentationEvent("build", 900, {
      position: { ...tower.position },
      color: definition.glow,
      label: "ALIADOS"
    });
  }

  update(deltaMs: number): void {
    const state = this.registry.state;

    for (const ally of state.allies) {
      if (!ally.alive) {
        continue;
      }

      ally.durationMs -= deltaMs;
      ally.attackCooldownMs -= deltaMs;

      if (ally.durationMs <= 0) {
        ally.alive = false;
        continue;
      }

      this.attackNearbyEnemy(ally);
      this.moveAgainstRoute(ally, deltaMs);
    }

    state.allies = state.allies.filter((ally) => ally.alive);
  }

  private attackNearbyEnemy(ally: AllyEntity): void {
    if (ally.attackCooldownMs > 0) {
      return;
    }

    const rangeSquared = ALLY_ATTACK_RANGE * ALLY_ATTACK_RANGE;
    const target = this.registry.state.enemies
      .filter((enemy) => enemy.alive && distanceSquared(enemy.position, ally.position) <= rangeSquared)
      .sort((a, b) => b.pathIndex - a.pathIndex)[0];

    if (!target) {
      return;
    }

    this.damageEnemyByAlly(ally, target);
    ally.attackCooldownMs = ALLY_ATTACK_COOLDOWN_MS;
  }

  private damageEnemyByAlly(ally: AllyEntity, enemy: EnemyEntity): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const armor = Math.max(0, definition.armor - enemy.armorReduction);
    const damage = Math.max(1, ally.damage - armor) * enemy.markMultiplier;
    const dealtDamage = Math.min(enemy.hp, damage);
    const tower = this.registry.state.towers.find((candidate) => candidate.id === ally.sourceTowerId);

    enemy.hp -= dealtDamage;
    enemy.damageSources[ally.sourceTowerId] =
      (enemy.damageSources[ally.sourceTowerId] ?? 0) + dealtDamage;
    enemy.recentDamageTotal += dealtDamage;
    enemy.recentDamageTimerMs = 900;
    enemy.recentDamageColor = ally.color;
    enemy.lastHitFlashMs = 110;

    if (tower) {
      tower.damageDealt += dealtDamage;
    }

    this.registry.state.combatStats[ally.ownerId].totalDamageDealt += dealtDamage;
    this.registry.state.combatStats[ally.ownerId].waveDamageDealt += dealtDamage;
    this.registry.pushPresentationEvent("damage", 520, {
      cueId: "hit",
      position: { ...enemy.position },
      amount: dealtDamage,
      color: ally.color
    });

    if (enemy.hp > 0) {
      return;
    }

    enemy.alive = false;
    this.registry.state.combatStats[ally.ownerId].kills += 1;
    if (tower) {
      tower.kills += 1;
      this.grantTowerXp(tower);
    }
    const creditsGranted = this.economySystem.reward(ally.ownerId, definition.reward);
    this.registry.pushPresentationEvent("kill", 900, {
      cueId: definition.traits.includes("boss") || definition.traits.includes("blindado") ? "kill_heavy" : "kill",
      position: { ...enemy.position },
      color: definition.glow,
      label: `+${creditsGranted} CRED`
    });
  }

  private grantTowerXp(tower: TowerEntity): void {
    if (tower.level >= towerProgression.maxLevel) {
      tower.xp = 0;
      tower.xpToNext = 0;
      return;
    }

    tower.xp += towerProgression.xpPerKill;

    while (tower.level < towerProgression.maxLevel && tower.xp >= tower.xpToNext) {
      tower.xp -= tower.xpToNext;
      tower.level += 1;
      tower.skillPoints += 1;
      tower.xpToNext = getTowerXpToNextLevel(tower.level);
      this.registry.applyAutoUpgradesForTower(tower.id);
    }
  }

  private moveAgainstRoute(ally: AllyEntity, deltaMs: number): void {
    const path = buildPathWorldPoints(this.registry.state.activeMap, ally.pathIndexId);
    const nextIndex = Math.max(0, ally.pathIndex - 1);
    const target = path[nextIndex];

    if (!target) {
      ally.alive = false;
      return;
    }

    const movement = (ally.speed * deltaMs) / 1000;
    ally.position = moveToward(ally.position, target, movement);

    if (distanceSquared(ally.position, target) <= 9) {
      ally.pathIndex = nextIndex;
    }

    if (ally.pathIndex <= 0) {
      ally.alive = false;
    }
  }
}
