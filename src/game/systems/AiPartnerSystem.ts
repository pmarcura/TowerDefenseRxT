import { getSkillDefinition } from "../data/skills";
import { towerBranchDefinitions } from "../data/towerBranches";
import type { GameAction } from "../actions/types";
import type {
  AiDecisionKind,
  GridPoint,
  TowerDefinition,
  TowerUpgradeBranchId
} from "../models/types";
import { RunTelemetry } from "../telemetry/RunTelemetry";
import { gridKey, isGridOnPath, isInsideGrid } from "../utils/grid";
import type { GameRegistry } from "../GameRegistry";
import type { BuildSystem } from "./BuildSystem";
import type { GameSystem } from "./GameSystem";
import type { SkillTreeSystem } from "./SkillTreeSystem";

const AI_PLAYER_ID = "p2";
const BUILD_THINK_INTERVAL_MS = 1500;
const UPGRADE_THINK_INTERVAL_MS = 900;
const REWARD_THINK_INTERVAL_MS = 650;

type AiScoredTower = {
  tower: TowerDefinition;
  index: number;
  cost: number;
  score: number;
  tags: string[];
};

type AiGridChoice = {
  grid: GridPoint;
  score: number;
  routeIndex: number;
  tags: string[];
};

type AiBuildPlan = {
  tower: TowerDefinition;
  index: number;
  cost: number;
  grid: GridPoint;
  routeIndex: number;
  score: number;
  confidence: number;
  tags: string[];
};

