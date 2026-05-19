import Phaser from "phaser";
import { GAME_WIDTH } from "../config/constants";
import { getPlayerClassDefinition } from "../data/playerClasses";
import { towerBranchDefinitions } from "../data/towerBranches";
import { getTowerDefinition, getTowerDefinitionsForClass } from "../data/towers";
import { getWaveDefinition, getWaveThreat, getWaveTimelineWindow } from "../data/waves";
import { gameDesign, toHexColor } from "../design/gameDesignSystem";
import { GameRegistry } from "../GameRegistry";
import type { GameState, PlayerId, TowerEntity, TowerRuntimeStats } from "../models/types";
import { gridKey, isGridOnPath, isInsideGrid } from "../utils/grid";
import {
  calculateTowerCost,
  calculateTowerPreviewStats,
  calculateTowerRuntimeStats
} from "../utils/towerStats";

const panelByPlayer: Record<PlayerId, { x: number; y: number; align: "left" | "right" }> = {
  p1: { x: 14, y: 82, align: "left" },
  p2: { x: GAME_WIDTH - gameDesign.hud.sidePanelWidth - 14, y: 82, align: "right" }
};

const controlsByPlayer: Record<PlayerId, string[]> = {
  p1: ["WASD mover", "MOUSE/SPACE construir", "F torre", "R pronto", "Q/E troca"],
  p2: ["SETAS mover", "ENTER construir", "SHIFT torre", "BACK pronto", "PG troca"]
};

