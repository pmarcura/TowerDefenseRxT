import { MINIMUM_DAMAGE, PROJECTILE_HIT_RADIUS } from "../config/constants";
import { getEnemyDefinition } from "../data/enemies";
import { getTowerBranchEffectTotals } from "../data/towerBranches";
import { getTowerDefinition } from "../data/towers";
import {
  getTowerXpToNextLevel,
  towerProgression
} from "../data/towerProgression";
import { GameRegistry } from "../GameRegistry";
import type { EnemyEntity, PlayerId, ProjectileEntity } from "../models/types";
import { buildPathWorldPoints } from "../utils/grid";
import { distance, distanceSquared, moveToward } from "../utils/math";
import type { EconomySystem } from "./EconomySystem";
import type { GameSystem } from "./GameSystem";

export class ProjectileSystem implements GameSystem {
  constructor(
    private readonly registry: GameRegistry,
    private readonly economySystem: EconomySystem
  ) {}

  addProjectile(projectile: ProjectileEntity): void {
    this.registry.state.projectiles.push(projectile);
    this.registry.pushPresentationEvent("audio", 280, { cueId: "tower_fire" });
  }

  update(deltaMs: number): void {
    const state = this.registry.state;

    for (const projectile of state.projectiles) {
      if (!projectile.alive) {
        continue;
      }

      const target = state.enemies.find((enemy) => enemy.id === projectile.targetEnemyId);

      if (!target || !target.alive) {
        projectile.alive = false;
        continue;
      }

      const movement = (projectile.speed * deltaMs) / 1000;
      projectile.position = moveToward(projectile.position, target.position, movement);

      if (distance(projectile.position, target.position) <= PROJECTILE_HIT_RADIUS) {
        this.hitTarget(projectile, target);
      }
    }

    state.projectiles = state.projectiles.filter((projectile) => projectile.alive);
  }

  private hitTarget(projectile: ProjectileEntity, target: EnemyEntity): void {
    const tower = getTowerDefinition(projectile.typeId);
    const sourceTower = this.registry.state.towers.find(
      (candidate) => candidate.id === projectile.towerId
    );
    const branchEffects = sourceTower
      ? getTowerBranchEffectTotals(sourceTower.branchRanks)
      : null;
    const ownerId = this.getProjectileOwner(projectile);

    this.damageEnemy(target, projectile.damage, ownerId, projectile.towerId);

    if (projectile.effect === "slow") {
      target.slowMultiplier = tower.slowMultiplier ?? target.slowMultiplier;
      target.slowTimerMs =
        (tower.slowDurationMs ?? target.slowTimerMs) + (branchEffects?.slowDurationBonusMs ?? 0);
    }

    const splashRadius =
      (tower.splashRadius ?? 0) + (branchEffects?.splashRadiusBonus ?? 0);

    if (splashRadius > 0) {
      const splashRadiusSquared = splashRadius * splashRadius;
      const splashDamageMultiplier =
        projectile.effect === "splash" ? 0.55 : branchEffects?.splashDamageMultiplier ?? 0;

      for (const enemy of this.registry.state.enemies) {
        if (enemy.id === target.id || !enemy.alive) {
          continue;
        }

        if (distanceSquared(enemy.position, target.position) <= splashRadiusSquared) {
          this.damageEnemy(
            enemy,
            projectile.damage * splashDamageMultiplier,
            ownerId,
            projectile.towerId
          );
        }
      }
    }

    const chainJumps = (tower.chainJumps ?? 0) + (branchEffects?.chainJumpsBonus ?? 0);
    const chainRange = (tower.chainRange ?? 0) + (branchEffects?.chainRangeBonus ?? 0);

    if (chainJumps > 0 && chainRange > 0) {
      this.chainDamage(
        target,
        projectile.damage,
        chainJumps,
        chainRange,
        ownerId,
        projectile.towerId,
        projectile.effect === "chain" ? 0.72 : branchEffects?.chainDamageMultiplier ?? 0
      );
    }

    projectile.alive = false;
  }

  private chainDamage(
    firstTarget: EnemyEntity,
    rawDamage: number,
    jumps: number,
    chainRange: number,
    ownerId: PlayerId,
    towerId: string,
    firstJumpMultiplier: number
  ): void {
    let currentTarget = firstTarget;
    let damage = rawDamage * firstJumpMultiplier;
    const visitedEnemyIds = new Set([firstTarget.id]);

    for (let jump = 0; jump < jumps; jump += 1) {
      const chainRangeSquared = chainRange * chainRange;
      const nextTarget = this.registry.state.enemies
        .filter(
          (enemy) =>
            enemy.alive &&
            !visitedEnemyIds.has(enemy.id) &&
            distanceSquared(enemy.position, currentTarget.position) <= chainRangeSquared
        )
        .sort(
          (a, b) =>
            distanceSquared(a.position, currentTarget.position) -
            distanceSquared(b.position, currentTarget.position)
        )[0];

      if (!nextTarget) {
        return;
      }

      this.damageEnemy(nextTarget, damage, ownerId, towerId);
      visitedEnemyIds.add(nextTarget.id);
      currentTarget = nextTarget;
      damage *= 0.68;
    }
  }

