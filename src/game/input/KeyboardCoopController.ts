import Phaser from "phaser";
import { CURSOR_STEP_COOLDOWN_MS } from "../config/constants";
import { playerClassDefinitions } from "../data/playerClasses";
import { GameRegistry } from "../GameRegistry";
import type { GridPoint, PlayerId } from "../models/types";
import type { BuildSystem } from "../systems/BuildSystem";
import type { ClassSelectionSystem } from "../systems/ClassSelectionSystem";
import type { SkillTreeSystem } from "../systems/SkillTreeSystem";
import { isInsideGrid, worldToGrid } from "../utils/grid";

type PlayerKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  build: Phaser.Input.Keyboard.Key;
  previousTower: Phaser.Input.Keyboard.Key;
  nextTower: Phaser.Input.Keyboard.Key;
  directTowerKeys: Phaser.Input.Keyboard.Key[];
  inspectTower: Phaser.Input.Keyboard.Key;
  readyWave: Phaser.Input.Keyboard.Key;
  buySkill: Phaser.Input.Keyboard.Key;
};

export class KeyboardCoopController {
  private readonly p1Keys: PlayerKeys;
  private readonly p2Keys: PlayerKeys;
  private readonly debugKey: Phaser.Input.Keyboard.Key;
  private readonly debugStartWaveKey: Phaser.Input.Keyboard.Key;
  private readonly debugCreditsKey: Phaser.Input.Keyboard.Key;
  private readonly pauseKeys: Phaser.Input.Keyboard.Key[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: GameRegistry,
    private readonly buildSystem: BuildSystem,
    private readonly classSelectionSystem: ClassSelectionSystem,
    private readonly skillTreeSystem: SkillTreeSystem
  ) {
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is not available");
    }

