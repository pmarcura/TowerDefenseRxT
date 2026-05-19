import Phaser from "phaser";
import { getPlayerClassDefinition } from "../data/playerClasses";
import {
  getDominantTowerBranch,
  towerBranchDefinitions
} from "../data/towerBranches";
import { getTowerDefinition, getTowerDefinitionsForClass } from "../data/towers";
import { towerProgression } from "../data/towerProgression";
import { gameDesign, toHexColor } from "../design/gameDesignSystem";
import { GameRegistry } from "../GameRegistry";
import type { GameState, PlayerClassDefinition, PlayerId, TowerEntity } from "../models/types";
import type { BuildSystem } from "../systems/BuildSystem";
import type { TowerSystem } from "../systems/TowerSystem";
import { gridToWorld } from "../utils/grid";

export class TowerRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly levelLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: GameRegistry,
    private readonly buildSystem: BuildSystem,
    private readonly towerSystem: TowerSystem
  ) {
    this.graphics = scene.add.graphics().setDepth(7);
  }

  render(state: GameState): void {
    this.graphics.clear();
    const focusedTowerIds = this.getFocusedTowerIds(state);

    this.syncSprites(state, focusedTowerIds);

    if (state.debug) {
      for (const tower of state.towers) {
        this.drawRange(tower);
      }
    }

    for (const tower of state.towers) {
      this.drawTower(tower, state, focusedTowerIds.has(tower.id));
    }

    this.syncLevelLabels(state, focusedTowerIds);
    this.drawCursor(state, "p1");
    this.drawCursor(state, "p2");
  }

  private drawRange(tower: TowerEntity): void {
    const range = this.towerSystem.getTowerRange(tower);

    this.graphics.lineStyle(1, 0xffffff, 0.08);
    this.graphics.strokeCircle(tower.position.x, tower.position.y, range);
  }

  private drawTower(tower: TowerEntity, state: GameState, focused: boolean): void {
    const definition = getTowerDefinition(tower.typeId);
    const ownerClass = getPlayerClassDefinition(this.registry.state.playerClasses[tower.ownerId]);
    const levelProgress =
      tower.level >= towerProgression.maxLevel || tower.xpToNext <= 0 ? 1 : tower.xp / tower.xpToNext;
    const glowAlpha =
      (focused ? gameDesign.tower.focusedGlow : gameDesign.tower.ambientGlow) +
      tower.level * (focused ? 0.018 : 0.008);
    const baseRadius = focused ? 29 + tower.level * 1.8 : 23 + tower.level * 1.1;

    this.graphics.fillStyle(definition.glow, glowAlpha);
    this.graphics.fillCircle(tower.position.x, tower.position.y, baseRadius);

    if (this.scene.textures.exists(definition.assetKey)) {
      this.graphics.fillStyle(0x020712, 0.72);
      this.graphics.fillCircle(tower.position.x, tower.position.y, focused ? 27 + tower.level : 22 + tower.level * 0.7);
      this.graphics.lineStyle(focused ? 3 : 2, ownerClass.accent, focused ? 0.92 : 0.48);
      this.graphics.strokeCircle(tower.position.x, tower.position.y, focused ? 25 + tower.level : 20 + tower.level * 0.8);
      this.drawClassSignature(tower, ownerClass, this.registry.state.elapsedMs, focused);
      if (focused || tower.skillPoints > 0 || !state.wave.active) {
        this.drawLevelPips(tower, levelProgress, focused);
      }
      this.drawBranchSignature(tower, focused);
      return;
    }

    this.graphics.fillStyle(0x020712, 0.98);
    this.graphics.fillCircle(tower.position.x, tower.position.y, focused ? 24 : 20);
    this.graphics.lineStyle(focused ? 4 : 2, definition.glow, focused ? 0.95 : 0.56);
    this.graphics.strokeCircle(tower.position.x, tower.position.y, focused ? 23 : 19);
    this.graphics.lineStyle(2, ownerClass.accent, focused ? 0.96 : 0.42);
    this.graphics.strokeCircle(tower.position.x, tower.position.y, focused ? 15 : 12);
    this.drawClassSignature(tower, ownerClass, this.registry.state.elapsedMs, focused);
    if (focused || tower.skillPoints > 0 || !state.wave.active) {
      this.drawLevelPips(tower, levelProgress, focused);
    }
    this.drawBranchSignature(tower, focused);

    if (definition.effect === "splash") {
      this.graphics.fillStyle(definition.color, 0.9);
      this.graphics.fillTriangle(
        tower.position.x,
        tower.position.y - 13,
        tower.position.x - 12,
        tower.position.y + 10,
        tower.position.x + 12,
        tower.position.y + 10
      );
      return;
    }

    if (definition.effect === "slow") {
      this.graphics.lineStyle(2, definition.color, 0.95);
      this.graphics.strokeCircle(tower.position.x, tower.position.y, 8);
      this.graphics.strokeCircle(tower.position.x, tower.position.y, 14);
      return;
    }

    if (definition.effect === "chain") {
      this.graphics.lineStyle(2, definition.color, 0.95);
      this.graphics.lineBetween(
        tower.position.x - 12,
        tower.position.y + 8,
        tower.position.x - 4,
        tower.position.y - 8
      );
      this.graphics.lineBetween(
        tower.position.x - 4,
        tower.position.y - 8,
        tower.position.x + 5,
        tower.position.y + 7
      );
      this.graphics.lineBetween(
        tower.position.x + 5,
        tower.position.y + 7,
        tower.position.x + 13,
        tower.position.y - 6
      );
      return;
    }

    if (definition.effect === "income") {
      const pulse = 0.5 + Math.sin(this.registry.state.elapsedMs / 260 + tower.position.x) * 0.18;

      this.graphics.fillStyle(0xffe39d, 0.92);
      this.graphics.fillCircle(tower.position.x, tower.position.y, 8);
      this.graphics.lineStyle(2, 0xffe39d, 0.72);
      this.graphics.strokeCircle(tower.position.x, tower.position.y, 13 + pulse * 5);
      this.graphics.lineStyle(3, definition.color, 0.92);
      this.graphics.lineBetween(tower.position.x - 10, tower.position.y + 10, tower.position.x + 10, tower.position.y + 10);
      this.graphics.lineBetween(tower.position.x - 7, tower.position.y + 15, tower.position.x + 7, tower.position.y + 15);
      return;
    }

    if (definition.effect === "summon") {
      this.graphics.lineStyle(3, definition.color, 0.92);
      this.graphics.strokeCircle(tower.position.x - 7, tower.position.y + 2, 6);
      this.graphics.strokeCircle(tower.position.x + 7, tower.position.y + 2, 6);
      this.graphics.lineStyle(2, definition.glow, 0.82);
      this.graphics.lineBetween(tower.position.x - 13, tower.position.y + 10, tower.position.x + 13, tower.position.y + 10);
      this.graphics.lineBetween(tower.position.x, tower.position.y - 13, tower.position.x, tower.position.y + 14);
      return;
    }

    if (definition.effect === "aura") {
      const pulse = 14 + Math.sin(this.registry.state.elapsedMs / 340 + tower.position.y) * 3;

      this.graphics.lineStyle(2, definition.color, 0.72);
      this.graphics.strokeCircle(tower.position.x, tower.position.y, pulse);
      this.graphics.strokeCircle(tower.position.x, tower.position.y, 8);
      this.graphics.fillStyle(definition.glow, 0.9);
      this.graphics.fillCircle(tower.position.x, tower.position.y, 4);
      return;
    }

    if (definition.effect === "mark") {
      this.graphics.lineStyle(3, definition.color, 0.94);
      this.graphics.strokeRect(tower.position.x - 10, tower.position.y - 10, 20, 20);
      this.graphics.lineStyle(2, definition.glow, 0.86);
      this.graphics.lineBetween(tower.position.x - 13, tower.position.y, tower.position.x + 13, tower.position.y);
      this.graphics.lineBetween(tower.position.x, tower.position.y - 13, tower.position.x, tower.position.y + 13);
      return;
    }

    if (definition.effect === "cleanse") {
      this.graphics.lineStyle(3, definition.color, 0.86);
      this.graphics.beginPath();
      this.graphics.arc(tower.position.x, tower.position.y, 13, Math.PI * 0.18, Math.PI * 1.35);
      this.graphics.strokePath();
      this.graphics.lineStyle(2, definition.glow, 0.72);
      this.graphics.lineBetween(tower.position.x - 8, tower.position.y + 8, tower.position.x + 10, tower.position.y - 10);
      return;
    }

    if (definition.effect === "ritual-zone") {
      this.graphics.lineStyle(2, definition.color, 0.9);
      this.graphics.strokeTriangle(
        tower.position.x,
        tower.position.y - 14,
        tower.position.x - 13,
        tower.position.y + 10,
        tower.position.x + 13,
        tower.position.y + 10
      );
      this.graphics.strokeCircle(tower.position.x, tower.position.y, 9);
      return;
    }

    if (definition.effect === "redirect") {
      this.graphics.lineStyle(3, definition.color, 0.92);
      this.graphics.beginPath();
      this.graphics.arc(tower.position.x, tower.position.y, 12, Math.PI * 0.1, Math.PI * 1.55);
      this.graphics.strokePath();
      this.graphics.fillStyle(definition.glow, 0.9);
      this.graphics.fillTriangle(
        tower.position.x - 13,
        tower.position.y - 3,
        tower.position.x - 3,
        tower.position.y - 9,
        tower.position.x - 5,
        tower.position.y + 2
      );
      return;
    }

    this.graphics.lineStyle(4, definition.color, 0.95);
    this.graphics.lineBetween(
      tower.position.x - 11,
      tower.position.y,
      tower.position.x + 11,
      tower.position.y
    );
    this.graphics.lineBetween(
      tower.position.x,
      tower.position.y - 11,
      tower.position.x,
      tower.position.y + 11
    );
  }

  private syncSprites(state: GameState, focusedTowerIds: Set<string>): void {
    const liveTowerIds = new Set(state.towers.map((tower) => tower.id));

    for (const [towerId, sprite] of this.sprites) {
      if (!liveTowerIds.has(towerId)) {
        sprite.destroy();
        this.sprites.delete(towerId);
      }
    }

    for (const tower of state.towers) {
      const definition = getTowerDefinition(tower.typeId);

      if (!this.scene.textures.exists(definition.assetKey)) {
        continue;
      }

      let sprite = this.sprites.get(tower.id);

      if (!sprite) {
        sprite = this.scene.add.image(tower.position.x, tower.position.y, definition.assetKey);
        sprite.setDisplaySize(56, 56);
        sprite.setDepth(6);
        this.sprites.set(tower.id, sprite);
      }

      const pulse = state.settings.reducedMotion ? 0 : Math.sin(state.elapsedMs / 420 + tower.position.x) * 1.5;
      const dominantBranch = getDominantTowerBranch(tower.branchRanks);
      const focused = focusedTowerIds.has(tower.id);
      const size =
        (focused ? gameDesign.tower.focusedSpriteSize : gameDesign.tower.spriteSize) +
        Math.min(gameDesign.tower.maxSpriteGrowth, tower.level * (focused ? 2.2 : 1.5));

      sprite.setPosition(tower.position.x, tower.position.y + pulse);
      sprite.setDisplaySize(size, size);
      if (dominantBranch) {
        sprite.setTint(dominantBranch.color);
      } else {
        sprite.clearTint();
      }
      sprite.setAlpha(focused ? 1 : 0.9);
    }
  }

  private syncLevelLabels(state: GameState, focusedTowerIds: Set<string>): void {
    const liveTowerIds = new Set(state.towers.map((tower) => tower.id));

    for (const [towerId, label] of this.levelLabels) {
      if (!liveTowerIds.has(towerId)) {
        label.destroy();
        this.levelLabels.delete(towerId);
      }
    }

    for (const tower of state.towers) {
      const definition = getTowerDefinition(tower.typeId);
      let label = this.levelLabels.get(tower.id);
      const focused = focusedTowerIds.has(tower.id);
      const shouldShow = focused || tower.skillPoints > 0;

      if (!label) {
        label = this.scene.add
          .text(tower.position.x, tower.position.y - 35, "", {
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "10px",
            fontStyle: "900",
            color: "#ffffff",
            stroke: "#02050a",
            strokeThickness: 4
          })
          .setOrigin(0.5)
          .setDepth(8);
        this.levelLabels.set(tower.id, label);
      }

      if (!shouldShow) {
        label.setVisible(false);
        continue;
      }

      label.setText(
        focused
          ? `${tower.level >= towerProgression.maxLevel ? "MAX" : `LV ${tower.level}`}${
              tower.skillPoints > 0 ? ` +${tower.skillPoints}` : ""
            }`
          : `+${tower.skillPoints}`
      );
      label.setColor(toHexColor(definition.glow));
      label.setPosition(tower.position.x, tower.position.y - 34 - tower.level);
      label.setVisible(true);
    }
  }

  private drawLevelPips(tower: TowerEntity, xpProgress: number, focused: boolean): void {
    const definition = getTowerDefinition(tower.typeId);
    const startX = tower.position.x - (focused ? 20 : 15);
    const y = tower.position.y + (focused ? 31 : 25);
    const gap = focused ? 10 : 7;

    for (let index = 0; index < towerProgression.maxLevel; index += 1) {
      const active = index < tower.level;

      this.graphics.fillStyle(active ? definition.glow : 0x1f3340, active ? (focused ? 0.92 : 0.62) : 0.34);
      this.graphics.fillCircle(startX + index * gap, y, focused ? (active ? 3.2 : 2.5) : 1.8);
    }

    if (tower.level >= towerProgression.maxLevel || !focused) {
      return;
    }

    this.graphics.fillStyle(0x07111a, 0.88);
    this.graphics.fillRoundedRect(tower.position.x - 19, y + 7, 38, 4, 2);
    this.graphics.fillStyle(definition.color, 0.88);
    this.graphics.fillRoundedRect(tower.position.x - 19, y + 7, 38 * Phaser.Math.Clamp(xpProgress, 0, 1), 4, 2);
  }

  private drawBranchSignature(tower: TowerEntity, focused: boolean): void {
    const activeBranches = towerBranchDefinitions.filter(
      (branch) => tower.branchRanks[branch.id] > 0
    );

    activeBranches.forEach((branch, index) => {
      const rank = tower.branchRanks[branch.id];
      const radius = (focused ? 36 : 29) + index * (focused ? 5 : 3);
      const startAngle = -Math.PI / 2 + index * 0.22;
      const endAngle = startAngle + Math.min(Math.PI * 1.55, rank * 0.42 + 0.6);

      this.graphics.lineStyle(focused ? 2 : 1, branch.color, (focused ? 0.24 : 0.08) + rank * (focused ? 0.06 : 0.035));
      this.graphics.beginPath();
      this.graphics.arc(tower.position.x, tower.position.y, radius, startAngle, endAngle);
      this.graphics.strokePath();
    });
  }

  private drawClassSignature(
    tower: TowerEntity,
    playerClass: PlayerClassDefinition,
    elapsedMs: number,
    focused: boolean
  ): void {
    const x = tower.position.x;
    const y = tower.position.y;
    const pulse = 1 + Math.sin(elapsedMs / 520 + x * 0.02) * 0.04;
    const radius = (focused ? 31 : 24) + tower.level * (focused ? 1.4 : 0.8);
    const secondary = playerClass.secondaryAccent;
    const primaryAlpha = focused ? 0.26 : 0.08;
    const secondaryAlpha = focused ? 0.34 : 0.11;

    this.graphics.lineStyle(focused ? 2 : 1, playerClass.accent, primaryAlpha);
    this.graphics.strokeCircle(x, y, radius * pulse);
    this.graphics.lineStyle(1, secondary, secondaryAlpha);

    if (playerClass.pattern === "vitrail") {
      this.graphics.lineBetween(x - 22, y, x + 22, y);
      this.graphics.lineBetween(x, y - 22, x, y + 22);
      this.graphics.lineBetween(x - 16, y - 16, x + 16, y + 16);
      this.graphics.lineBetween(x + 16, y - 16, x - 16, y + 16);
      return;
    }

    if (playerClass.pattern === "gira") {
      for (let index = 0; index < 8; index += 1) {
        const angle = elapsedMs / 900 + index * (Math.PI / 4);
        this.graphics.fillStyle(index % 2 === 0 ? playerClass.accent : secondary, focused ? 0.72 : 0.18);
        this.graphics.fillCircle(x + Math.cos(angle) * (focused ? 24 : 19), y + Math.sin(angle) * (focused ? 24 : 19), focused ? 2.6 : 1.6);
      }

      return;
    }

    if (playerClass.pattern === "zellige") {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.lineBetween(x, y, x + Math.cos(angle) * 24, y + Math.sin(angle) * 24);
      }

      this.graphics.strokeCircle(x, y, 14);
      return;
    }

    if (playerClass.pattern === "lotus") {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.strokeEllipse(
          x + Math.cos(angle) * 13,
          y + Math.sin(angle) * 13,
          10,
          18
        );
      }

      return;
    }

    if (playerClass.pattern === "wheel") {
      this.graphics.strokeCircle(x, y, 18);

      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.lineBetween(x, y, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
      }

      return;
    }

    if (playerClass.pattern === "torii") {
      this.graphics.lineStyle(focused ? 3 : 1, playerClass.accent, focused ? 0.5 : 0.13);
      this.graphics.lineBetween(x - 22, y - 18, x + 22, y - 18);
      this.graphics.lineStyle(1, secondary, focused ? 0.36 : 0.12);
      this.graphics.lineBetween(x - 16, y - 11, x + 16, y - 11);
      this.graphics.lineBetween(x - 12, y - 10, x - 12, y + 18);
      this.graphics.lineBetween(x + 12, y - 10, x + 12, y + 18);
      return;
    }

    for (let index = 0; index < 10; index += 1) {
      const angle = index * (Math.PI / 5);
      const beadRadius = index % 2 === 0 ? 2.8 : 2;

      this.graphics.fillStyle(index % 2 === 0 ? playerClass.accent : secondary, focused ? 0.66 : 0.16);
      this.graphics.fillCircle(x + Math.cos(angle) * (focused ? 23 : 18), y + Math.sin(angle) * (focused ? 23 : 18), focused ? beadRadius : 1.4);
    }

    this.graphics.strokeCircle(x, y, 12);
  }

  private drawCursor(state: GameState, playerId: PlayerId): void {
    const cursor = state.cursors[playerId];
    const point = gridToWorld(cursor.grid, state.activeMap);
    const availableTowers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selectedTower = availableTowers[cursor.selectedTowerIndex % availableTowers.length];
    const towerUnderCursor = state.towers.find(
      (tower) => tower.grid.col === cursor.grid.col && tower.grid.row === cursor.grid.row
    );
    const canBuild = this.buildSystem.canBuildAt(cursor.grid);
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const color = towerUnderCursor ? playerClass.accent : canBuild ? playerClass.accent : 0xff5577;
    const cursorSize = state.activeMap.tileSize - 4;
    const previewRange = towerUnderCursor
      ? this.towerSystem.getTowerRange(towerUnderCursor)
      : selectedTower.range;
    const shouldDrawRange = Boolean(towerUnderCursor) || !state.wave.active || state.towerInspection?.playerId === playerId;

    this.graphics.lineStyle(3, color, 0.96);
    this.graphics.strokeRect(
      point.x - cursorSize / 2,
      point.y - cursorSize / 2,
      cursorSize,
      cursorSize
    );
    if (shouldDrawRange) {
      this.graphics.lineStyle(towerUnderCursor ? 2 : 1, selectedTower.color, towerUnderCursor ? 0.34 : 0.13);
      this.graphics.strokeCircle(point.x, point.y, previewRange);
    }
    this.graphics.fillStyle(color, canBuild ? 0.13 : 0.18);
    this.graphics.fillRect(
      point.x - cursorSize / 2 + 2,
      point.y - cursorSize / 2 + 2,
      cursorSize - 4,
      cursorSize - 4
    );

    if (towerUnderCursor) {
      const definition = getTowerDefinition(towerUnderCursor.typeId);

      this.graphics.lineStyle(2, definition.glow, 0.72);
      this.graphics.strokeCircle(point.x, point.y, 31 + Math.sin(state.elapsedMs / 180) * 3);
    }

    this.drawClassCursorMotif(point.x, point.y, playerClass, state.elapsedMs);
  }

  private getFocusedTowerIds(state: GameState): Set<string> {
    const focusedTowerIds = new Set<string>();

    if (state.towerInspection) {
      focusedTowerIds.add(state.towerInspection.towerId);
    }

    for (const cursor of Object.values(state.cursors)) {
      const tower = state.towers.find(
        (candidate) => candidate.grid.col === cursor.grid.col && candidate.grid.row === cursor.grid.row
      );

      if (tower) {
        focusedTowerIds.add(tower.id);
      }
    }

    return focusedTowerIds;
  }

  private drawClassCursorMotif(
    x: number,
    y: number,
    playerClass: PlayerClassDefinition,
    elapsedMs: number
  ): void {
    const alpha = 0.48 + Math.sin(elapsedMs / 360) * 0.08;

    this.graphics.lineStyle(2, playerClass.secondaryAccent, alpha);

    if (playerClass.pattern === "torii") {
      this.graphics.lineBetween(x - 14, y - 14, x + 14, y - 14);
      this.graphics.lineBetween(x - 9, y - 8, x - 9, y + 12);
      this.graphics.lineBetween(x + 9, y - 8, x + 9, y + 12);
      return;
    }

    if (playerClass.pattern === "zellige" || playerClass.pattern === "wheel") {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.lineBetween(x, y, x + Math.cos(angle) * 15, y + Math.sin(angle) * 15);
      }

      return;
    }

    if (playerClass.pattern === "lotus" || playerClass.pattern === "gira") {
      this.graphics.strokeCircle(x, y, 12);
      this.graphics.strokeCircle(x, y, 18);
      return;
    }

    this.graphics.lineBetween(x - 14, y, x + 14, y);
    this.graphics.lineBetween(x, y - 14, x, y + 14);
  }
}
