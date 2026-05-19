import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { getPlayerClassDefinition } from "../data/playerClasses";
import { getTowerDefinition, getTowerDefinitionsForClass } from "../data/towers";
import { getWaveDefinition, getWaveThreat, getWaveTimelineWindow } from "../data/waves";
import { gameDesign, toHexColor } from "../design/gameDesignSystem";
import { GameRegistry } from "../GameRegistry";
import type { GameState, PlayerId, TowerEffect, TowerEntity, TowerRuntimeStats } from "../models/types";
import { gridKey, isGridOnPath, isInsideGrid } from "../utils/grid";
import {
  calculateTowerCost,
  calculateTowerPreviewStats,
  calculateTowerRuntimeStats
} from "../utils/towerStats";

const statusPanels: Record<PlayerId, { x: number; y: number }> = {
  p1: { x: 14, y: 82 },
  p2: { x: GAME_WIDTH - 252, y: 82 }
};

const debugButton = { x: GAME_WIDTH - 154, y: 12, width: 142, height: 30 };

export class PhaserHudRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly registry = GameRegistry.getInstance();
  private usedTexts = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(80);
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
  }

  render(state: GameState): void {
    this.graphics.clear();
    this.usedTexts = 0;

    if (state.phase === "menu" || state.phase === "class-selection") {
      this.hideUnusedText();
      return;
    }

    this.drawTimeline(state);
    this.drawCountdown(state);
    this.drawPlayerStatus(state, "p1");
    this.drawContextPanel(state, "p1");
    this.drawQuickbar(state, "p1");

    if (state.sessionMode === "solo-ai") {
      this.drawAiPanel(state);
    } else {
      this.drawPlayerStatus(state, "p2");
      this.drawMiniQuickbar(state, "p2");
    }

    this.drawDebugButton(state);
    this.hideUnusedText();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const state = this.registry.state;

    if (!state.debug || state.phase !== "playing") {
      return;
    }

    if (
      pointer.x >= debugButton.x &&
      pointer.x <= debugButton.x + debugButton.width &&
      pointer.y >= debugButton.y &&
      pointer.y <= debugButton.y + debugButton.height
    ) {
      this.registry.debugAdvanceWave();
    }
  }

  private drawTimeline(state: GameState): void {
    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const width = 544;
    const height = 56;
    const x = (GAME_WIDTH - width) / 2;
    const y = 10;
    const timeline = getWaveTimelineWindow(state.wave.currentWaveIndex, 10);
    const nodeGap = 40;
    const startX = x + 74;

    this.panel(x, y, width, height, wave.isBoss ? gameDesign.color.pink : gameDesign.color.cyan, 0.78);

    for (let index = 0; index < timeline.length; index += 1) {
      const nodeWave = timeline[index].wave;
      const waveIndex = timeline[index].index;
      const nodeX = startX + index * nodeGap;
      const completed = waveIndex < state.wave.currentWaveIndex;
      const current = waveIndex === state.wave.currentWaveIndex;
      const color = nodeWave.isBoss ? gameDesign.color.pink : current ? gameDesign.color.cyan : 0x6f8492;

      if (index > 0) {
        this.graphics.lineStyle(2, completed ? gameDesign.color.cyan : 0x203646, completed ? 0.5 : 0.28);
        this.graphics.lineBetween(nodeX - nodeGap + 10, y + 20, nodeX - 10, y + 20);
      }

      this.graphics.fillStyle(completed || current ? color : 0x07131e, current ? 0.96 : 0.78);
      this.graphics.fillCircle(nodeX, y + 20, nodeWave.isBoss ? 9 : 7);
      this.graphics.lineStyle(current ? 3 : 1, color, current ? 0.95 : 0.46);
      this.graphics.strokeCircle(nodeX, y + 20, nodeWave.isBoss ? 12 : 9);
      this.text(nodeX, y + 33, `${waveIndex + 1}`, 8, current ? "#edf7ff" : "#6f8492", "900", 0.5);
    }

    const status = this.getWaveStatus(state);
    const routes = state.wave.snapshot.activePathIndexes.length;

    this.text(x + 14, y + 8, status, 9, wave.isBoss ? "#ff8db4" : "#83f3ff", "900");
    this.text(x + 14, y + 29, wave.name, 14, "#edf7ff", "900", 0, 190);
    this.drawMiniStat(x + width - 165, y + 12, "threat", `${getWaveThreat(wave)}`, wave.isBoss ? gameDesign.color.pink : 0xffd36d);
    this.drawMiniStat(x + width - 112, y + 12, "route", `${routes || "-"}`, 0x83f3ff);
    this.drawMiniStat(x + width - 60, y + 12, "enemy", `${state.wave.snapshot.aliveEnemies}`, 0xff6d8b);
    this.drawMiniStat(x + width - 14, y + 12, "spawn", `${state.wave.snapshot.totalSpawnsRemaining}`, 0xb4ff72, 1);
  }

  private drawCountdown(state: GameState): void {
    if (state.phase !== "playing" || state.wave.active || state.wave.completed) {
      return;
    }

    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const seconds = Math.max(0, state.wave.nextWaveInMs / 1000);
    const color = wave.isBoss ? gameDesign.color.pink : gameDesign.color.cyan;
    const x = GAME_WIDTH / 2 - 170;
    const y = 72;
    const width = 340;
    const height = 54;

    this.panel(x, y, width, height, color, 0.84);
    this.text(x + 18, y + 9, state.wave.readyPlayers.p1 ? "COMECANDO" : "PREPARACAO", 11, toHexColor(color), "900");
    this.text(x + 18, y + 28, wave.name, 12, "#edf7ff", "900", 0, 205);
    this.text(x + width - 18, y + 3, `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`, 32, "#edf7ff", "900", 1);
  }

  private drawPlayerStatus(state: GameState, playerId: PlayerId): void {
    const panel = statusPanels[playerId];
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const width = 238;
    const height = 126;
    const stats = state.combatStats[playerId];
    const towers = state.towers.filter((tower) => tower.ownerId === playerId).length;

    this.panel(panel.x, panel.y, width, height, playerClass.accent, 0.82);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(panel.x + 2, panel.y + 2, width - 4, 38, 8);
    this.text(panel.x + 12, panel.y + 9, playerId.toUpperCase(), 10, toHexColor(playerClass.accent), "900");
    this.text(panel.x + 12, panel.y + 25, playerClass.shortName, 16, "#edf7ff", "900", 0, 130);
    this.text(panel.x + width - 12, panel.y + 7, `${state.economies[playerId].credits}`, 22, toHexColor(playerClass.accent), "900", 1);
    this.text(panel.x + width - 12, panel.y + 33, "C", 9, "#8ea4b3", "900", 1);

    this.drawHealthStrip(panel.x + 12, panel.y + 52, width - 24, state.baseHp / state.activeMap.baseHp);
    this.drawMetricIcon(panel.x + 16, panel.y + 78, "damage", `${Math.round(stats.waveDamageDealt)}`, 0x83f3ff);
    this.drawMetricIcon(panel.x + 88, panel.y + 78, "kill", `${stats.kills}`, 0xffd36d);
    this.drawMetricIcon(panel.x + 154, panel.y + 78, "tower", `${towers}`, playerClass.accent);
  }

  private drawContextPanel(state: GameState, playerId: PlayerId): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const x = 14;
    const y = 218;
    const width = 238;
    const height = 172;
    const cursor = state.cursors[playerId];
    const available = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selectedTower = available[cursor.selectedTowerIndex % available.length];
    const selectedCost = calculateTowerCost(state, playerId, selectedTower.id);
    const towerUnderCursor = state.towers.find((tower) => gridKey(tower.grid) === gridKey(cursor.grid));
    const stats = towerUnderCursor
      ? calculateTowerRuntimeStats(state, towerUnderCursor)
      : calculateTowerPreviewStats(state, playerId, selectedTower.id);
    const title = towerUnderCursor ? "FOCO" : "BUILD";
    const status = this.getBuildStatus(state, playerId, selectedTower.id, selectedCost, towerUnderCursor);

    this.panel(x, y, width, height, status.color, 0.78);
    this.text(x + 14, y + 10, title, 10, toHexColor(status.color), "900");
    this.text(x + width - 14, y + 10, towerUnderCursor ? `LV ${stats.level}` : `${selectedCost} C`, 12, "#ffe39d", "900", 1);
    this.drawEffectIcon(stats.effect, x + 30, y + 44, 18, towerUnderCursor ? getTowerDefinition(towerUnderCursor.typeId).color : selectedTower.color, 0.95);
    this.text(x + 58, y + 32, stats.shortName, 16, "#edf7ff", "900", 0, 162);
    this.text(x + 58, y + 54, stats.effectLabel, 10, "#a9bac6", "900", 0, 162);
    this.drawStatPill(x + 14, y + 84, "DPS", stats.effect === "income" ? "--" : stats.dps.toFixed(1), gameDesign.color.cyan);
    this.drawStatPill(x + 88, y + 84, "ALC", `${Math.round(stats.range)}`, 0xb4ff72);
    this.drawStatPill(x + 162, y + 84, "CD", `${(stats.cooldownMs / 1000).toFixed(1)}s`, 0xffd36d);
    this.text(x + 14, y + 124, status.title, 10, toHexColor(status.color), "900");
    this.text(x + 14, y + 140, status.detail, 10, "#a9bac6", "800", 0, width - 28);

    if (towerUnderCursor) {
      this.text(x + width - 14, y + 124, `${stats.kills}K  ${Math.round(stats.damageDealt)}D`, 9, "#edf7ff", "900", 1);
      if (stats.branchSummary.length > 0) {
        this.text(x + width - 14, y + 140, stats.branchSummary.join(" / "), 8, "#b4ff72", "900", 1);
      }
    }
  }

  private drawQuickbar(state: GameState, playerId: PlayerId): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const towers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selected = state.cursors[playerId].selectedTowerIndex % towers.length;
    const x = 284;
    const y = GAME_HEIGHT - 86;
    const width = 712;
    const height = 72;

    this.panel(x, y, width, height, playerClass.accent, 0.78);
    this.text(x + 16, y + 10, "TORRES", 10, toHexColor(playerClass.accent), "900");

    const slotSize = 52;
    const gap = 8;
    const startX = x + 82;

    towers.forEach((tower, index) => {
      const slotX = startX + index * (slotSize + gap);
      const isSelected = index === selected;
      const cost = calculateTowerCost(state, playerId, tower.id);
      const canBuy = state.economies[playerId].credits >= cost;

      this.graphics.fillStyle(isSelected ? tower.color : 0x07131e, isSelected ? 0.22 : 0.72);
      this.graphics.fillRoundedRect(slotX, y + 10, slotSize, 52, 8);
      this.graphics.lineStyle(isSelected ? 2 : 1, canBuy ? tower.color : 0x6f8492, isSelected ? 0.92 : 0.42);
      this.graphics.strokeRoundedRect(slotX, y + 10, slotSize, 52, 8);
      this.drawEffectIcon(tower.effect, slotX + slotSize / 2, y + 27, 14, canBuy ? tower.color : 0x6f8492, canBuy ? 0.95 : 0.46);
      this.text(slotX + slotSize / 2, y + 43, `${cost}`, 10, canBuy ? "#ffe39d" : "#6f8492", "900", 0.5);

      if (isSelected) {
        this.graphics.fillStyle(tower.color, 0.9);
        this.graphics.fillTriangle(slotX + 18, y + 5, slotX + 34, y + 5, slotX + 26, y);
      }
    });

    const selectedTower = towers[selected];
    this.text(x + width - 18, y + 12, selectedTower.shortName, 13, "#edf7ff", "900", 1);
    this.text(x + width - 18, y + 33, selectedTower.role, 9, "#8ea4b3", "900", 1);
    this.drawInputGlyphs(x + width - 180, y + 50, playerId);
  }

  private drawMiniQuickbar(state: GameState, playerId: PlayerId): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const x = GAME_WIDTH - 252;
    const y = 218;
    const towers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selected = state.cursors[playerId].selectedTowerIndex % towers.length;

    this.panel(x, y, 238, 84, playerClass.accent, 0.76);
    this.text(x + 14, y + 10, "P2 TORRES", 10, toHexColor(playerClass.accent), "900");
    towers.slice(0, 6).forEach((tower, index) => {
      const slotX = x + 14 + index * 35;

      this.graphics.fillStyle(index === selected ? tower.color : 0x07131e, index === selected ? 0.2 : 0.65);
      this.graphics.fillRoundedRect(slotX, y + 34, 28, 28, 6);
      this.graphics.lineStyle(index === selected ? 2 : 1, tower.color, index === selected ? 0.82 : 0.34);
      this.graphics.strokeRoundedRect(slotX, y + 34, 28, 28, 6);
      this.drawEffectIcon(tower.effect, slotX + 14, y + 48, 8, tower.color, 0.9);
    });
  }

  private drawAiPanel(state: GameState): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses.p2);
    const decision = state.aiPartner.lastDecision;
    const x = GAME_WIDTH - 252;
    const y = 82;
    const width = 238;
    const height = 198;
    const towers = state.towers.filter((tower) => tower.ownerId === "p2").length;

    this.panel(x, y, width, height, playerClass.accent, 0.78);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, 40, 8);
    this.text(x + 14, y + 10, "P2 IA", 11, toHexColor(playerClass.accent), "900");
    this.text(x + width - 14, y + 8, `${state.economies.p2.credits} C`, 13, "#ffe39d", "900", 1);
    this.text(x + 14, y + 28, playerClass.shortName, 13, "#edf7ff", "900");

    this.drawMetricIcon(x + 18, y + 54, "tower", `${towers}`, playerClass.accent);
    this.drawMetricIcon(x + 88, y + 54, "damage", `${Math.round(state.combatStats.p2.waveDamageDealt)}`, 0x83f3ff);
    this.drawMetricIcon(x + 158, y + 54, "brain", `${state.aiPartner.decisionsLogged}`, 0xffd36d);

    this.graphics.fillStyle(0x020712, 0.68);
    this.graphics.fillRoundedRect(x + 12, y + 106, width - 24, 78, 8);
    this.graphics.lineStyle(1, playerClass.accent, 0.32);
    this.graphics.strokeRoundedRect(x + 12, y + 106, width - 24, 78, 8);
    this.drawDecisionIcon(decision?.kind ?? "hold", x + 30, y + 126, playerClass.accent);
    this.text(x + 54, y + 116, decision?.title ?? "Analisando", 12, "#edf7ff", "900", 0, width - 76);
    this.text(x + 54, y + 136, decision?.detail ?? "aguardando melhor acao", 9, "#a9bac6", "800", 0, width - 76);

    if (decision) {
      this.drawConfidenceBar(x + 54, y + 158, 90, decision.confidence, playerClass.accent);
      this.text(x + width - 20, y + 156, `${Math.round(decision.confidence * 100)}%`, 9, "#edf7ff", "900", 1);
      this.drawTags(x + 16, y + 171, decision.tags, playerClass.accent);
    }
  }

  private drawDebugButton(state: GameState): void {
    if (!state.debug || state.phase !== "playing") {
      return;
    }

    this.graphics.fillStyle(0x120613, 0.88);
    this.graphics.fillRoundedRect(debugButton.x, debugButton.y, debugButton.width, debugButton.height, 6);
    this.graphics.lineStyle(1, gameDesign.color.pink, 0.62);
    this.graphics.strokeRoundedRect(debugButton.x, debugButton.y, debugButton.width, debugButton.height, 6);
    this.text(
      debugButton.x + debugButton.width / 2,
      debugButton.y + 9,
      "DEBUG F2",
      10,
      "#ff8db4",
      "900",
      0.5
    );
  }

  private drawBuildStatusIcon(x: number, y: number, color: number): void {
    this.graphics.lineStyle(2, color, 0.9);
    this.graphics.strokeRect(x - 8, y - 8, 16, 16);
    this.graphics.lineBetween(x, y - 12, x, y + 12);
    this.graphics.lineBetween(x - 12, y, x + 12, y);
  }

  private drawMetricIcon(x: number, y: number, icon: "damage" | "kill" | "tower" | "brain", value: string, color: number): void {
    this.graphics.fillStyle(0x020712, 0.62);
    this.graphics.fillRoundedRect(x - 4, y - 4, 56, 28, 7);
    this.graphics.lineStyle(1, color, 0.32);
    this.graphics.strokeRoundedRect(x - 4, y - 4, 56, 28, 7);
    this.drawSmallIcon(icon, x + 9, y + 10, color);
    this.text(x + 50, y + 4, value, 11, "#edf7ff", "900", 1);
  }

  private drawMiniStat(x: number, y: number, icon: "threat" | "route" | "enemy" | "spawn", value: string, color: number, originX = 0): void {
    const actualX = originX === 1 ? x - 34 : x;

    this.graphics.fillStyle(0x020712, 0.55);
    this.graphics.fillRoundedRect(actualX, y, 38, 30, 7);
    this.graphics.lineStyle(1, color, 0.26);
    this.graphics.strokeRoundedRect(actualX, y, 38, 30, 7);
    this.drawSmallIcon(icon, actualX + 12, y + 11, color);
    this.text(actualX + 32, y + 7, value, 10, "#edf7ff", "900", 1);
  }

  private drawHealthStrip(x: number, y: number, width: number, ratio: number): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    const color = clamped > 0.55 ? 0x77ffc7 : clamped > 0.28 ? 0xffd36d : 0xff6d8b;

    this.graphics.fillStyle(0x020712, 0.82);
    this.graphics.fillRoundedRect(x, y, width, 10, 5);
    this.graphics.fillStyle(color, 0.92);
    this.graphics.fillRoundedRect(x, y, width * clamped, 10, 5);
    this.text(x + width - 4, y - 2, "CORE", 8, "#020712", "900", 1);
  }

  private drawStatPill(x: number, y: number, label: string, value: string, color: number): void {
    this.graphics.fillStyle(0x020712, 0.62);
    this.graphics.fillRoundedRect(x, y, 62, 30, 7);
    this.graphics.lineStyle(1, color, 0.32);
    this.graphics.strokeRoundedRect(x, y, 62, 30, 7);
    this.text(x + 8, y + 5, label, 8, "#8ea4b3", "900");
    this.text(x + 54, y + 5, value, 10, "#edf7ff", "900", 1);
  }

  private drawInputGlyphs(x: number, y: number, playerId: PlayerId): void {
    const labels = playerId === "p1" ? ["Q", "E", "SP", "F", "R"] : ["PG", "PG", "EN", "SH", "BK"];

    labels.forEach((label, index) => {
      this.graphics.fillStyle(0x020712, 0.58);
      this.graphics.fillRoundedRect(x + index * 31, y, 25, 14, 4);
      this.graphics.lineStyle(1, 0x31556a, 0.38);
      this.graphics.strokeRoundedRect(x + index * 31, y, 25, 14, 4);
      this.text(x + index * 31 + 12.5, y + 2, label, 7, "#8ea4b3", "900", 0.5);
    });
  }

  private drawTags(x: number, y: number, tags: readonly string[], color: number): void {
    let cursorX = x;

    tags.slice(0, 3).forEach((tag) => {
      const width = Math.min(58, 15 + tag.length * 4.8);

      this.graphics.fillStyle(color, 0.1);
      this.graphics.fillRoundedRect(cursorX, y, width, 14, 4);
      this.graphics.lineStyle(1, color, 0.28);
      this.graphics.strokeRoundedRect(cursorX, y, width, 14, 4);
      this.text(cursorX + width / 2, y + 2, tag.slice(0, 10), 7, toHexColor(color), "900", 0.5);
      cursorX += width + 5;
    });
  }

  private drawConfidenceBar(x: number, y: number, width: number, confidence: number, color: number): void {
    this.graphics.fillStyle(0x132231, 0.9);
    this.graphics.fillRoundedRect(x, y, width, 6, 3);
    this.graphics.fillStyle(color, 0.92);
    this.graphics.fillRoundedRect(x, y, width * Phaser.Math.Clamp(confidence, 0, 1), 6, 3);
  }

  private getBuildStatus(
    state: GameState,
    playerId: PlayerId,
    towerId: string,
    cost: number,
    towerUnderCursor: TowerEntity | undefined
  ): { title: string; detail: string; color: number } {
    const cursor = state.cursors[playerId];
    const tower = getTowerDefinition(towerId);
    const availableCredits = state.economies[playerId].credits;

    if (towerUnderCursor) {
      return {
        title: towerUnderCursor.ownerId === playerId ? "UPGRADE" : "ALIADA",
        detail: towerUnderCursor.ownerId === playerId ? "F abre arvore" : "ocupada por P2",
        color: towerUnderCursor.ownerId === playerId ? gameDesign.color.cyan : 0xffd36d
      };
    }

    if (!isInsideGrid(cursor.grid, state.activeMap)) {
      return { title: "INVALIDO", detail: "fora do mapa", color: gameDesign.color.danger };
    }

    if (isGridOnPath(cursor.grid, state.activeMap)) {
      return { title: "ROTA", detail: "construa ao lado", color: gameDesign.color.danger };
    }

    if (availableCredits < cost) {
      return {
        title: `FALTAM ${cost - availableCredits}`,
        detail: `${tower.shortName}: ${availableCredits}/${cost}`,
        color: 0xffd36d
      };
    }

    return { title: "PRONTO", detail: `${tower.shortName} disponivel`, color: gameDesign.color.success };
  }

  private getWaveStatus(state: GameState): string {
    if (state.phase === "paused") {
      return "PAUSADO";
    }

    if (state.phase === "reward-selection") {
      return "RECOMPENSA";
    }

    if (state.phase === "victory") {
      return "VITORIA";
    }

    if (state.phase === "defeat") {
      return "BASE PERDIDA";
    }

    if (state.wave.active) {
      return "COMBATE";
    }

    if (state.wave.readyPlayers.p1 && (state.sessionMode === "solo-ai" || state.wave.readyPlayers.p2)) {
      return `ENTRANDO ${(state.wave.nextWaveInMs / 1000).toFixed(1)}S`;
    }

    const missing = [
      state.wave.readyPlayers.p1 ? null : "P1",
      state.sessionMode === "solo-ai" || state.wave.readyPlayers.p2 ? null : "P2"
    ].filter(Boolean);

    return missing.length > 0
      ? `AUTO ${(state.wave.nextWaveInMs / 1000).toFixed(0)}S · ${missing.join("+")}`
      : `AUTO ${(state.wave.nextWaveInMs / 1000).toFixed(0)}S`;
  }

  private drawEffectIcon(
    effect: TowerEffect,
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number
  ): void {
    this.graphics.lineStyle(2, color, alpha);
    this.graphics.fillStyle(color, alpha * 0.18);

    if (effect === "damage") {
      this.graphics.strokeCircle(x, y, size * 0.78);
      this.graphics.lineBetween(x - size, y, x + size, y);
      this.graphics.lineBetween(x, y - size, x, y + size);
      return;
    }

    if (effect === "chain") {
      this.graphics.lineBetween(x - size, y + size * 0.5, x - size * 0.32, y - size * 0.52);
      this.graphics.lineBetween(x - size * 0.32, y - size * 0.52, x + size * 0.2, y + size * 0.44);
      this.graphics.lineBetween(x + size * 0.2, y + size * 0.44, x + size, y - size * 0.5);
      return;
    }

    if (effect === "slow") {
      this.graphics.strokeCircle(x, y, size * 0.52);
      this.graphics.strokeCircle(x, y, size * 0.95);
      return;
    }

    if (effect === "splash") {
      this.graphics.strokeTriangle(x, y - size, x - size, y + size * 0.7, x + size, y + size * 0.7);
      return;
    }

    if (effect === "income") {
      this.graphics.fillCircle(x, y, size * 0.55);
      this.graphics.lineStyle(2, 0x020712, 0.8);
      this.graphics.lineBetween(x - size * 0.34, y, x + size * 0.34, y);
      return;
    }

    if (effect === "summon") {
      this.graphics.strokeCircle(x - size * 0.45, y, size * 0.38);
      this.graphics.strokeCircle(x + size * 0.45, y, size * 0.38);
      this.graphics.lineBetween(x - size, y + size * 0.7, x + size, y + size * 0.7);
      return;
    }

    if (effect === "aura") {
      this.graphics.strokeCircle(x, y, size);
      this.graphics.fillCircle(x, y, size * 0.28);
      return;
    }

    if (effect === "mark") {
      this.graphics.strokeRect(x - size * 0.7, y - size * 0.7, size * 1.4, size * 1.4);
      this.graphics.lineBetween(x - size, y, x + size, y);
      this.graphics.lineBetween(x, y - size, x, y + size);
      return;
    }

    if (effect === "cleanse") {
      this.graphics.beginPath();
      this.graphics.arc(x, y, size * 0.82, Math.PI * 0.15, Math.PI * 1.35);
      this.graphics.strokePath();
      this.graphics.lineBetween(x - size * 0.5, y + size * 0.55, x + size * 0.62, y - size * 0.62);
      return;
    }

    if (effect === "ritual-zone") {
      this.graphics.strokeTriangle(x, y - size, x - size, y + size * 0.7, x + size, y + size * 0.7);
      this.graphics.strokeCircle(x, y, size * 0.48);
      return;
    }

    this.graphics.beginPath();
    this.graphics.arc(x, y, size * 0.8, Math.PI * 0.1, Math.PI * 1.55);
    this.graphics.strokePath();
    this.graphics.fillTriangle(x - size, y - size * 0.15, x - size * 0.25, y - size * 0.62, x - size * 0.35, y + size * 0.22);
  }

  private drawDecisionIcon(kind: "build" | "upgrade" | "reward" | "ready" | "hold", x: number, y: number, color: number): void {
    this.graphics.lineStyle(2, color, 0.9);

    if (kind === "build") {
      this.drawBuildStatusIcon(x, y, color);
      return;
    }

    if (kind === "upgrade") {
      this.graphics.strokeCircle(x, y, 10);
      this.graphics.lineBetween(x, y - 12, x, y + 12);
      this.graphics.lineBetween(x - 12, y, x + 12, y);
      return;
    }

    if (kind === "reward") {
      this.graphics.strokeTriangle(x, y - 12, x - 12, y + 8, x + 12, y + 8);
      return;
    }

    if (kind === "ready") {
      this.graphics.strokeCircle(x, y, 11);
      this.graphics.lineBetween(x - 5, y, x - 1, y + 5);
      this.graphics.lineBetween(x - 1, y + 5, x + 8, y - 7);
      return;
    }

    this.graphics.strokeCircle(x, y, 10);
    this.graphics.lineBetween(x - 7, y, x + 7, y);
  }

  private drawSmallIcon(icon: string, x: number, y: number, color: number): void {
    this.graphics.lineStyle(2, color, 0.88);
    this.graphics.fillStyle(color, 0.24);

    if (icon === "damage" || icon === "threat") {
      this.graphics.lineBetween(x - 7, y + 5, x + 7, y - 5);
      this.graphics.lineBetween(x + 2, y - 6, x + 7, y - 5);
      this.graphics.lineBetween(x + 7, y - 5, x + 6, y);
      return;
    }

    if (icon === "kill" || icon === "enemy") {
      this.graphics.strokeCircle(x, y, 7);
      this.graphics.lineBetween(x - 5, y - 5, x + 5, y + 5);
      this.graphics.lineBetween(x + 5, y - 5, x - 5, y + 5);
      return;
    }

    if (icon === "tower") {
      this.graphics.strokeRect(x - 6, y - 6, 12, 12);
      this.graphics.lineBetween(x, y - 9, x, y + 9);
      return;
    }

    if (icon === "brain") {
      this.graphics.strokeCircle(x - 4, y, 5);
      this.graphics.strokeCircle(x + 4, y, 5);
      this.graphics.lineBetween(x - 1, y - 6, x - 1, y + 6);
      return;
    }

    if (icon === "route") {
      this.graphics.lineBetween(x - 8, y + 5, x - 2, y - 4);
      this.graphics.lineBetween(x - 2, y - 4, x + 7, y + 2);
      return;
    }

    this.graphics.fillCircle(x, y, 5);
  }

  private panel(x: number, y: number, width: number, height: number, color: number, alpha: number): void {
    this.graphics.fillStyle(gameDesign.color.ink, alpha);
    this.graphics.fillRoundedRect(x, y, width, height, gameDesign.radius.panel);
    this.graphics.lineStyle(1, color, 0.34);
    this.graphics.strokeRoundedRect(x, y, width, height, gameDesign.radius.panel);
  }

  private text(
    x: number,
    y: number,
    value: string,
    fontSize: number,
    color: string,
    fontStyle: string,
    originX = 0,
    wrapWidth?: number
  ): Phaser.GameObjects.Text {
    const text = this.getText();

    text.setPosition(x, y);
    text.setText(value);
    text.setStyle({
      fontFamily: gameDesign.font.family,
      fontSize: `${fontSize}px`,
      fontStyle,
      color,
      lineSpacing: 1,
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined
    });
    text.setOrigin(originX, 0);
    text.setVisible(true);
    text.setAlpha(1);

    return text;
  }

  private getText(): Phaser.GameObjects.Text {
    let text = this.texts[this.usedTexts];

    if (!text) {
      text = this.scene.add.text(0, 0, "", {}).setDepth(81);
      this.texts.push(text);
    }

    this.usedTexts += 1;

    return text;
  }

  private hideUnusedText(): void {
    for (let index = this.usedTexts; index < this.texts.length; index += 1) {
      this.texts[index].setVisible(false);
    }
  }
}
