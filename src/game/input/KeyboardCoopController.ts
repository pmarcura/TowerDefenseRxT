import Phaser from "phaser";
import { gameUiBridge } from "../bridge/RewardBridge";
import { CURSOR_STEP_COOLDOWN_MS } from "../config/constants";
import { playerClassDefinitions } from "../data/playerClasses";
import { towerBranchDefinitions } from "../data/towerBranches";
import { GameRegistry } from "../GameRegistry";
import type { GridPoint, PlayerId } from "../models/types";
import type { BuildSystem } from "../systems/BuildSystem";
import type { ClassSelectionSystem } from "../systems/ClassSelectionSystem";
import type { SkillTreeSystem } from "../systems/SkillTreeSystem";
import { isInsideGrid, worldToGrid } from "../utils/grid";
import { getLocalPlayerIds, getPlayablePlayerIds } from "../utils/players";

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

    for (const slot of this.getLocalControlSlots()) {
      this.updatePlayer(slot.playerId, slot.keys);
    }
  }

  private updateRewardSelection(): void {
    let selected = false;

    for (const slot of this.getLocalControlSlots()) {
      if (Phaser.Input.Keyboard.JustDown(slot.keys.buySkill)) {
        const highlightedSkillId =
          this.registry.state.rewardSelection?.choices[slot.playerId]?.skillIds[0] ?? null;
        const changed = this.skillTreeSystem.selectHighlightedReward(slot.playerId);

        if (changed && highlightedSkillId) {
          gameUiBridge.sendLocalGameAction({
            type: "SELECT_REWARD",
            playerId: slot.playerId,
            skillId: highlightedSkillId
          });
        }

        selected = changed || selected;
      }
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
      for (const playerId of getPlayablePlayerIds(state)) {
        state.economies[playerId].credits += 100;
        this.registry.pushPlayerNotice(playerId, "+100 DEBUG", "creditos adicionados", "info", 1200);
      }
    }
  }

  private updateClassSelection(): void {
    for (const slot of this.getLocalControlSlots()) {
      this.updatePlayerClassSelection(slot.playerId, slot.keys);
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

    const keys = this.getKeysForLocalPlayer(inspection.playerId) ?? this.p1Keys;

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
      const branch = towerBranchDefinitions[inspection.selectedOptionIndex];

      if (branch && this.registry.activateTowerInspectionOption(inspection.playerId)) {
        gameUiBridge.sendLocalGameAction({
          type: "UPGRADE_TOWER",
          playerId: inspection.playerId,
          towerId: inspection.towerId,
          branchId: branch.id
        });
      }
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
      const towerId = this.registry.getSelectedTowerId(playerId);
      const grid = { ...state.cursors[playerId].grid };

      if (this.buildSystem.tryBuildForPlayer(playerId)) {
        gameUiBridge.sendLocalGameAction({ type: "BUILD_TOWER", playerId, towerId, grid });
      }
    }

    if (Phaser.Input.Keyboard.JustDown(keys.inspectTower)) {
      this.registry.openTowerInspection(playerId);
    }

    if (!state.wave.active && Phaser.Input.Keyboard.JustDown(keys.readyWave)) {
      if (this.registry.setPlayerReady(playerId)) {
        gameUiBridge.sendLocalGameAction({ type: "SET_READY", playerId, ready: true });
      }
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

    const primaryPlayerId = getLocalPlayerIds(state.session)[0];

    if (!primaryPlayerId) {
      return;
    }

    const grid = worldToGrid({ x: pointer.x, y: pointer.y }, state.activeMap);

    if (!isInsideGrid(grid, state.activeMap)) {
      return;
    }

    state.cursors[primaryPlayerId].grid = grid;

    const tower = state.towers.find(
      (candidate) => candidate.grid.col === grid.col && candidate.grid.row === grid.row
    );

    if (tower) {
      if (tower.ownerId === primaryPlayerId) {
        this.registry.openTowerInspection(primaryPlayerId);
      } else {
        this.registry.pushPlayerNotice(
          primaryPlayerId,
          "TORRE DO TIME",
          "espaco ocupado por outro jogador",
          "info",
          1300
        );
      }
      return;
    }

    const towerId = this.registry.getSelectedTowerId(primaryPlayerId);

    if (this.buildSystem.tryBuildForPlayer(primaryPlayerId)) {
      gameUiBridge.sendLocalGameAction({
        type: "BUILD_TOWER",
        playerId: primaryPlayerId,
        towerId,
        grid
      });
    }
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

  private getLocalControlSlots(): { playerId: PlayerId; keys: PlayerKeys }[] {
    const [primaryPlayerId, secondaryPlayerId] = getLocalPlayerIds(this.registry.state.session);
    const slots: { playerId: PlayerId; keys: PlayerKeys }[] = [];

    if (primaryPlayerId) {
      slots.push({ playerId: primaryPlayerId, keys: this.p1Keys });
    }

    if (secondaryPlayerId) {
      slots.push({ playerId: secondaryPlayerId, keys: this.p2Keys });
    }

    return slots;
  }

  private getKeysForLocalPlayer(playerId: PlayerId): PlayerKeys | null {
    return this.getLocalControlSlots().find((slot) => slot.playerId === playerId)?.keys ?? null;
  }
}
