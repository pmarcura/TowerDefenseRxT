import { getSkillDefinition } from "../data/skills";
import { towerBranchDefinitions } from "../data/towerBranches";
import type { TowerDefinition } from "../models/types";
import { gridKey, isGridOnPath, isInsideGrid } from "../utils/grid";
import type { GameRegistry } from "../GameRegistry";
import type { BuildSystem } from "./BuildSystem";
import type { GameSystem } from "./GameSystem";
import type { SkillTreeSystem } from "./SkillTreeSystem";

const AI_PLAYER_ID = "p2";
const BUILD_THINK_INTERVAL_MS = 1500;
const UPGRADE_THINK_INTERVAL_MS = 900;
const REWARD_THINK_INTERVAL_MS = 650;

export class AiPartnerSystem implements GameSystem {
  private buildThinkMs = 500;
  private upgradeThinkMs = 800;
  private rewardThinkMs = 450;
  private readyThinkMs = 900;

  constructor(
    private readonly registry: GameRegistry,
    private readonly buildSystem: BuildSystem,
    private readonly skillTreeSystem: SkillTreeSystem
  ) {}

  update(deltaMs: number): void {
    const state = this.registry.state;

    if (state.sessionMode !== "solo-ai") {
      return;
    }

    if (state.phase === "reward-selection") {
      this.updateRewardSelection(deltaMs);
      return;
    }

    if (state.phase !== "playing") {
      return;
    }

    this.updateReady(deltaMs);
    this.updateUpgrades(deltaMs);
    this.updateBuilds(deltaMs);
  }

  private updateRewardSelection(deltaMs: number): void {
    this.rewardThinkMs -= deltaMs;

    if (this.rewardThinkMs > 0) {
      return;
    }

    this.rewardThinkMs = REWARD_THINK_INTERVAL_MS;
    const choices = this.registry.state.rewardSelection?.choices[AI_PLAYER_ID];

    if (choices && !choices.selectedSkillId) {
      const skillId = [...choices.skillIds].sort(
        (a, b) => this.scoreSkill(b) - this.scoreSkill(a)
      )[0];

      if (skillId) {
        this.skillTreeSystem.selectReward(AI_PLAYER_ID, skillId);
        this.registry.pushPlayerNotice("p1", "IA ESCOLHEU", getSkillDefinition(skillId).shortName, "info", 1600);
      }
    }

    if (this.skillTreeSystem.canCloseRewardSelection()) {
      this.skillTreeSystem.completeRewardSelection();
    }
  }

  private updateReady(deltaMs: number): void {
    const state = this.registry.state;

    if (state.wave.active || state.wave.readyPlayers[AI_PLAYER_ID]) {
      this.readyThinkMs = 900;
      return;
    }

    this.readyThinkMs -= deltaMs;

    if (this.readyThinkMs <= 0) {
      this.registry.setPlayerReady(AI_PLAYER_ID);
      this.readyThinkMs = 900;
    }
  }

  private updateUpgrades(deltaMs: number): void {
    this.upgradeThinkMs -= deltaMs;

    if (this.upgradeThinkMs > 0) {
      return;
    }

    this.upgradeThinkMs = UPGRADE_THINK_INTERVAL_MS;
    const candidate = this.registry.state.towers
      .filter((tower) => tower.ownerId === AI_PLAYER_ID && tower.skillPoints > 0)
      .sort((a, b) => b.damageDealt + b.level * 160 - (a.damageDealt + a.level * 160))[0];

    if (!candidate) {
      return;
    }

    const branch = [...towerBranchDefinitions]
      .sort((a, b) => this.scoreBranch(b.id) - this.scoreBranch(a.id))
      .find((definition) => candidate.branchRanks[definition.id] < definition.maxRank);

    if (branch) {
      this.registry.spendTowerUpgradePoint(AI_PLAYER_ID, candidate.id, branch.id);
    }
  }

  private updateBuilds(deltaMs: number): void {
    this.buildThinkMs -= deltaMs;

    if (this.buildThinkMs > 0) {
      return;
    }

    this.buildThinkMs = BUILD_THINK_INTERVAL_MS;
    const state = this.registry.state;
    const towers = this.buildSystem.getAvailableTowers(AI_PLAYER_ID);
    const affordable = towers
      .map((tower, index) => ({
        tower,
        index,
        cost: this.buildSystem.getTowerCostForPlayer(AI_PLAYER_ID, tower.id),
        score: this.scoreTower(tower)
      }))
      .filter((entry) => state.economies[AI_PLAYER_ID].credits >= entry.cost)
      .sort((a, b) => b.score - a.score);

    for (const entry of affordable) {
      const grid = this.chooseBuildGrid(entry.tower);

      if (!grid) {
        continue;
      }

      state.cursors[AI_PLAYER_ID].grid = grid;
      this.buildSystem.selectTower(AI_PLAYER_ID, entry.index);

      if (this.buildSystem.tryBuildForPlayer(AI_PLAYER_ID)) {
        this.registry.pushPlayerNotice(
          "p1",
          "IA CONSTRUIU",
          `${entry.tower.shortName} na rota ${this.describeNearestRoute(grid)}`,
          "info",
          1500
        );
        return;
      }
    }
  }

