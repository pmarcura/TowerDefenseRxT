import { getPlayerClassDefinition } from "../data/playerClasses";
import { getTowerBranchEffectTotals } from "../data/towerBranches";
import { getTowerDefinition } from "../data/towers";
import { getTowerLevelBonuses } from "../data/towerProgression";
import { GameRegistry } from "../GameRegistry";
import type { EnemyEntity, TowerEntity } from "../models/types";
import { distanceSquared } from "../utils/math";
import type { AllySystem } from "./AllySystem";
import type { GameSystem } from "./GameSystem";
import type { ProjectileSystem } from "./ProjectileSystem";
import type { SkillTreeSystem } from "./SkillTreeSystem";
import type { EconomySystem } from "./EconomySystem";

export class TowerSystem implements GameSystem {
  constructor(
    private readonly registry: GameRegistry,
    private readonly projectileSystem: ProjectileSystem,
    private readonly skillTreeSystem: SkillTreeSystem,
    private readonly economySystem: EconomySystem,
    private readonly allySystem: AllySystem
  ) {}

  update(deltaMs: number): void {
    const state = this.registry.state;

    for (const tower of state.towers) {
      tower.cooldownMs -= deltaMs;

      if (this.updateIncomeTower(tower)) {
        continue;
      }

      if (this.updateUtilityTower(tower)) {
        continue;
      }

      if (tower.cooldownMs > 0) {
        continue;
      }

      const target = this.findTarget(tower);

      if (!target) {
        continue;
      }

      this.fireAt(tower, target);
    }
  }

  getTowerRange(tower: TowerEntity): number {
    const definition = getTowerDefinition(tower.typeId);
    const playerClass = getPlayerClassDefinition(this.registry.state.playerClasses[tower.ownerId]);
    const skillEffects = this.skillTreeSystem.getEffects(tower.ownerId);
    const levelBonuses = getTowerLevelBonuses(tower.level);
    const branchEffects = getTowerBranchEffectTotals(tower.branchRanks);

    return (
      definition.range +
      playerClass.rangeBonus +
      skillEffects.rangeBonus +
      levelBonuses.rangeBonus +
      branchEffects.rangeBonus
    );
  }

  private findTarget(tower: TowerEntity): EnemyEntity | null {
    const range = this.getTowerRange(tower);
    const rangeSquared = range * range;
    const candidates = this.registry.state.enemies.filter(
      (enemy) => enemy.alive && distanceSquared(enemy.position, tower.position) <= rangeSquared
    );

    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((a, b) => b.pathIndex - a.pathIndex)[0];
  }

  private fireAt(tower: TowerEntity, target: EnemyEntity): void {
    const definition = getTowerDefinition(tower.typeId);
    const playerClass = getPlayerClassDefinition(this.registry.state.playerClasses[tower.ownerId]);
    const skillEffects = this.skillTreeSystem.getEffects(tower.ownerId);
    const levelBonuses = getTowerLevelBonuses(tower.level);
    const branchEffects = getTowerBranchEffectTotals(tower.branchRanks);
    const auraEffects = this.getAuraEffects(tower);

    tower.cooldownMs =
      definition.cooldownMs *
      levelBonuses.cooldownMultiplier *
      branchEffects.cooldownMultiplier *
      auraEffects.cooldownMultiplier;

    this.projectileSystem.addProjectile({
      id: this.registry.createId("projectile"),
      typeId: definition.id,
      towerId: tower.id,
      targetEnemyId: target.id,
      position: { ...tower.position },
      speed: definition.projectileSpeed * branchEffects.projectileSpeedMultiplier,
      damage:
        definition.damage *
        playerClass.damageMultiplier *
        skillEffects.damageMultiplier *
        levelBonuses.damageMultiplier *
        branchEffects.damageMultiplier *
        auraEffects.damageMultiplier,
      criticalChance: Math.min(0.2, 0.05 + tower.level * 0.006 + tower.branchRanks.rupture * 0.015),
      criticalMultiplier: 1.75 + tower.branchRanks.focus * 0.1,
      effect: definition.effect,
      alive: true
    });
  }

  private updateIncomeTower(tower: TowerEntity): boolean {
    const definition = getTowerDefinition(tower.typeId);

    if (definition.effect !== "income") {
      return false;
    }

    if (!this.registry.state.wave.active) {
      tower.cooldownMs = Math.min(tower.cooldownMs, definition.incomeIntervalMs ?? definition.cooldownMs);
      return true;
    }

    if (tower.cooldownMs > 0) {
      return true;
    }

    const income = this.economySystem.rewardIncome(tower.ownerId, definition.incomePerTick ?? 1, tower.id);
    tower.cooldownMs = definition.incomeIntervalMs ?? definition.cooldownMs;

    if (income <= 0) {
      return true;
    }

    this.registry.pushPresentationEvent("income", 900, {
      cueId: "income_tick",
      position: { ...tower.position },
      color: definition.glow,
      label: `+${income} CRED`,
      sourcePlayerId: tower.ownerId,
      sourceTowerId: tower.id
    });

    return true;
  }

  private updateUtilityTower(tower: TowerEntity): boolean {
    const definition = getTowerDefinition(tower.typeId);

    if (definition.effect !== "summon" && definition.effect !== "ritual-zone" && definition.effect !== "aura") {
      return false;
    }

    if (tower.cooldownMs > 0) {
      return true;
    }

    if (definition.effect === "summon") {
      this.allySystem.spawnFromTower(tower);
    }

    if (definition.effect === "ritual-zone") {
      const target = this.findTarget(tower);
      const position = target?.position ?? tower.position;

      this.registry.state.ritualZones.push({
        id: this.registry.createId("zone"),
        ownerId: tower.ownerId,
        sourceTowerId: tower.id,
        position: { ...position },
        radius: definition.zoneRadius ?? 52,
        damageMultiplier: definition.markDamageMultiplier ?? 1.12,
        armorReduction: definition.armorReduction ?? 1,
        tickDamage: 0,
        tickMs: 500,
        durationMs: definition.zoneDurationMs ?? 3200,
        color: definition.glow
      });
      this.registry.pushPresentationEvent("level-up", 850, {
        position: { ...position },
        color: definition.glow,
        label: "ZONA"
      });
    }

    tower.cooldownMs = definition.cooldownMs;

    return true;
  }

  private getAuraEffects(tower: TowerEntity): {
    damageMultiplier: number;
    cooldownMultiplier: number;
  } {
    let damageMultiplier = 1;
    let cooldownMultiplier = 1;

    for (const candidate of this.registry.state.towers) {
      if (candidate.id === tower.id || candidate.ownerId !== tower.ownerId) {
        continue;
      }

      const definition = getTowerDefinition(candidate.typeId);

      if (definition.effect !== "aura") {
        continue;
      }

      const auraRange = definition.auraRange ?? definition.range;

      if (distanceSquared(candidate.position, tower.position) > auraRange * auraRange) {
        continue;
      }

      damageMultiplier *= definition.auraDamageMultiplier ?? 1;
      cooldownMultiplier *= definition.auraCooldownMultiplier ?? 1;
    }

    return { damageMultiplier, cooldownMultiplier };
  }
}
