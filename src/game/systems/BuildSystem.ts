import { getTowerDefinition, getTowerDefinitionsForClass } from "../data/towers";
import { getPlayerClassDefinition } from "../data/playerClasses";
import { createEmptyTowerBranchRanks } from "../data/towerBranches";
import { getTowerXpToNextLevel } from "../data/towerProgression";
import { GameRegistry } from "../GameRegistry";
import type { GridPoint, PlayerId } from "../models/types";
import { RunTelemetry } from "../telemetry/RunTelemetry";
import { clampGrid, gridKey, gridToWorld, isGridOnPath, isInsideGrid } from "../utils/grid";
import type { EconomySystem } from "./EconomySystem";
import type { GameSystem } from "./GameSystem";
import type { SkillTreeSystem } from "./SkillTreeSystem";

export class BuildSystem implements GameSystem {
  private readonly telemetry = RunTelemetry.getInstance();

  constructor(
    private readonly registry: GameRegistry,
    private readonly economySystem: EconomySystem,
    private readonly skillTreeSystem: SkillTreeSystem
  ) {}

  update(deltaMs: number): void {
    const state = this.registry.state;

    state.cursors.p1.moveCooldownMs = Math.max(0, state.cursors.p1.moveCooldownMs - deltaMs);
    state.cursors.p2.moveCooldownMs = Math.max(0, state.cursors.p2.moveCooldownMs - deltaMs);
  }

  moveCursor(playerId: PlayerId, direction: GridPoint): void {
    const cursor = this.registry.state.cursors[playerId];

    cursor.grid = clampGrid(
      {
        col: cursor.grid.col + direction.col,
        row: cursor.grid.row + direction.row
      },
      this.registry.state.activeMap
    );
  }

  cycleTower(playerId: PlayerId, direction: number): void {
    const cursor = this.registry.state.cursors[playerId];
    const total = this.getAvailableTowers(playerId).length;

    cursor.selectedTowerIndex = (cursor.selectedTowerIndex + direction + total) % total;
  }

  selectTower(playerId: PlayerId, selectedTowerIndex: number): void {
    const cursor = this.registry.state.cursors[playerId];

    cursor.selectedTowerIndex = Math.min(
      Math.max(selectedTowerIndex, 0),
      this.getAvailableTowers(playerId).length - 1
    );
  }

  getAvailableTowers(playerId: PlayerId) {
    return getTowerDefinitionsForClass(this.registry.state.playerClasses[playerId]);
  }

  getTowerCostForPlayer(playerId: PlayerId, towerId: string): number {
    const tower = getTowerDefinition(towerId);
    const playerClass = getPlayerClassDefinition(this.registry.state.playerClasses[playerId]);
    const skillEffects = this.skillTreeSystem.getEffects(playerId);

    return Math.ceil(tower.cost * playerClass.costMultiplier * skillEffects.costMultiplier);
  }

  canBuildAt(grid: GridPoint): boolean {
    const state = this.registry.state;

    const map = this.registry.state.activeMap;

    if (!isInsideGrid(grid, map) || isGridOnPath(grid, map)) {
      return false;
    }

    return !state.towers.some((tower) => gridKey(tower.grid) === gridKey(grid));
  }

  tryBuildForPlayer(playerId: PlayerId): boolean {
    const state = this.registry.state;

    if (state.phase !== "playing") {
      return false;
    }

    const cursor = state.cursors[playerId];
    const towerId = this.registry.getSelectedTowerId(playerId);
    const tower = getTowerDefinition(towerId);
    const cost = this.getTowerCostForPlayer(playerId, towerId);

    const buildBlockReason = this.getBuildBlockReason(cursor.grid);

    if (buildBlockReason) {
      this.registry.pushMessage(`${playerId.toUpperCase()} ${buildBlockReason}`, 1800);
      this.registry.pushPresentationEvent("audio", 600, { cueId: "ui_error" });
      this.registry.pushPlayerNotice(
        playerId,
        "BLOQUEADO",
        buildBlockReason,
        "warning",
        1900
      );
      this.telemetry.record(
        "player-action",
        state,
        { type: "BUILD_TOWER", playerId, towerId, grid: { ...cursor.grid } },
        [buildBlockReason]
      );
      return false;
    }

    if (!this.economySystem.spend(playerId, cost)) {
      const availableCredits = state.economies[playerId].credits;
      const missingCredits = cost - availableCredits;

      this.registry.pushMessage(
        `${playerId.toUpperCase()} faltam ${missingCredits} creditos para ${tower.shortName} (${availableCredits}/${cost})`,
        2200
      );
      this.registry.pushPresentationEvent("audio", 600, { cueId: "ui_error" });
      this.registry.pushPlayerNotice(
        playerId,
        `FALTAM ${missingCredits}`,
        `${tower.shortName}: ${availableCredits}/${cost} creditos`,
        "danger",
        2400
      );
      this.telemetry.record(
        "player-action",
        state,
        { type: "BUILD_TOWER", playerId, towerId, grid: { ...cursor.grid } },
        [`faltam ${missingCredits} creditos`]
      );
      return false;
    }

    state.towers.push({
      id: this.registry.createId("tower"),
      typeId: tower.id,
      ownerId: playerId,
      grid: { ...cursor.grid },
      position: gridToWorld(cursor.grid, state.activeMap),
      cooldownMs: tower.cooldownMs * 0.4,
      level: 1,
      xp: 0,
      xpToNext: getTowerXpToNextLevel(1),
      kills: 0,
      damageDealt: 0,
      skillPoints: 0,
      branchRanks: createEmptyTowerBranchRanks(),
      autoUpgradeEnabled: true,
      autoBuildId: "balanced"
    });
    state.combatStats[playerId].towersBuilt += 1;

    this.registry.pushMessage(`${tower.shortName} armado`);
    this.registry.pushPresentationEvent("build", 900, {
      cueId: "build",
      position: gridToWorld(cursor.grid, state.activeMap),
      color: tower.color,
      label: tower.shortName
    });
    this.registry.pushPlayerNotice(
      playerId,
      "TORRE ARMADA",
      `${tower.shortName} ativo por ${cost} creditos`,
      "success",
      1600
    );
    this.telemetry.record("player-action", state, {
      type: "BUILD_TOWER",
      playerId,
      towerId,
      grid: { ...cursor.grid }
    });

    return true;
  }

  private getBuildBlockReason(grid: GridPoint): string | null {
    const state = this.registry.state;
    const map = state.activeMap;

    if (!isInsideGrid(grid, map)) {
      return "fora do grid";
    }

    if (isGridOnPath(grid, map)) {
      return "nao pode construir na rota";
    }

    if (state.towers.some((tower) => gridKey(tower.grid) === gridKey(grid))) {
      return "celula ja ocupada";
    }

    return null;
  }
}