  private chooseBuildGrid(tower: TowerDefinition) {
    const state = this.registry.state;
    const map = state.activeMap;
    const occupied = new Set(state.towers.map((entity) => gridKey(entity.grid)));
    const candidates: { grid: { col: number; row: number }; score: number }[] = [];

    for (let row = 0; row < map.rows; row += 1) {
      for (let col = 0; col < map.columns; col += 1) {
        const grid = { col, row };

        if (!isInsideGrid(grid, map) || isGridOnPath(grid, map) || occupied.has(gridKey(grid))) {
          continue;
        }

        const score = this.scoreGrid(grid, tower);

        if (score > -8) {
          candidates.push({ grid, score });
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score)[0]?.grid ?? null;
  }

  private scoreGrid(grid: { col: number; row: number }, tower: TowerDefinition): number {
    const map = this.registry.state.activeMap;
    const rangeTiles = tower.range / map.tileSize;
    let score = 0;
    let coveredRoutes = 0;

    for (const path of map.paths) {
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestProgress = 0;

      path.forEach((point, index) => {
        const distance = Math.abs(point.col - grid.col) + Math.abs(point.row - grid.row);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestProgress = path.length <= 1 ? 1 : index / (path.length - 1);
        }
      });

      if (bestDistance <= rangeTiles) {
        coveredRoutes += 1;
        score += 4.2 + bestProgress * 3;
      } else {
        score -= Math.min(5, bestDistance - rangeTiles);
      }

      score += Math.max(0, 5 - bestDistance) * 0.55;
    }

    const nearbyTowerPenalty = this.registry.state.towers.reduce((penalty, existing) => {
      const distance = Math.abs(existing.grid.col - grid.col) + Math.abs(existing.grid.row - grid.row);

      return penalty + Math.max(0, 3 - distance);
    }, 0);

    return score + Math.max(0, coveredRoutes - 1) * 4 - nearbyTowerPenalty * 0.7;
  }

  private scoreTower(tower: TowerDefinition): number {
    const state = this.registry.state;
    const existingSameType = state.towers.filter(
      (candidate) => candidate.ownerId === AI_PLAYER_ID && candidate.typeId === tower.id
    ).length;
    const dps = tower.damage > 0 ? tower.damage / Math.max(0.2, tower.cooldownMs / 1000) : 0;
    let score = dps / Math.max(35, tower.cost) * 18 + tower.range / 100 - existingSameType * 1.5;

    if (tower.effect === "income") {
      score += state.wave.currentWaveIndex <= 2 && existingSameType < 2 ? 4.8 : -3.6;
    }

    if (tower.effect === "splash" || tower.effect === "chain" || tower.effect === "ritual-zone") {
      score += 2.1;
    }

    if (tower.effect === "mark" || tower.effect === "cleanse") {
      score += state.wave.currentWaveIndex >= 3 ? 2.4 : 0.5;
    }

    if (tower.effect === "summon" || tower.effect === "slow" || tower.effect === "redirect") {
      score += state.activeMap.paths.length > 1 ? 2.2 : 1.1;
    }

    if (tower.effect === "aura") {
      const nearbyAllies = state.towers.filter((candidate) => candidate.ownerId === AI_PLAYER_ID).length;
      score += nearbyAllies >= 3 ? 2.8 : -2.2;
    }

    return score;
  }

  private scoreSkill(skillId: string): number {
    const skill = getSkillDefinition(skillId);
    let score = skill.weight / Math.max(1, skill.costSigils);

    score += skill.effect.damageMultiplier ? 5 : 0;
    score += skill.effect.rangeBonus ? 2 : 0;
    score += skill.effect.costMultiplier ? 2.5 : 0;
    score += skill.effect.rewardMultiplier ? 2 : 0;
    score += skill.rarity === "epic" ? 2.5 : skill.rarity === "rare" ? 1.4 : 0;

    return score;
  }

  private scoreBranch(branchId: string): number {
    if (branchId === "focus") {
      return 5;
    }

    if (branchId === "tempo") {
      return 4;
    }

    if (branchId === "rupture") {
      return 3.5;
    }

    if (branchId === "reach") {
      return 3;
    }

    return 2;
  }

  private describeNearestRoute(grid: { col: number; row: number }): number {
    const map = this.registry.state.activeMap;
    const best = map.paths
      .map((path, index) => ({
        index,
        distance: Math.min(
          ...path.map((point) => Math.abs(point.col - grid.col) + Math.abs(point.row - grid.row))
        )
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    return (best?.index ?? 0) + 1;
  }
}