export class AiPartnerSystem implements GameSystem {
  private readonly telemetry = RunTelemetry.getInstance();
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
        const skill = getSkillDefinition(skillId);
        this.commitDecision(
          "reward",
          `Reward: ${skill.shortName}`,
          this.describeSkillChoice(skillId),
          0.76,
          this.scoreSkill(skillId),
          ["recompensa", skill.rarity, skill.branch],
          { type: "SELECT_REWARD", playerId: AI_PLAYER_ID, skillId },
          undefined,
          skillId
        );
        this.registry.pushPlayerNotice("p1", "IA ESCOLHEU", skill.shortName, "info", 1600);
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
      this.commitDecision(
        "ready",
        "Pronto",
        "defesa minima pronta",
        0.68,
        this.registry.state.towers.filter((tower) => tower.ownerId === AI_PLAYER_ID).length,
        ["tempo", "onda"],
        { type: "SET_READY", playerId: AI_PLAYER_ID, ready: true }
      );
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
      this.commitDecision(
        "upgrade",
        `Upgrade ${branch.shortName}`,
        `torre com ${Math.round(candidate.damageDealt)} dano`,
        0.72,
        candidate.damageDealt / 100 + candidate.level,
        ["xp", branch.id, candidate.level >= 3 ? "carry" : "crescimento"],
        {
          type: "UPGRADE_TOWER",
          playerId: AI_PLAYER_ID,
          towerId: candidate.id,
          branchId: branch.id
        },
        undefined,
        candidate.id
      );
    }
  }

  private updateBuilds(deltaMs: number): void {
    this.buildThinkMs -= deltaMs;

    if (this.buildThinkMs > 0) {
      return;
    }

    this.buildThinkMs = BUILD_THINK_INTERVAL_MS;
    const state = this.registry.state;
    const plan = this.chooseBuildPlan();

    if (!plan) {
      this.commitDecision(
        "hold",
        "Segurando creditos",
        "sem posicao eficiente agora",
        0.52,
        0,
        ["economia", "sem-slot"]
      );
      return;
    }

    state.cursors[AI_PLAYER_ID].grid = plan.grid;
    this.buildSystem.selectTower(AI_PLAYER_ID, plan.index);

    if (this.buildSystem.tryBuildForPlayer(AI_PLAYER_ID)) {
      this.commitDecision(
        "build",
        `${plan.tower.shortName} R${plan.routeIndex + 1}`,
        `${Math.round(plan.score)} pts · ${plan.tags.slice(0, 2).join(" + ")}`,
        plan.confidence,
        plan.score,
        plan.tags,
        {
          type: "BUILD_TOWER",
          playerId: AI_PLAYER_ID,
          towerId: plan.tower.id,
          grid: { ...plan.grid }
        },
        plan.routeIndex,
        plan.tower.id
      );
      this.registry.pushPlayerNotice(
        "p1",
        "IA CONSTRUIU",
        `${plan.tower.shortName} · rota ${plan.routeIndex + 1}`,
        "info",
        1500
      );
    }
  }

  private chooseBuildPlan(): AiBuildPlan | null {
    const state = this.registry.state;
    const towers = this.buildSystem.getAvailableTowers(AI_PLAYER_ID);
    const reserve = this.getCreditReserve();
    const plans = towers
      .map((tower, index) => {
        const cost = this.buildSystem.getTowerCostForPlayer(AI_PLAYER_ID, tower.id);
        const towerScore = this.scoreTower(tower, cost, index);

        if (state.economies[AI_PLAYER_ID].credits - cost < reserve && tower.effect !== "income") {
          towerScore.score -= 4;
          towerScore.tags.push("reserva");
        }

        if (state.economies[AI_PLAYER_ID].credits < cost) {
          return null;
        }

        const grid = this.chooseBuildGrid(tower);

        if (!grid) {
          return null;
        }

        const score = towerScore.score + grid.score - cost / 120;
        const confidence = Math.max(0.45, Math.min(0.94, 0.48 + score / 24));

        return {
          tower,
          index,
          cost,
          grid: grid.grid,
          routeIndex: grid.routeIndex,
          score,
          confidence,
          tags: [...towerScore.tags, ...grid.tags].slice(0, 5)
        };
      })
      .filter((plan): plan is AiBuildPlan => Boolean(plan))
      .filter((plan) => plan.score > 4.5)
      .sort((a, b) => b.score - a.score);

    return plans[0] ?? null;
  }

  private chooseBuildGrid(tower: TowerDefinition): AiGridChoice | null {
    const state = this.registry.state;
    const map = state.activeMap;
    const occupied = new Set(state.towers.map((entity) => gridKey(entity.grid)));
    const candidates: AiGridChoice[] = [];

    for (let row = 0; row < map.rows; row += 1) {
      for (let col = 0; col < map.columns; col += 1) {
        const grid = { col, row };

        if (!isInsideGrid(grid, map) || isGridOnPath(grid, map) || occupied.has(gridKey(grid))) {
          continue;
        }

        const score = this.scoreGrid(grid, tower);

        if (score.score > -8) {
          candidates.push({ grid, ...score });
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
  }

  private scoreGrid(grid: GridPoint, tower: TowerDefinition): Omit<AiGridChoice, "grid"> {
    const map = this.registry.state.activeMap;
    const rangeTiles = tower.range / map.tileSize;
    let score = 0;
    let coveredRoutes = 0;
    let bestRouteIndex = 0;
    let highestRouteScore = Number.NEGATIVE_INFINITY;
    const tags: string[] = [];

    for (let routeIndex = 0; routeIndex < map.paths.length; routeIndex += 1) {
      const path = map.paths[routeIndex];
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
        const routeScore = 4.2 + bestProgress * 4 + Math.max(0, 4 - bestDistance) * 0.55;
        score += routeScore;
        if (routeScore > highestRouteScore) {
          highestRouteScore = routeScore;
          bestRouteIndex = routeIndex;
        }
      } else {
        score -= Math.min(5, bestDistance - rangeTiles);
      }

      score += Math.max(0, 5 - bestDistance) * 0.55;

      if (bestProgress >= 0.62 && bestDistance <= rangeTiles + 1) {
        tags.push("fim-da-rota");
      }

      if (bestDistance <= 2) {
        tags.push("perto-rota");
      }
    }

    const nearbyTowerPenalty = this.registry.state.towers.reduce((penalty, existing) => {
      const distance = Math.abs(existing.grid.col - grid.col) + Math.abs(existing.grid.row - grid.row);

      return penalty + Math.max(0, 3 - distance);
    }, 0);

    if (coveredRoutes > 1) {
      tags.push("multi-rota");
    }

    if (nearbyTowerPenalty <= 1) {
      tags.push("espacado");
    }

    return {
      score: score + Math.max(0, coveredRoutes - 1) * 4 - nearbyTowerPenalty * 0.7,
      routeIndex: bestRouteIndex,
      tags: [...new Set(tags)]
    };
  }

  private scoreTower(tower: TowerDefinition, cost: number, index: number): AiScoredTower {
    const state = this.registry.state;
    const existingSameType = state.towers.filter(
      (candidate) => candidate.ownerId === AI_PLAYER_ID && candidate.typeId === tower.id
    ).length;
    const dps = tower.damage > 0 ? tower.damage / Math.max(0.2, tower.cooldownMs / 1000) : 0;
    const tags: string[] = [];
    let score = dps / Math.max(35, cost) * 18 + tower.range / 100 - existingSameType * 1.5;

    if (dps > 18) {
      tags.push("dps");
    }

    if (tower.effect === "income") {
      score += state.wave.currentWaveIndex <= 2 && existingSameType < 2 ? 4.8 : -3.6;
      tags.push(state.wave.currentWaveIndex <= 2 ? "economia-cedo" : "economia-tarde");
    }

    if (tower.effect === "splash" || tower.effect === "chain" || tower.effect === "ritual-zone") {
      score += 2.1;
      tags.push("grupo");
    }

    if (tower.effect === "mark" || tower.effect === "cleanse") {
      score += state.wave.currentWaveIndex >= 3 ? 2.4 : 0.5;
      tags.push("anti-blindado");
    }

    if (tower.effect === "summon" || tower.effect === "slow" || tower.effect === "redirect") {
      score += state.activeMap.paths.length > 1 ? 2.2 : 1.1;
      tags.push("controle");
    }

    if (tower.effect === "aura") {
      const nearbyAllies = state.towers.filter((candidate) => candidate.ownerId === AI_PLAYER_ID).length;
      score += nearbyAllies >= 3 ? 2.8 : -2.2;
      tags.push(nearbyAllies >= 3 ? "aura-valor" : "aura-cedo");
    }

    return { tower, index, cost, score, tags };
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

  private scoreBranch(branchId: TowerUpgradeBranchId): number {
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

  private getCreditReserve(): number {
    const state = this.registry.state;
    const towerCount = state.towers.filter((tower) => tower.ownerId === AI_PLAYER_ID).length;

    if (towerCount < 2) {
      return 0;
    }

    return Math.min(44, 8 + state.wave.currentWaveIndex * 3);
  }

  private describeSkillChoice(skillId: string): string {
    const skill = getSkillDefinition(skillId);

    if (skill.effect.damageMultiplier) {
      return "mais dano para a run";
    }

    if (skill.effect.costMultiplier) {
      return "torres mais baratas";
    }

    if (skill.effect.rewardMultiplier) {
      return "mais economia";
    }

    if (skill.effect.rangeBonus) {
      return "mais alcance";
    }

    return skill.branch;
  }

  private commitDecision(
    kind: AiDecisionKind,
    title: string,
    detail: string,
    confidence: number,
    score: number,
    tags: string[],
    action?: GameAction,
    routeIndex?: number,
    towerId?: string
  ): void {
    const state = this.registry.state;

    state.aiPartner.active = true;
    state.aiPartner.decisionsLogged += 1;
    state.aiPartner.lastDecision = {
      kind,
      title,
      detail,
      confidence: Math.round(confidence * 100) / 100,
      score: Math.round(score * 10) / 10,
      routeIndex,
      towerId,
      tags: [...new Set(tags)].slice(0, 5),
      ttlMs: kind === "hold" ? 1700 : 3600
    };
    this.telemetry.record("ai-decision", state, action);
  }
}