  private damageEnemy(
    enemy: EnemyEntity,
    rawDamage: number,
    ownerId: PlayerId,
    towerId: string
  ): void {
    if (!enemy.alive) {
      return;
    }

    const definition = getEnemyDefinition(enemy.typeId);
    const armor = Math.max(0, definition.armor - enemy.armorReduction);
    const finalDamage = Math.max(MINIMUM_DAMAGE, rawDamage - armor) * enemy.markMultiplier;
    const dealtDamage = Math.min(enemy.hp, finalDamage);
    const stats = this.registry.state.combatStats[ownerId];

    enemy.hp -= dealtDamage;
    enemy.damageSources[towerId] = (enemy.damageSources[towerId] ?? 0) + dealtDamage;
    stats.totalDamageDealt += dealtDamage;
    stats.waveDamageDealt += dealtDamage;
    this.addTowerDamage(towerId, dealtDamage);
    this.registry.pushPresentationEvent("damage", 720, {
      cueId: "hit",
      position: { ...enemy.position },
      amount: dealtDamage,
      color: definition.color
    });

    this.applyProjectileStatus(enemy, towerId);

    if (enemy.hp <= 0) {
      enemy.alive = false;
      stats.kills += 1;
      this.grantTowerKill(towerId);
      this.grantTowerEliminationXp(enemy, towerId);
      const creditsGranted = this.economySystem.reward(ownerId, definition.reward);
      this.registry.pushPresentationEvent("kill", 900, {
        cueId: "kill",
        position: { ...enemy.position },
        color: definition.glow,
        label: `+${creditsGranted}`
      });
    }
  }

  private applyProjectileStatus(enemy: EnemyEntity, towerId: string): void {
    const towerEntity = this.registry.state.towers.find((candidate) => candidate.id === towerId);

    if (!towerEntity) {
      return;
    }

    const tower = getTowerDefinition(towerEntity.typeId);

    if (tower.effect === "mark") {
      enemy.markMultiplier = Math.max(enemy.markMultiplier, tower.markDamageMultiplier ?? 1.18);
      enemy.markTimerMs = Math.max(enemy.markTimerMs, tower.markDurationMs ?? 2600);
      return;
    }

    if (tower.effect === "cleanse") {
      enemy.armorReduction = Math.max(enemy.armorReduction, tower.armorReduction ?? 3);
      enemy.armorReductionTimerMs = Math.max(enemy.armorReductionTimerMs, tower.statusDurationMs ?? 3400);
      return;
    }

    if (tower.effect === "redirect") {
      this.redirectEnemy(enemy, tower.redirectDistance ?? 1);
    }
  }

  private redirectEnemy(enemy: EnemyEntity, distanceSteps: number): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const bossPenalty = definition.traits.includes("boss") ? 0 : 1;
    const steps = Math.max(0, Math.floor(distanceSteps * bossPenalty));

    if (steps <= 0 || enemy.pathIndex <= 0) {
      return;
    }

    const path = buildPathWorldPoints(this.registry.state.activeMap, enemy.pathIndexId);
    enemy.pathIndex = Math.max(0, enemy.pathIndex - steps);
    const point = path[enemy.pathIndex];

    if (point) {
      enemy.position = { ...point };
    }
  }

  private getProjectileOwner(projectile: ProjectileEntity): PlayerId {
    return (
      this.registry.state.towers.find((tower) => tower.id === projectile.towerId)?.ownerId ?? "p1"
    );
  }

  private addTowerDamage(towerId: string, dealtDamage: number): void {
    const tower = this.registry.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower) {
      return;
    }

    tower.damageDealt += dealtDamage;
  }

  private grantTowerKill(towerId: string): void {
    const tower = this.registry.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower) {
      return;
    }

    tower.kills += 1;
  }

  private grantTowerEliminationXp(enemy: EnemyEntity, killingTowerId: string): void {
    const sourceTowerIds = Object.keys(enemy.damageSources);
    const participantTowerIds =
      sourceTowerIds.length > 0 ? sourceTowerIds : [killingTowerId];

    for (const participantTowerId of participantTowerIds) {
      this.grantTowerXp(participantTowerId);
    }
  }

  private grantTowerXp(towerId: string): void {
    const tower = this.registry.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower) {
      return;
    }

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

      const definition = getTowerDefinition(tower.typeId);

      this.registry.pushPresentationEvent("level-up", 1250, {
        cueId: "reward",
        position: { ...tower.position },
        color: definition.glow,
        label: `LV ${tower.level}`
      });
      this.registry.pushPlayerNotice(
        tower.ownerId,
        `${definition.shortName} LV ${tower.level}`,
        "torre evoluiu por abates e assistencias",
        "success",
        1900
      );
    }
  }
}