    this.p1Keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      build: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      previousTower: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      nextTower: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      directTowerKeys: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NINE)
      ],
      inspectTower: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      readyWave: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      buySkill: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    };

    this.p2Keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      build: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      previousTower: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_UP),
      nextTower: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN),
      directTowerKeys: [],
      inspectTower: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      readyWave: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE),
      buySkill: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    };

    this.debugKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.debugStartWaveKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
    this.debugCreditsKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
    this.pauseKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    ];

    this.scene.input.on("pointerdown", this.handlePointerDown, this);
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.registry.state.debug = !this.registry.state.debug;
    }

    if (this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      if (this.registry.state.towerInspection) {
        this.registry.closeTowerInspection();
        return;
      }

      if (this.registry.state.phase === "playing") {
        this.registry.pause();
      } else if (this.registry.state.phase === "paused") {
        this.registry.resume();
      }
    }

    this.updateDebugShortcuts();

    if (this.registry.state.phase === "class-selection") {
      this.updateClassSelection();
      return;
    }

    if (this.registry.state.phase === "reward-selection") {
      this.updateRewardSelection();
      return;
    }

    if (this.registry.state.phase !== "playing") {
      return;
    }

    if (this.registry.state.towerInspection) {
      this.updateTowerInspection();
      return;
    }

    this.updatePlayer("p1", this.p1Keys);

    if (this.registry.state.sessionMode !== "solo-ai") {
      this.updatePlayer("p2", this.p2Keys);
    }
  }

  private updateRewardSelection(): void {
    let selected = false;

    if (Phaser.Input.Keyboard.JustDown(this.p1Keys.buySkill)) {
      selected = this.skillTreeSystem.selectHighlightedReward("p1") || selected;
    }

    if (
      this.registry.state.sessionMode !== "solo-ai" &&
      Phaser.Input.Keyboard.JustDown(this.p2Keys.buySkill)
    ) {
      selected = this.skillTreeSystem.selectHighlightedReward("p2") || selected;
    }

    if (selected && this.skillTreeSystem.canCloseRewardSelection()) {
      this.skillTreeSystem.completeRewardSelection();
    }
  }

  private updateDebugShortcuts(): void {
    const state = this.registry.state;

    if (!state.debug) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.debugStartWaveKey)) {
      this.registry.debugAdvanceWave();
    }

    if (Phaser.Input.Keyboard.JustDown(this.debugCreditsKey)) {
      state.economies.p1.credits += 100;
      state.economies.p2.credits += 100;
      this.registry.pushPlayerNotice("p1", "+100 DEBUG", "creditos adicionados", "info", 1200);
      this.registry.pushPlayerNotice("p2", "+100 DEBUG", "creditos adicionados", "info", 1200);
    }
  }

  private updateClassSelection(): void {
    this.updatePlayerClassSelection("p1", this.p1Keys);

    if (this.registry.state.sessionMode !== "solo-ai") {
      this.updatePlayerClassSelection("p2", this.p2Keys);
    }
  }

  private updatePlayerClassSelection(playerId: PlayerId, keys: PlayerKeys): void {
    if (
      Phaser.Input.Keyboard.JustDown(keys.previousTower) ||
      Phaser.Input.Keyboard.JustDown(keys.left)
    ) {
      this.classSelectionSystem.cycleClass(playerId, -1);
    }

    if (
      Phaser.Input.Keyboard.JustDown(keys.nextTower) ||
      Phaser.Input.Keyboard.JustDown(keys.right)
    ) {
      this.classSelectionSystem.cycleClass(playerId, 1);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.build)) {
      this.classSelectionSystem.confirmClass(playerId);
    }

    keys.directTowerKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        const classId = playerClassDefinitions[index]?.id;

        if (classId) {
          this.classSelectionSystem.selectClass(playerId, classId);
        }
      }
    });
  }

  private updateTowerInspection(): void {
    const inspection = this.registry.state.towerInspection;

    if (!inspection) {
      return;
    }

    const keys = inspection.playerId === "p1" ? this.p1Keys : this.p2Keys;

    if (Phaser.Input.Keyboard.JustDown(keys.inspectTower)) {
      this.registry.closeTowerInspection();
      return;
    }

    if (
      Phaser.Input.Keyboard.JustDown(keys.previousTower) ||
      Phaser.Input.Keyboard.JustDown(keys.left) ||
      Phaser.Input.Keyboard.JustDown(keys.up)
    ) {
      this.registry.cycleTowerInspectionOption(inspection.playerId, -1);
    }

    if (
      Phaser.Input.Keyboard.JustDown(keys.nextTower) ||
      Phaser.Input.Keyboard.JustDown(keys.right) ||
      Phaser.Input.Keyboard.JustDown(keys.down)
    ) {
      this.registry.cycleTowerInspectionOption(inspection.playerId, 1);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.build)) {
      this.registry.activateTowerInspectionOption(inspection.playerId);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.readyWave)) {
      this.registry.toggleTowerAutoUpgrade(inspection.playerId, inspection.towerId);
    }

    keys.directTowerKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.registry.setTowerInspectionOption(inspection.playerId, index);
      }
    });
  }

  private updatePlayer(playerId: PlayerId, keys: PlayerKeys): void {
    const state = this.registry.state;
    const cursor = state.cursors[playerId];

    if (cursor.moveCooldownMs <= 0) {
      const direction = this.getDirection(keys);

      if (direction.col !== 0 || direction.row !== 0) {
        this.buildSystem.moveCursor(playerId, direction);
        cursor.moveCooldownMs = CURSOR_STEP_COOLDOWN_MS;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(keys.build)) {
      this.buildSystem.tryBuildForPlayer(playerId);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.inspectTower)) {
      this.registry.openTowerInspection(playerId);
    }

    if (!state.wave.active && Phaser.Input.Keyboard.JustDown(keys.readyWave)) {
      this.registry.setPlayerReady(playerId);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.previousTower)) {
      this.buildSystem.cycleTower(playerId, -1);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.nextTower)) {
      this.buildSystem.cycleTower(playerId, 1);
    }

    keys.directTowerKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.buildSystem.selectTower(playerId, index);
      }
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const state = this.registry.state;

    if (state.phase !== "playing" || state.towerInspection) {
      return;
    }

    const grid = worldToGrid({ x: pointer.x, y: pointer.y }, state.activeMap);

    if (!isInsideGrid(grid, state.activeMap)) {
      return;
    }

    state.cursors.p1.grid = grid;

    const tower = state.towers.find(
      (candidate) => candidate.grid.col === grid.col && candidate.grid.row === grid.row
    );

    if (tower) {
      if (tower.ownerId === "p1") {
        this.registry.openTowerInspection("p1");
      } else {
        this.registry.pushPlayerNotice("p1", "TORRE DA IA", "espaco ocupado por P2", "info", 1300);
      }
      return;
    }

    this.buildSystem.tryBuildForPlayer("p1");
  }

  private getDirection(keys: PlayerKeys): GridPoint {
    if (keys.left.isDown) {
      return { col: -1, row: 0 };
    }

    if (keys.right.isDown) {
      return { col: 1, row: 0 };
    }

    if (keys.up.isDown) {
      return { col: 0, row: -1 };
    }

    if (keys.down.isDown) {
      return { col: 0, row: 1 };
    }

    return { col: 0, row: 0 };
  }
}