export class PhaserHudRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly registry = GameRegistry.getInstance();
  private usedTexts = 0;
  private readonly debugButton = { x: GAME_WIDTH - 154, y: 12, width: 142, height: 30 };

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
    this.drawCountdownCallout(state);
    this.drawDebugButton(state);
    this.drawPlayerPanel(state, "p1");

    if (state.sessionMode === "solo-ai") {
      this.drawAiCompanionChip(state);
    } else {
      this.drawPlayerPanel(state, "p2");
    }
    this.hideUnusedText();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const state = this.registry.state;

    if (!state.debug || state.phase !== "playing") {
      return;
    }

    const button = this.debugButton;

    if (
      pointer.x >= button.x &&
      pointer.x <= button.x + button.width &&
      pointer.y >= button.y &&
      pointer.y <= button.y + button.height
    ) {
      this.registry.debugAdvanceWave();
    }
  }

  private drawTimeline(state: GameState): void {
    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const width = gameDesign.hud.timelineWidth;
    const height = gameDesign.hud.timelineHeight;
    const x = (GAME_WIDTH - width) / 2;
    const y = 10;
    const timeline = getWaveTimelineWindow(state.wave.currentWaveIndex, 10);
    const nodeGap = 38;
    const startX = x + 70;

    this.graphics.fillStyle(gameDesign.color.void, 0.78);
    this.graphics.fillRoundedRect(x, y, width, height, gameDesign.radius.lg);
    this.graphics.lineStyle(1, wave.isBoss ? 0xff4f9a : 0x83f3ff, wave.isBoss ? 0.46 : 0.24);
    this.graphics.strokeRoundedRect(x, y, width, height, gameDesign.radius.lg);

    for (let index = 0; index < timeline.length; index += 1) {
      const nodeWave = timeline[index].wave;
      const waveIndex = timeline[index].index;
      const nodeX = startX + index * nodeGap;
      const completed = waveIndex < state.wave.currentWaveIndex;
      const current = waveIndex === state.wave.currentWaveIndex;
      const color = nodeWave.isBoss ? 0xff4f9a : current ? 0x83f3ff : 0x8ea4b3;

      if (index > 0) {
        this.graphics.lineStyle(2, completed ? 0x83f3ff : 0x203646, completed ? 0.5 : 0.32);
        this.graphics.lineBetween(nodeX - nodeGap + 10, y + 19, nodeX - 10, y + 19);
      }

      this.graphics.fillStyle(completed ? color : 0x07131e, current ? 0.95 : 0.78);
      this.graphics.fillCircle(nodeX, y + 19, nodeWave.isBoss ? 9 : 7);
      this.graphics.lineStyle(current ? 3 : 1, color, current ? 0.92 : 0.46);
      this.graphics.strokeCircle(nodeX, y + 19, nodeWave.isBoss ? 11 : 9);
      this.drawText(nodeX, y + 31, `${waveIndex + 1}`, gameDesign.font.size.meta, current ? "#edf7ff" : "#6f8492", gameDesign.font.weight.strong, 0.5);
    }

    const status = this.getWaveStatus(state);
    const threat = getWaveThreat(wave);
    const routes = state.wave.snapshot.activePathIndexes.length;
    const alive = state.wave.snapshot.aliveEnemies;
    const remaining = state.wave.snapshot.totalSpawnsRemaining;

    this.drawText(x + 14, y + 7, status, 9, wave.isBoss ? "#ff8db4" : "#83f3ff", "900");
    this.drawText(x + 14, y + 27, wave.name, 13, "#edf7ff", "900", 0, 185);
    this.drawText(
      x + width - 14,
      y + 34,
      `AMEACA ${threat}  ROTAS ${routes || "-"}  VIVOS ${alive}  SPAWN ${remaining}`,
      9,
      "#a9bac6",
      "900",
      1
    );
  }

  private drawPlayerPanel(state: GameState, playerId: PlayerId): void {
    const panel = panelByPlayer[playerId];
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const x = panel.x;
    const y = panel.y;
    const width = gameDesign.hud.sidePanelWidth;
    const height = gameDesign.hud.sidePanelHeight;
    const cursor = state.cursors[playerId];
    const availableTowers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selectedTower = availableTowers[cursor.selectedTowerIndex % availableTowers.length];
    const selectedCost = calculateTowerCost(state, playerId, selectedTower.id);
    const towerUnderCursor = state.towers.find((tower) => gridKey(tower.grid) === gridKey(cursor.grid));
    const stats = towerUnderCursor
      ? calculateTowerRuntimeStats(state, towerUnderCursor)
      : calculateTowerPreviewStats(state, playerId, selectedTower.id);
    const title = towerUnderCursor ? "TORRE NO CURSOR" : "TORRE SELECIONADA";

    this.graphics.fillStyle(gameDesign.color.ink, gameDesign.alpha.panelStrong);
    this.graphics.fillRoundedRect(x, y, width, height, gameDesign.radius.panel);
    this.graphics.lineStyle(2, playerClass.accent, 0.42);
    this.graphics.strokeRoundedRect(x, y, width, height, gameDesign.radius.panel);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, 48, gameDesign.radius.lg);

    this.drawText(x + 12, y + 9, playerId.toUpperCase(), 10, this.toHex(playerClass.accent), "900");
    this.drawText(x + 12, y + 24, playerClass.shortName, 17, "#edf7ff", "900", 0, 145);
    this.drawText(x + width - 12, y + 13, `${state.economies[playerId].credits}`, 19, this.toHex(playerClass.accent), "900", 1);
    this.drawText(x + width - 12, y + 35, "CRED", 9, "#8ea4b3", "900", 1);

    this.drawBuildNotice(state, playerId, selectedTower.id, selectedCost, towerUnderCursor, x, y + 56, width);
    this.drawTowerStats(title, stats, selectedCost, x, y + 102, width, towerUnderCursor);
    this.drawTowerBelt(state, playerId, x + 12, y + 226, width - 24);
    this.drawPlayerMetrics(state, playerId, x + 12, y + 276, width - 24);
    this.drawControls(playerId, x + 12, y + 308, width - 24);
  }

  private drawAiCompanionChip(state: GameState): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses.p2);
    const x = GAME_WIDTH - 246;
    const y = 86;
    const width = 232;
    const height = 92;
    const towers = state.towers.filter((tower) => tower.ownerId === "p2").length;

    this.graphics.fillStyle(gameDesign.color.ink, 0.74);
    this.graphics.fillRoundedRect(x, y, width, height, gameDesign.radius.panel);
    this.graphics.lineStyle(1, playerClass.accent, 0.42);
    this.graphics.strokeRoundedRect(x, y, width, height, gameDesign.radius.panel);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, 34, gameDesign.radius.lg);
    this.drawText(x + 14, y + 10, "IA GUARDIÃ", 10, "#ffd36d", "900");
    this.drawText(x + width - 14, y + 10, `${state.economies.p2.credits} CRED`, 10, "#ffe39d", "900", 1);
    this.drawText(x + 14, y + 44, playerClass.shortName, 15, "#edf7ff", "900", 0, width - 28);
    this.drawText(
      x + 14,
      y + 68,
      `P2 invisível · ${towers} torres · pronto automático`,
      9,
      "#8ea4b3",
      "900",
      0,
      width - 28
    );
  }

  private drawCountdownCallout(state: GameState): void {
    if (state.phase !== "playing" || state.wave.active || state.wave.completed) {
      return;
    }

    const seconds = Math.max(0, state.wave.nextWaveInMs / 1000);
    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const x = GAME_WIDTH / 2 - 182;
    const y = 70;
    const width = 364;
    const height = 54;
    const color = wave.isBoss ? gameDesign.color.pink : gameDesign.color.cyan;

    this.graphics.fillStyle(0x020712, 0.82);
    this.graphics.fillRoundedRect(x, y, width, height, 9);
    this.graphics.lineStyle(2, color, wave.isBoss ? 0.72 : 0.48);
    this.graphics.strokeRoundedRect(x, y, width, height, 9);
    this.graphics.fillStyle(color, 0.1);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, height - 4, 8);

    const title = state.wave.readyPlayers.p1 && (state.sessionMode === "solo-ai" || state.wave.readyPlayers.p2)
      ? "COMEÇANDO"
      : "PREPARAÇÃO";
    this.drawText(x + 18, y + 9, title, 11, this.toHex(color), "900");
    this.drawText(x + 18, y + 27, wave.name, 12, "#edf7ff", "900", 0, 205);
    this.drawText(x + width - 20, y + 5, `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`, 30, "#edf7ff", "900", 1);
  }

  private drawDebugButton(state: GameState): void {
    if (!state.debug || state.phase !== "playing") {
      return;
    }

    const button = this.debugButton;

    this.graphics.fillStyle(0x120613, 0.88);
    this.graphics.fillRoundedRect(button.x, button.y, button.width, button.height, 6);
    this.graphics.lineStyle(1, 0xff8db4, 0.62);
    this.graphics.strokeRoundedRect(button.x, button.y, button.width, button.height, 6);
    this.drawText(button.x + button.width / 2, button.y + 9, "DEBUG F2 AVANCAR", 10, "#ff8db4", "900", 0.5);
  }

  private drawBuildNotice(
    state: GameState,
    playerId: PlayerId,
    towerId: string,
    cost: number,
    towerUnderCursor: TowerEntity | undefined,
    x: number,
    y: number,
    width: number
  ): void {
    const notice = state.playerNotices[playerId];
    const status = notice
      ? { title: notice.title, detail: notice.detail, color: this.getNoticeColor(notice.tone) }
      : this.getBuildStatus(state, playerId, towerId, cost, towerUnderCursor);

    this.graphics.fillStyle(gameDesign.color.void, 0.68);
    this.graphics.fillRoundedRect(x + 10, y, width - 20, 38, gameDesign.radius.md);
    this.graphics.lineStyle(1, status.color, 0.4);
    this.graphics.strokeRoundedRect(x + 10, y, width - 20, 38, gameDesign.radius.md);
    this.drawText(x + 20, y + 7, status.title, 10, this.toHex(status.color), "900");
    this.drawText(x + 20, y + 22, status.detail, 10, "#a9bac6", "800", 0, width - 40);
  }

  private drawTowerStats(
    title: string,
    stats: TowerRuntimeStats,
    selectedCost: number,
    x: number,
    y: number,
    width: number,
    towerUnderCursor: TowerEntity | undefined
  ): void {
    this.graphics.fillStyle(gameDesign.color.panel, 0.62);
    this.graphics.fillRoundedRect(x + 10, y, width - 20, 116, gameDesign.radius.md);
    this.graphics.lineStyle(1, 0x31556a, 0.34);
    this.graphics.strokeRoundedRect(x + 10, y, width - 20, 116, gameDesign.radius.md);

    this.drawText(x + 20, y + 8, title, 9, "#8ea4b3", "900");
    this.drawText(x + 20, y + 23, stats.name, 13, "#edf7ff", "900", 0, width - 56);
    this.drawText(x + width - 20, y + 23, towerUnderCursor ? `LV ${stats.level}` : `${selectedCost}C`, 11, "#ffe39d", "900", 1);

    if (stats.effect === "income") {
      this.drawStatLine(x + 20, y + 47, "RENDA", stats.effectDetails[0] ?? "+creditos", "TEMPO", stats.effectDetails[1] ?? "wave");
      this.drawStatLine(x + 20, y + 66, "ATAQUE", "nao ataca", "USO", "combate");
    } else {
      this.drawStatLine(x + 20, y + 47, "DPS", stats.dps.toFixed(1), "TIRO", stats.damagePerShot.toFixed(1));
      this.drawStatLine(x + 20, y + 66, "CD", `${(stats.cooldownMs / 1000).toFixed(2)}s`, "ALC", `${Math.round(stats.range)}`);
    }
    this.drawText(x + 20, y + 87, `${stats.effectLabel}: ${stats.effectDetails.join("  |  ")}`, 9, "#d2e5f1", "800", 0, width - 40);
    this.drawText(
      x + 20,
      y + 103,
      towerUnderCursor
        ? `KILLS ${stats.kills}  DANO ${Math.round(stats.damageDealt)}  PTS ${stats.skillPoints}`
        : stats.role.toUpperCase(),
      8,
      "#8ea4b3",
      "900",
      0,
      width - 40
    );

    if (towerUnderCursor && stats.branchSummary.length > 0) {
      this.drawText(x + width - 20, y + 103, stats.branchSummary.join(" / "), 8, "#b4ff72", "900", 1);
    }
  }

  private drawTowerBelt(
    state: GameState,
    playerId: PlayerId,
    x: number,
    y: number,
    width: number
  ): void {
    const availableTowers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selectedIndex = state.cursors[playerId].selectedTowerIndex % availableTowers.length;
    const slotWidth = Math.floor((width - 8 * Math.max(0, availableTowers.length - 1)) / availableTowers.length);

    for (let index = 0; index < availableTowers.length; index += 1) {
        const tower = availableTowers[index];
        const slotX = x + index * (slotWidth + 8);
        const slotY = y + 10;
        const selected = index === selectedIndex;

        this.graphics.fillStyle(selected ? tower.color : 0x07131e, selected ? 0.28 : 0.46);
        this.graphics.fillRoundedRect(slotX, slotY, slotWidth, 20, 4);
        this.graphics.lineStyle(selected ? 2 : 1, tower.color, selected ? 0.82 : 0.28);
        this.graphics.strokeRoundedRect(slotX, slotY, slotWidth, 20, 4);
        this.drawText(slotX + slotWidth / 2, slotY + 5, tower.shortName.slice(0, 3).toUpperCase(), 8, "#edf7ff", "900", 0.5);
    }
  }

  private drawPlayerMetrics(
    state: GameState,
    playerId: PlayerId,
    x: number,
    y: number,
    width: number
  ): void {
    const stats = state.combatStats[playerId];
    const towersInField = state.towers.filter((tower) => tower.ownerId === playerId).length;

    this.drawText(x, y, `DMG ${Math.round(stats.waveDamageDealt)}`, 10, "#edf7ff", "900");
    this.drawText(x + width / 2, y, `KILLS ${stats.kills}`, 10, "#edf7ff", "900", 0.5);
    this.drawText(x + width, y, `TORRES ${towersInField}`, 10, "#edf7ff", "900", 1);
  }

  private drawControls(playerId: PlayerId, x: number, y: number, width: number): void {
    this.drawText(x, y, controlsByPlayer[playerId].slice(0, 3).join("  ·  "), 8, "#8ea4b3", "900", 0, width);
    this.drawText(x, y + 12, controlsByPlayer[playerId].slice(3).join("  ·  "), 8, "#8ea4b3", "900", 0, width);
  }

  private drawStatLine(
    x: number,
    y: number,
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string
  ): void {
    this.drawText(x, y, leftLabel, 9, "#8ea4b3", "900");
    this.drawText(x + 42, y, leftValue, 11, "#edf7ff", "900");
    this.drawText(x + 116, y, rightLabel, 9, "#8ea4b3", "900");
    this.drawText(x + 158, y, rightValue, 11, "#edf7ff", "900");
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
        title: towerUnderCursor.ownerId === playerId ? "INSPECIONE" : "TORRE ALIADA",
        detail: towerUnderCursor.ownerId === playerId ? "abra stats e upgrades" : "campo ocupado",
        color: 0x83f3ff
      };
    }

    if (!isInsideGrid(cursor.grid, state.activeMap)) {
      return { title: "INVALIDO", detail: "cursor fora do mapa", color: 0xff6d8b };
    }

    if (isGridOnPath(cursor.grid, state.activeMap)) {
      return { title: "ROTA", detail: "construa fora do caminho", color: 0xff6d8b };
    }

    if (availableCredits < cost) {
      return {
        title: `FALTAM ${cost - availableCredits}`,
        detail: `${tower.shortName} custa ${cost}; voce tem ${availableCredits}`,
        color: 0xffd36d
      };
    }

    return { title: "PRONTO", detail: `${tower.shortName} por ${cost} creditos`, color: 0xb4ff72 };
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

    if (state.wave.readyPlayers.p1 && state.wave.readyPlayers.p2) {
      return `ENTRANDO ${(state.wave.nextWaveInMs / 1000).toFixed(1)}S`;
    }

    const missing = [
      state.wave.readyPlayers.p1 ? null : "P1",
      state.sessionMode === "solo-ai" || state.wave.readyPlayers.p2 ? null : "P2"
    ].filter(Boolean);

    return missing.length > 0
      ? `AUTO ${(state.wave.nextWaveInMs / 1000).toFixed(0)}S · FALTA ${missing.join("+")}`
      : `AUTO ${(state.wave.nextWaveInMs / 1000).toFixed(0)}S`;
  }

  private getNoticeColor(tone: string): number {
    if (tone === "success") {
      return 0xb4ff72;
    }

    if (tone === "warning") {
      return 0xffd36d;
    }

    if (tone === "danger") {
      return 0xff6d8b;
    }

    return 0x83f3ff;
  }

  private drawText(
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
      lineSpacing: 2,
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

  private toHex(color: number): string {
    return toHexColor(color);
  }
}
