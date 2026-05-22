import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { gameUiBridge } from "../bridge/RewardBridge";
import { getPlayerClassDefinition } from "../data/playerClasses";
import { getSkillDefinition, getSkillRank } from "../data/skills";
import {
  getTowerAutoBuildDefinition,
  towerBranchDefinitions
} from "../data/towerBranches";
import { getTowerDefinition, getTowerDefinitionsForClass } from "../data/towers";
import { getWaveDefinition, getWaveThreat, getWaveTimelineWindow } from "../data/waves";
import {
  type GameUiIconId,
  type GameUiTextRole,
  gameDesign,
  gameText,
  playerColor,
  toHexColor
} from "../design/gameDesignSystem";
import { GameRegistry } from "../GameRegistry";
import type { GameSettings, GameState, PlayerId, TowerEffect, TowerEntity } from "../models/types";
import { RunTelemetry } from "../telemetry/RunTelemetry";
import { gridKey, isGridOnPath, isInsideGrid } from "../utils/grid";
import {
  calculateTowerCost,
  calculateTowerPreviewStats,
  calculateTowerRuntimeStats
} from "../utils/towerStats";
import {
  getLocalPlayerIds,
  getPlayablePlayerIds,
  getPlayerLabel,
  getRemoteOrAiPlayerIds
} from "../utils/players";

type HudButton = {
  x: number;
  y: number;
  width: number;
  height: number;
  onClick: () => void;
  enabled?: boolean;
};

const sidePanelSlots = {
  left: { x: 8, y: 82 },
  right: { x: GAME_WIDTH - gameDesign.hud.sidePanelWidth - 8, y: 82 }
};

const debugButton = { x: GAME_WIDTH - 164, y: 12, width: 150, height: 32 };

export class PhaserHudRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly buttons: HudButton[] = [];
  private readonly registry = GameRegistry.getInstance();
  private usedTexts = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(80);
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
  }

  render(state: GameState): void {
    this.graphics.clear();
    this.usedTexts = 0;
    this.buttons.length = 0;

    if (state.phase === "menu" || state.phase === "class-selection") {
      this.hideUnusedText();
      return;
    }

    if (state.phase === "reward-selection" || state.phase === "paused" || state.phase === "victory" || state.phase === "defeat") {
      this.drawPhaseOverlay(state);
      this.hideUnusedText();
      return;
    }

    this.drawTimeline(state);

    if (state.phase === "playing" || state.phase === "paused") {
      const playablePlayerIds = getPlayablePlayerIds(state);
      const localPlayerIds = getLocalPlayerIds(state.session);
      const primaryPlayerId = localPlayerIds[0] ?? playablePlayerIds[0];
      const secondaryLocalPlayerId = localPlayerIds.find((playerId) => playerId !== primaryPlayerId);

      if (primaryPlayerId) {
        this.drawPlayerStatus(state, primaryPlayerId, "left");
        this.drawContextPanel(state, primaryPlayerId, "left");
      }

      if (state.sessionMode === "solo-ai") {
        if (primaryPlayerId) {
          this.drawQuickbar(state, primaryPlayerId);
        }
        this.drawAiPanel(state);
      } else if (secondaryLocalPlayerId) {
        this.drawPlayerStatus(state, secondaryLocalPlayerId, "right");
        this.drawContextPanel(state, secondaryLocalPlayerId, "right");
        if (primaryPlayerId) {
          this.drawSideQuickbar(state, primaryPlayerId, "left");
        }
        this.drawSideQuickbar(state, secondaryLocalPlayerId, "right");
      } else {
        if (primaryPlayerId) {
          this.drawQuickbar(state, primaryPlayerId);
        }
        this.drawTeamPanel(state, primaryPlayerId);
      }
    }

    this.drawDebugButton(state);
    this.drawTowerInspectionOverlay(state);
    this.hideUnusedText();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    for (let index = this.buttons.length - 1; index >= 0; index -= 1) {
      const button = this.buttons[index];

      if (
        button.enabled === false ||
        pointer.x < button.x ||
        pointer.x > button.x + button.width ||
        pointer.y < button.y ||
        pointer.y > button.y + button.height
      ) {
        continue;
      }

      button.onClick();
      return;
    }
  }

  private drawTimeline(state: GameState): void {
    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const width = gameDesign.hud.timelineWidth;
    const height = gameDesign.hud.timelineHeight;
    const x = (GAME_WIDTH - width) / 2;
    const y = 12;
    const timeline = getWaveTimelineWindow(state.wave.currentWaveIndex, 10);
    const nodeGap = 30;
    const nodeY = y + 25;
    const startX = x + 286;
    const routes = state.wave.snapshot.activePathIndexes.length;
    const seconds = Math.max(0, state.wave.nextWaveInMs / 1000);
    const statusLabel = state.wave.active
      ? wave.isBoss
        ? "BOSS ATIVO"
        : "COMBATE"
      : wave.isBoss
        ? "BOSS EM PREPARO"
        : "PREPARACAO";
    const timerLabel = state.wave.active ? "VIVOS" : "COMECA EM";
    const timerValue = state.wave.active
      ? `${state.wave.snapshot.aliveEnemies}`
      : `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
    const detail = state.wave.active ? `${routes || 1} rota(s) ativa(s)` : "";
    const accent = wave.isBoss ? gameDesign.color.pink : gameDesign.color.cyan;
    const playerIds = getPlayablePlayerIds(state);
    const readyCount = playerIds.filter((playerId) => state.wave.readyPlayers[playerId]).length;
    const allReady = playerIds.length > 0 && readyCount === playerIds.length;

    this.panel(x, y, width, height, accent, 0.82);
    this.graphics.fillStyle(accent, 0.06);
    this.graphics.fillRoundedRect(x + 2, y + 2, 248, height - 4, 8);
    this.textRole(x + 18, y + 12, statusLabel, "label", toHexColor(accent));
    this.textRole(x + 18, y + 35, wave.name, "title", "#edf7ff", 0, 218);
    this.drawReadyChip(x + 18, y + 62, "PRONTOS", allReady, allReady ? gameDesign.color.success : gameDesign.color.gold);
    this.textRole(x + 126, y + 65, `${readyCount}/${playerIds.length || 1}`, "meta", allReady ? "#b4ff72" : "#ffe39d", 0, 52);

    if (detail) {
      this.textRole(x + 196, y + 65, detail, "meta", "#a9bac6", 0, 48);
    }

    for (let index = 0; index < timeline.length; index += 1) {
      const nodeWave = timeline[index].wave;
      const waveIndex = timeline[index].index;
      const nodeX = startX + index * nodeGap;
      const completed = waveIndex < state.wave.currentWaveIndex;
      const current = waveIndex === state.wave.currentWaveIndex;
      const color = nodeWave.isBoss ? gameDesign.color.pink : current ? gameDesign.color.cyan : 0x6f8492;

      if (index > 0) {
        this.graphics.lineStyle(2, completed ? gameDesign.color.cyan : 0x203646, completed ? 0.5 : 0.28);
        this.graphics.lineBetween(nodeX - nodeGap + 9, nodeY, nodeX - 9, nodeY);
      }

      this.graphics.fillStyle(completed || current ? color : 0x07131e, current ? 0.96 : 0.78);
      this.graphics.fillCircle(nodeX, nodeY, nodeWave.isBoss ? 8 : 6);
      this.graphics.lineStyle(current ? 3 : 1, color, current ? 0.95 : 0.46);
      this.graphics.strokeCircle(nodeX, nodeY, nodeWave.isBoss ? 11 : 8);
      this.textRole(nodeX, nodeY + 15, `${waveIndex + 1}`, "micro", current ? "#edf7ff" : "#6f8492", 0.5);
    }

    this.drawWaveMetricChip(x + 286, y + 56, "threat", "Ameaca", `${getWaveThreat(wave)}`, wave.isBoss ? gameDesign.color.pink : 0xffd36d);
    this.drawWaveMetricChip(x + 350, y + 56, "route", "Rotas", `${routes || "-"}`, 0x83f3ff);
    this.drawWaveMetricChip(x + 414, y + 56, "enemy", "Vivos", `${state.wave.snapshot.aliveEnemies}`, 0xff6d8b);
    this.drawWaveMetricChip(x + 478, y + 56, "spawn", "Fila", `${state.wave.snapshot.totalSpawnsRemaining}`, 0xb4ff72);

    this.graphics.fillStyle(0x020712, 0.58);
    this.graphics.fillRoundedRect(x + width - 130, y + 13, 108, 62, 8);
    this.graphics.lineStyle(1, accent, 0.28);
    this.graphics.strokeRoundedRect(x + width - 130, y + 13, 108, 62, 8);
    this.textRole(x + width - 24, y + 21, timerLabel, "meta", "#a9bac6", 1);
    this.text(x + width - 24, y + 35, timerValue, 34, "#edf7ff", "900", 1);
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
    const playerIds = getPlayablePlayerIds(state);
    const readyCount = playerIds.filter((playerId) => state.wave.readyPlayers[playerId]).length;

    this.textRole(x + 18, y + 8, readyCount > 0 ? `${readyCount}/${playerIds.length} prontos` : "Preparacao", "label", toHexColor(color));
    this.textRole(x + 18, y + 29, wave.name, "body", "#edf7ff", 0, 205);
    this.textRole(x + width - 104, y + 8, "Comeca em", "meta", "#a9bac6", 0.5);
    this.text(x + width - 18, y + 4, `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`, 34, "#edf7ff", "900", 1);
  }

  private drawPlayerStatus(state: GameState, playerId: PlayerId, slot: "left" | "right" = "left"): void {
    const panel = sidePanelSlots[slot];
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const width = gameDesign.hud.sidePanelWidth;
    const height = gameDesign.hud.statusPanelHeight;
    const stats = state.combatStats[playerId];
    const towers = state.towers.filter((tower) => tower.ownerId === playerId).length;

    this.panel(panel.x, panel.y, width, height, playerClass.accent, 0.82);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(panel.x + 2, panel.y + 2, width - 4, 44, 8);
    this.textRole(panel.x + 12, panel.y + 10, playerId.toUpperCase(), "label", toHexColor(playerClass.accent));
    this.textRole(panel.x + 12, panel.y + 28, playerClass.shortName, "player", "#edf7ff", 0, 144);
    this.drawSmallIcon("credits", panel.x + width - 76, panel.y + 24, gameDesign.color.gold);
    this.text(panel.x + width - 12, panel.y + 9, `${state.economies[playerId].credits}`, 24, toHexColor(playerClass.accent), "900", 1);
    this.textRole(panel.x + width - 12, panel.y + 36, "creditos", "micro", "#a9bac6", 1);

    this.drawHealthStrip(panel.x + 12, panel.y + 58, width - 24, state.baseHp / state.activeMap.baseHp);
    this.drawMetricIcon(panel.x + 14, panel.y + 86, "damage", "Dano da onda", `${Math.round(stats.waveDamageDealt)}`, playerColor(playerId));
    this.drawMetricIcon(panel.x + 94, panel.y + 86, "kill", "Eliminacoes", `${stats.kills}`, 0xffd36d);
    this.drawMetricIcon(panel.x + 174, panel.y + 86, "tower", "Torres", `${towers}`, playerClass.accent);
  }

  private drawContextPanel(state: GameState, playerId: PlayerId, slot: "left" | "right" = "left"): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const x = sidePanelSlots[slot].x;
    const y = 228;
    const width = gameDesign.hud.sidePanelWidth;
    const height = gameDesign.hud.contextPanelHeight;
    const cursor = state.cursors[playerId];
    const available = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selectedTower = available[cursor.selectedTowerIndex % available.length];
    const selectedCost = calculateTowerCost(state, playerId, selectedTower.id);
    const towerUnderCursor = state.towers.find((tower) => gridKey(tower.grid) === gridKey(cursor.grid));
    const stats = towerUnderCursor
      ? calculateTowerRuntimeStats(state, towerUnderCursor)
      : calculateTowerPreviewStats(state, playerId, selectedTower.id);
    const title = towerUnderCursor ? "Torre no cursor" : "Torre selecionada";
    const status = this.getBuildStatus(state, playerId, selectedTower.id, selectedCost, towerUnderCursor);

    if (!towerUnderCursor && state.sessionMode === "solo-ai") {
      this.panel(x, y, width, height, status.color, 0.78);
      this.textRole(x + 14, y + 12, "Construcao", "label", toHexColor(status.color));
      this.textRole(x + width - 14, y + 12, `${selectedCost} creditos`, "label", "#ffe39d", 1);
      this.drawEffectIcon(selectedTower.effect, x + 30, y + 54, 17, selectedTower.color, 0.95);
      this.textRole(x + 58, y + 40, selectedTower.shortName, "title", "#edf7ff", 0, 158);
      this.textRole(x + 58, y + 64, selectedTower.role, "body", "#a9bac6", 0, 158);
      this.drawAbilitySummary(x + 14, y + 88, width - 28, stats, selectedTower.color);

      this.graphics.fillStyle(status.color, 0.08);
      this.graphics.fillRoundedRect(x + 14, y + 128, width - 28, 62, 8);
      this.graphics.lineStyle(1, status.color, 0.3);
      this.graphics.strokeRoundedRect(x + 14, y + 128, width - 28, 62, 8);
      this.textRole(x + 28, y + 142, status.title, "label", toHexColor(status.color), 0, width - 56);
      this.textRole(x + 28, y + 162, status.detail, "body", "#c4d4df", 0, width - 56);
      this.textRole(x + 14, y + 202, "F: detalhes da torre no cursor.", "micro", "#8ea4b3");
      return;
    }

    this.panel(x, y, width, height, status.color, 0.78);
    this.textRole(x + 14, y + 12, title, "label", toHexColor(status.color));
    this.textRole(
      x + width - 14,
      y + 12,
      towerUnderCursor ? `Nivel ${stats.level}` : `${selectedCost} creditos`,
      "label",
      "#ffe39d",
      1
    );
    this.drawEffectIcon(stats.effect, x + 30, y + 52, 17, towerUnderCursor ? getTowerDefinition(towerUnderCursor.typeId).color : selectedTower.color, 0.95);
    this.textRole(x + 58, y + 38, stats.shortName, "title", "#edf7ff", 0, 166);
    this.textRole(x + 58, y + 62, stats.effectLabel, "body", "#a9bac6", 0, 166);
    this.drawAbilitySummary(x + 14, y + 82, width - 28, stats, towerUnderCursor ? getTowerDefinition(towerUnderCursor.typeId).color : selectedTower.color);
    this.drawStatPill(x + 10, y + 112, "damage", "Dano/s", stats.effect === "income" ? "renda" : stats.dps.toFixed(1), playerColor(playerId));
    this.drawStatPill(x + 84, y + 112, "range", "Alcance", `${Math.round(stats.range)}`, 0xb4ff72);
    this.drawStatPill(x + 158, y + 112, "cooldown", "Recarga", `${(stats.cooldownMs / 1000).toFixed(1)}s`, 0xffd36d);
    this.textRole(x + 14, y + 160, status.title, "label", toHexColor(status.color));
    this.textRole(x + 14, y + 178, status.detail, "body", "#c4d4df", 0, width - 28);

    if (towerUnderCursor) {
      const xpRatio = stats.skillPoints > 0 ? 1 : Phaser.Math.Clamp(towerUnderCursor.xp / towerUnderCursor.xpToNext, 0, 1);

      this.drawProgressLine(x + 14, y + 196, width - 28, xpRatio, playerClass.accent);
      this.textRole(
        x + 14,
        y + 204,
        `XP ${towerUnderCursor.xp}/${towerUnderCursor.xpToNext}  |  pontos ${stats.skillPoints}`,
        "micro",
        "#edf7ff"
      );
      this.textRole(
        x + width - 14,
        y + 204,
        `${stats.kills} elim.  ${Math.round(stats.damageDealt)} dano`,
        "micro",
        "#edf7ff",
        1
      );
    }
  }

  private drawQuickbar(state: GameState, playerId: PlayerId): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const towers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selected = state.cursors[playerId].selectedTowerIndex % towers.length;
    const selectedTower = towers[selected];
    const preview = calculateTowerPreviewStats(state, playerId, selectedTower.id);
    const selectedCost = calculateTowerCost(state, playerId, selectedTower.id);
    const canBuildSelected = state.economies[playerId].credits >= selectedCost;
    const x = 248;
    const y = GAME_HEIGHT - 146;
    const width = 784;
    const height = gameDesign.hud.quickbarHeight;
    const shopX = x + 16;
    const shopY = y + 14;
    const slotY = y + 38;
    const slotWidth = 48;
    const slotHeight = 56;
    const slotGap = 6;
    const infoX = x + 368;
    const infoY = y + 14;
    const infoWidth = width - 386;
    const costColor = canBuildSelected ? "#ffe39d" : "#ff8db4";
    const abilityDetail = preview.effectDetails.join(" | ");

    this.panel(x, y, width, height, playerClass.accent, 0.92);
    this.textRole(shopX, shopY, "Torres", "label", toHexColor(playerClass.accent));
    this.textRole(shopX + 56, shopY, playerClass.shortName, "micro", "#8ea4b3", 0, 160);

    towers.forEach((tower, index) => {
      const slotX = shopX + index * (slotWidth + slotGap);
      const isSelected = index === selected;
      const cost = calculateTowerCost(state, playerId, tower.id);
      const canBuy = state.economies[playerId].credits >= cost;

      this.drawTowerSlot(
        slotX,
        slotY,
        slotWidth,
        slotHeight,
        index + 1,
        tower.effect,
        tower.color,
        cost,
        canBuy,
        isSelected
      );
    });

    this.graphics.lineStyle(1, 0x31556a, 0.42);
    this.graphics.lineBetween(infoX - 18, y + 16, infoX - 18, y + height - 16);

    this.drawEffectIcon(selectedTower.effect, infoX + 20, infoY + 22, 14, selectedTower.color, 0.95);
    this.textRole(infoX + 46, infoY + 2, selectedTower.shortName, "title", "#edf7ff", 0, 152);
    this.textRole(infoX + 46, infoY + 24, selectedTower.role, "meta", "#a9bac6", 0, 152);
    this.textRole(infoX + infoWidth, infoY + 4, `${selectedCost} creditos`, "label", costColor, 1);
    this.textRole(infoX + infoWidth, infoY + 22, canBuildSelected ? "Disponivel" : "Creditos insuficientes", "micro", costColor, 1);

    this.textRole(infoX, infoY + 52, this.shorten(selectedTower.summary, 68), "body", "#d8e6ef", 0, 236);
    this.drawAbilityTag(infoX + 250, infoY + 47, preview.effectLabel, this.shorten(abilityDetail, 32), selectedTower.color, 132);

    this.drawTowerStatTile(infoX, infoY + 88, 128, "damage", "Dano por segundo", preview.effect === "income" ? "renda" : preview.dps.toFixed(1), playerColor(playerId));
    this.drawTowerStatTile(infoX + 138, infoY + 88, 100, "range", "Alcance", `${Math.round(preview.range)}`, 0xb4ff72);
    this.drawTowerStatTile(infoX + 250, infoY + 88, 108, "cooldown", "Recarga", `${(preview.cooldownMs / 1000).toFixed(1)}s`, 0xffd36d);

    this.drawControlRibbon(shopX, y + 102, playerId);
  }

  private drawSideQuickbar(state: GameState, playerId: PlayerId, slot: "left" | "right" = "left"): void {
    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const x = sidePanelSlots[slot].x;
    const y = GAME_HEIGHT - 126;
    const width = gameDesign.hud.sidePanelWidth;
    const height = 112;
    const towers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
    const selected = state.cursors[playerId].selectedTowerIndex % towers.length;
    const selectedTower = towers[selected];
    const preview = calculateTowerPreviewStats(state, playerId, selectedTower.id);

    this.panel(x, y, width, height, playerClass.accent, 0.8);
    this.textRole(x + 14, y + 10, `${playerId.toUpperCase()} torres`, "label", toHexColor(playerClass.accent));
    this.textRole(x + width - 14, y + 10, selectedTower.shortName, "label", "#edf7ff", 1);
    towers.slice(0, 6).forEach((tower, index) => {
      const slotSize = 30;
      const slotX = x + 12 + index * 36;
      const isSelected = index === selected;
      const cost = calculateTowerCost(state, playerId, tower.id);
      const canBuy = state.economies[playerId].credits >= cost;

      this.graphics.fillStyle(isSelected ? tower.color : 0x07131e, isSelected ? 0.2 : 0.65);
      this.graphics.fillRoundedRect(slotX, y + 34, slotSize, 34, 6);
      this.graphics.lineStyle(isSelected ? 2 : 1, canBuy ? tower.color : 0x6f8492, isSelected ? 0.88 : 0.34);
      this.graphics.strokeRoundedRect(slotX, y + 34, slotSize, 34, 6);
      this.drawEffectIcon(tower.effect, slotX + slotSize / 2, y + 48, 8, canBuy ? tower.color : 0x6f8492, canBuy ? 0.9 : 0.42);
      this.textRole(slotX + slotSize / 2, y + 58, `${cost}`, "micro", canBuy ? "#ffe39d" : "#6f8492", 0.5);
    });

    this.drawTinyStat(x + 14, y + 76, "damage", "Dano por segundo", preview.effect === "income" ? "renda" : preview.dps.toFixed(1), playerColor(playerId));
    this.textRole(x + width - 14, y + 76, selectedTower.role, "meta", "#a9bac6", 1, 108);
    this.drawCompactControls(x + 14, y + 96, playerId);
  }

  private drawAiPanel(state: GameState): void {
    const aiPlayerId =
      state.session.seats.find((seat) => seat.kind === "ai-partner" && seat.connected)?.id ??
      getRemoteOrAiPlayerIds(state)[0];

    if (!aiPlayerId) {
      return;
    }

    const playerClass = getPlayerClassDefinition(state.playerClasses[aiPlayerId]);
    const decision = state.aiPartner.lastDecision;
    const x = sidePanelSlots.right.x;
    const y = 82;
    const width = gameDesign.hud.sidePanelWidth;
    const height = 220;
    const towers = state.towers.filter((tower) => tower.ownerId === aiPlayerId).length;

    this.panel(x, y, width, height, playerClass.accent, 0.78);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, 40, 8);
    this.textRole(x + 14, y + 10, `${getPlayerLabel(aiPlayerId)} Bot`, "label", toHexColor(playerClass.accent));
    this.textRole(x + width - 14, y + 8, `${state.economies[aiPlayerId].credits} creditos`, "stat", "#ffe39d", 1);
    this.textRole(x + 14, y + 30, playerClass.shortName, "title", "#edf7ff");

    this.drawMetricIcon(x + 14, y + 58, "tower", "Torres", `${towers}`, playerClass.accent);
    this.drawMetricIcon(x + 94, y + 58, "damage", "Dano", `${Math.round(state.combatStats[aiPlayerId].waveDamageDealt)}`, playerColor(aiPlayerId));
    this.drawMetricIcon(x + 174, y + 58, "brain", "Decisoes", `${state.aiPartner.decisionsLogged}`, 0xffd36d);

    this.graphics.fillStyle(0x020712, 0.68);
    this.graphics.fillRoundedRect(x + 12, y + 116, width - 24, 90, 8);
    this.graphics.lineStyle(1, playerClass.accent, 0.32);
    this.graphics.strokeRoundedRect(x + 12, y + 116, width - 24, 90, 8);
    this.drawDecisionIcon(decision?.kind ?? "hold", x + 32, y + 140, playerClass.accent);
    this.textRole(x + 58, y + 126, decision?.title ?? "Analisando", "body", "#edf7ff", 0, width - 82);
    this.textRole(x + 58, y + 148, decision?.detail ?? "aguardando melhor acao", "meta", "#a9bac6", 0, width - 82);

    if (decision) {
      this.drawConfidenceBar(x + 58, y + 174, 100, decision.confidence, playerClass.accent);
      this.textRole(x + width - 20, y + 168, `${Math.round(decision.confidence * 100)}%`, "meta", "#edf7ff", 1);
      this.drawTags(x + 16, y + 188, decision.tags, playerClass.accent);
    }
  }

  private drawTeamPanel(state: GameState, focusedPlayerId?: PlayerId): void {
    const playerIds = getPlayablePlayerIds(state);
    const x = sidePanelSlots.right.x;
    const y = 82;
    const width = gameDesign.hud.sidePanelWidth;
    const height = 500;
    const readyCount = playerIds.filter((playerId) => state.wave.readyPlayers[playerId]).length;

    this.panel(x, y, width, height, gameDesign.color.cyan, 0.78);
    this.graphics.fillStyle(gameDesign.color.cyan, 0.08);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, 44, 8);
    this.textRole(x + 14, y + 10, "Time online", "label", "#83f3ff");
    this.textRole(x + width - 14, y + 10, `${playerIds.length} ativos`, "label", "#edf7ff", 1);
    this.textRole(x + 14, y + 30, `${readyCount}/${playerIds.length} prontos`, "meta", readyCount === playerIds.length ? "#b4ff72" : "#ffe39d");

    playerIds.slice(0, 12).forEach((playerId, index) => {
      const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
      const rowY = y + 62 + index * 36;
      const towers = state.towers.filter((tower) => tower.ownerId === playerId).length;
      const isFocused = playerId === focusedPlayerId;
      const isReady = state.wave.readyPlayers[playerId];
      const seat = state.session.seats.find((candidate) => candidate.id === playerId);

      this.graphics.fillStyle(isFocused ? playerClass.accent : 0x020712, isFocused ? 0.18 : 0.62);
      this.graphics.fillRoundedRect(x + 12, rowY, width - 24, 30, 6);
      this.graphics.lineStyle(isFocused ? 2 : 1, isReady ? gameDesign.color.success : playerClass.accent, isFocused || isReady ? 0.68 : 0.24);
      this.graphics.strokeRoundedRect(x + 12, rowY, width - 24, 30, 6);
      this.drawSmallIcon(seat?.kind === "ai-partner" ? "brain" : "tower", x + 26, rowY + 15, playerClass.accent);
      this.textRole(x + 42, rowY + 5, `${getPlayerLabel(playerId)} ${playerClass.shortName}`, "label", "#edf7ff", 0, 112);
      this.textRole(x + 158, rowY + 5, `${state.economies[playerId].credits}c`, "micro", "#ffe39d", 0, 42);
      this.textRole(x + 202, rowY + 5, `${towers}T`, "micro", "#a9bac6", 0, 32);
      this.textRole(x + width - 18, rowY + 5, isReady ? "OK" : "prep", "micro", isReady ? "#b4ff72" : "#8ea4b3", 1);
    });
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
      "DEBUG: proxima wave",
      10,
      "#ff8db4",
      "900",
      0.5
    );
    this.registerButton(debugButton.x, debugButton.y, debugButton.width, debugButton.height, () => {
      this.registry.debugAdvanceWave();
    });
  }

  private drawPhaseOverlay(state: GameState): void {
    if (state.phase === "paused") {
      this.drawPauseOverlay(state);
      return;
    }

    if (state.phase === "reward-selection" && state.rewardSelection) {
      this.drawRewardOverlay(state);
      return;
    }

    if ((state.phase === "victory" || state.phase === "defeat") && state.runSummary) {
      this.drawRunSummaryOverlay(state);
    }
  }

  private drawTowerInspectionOverlay(state: GameState): void {
    const inspection = state.towerInspection;

    if (!inspection || state.phase !== "playing") {
      return;
    }

    const tower = state.towers.find((candidate) => candidate.id === inspection.towerId);

    if (!tower) {
      return;
    }

    const definition = getTowerDefinition(tower.typeId);
    const stats = calculateTowerRuntimeStats(state, tower);
    const playerClass = getPlayerClassDefinition(state.playerClasses[tower.ownerId]);
    const x = GAME_WIDTH / 2 - 320;
    const y = 132;
    const width = 640;
    const height = 418;

    this.drawScrim(0.44);
    this.panel(x, y, width, height, playerClass.accent, 0.95);
    this.drawEffectIcon(definition.effect, x + 38, y + 42, 18, definition.color, 0.96);
    this.textRole(x + 70, y + 20, definition.name, "overlayTitle", "#edf7ff", 0, 380);
    this.textRole(x + 70, y + 60, `${playerClass.shortName} · nivel ${tower.level} · ${tower.skillPoints} ponto(s)`, "body", toHexColor(playerClass.accent));
    this.textRole(x + width - 22, y + 28, tower.autoUpgradeEnabled ? "Auto ativo" : "Manual", "label", tower.autoUpgradeEnabled ? "#b4ff72" : "#ffe39d", 1);

    this.drawTinyStat(x + 34, y + 106, "damage", "Dano por segundo", stats.effect === "income" ? "--" : stats.dps.toFixed(1), playerColor(tower.ownerId));
    this.drawTinyStat(x + 220, y + 106, "range", "Alcance", `${Math.round(stats.range)}`, gameDesign.color.success);
    this.drawTinyStat(x + 370, y + 106, "cooldown", "Recarga", `${(stats.cooldownMs / 1000).toFixed(2)}s`, gameDesign.color.gold);
    this.drawTinyStat(x + 505, y + 106, "kill", "Eliminacoes", `${stats.kills}`, gameDesign.color.pink);

    this.textRole(x + 34, y + 164, "Escolha uma linha de evolucao", "title", "#edf7ff");
    this.textRole(x + 34, y + 188, "Usa pontos ganhos por abates e assistencias. Nao gasta creditos.", "body", "#a9bac6");

    towerBranchDefinitions.forEach((branch, index) => {
      const branchX = x + 34 + index * 118;
      const branchY = y + 232;
      const selected = inspection.selectedOptionIndex === index;
      const rank = tower.branchRanks[branch.id];
      const canUpgrade = tower.skillPoints > 0 && rank < branch.maxRank && tower.ownerId === inspection.playerId;

      this.graphics.fillStyle(selected ? branch.color : 0x020712, selected ? 0.2 : 0.7);
      this.graphics.fillRoundedRect(branchX, branchY, 106, 112, 8);
      this.graphics.lineStyle(selected ? 2 : 1, branch.color, selected ? 0.9 : 0.34);
      this.graphics.strokeRoundedRect(branchX, branchY, 106, 112, 8);
      this.drawBranchIcon(branch.id, branchX + 53, branchY + 22, branch.color);
      this.textRole(branchX + 53, branchY + 42, branch.shortName, "label", "#edf7ff", 0.5);
      this.textRole(branchX + 53, branchY + 60, branch.role, "micro", "#a9bac6", 0.5);
      this.drawRankDots(branchX + 21, branchY + 82, rank, branch.maxRank, branch.color);
      this.textRole(branchX + 53, branchY + 96, canUpgrade ? "Aplicar" : rank >= branch.maxRank ? "Completo" : "Sem ponto", "micro", canUpgrade ? "#b4ff72" : "#8ea4b3", 0.5);

      this.registerButton(branchX, branchY, 106, 112, () => {
        this.registry.setTowerInspectionOption(inspection.playerId, index);
        this.registry.activateTowerInspectionOption(inspection.playerId);
      }, tower.ownerId === inspection.playerId);
    });

    const build = getTowerAutoBuildDefinition(tower.autoBuildId);
    this.drawOverlayButton(x + 34, y + height - 58, 230, 40, "brain", tower.autoUpgradeEnabled ? `Auto: ${build.name}` : "Ligar auto-upgrade", build.description, gameDesign.color.cyan, () => {
      this.registry.toggleTowerAutoUpgrade(inspection.playerId, tower.id);
    });
    this.drawOverlayButton(x + width - 194, y + height - 58, 160, 40, "pause", "Fechar", "F ou Esc", gameDesign.color.gold, () => {
      this.registry.closeTowerInspection();
    });
  }

  private drawScrim(alpha = 0.72): void {
    this.graphics.fillStyle(0x02040a, alpha);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private drawPauseOverlay(state: GameState): void {
    const x = GAME_WIDTH / 2 - 250;
    const y = 108;
    const width = 500;
    const height = 472;

    this.drawScrim(0.68);
    this.panel(x, y, width, height, gameDesign.color.cyan, 0.94);
    this.drawSmallIcon("pause", x + 36, y + 38, gameDesign.color.cyan);
    this.textRole(x + 62, y + 22, "Jogo pausado", "overlayTitle", "#edf7ff");
    this.textRole(x + 62, y + 62, "A simulacao esta congelada. Ajuste volume ou volte para a run.", "body", "#a9bac6", 0, width - 92);

    this.drawOverlayButton(x + 32, y + 102, 208, 48, "ready", "Continuar", "Esc ou P tambem volta", gameDesign.color.success, () => {
      this.registry.resume();
    });
    this.drawOverlayButton(x + 260, y + 102, 208, 48, "restart", "Reiniciar run", "volta para escolha de classe", gameDesign.color.gold, () => {
      this.registry.restartRun();
    });

    this.drawVolumeControl(x + 32, y + 176, 436, "Volume master", state.settings.masterVolume, "masterVolume", gameDesign.color.cyan);
    this.drawVolumeControl(x + 32, y + 222, 436, "SFX", state.settings.sfxVolume, "sfxVolume", gameDesign.color.gold);
    this.drawVolumeControl(x + 32, y + 268, 436, "Musica", state.settings.musicVolume, "musicVolume", gameDesign.color.pink);

    this.drawOverlayButton(
      x + 32,
      y + 324,
      208,
      44,
      "sound",
      state.settings.muted ? "Som desligado" : "Som ligado",
      "clique para alternar",
      gameDesign.color.cyan,
      () => this.registry.updateSettings({ muted: !state.settings.muted })
    );
    this.drawOverlayButton(
      x + 260,
      y + 324,
      208,
      44,
      "motion",
      state.settings.reducedMotion ? "Movimento reduzido" : "Animacao completa",
      "clique para alternar",
      gameDesign.color.pink,
      () => this.registry.updateSettings({ reducedMotion: !state.settings.reducedMotion })
    );
    this.drawOverlayButton(x + 32, y + 396, 436, 44, "brain", "Exportar aprendizado humano", "gera dataset local para o laboratorio", gameDesign.color.gold, () => {
      this.downloadLearningDataset();
    });
  }

  private drawRewardOverlay(state: GameState): void {
    const rewardSelection = state.rewardSelection;

    if (!rewardSelection) {
      return;
    }

    const x = GAME_WIDTH / 2 - 440;
    const y = 92;
    const width = 880;
    const height = 528;
    const seconds = Math.ceil(rewardSelection.autoSelectInMs / 1000);
    const playerIds = getPlayablePlayerIds(state);
    const localPlayerIds = getLocalPlayerIds(state.session);
    const visibleRewardPlayerIds = (localPlayerIds.length > 0 ? localPlayerIds : playerIds).slice(0, 2);
    const columnWidth = visibleRewardPlayerIds.length > 1 ? 300 : 390;
    const progressX = x + 32 + visibleRewardPlayerIds.length * (columnWidth + 22);
    const progressWidth = Math.max(220, x + width - 32 - progressX);

    this.drawScrim(0.7);
    this.panel(x, y, width, height, gameDesign.color.gold, 0.95);
    this.drawSmallIcon("reward", x + 36, y + 38, gameDesign.color.gold);
    this.textRole(x + 62, y + 22, "Recompensa do boss", "overlayTitle", "#edf7ff");
    this.textRole(x + 62, y + 62, `${playerIds.length} jogadores escolhem. Auto em ${seconds}s.`, "body", "#c4d4df");

    visibleRewardPlayerIds.forEach((playerId, index) => {
      this.drawRewardColumn(state, playerId, x + 32 + index * (columnWidth + 22), y + 110, columnWidth);
    });
    this.drawRewardProgress(state, progressX, y + 110, progressWidth, 380);
  }

  private drawRewardColumn(state: GameState, playerId: PlayerId, x: number, y: number, width: number): void {
    const rewardSelection = state.rewardSelection;

    if (!rewardSelection) {
      return;
    }

    const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
    const choices = rewardSelection.choices[playerId];

    this.textRole(x, y, `${playerId.toUpperCase()} ${playerClass.shortName}`, "title", toHexColor(playerClass.accent));

    choices.skillIds.forEach((skillId, index) => {
      const skill = getSkillDefinition(skillId);
      const selected = choices.selectedSkillId === skillId;
      const rank = getSkillRank(state.skillTrees[playerId].skillRanks, skillId);
      const cardY = y + 38 + index * 112;
      const canPick = !choices.selectedSkillId && rank < skill.maxRank && state.skillTrees[playerId].bossSigils >= skill.costSigils;
      const color = selected ? gameDesign.color.success : canPick ? playerClass.accent : 0x6f8492;

      this.graphics.fillStyle(selected ? playerClass.accent : 0x020712, selected ? 0.18 : 0.72);
      this.graphics.fillRoundedRect(x, cardY, width, 94, 9);
      this.graphics.lineStyle(selected ? 2 : 1, color, selected ? 0.88 : 0.42);
      this.graphics.strokeRoundedRect(x, cardY, width, 94, 9);
      this.drawSmallIcon("reward", x + 24, cardY + 30, color);
      this.textRole(x + 50, cardY + 14, skill.name, "title", selected ? "#ffffff" : "#edf7ff", 0, width - 134);
      this.textRole(x + width - 14, cardY + 14, `${skill.costSigils} sigilo`, "meta", "#ffe39d", 1);
      this.textRole(x + 50, cardY + 42, skill.description, "body", "#a9bac6", 0, width - 74);
      this.textRole(
        x + 50,
        cardY + 72,
        selected ? "Escolhida" : `Rank ${rank}/${skill.maxRank} · ${this.getRewardEffectSummary(skill.effect)}`,
        "meta",
        selected ? "#b4ff72" : "#83f3ff"
      );

      this.registerButton(x, cardY, width, 94, () => {
        gameUiBridge.selectReward(playerId, skill.id);
      }, canPick);
    });
  }

  private drawRunSummaryOverlay(state: GameState): void {
    const summary = state.runSummary;

    if (!summary) {
      return;
    }

    const won = summary.result === "victory";
    const x = GAME_WIDTH / 2 - 330;
    const y = 116;
    const width = 660;
    const height = 458;
    const color = won ? gameDesign.color.success : gameDesign.color.pink;

    this.drawScrim(0.74);
    this.panel(x, y, width, height, color, 0.95);
    this.textRole(x + 32, y + 24, won ? "Run vencida" : "Base perdida", "overlayTitle", won ? "#b4ff72" : "#ff8db4");
    this.textRole(x + 34, y + 66, `${summary.wavesCleared} waves superadas · core ${summary.baseHpRemaining}/${state.activeMap.baseHp}`, "body", "#c4d4df");

    this.drawSummaryGrid(state, x + 34, y + 112, width - 68, 254);
    this.drawOverlayButton(x + 34, y + height - 74, 280, 48, "restart", "Jogar novamente", "volta para escolha de classe", gameDesign.color.gold, () => {
      this.registry.restartRun();
    });
    this.drawOverlayButton(x + 340, y + height - 74, 286, 48, "brain", "Exportar aprendizado", "partidas humanas para dashboard", gameDesign.color.cyan, () => {
      this.downloadLearningDataset();
    });
  }

  private drawSummaryPlayer(state: GameState, playerId: PlayerId, x: number, y: number, width: number): void {
    const summary = state.runSummary;

    if (!summary) {
      return;
    }

    const playerClass = getPlayerClassDefinition(summary.playerClasses[playerId]);
    const stats = summary.combatStats[playerId];
    const towerTotal = Object.values(summary.towerCounts[playerId]).reduce((sum, count) => sum + count, 0);

    this.graphics.fillStyle(0x020712, 0.66);
    this.graphics.fillRoundedRect(x, y, width, 172, 9);
    this.graphics.lineStyle(1, playerClass.accent, 0.38);
    this.graphics.strokeRoundedRect(x, y, width, 172, 9);
    this.textRole(x + 16, y + 14, `${playerId.toUpperCase()} ${playerClass.shortName}`, "title", toHexColor(playerClass.accent));
    this.drawTinyStat(x + 20, y + 58, "damage", "Dano total", `${Math.round(stats.totalDamageDealt)}`, playerColor(playerId));
    this.drawTinyStat(x + 150, y + 58, "kill", "Eliminacoes", `${stats.kills}`, gameDesign.color.gold);
    this.drawTinyStat(x + 20, y + 108, "tower", "Torres", `${towerTotal}`, playerClass.accent);
    this.drawTinyStat(x + 150, y + 108, "credits", "Construidas", `${stats.towersBuilt}`, gameDesign.color.success);
  }

  private drawSummaryGrid(state: GameState, x: number, y: number, width: number, height: number): void {
    const summary = state.runSummary;

    if (!summary) {
      return;
    }

    const playerIds = getPlayablePlayerIds(state).slice(0, 12);
    const columns = playerIds.length <= 2 ? 2 : playerIds.length <= 6 ? 3 : 4;
    const gap = 10;
    const cardWidth = (width - gap * (columns - 1)) / columns;
    const cardHeight = Math.min(78, (height - gap * 2) / 3);

    playerIds.forEach((playerId, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cardX = x + col * (cardWidth + gap);
      const cardY = y + row * (cardHeight + gap);
      const playerClass = getPlayerClassDefinition(summary.playerClasses[playerId]);
      const stats = summary.combatStats[playerId];
      const towerTotal = Object.values(summary.towerCounts[playerId]).reduce((sum, count) => sum + count, 0);

      this.graphics.fillStyle(0x020712, 0.66);
      this.graphics.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 8);
      this.graphics.lineStyle(1, playerClass.accent, 0.38);
      this.graphics.strokeRoundedRect(cardX, cardY, cardWidth, cardHeight, 8);
      this.textRole(cardX + 12, cardY + 10, `${getPlayerLabel(playerId)} ${playerClass.shortName}`, "label", toHexColor(playerClass.accent), 0, cardWidth - 24);
      this.textRole(cardX + 12, cardY + 32, `${Math.round(stats.totalDamageDealt)} dano`, "micro", "#edf7ff", 0, cardWidth - 24);
      this.textRole(cardX + 12, cardY + 48, `${stats.kills} elim. · ${towerTotal} torres`, "micro", "#a9bac6", 0, cardWidth - 24);
    });
  }

  private drawOverlayButton(
    x: number,
    y: number,
    width: number,
    height: number,
    icon: GameUiIconId,
    title: string,
    detail: string,
    color: number,
    onClick: () => void
  ): void {
    this.graphics.fillStyle(0x020712, 0.78);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(1, color, 0.46);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
    this.drawSmallIcon(icon, x + 22, y + height / 2, color);
    this.textRole(x + 48, y + 10, title, "body", "#edf7ff", 0, width - 58);
    this.textRole(x + 48, y + 30, detail, "meta", "#8ea4b3", 0, width - 58);
    this.registerButton(x, y, width, height, onClick);
  }

  private drawVolumeControl(
    x: number,
    y: number,
    width: number,
    label: string,
    value: number,
    key: keyof Pick<GameSettings, "masterVolume" | "sfxVolume" | "musicVolume">,
    color: number
  ): void {
    const buttonSize = 30;
    const barX = x + 156;
    const barY = y + 18;
    const barWidth = width - 230;
    const clamped = Phaser.Math.Clamp(value, 0, 1);

    this.graphics.fillStyle(0x020712, 0.68);
    this.graphics.fillRoundedRect(x, y, width, 36, 8);
    this.graphics.lineStyle(1, color, 0.32);
    this.graphics.strokeRoundedRect(x, y, width, 36, 8);
    this.textRole(x + 14, y + 9, label, "body", "#edf7ff", 0, 132);
    this.graphics.fillStyle(0x132231, 0.9);
    this.graphics.fillRoundedRect(barX, barY, barWidth, 6, 3);
    this.graphics.fillStyle(color, 0.92);
    this.graphics.fillRoundedRect(barX, barY, barWidth * clamped, 6, 3);
    this.textRole(x + width - 76, y + 10, `${Math.round(clamped * 100)}%`, "label", toHexColor(color), 1);

    this.drawVolumeButton(x + width - 66, y + 3, buttonSize, "-", color, () => {
      this.registry.updateSettings({ [key]: Phaser.Math.Clamp(clamped - 0.1, 0, 1) });
    });
    this.drawVolumeButton(x + width - 32, y + 3, buttonSize, "+", color, () => {
      this.registry.updateSettings({ [key]: Phaser.Math.Clamp(clamped + 0.1, 0, 1) });
    });
  }

  private drawRewardProgress(state: GameState, x: number, y: number, width: number, height: number): void {
    const rewardSelection = state.rewardSelection;

    if (!rewardSelection) {
      return;
    }

    this.graphics.fillStyle(0x020712, 0.62);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(1, gameDesign.color.gold, 0.32);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
    this.textRole(x + 14, y + 12, "Progresso do time", "title", "#edf7ff", 0, width - 28);

    getPlayablePlayerIds(state).slice(0, 12).forEach((playerId, index) => {
      const choices = rewardSelection.choices[playerId];
      const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
      const rowY = y + 46 + index * 27;
      const selected = Boolean(choices?.selectedSkillId);
      const seat = state.session.seats.find((candidate) => candidate.id === playerId);

      this.graphics.fillStyle(selected ? playerClass.accent : 0x07131e, selected ? 0.16 : 0.62);
      this.graphics.fillRoundedRect(x + 12, rowY, width - 24, 21, 5);
      this.textRole(
        x + 22,
        rowY + 5,
        `${getPlayerLabel(playerId)} ${seat?.kind === "ai-partner" ? "Bot" : playerClass.shortName}`,
        "micro",
        "#edf7ff",
        0,
        width - 86
      );
      this.textRole(x + width - 18, rowY + 5, selected ? "OK" : "auto", "micro", selected ? "#b4ff72" : "#ffe39d", 1);
    });
  }

  private drawVolumeButton(
    x: number,
    y: number,
    size: number,
    label: string,
    color: number,
    onClick: () => void
  ): void {
    this.graphics.fillStyle(0x020712, 0.86);
    this.graphics.fillRoundedRect(x, y, size, size, 6);
    this.graphics.lineStyle(1, color, 0.5);
    this.graphics.strokeRoundedRect(x, y, size, size, 6);
    this.textRole(x + size / 2, y + 6, label, "title", "#edf7ff", 0.5);
    this.registerButton(x, y, size, size, onClick);
  }

  private getRewardEffectSummary(effect: { rangeBonus?: number; damageMultiplier?: number; costMultiplier?: number; rewardMultiplier?: number }): string {
    const parts: string[] = [];

    if (effect.damageMultiplier) {
      parts.push(`dano x${effect.damageMultiplier.toFixed(2)}`);
    }

    if (effect.rangeBonus) {
      parts.push(`alcance +${effect.rangeBonus}`);
    }

    if (effect.costMultiplier) {
      parts.push(`custo x${effect.costMultiplier.toFixed(2)}`);
    }

    if (effect.rewardMultiplier) {
      parts.push(`renda x${effect.rewardMultiplier.toFixed(2)}`);
    }

    return parts.join(" · ") || "efeito passivo";
  }

  private downloadLearningDataset(): void {
    const jsonl = RunTelemetry.getInstance().exportJsonl();

    if (typeof document === "undefined" || typeof Blob === "undefined" || jsonl.trim().length === 0) {
      this.registry.pushPlayerNotice("p1", "SEM DADOS", "jogue uma run para gerar aprendizado", "warning", 1800);
      return;
    }

    const blob = new Blob([jsonl], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `aegis-human-learning-${Date.now()}.jsonl`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.registry.pushPlayerNotice("p1", "APRENDIZADO EXPORTADO", "dataset pronto para o dashboard", "success", 2200);
  }

  private drawBuildStatusIcon(x: number, y: number, color: number): void {
    this.graphics.lineStyle(2, color, 0.9);
    this.graphics.strokeRect(x - 8, y - 8, 16, 16);
    this.graphics.lineBetween(x, y - 12, x, y + 12);
    this.graphics.lineBetween(x - 12, y, x + 12, y);
  }

  private drawMetricIcon(x: number, y: number, icon: GameUiIconId, label: string, value: string, color: number): void {
    this.graphics.fillStyle(0x020712, 0.62);
    this.graphics.fillRoundedRect(x - 4, y - 4, 66, 36, 7);
    this.graphics.lineStyle(1, color, 0.32);
    this.graphics.strokeRoundedRect(x - 4, y - 4, 66, 36, 7);
    this.drawSmallIcon(icon, x + 10, y + 13, color);
    this.textRole(x + 60, y + 3, value, "stat", "#edf7ff", 1);
    this.textRole(x + 32, y + 22, label, "micro", "#8ea4b3", 0.5);
  }

  private drawMiniStat(x: number, y: number, icon: GameUiIconId, label: string, value: string, color: number): void {
    this.graphics.fillStyle(0x020712, 0.55);
    this.graphics.fillRoundedRect(x, y, 58, 38, 7);
    this.graphics.lineStyle(1, color, 0.26);
    this.graphics.strokeRoundedRect(x, y, 58, 38, 7);
    this.drawSmallIcon(icon, x + 12, y + 13, color);
    this.textRole(x + 50, y + 5, value, "stat", "#edf7ff", 1);
    this.textRole(x + 29, y + 25, label, "micro", "#8ea4b3", 0.5);
  }

  private drawWaveMetricChip(
    x: number,
    y: number,
    icon: GameUiIconId,
    label: string,
    value: string,
    color: number
  ): void {
    this.graphics.fillStyle(0x020712, 0.52);
    this.graphics.fillRoundedRect(x, y, 58, 24, 6);
    this.graphics.lineStyle(1, color, 0.28);
    this.graphics.strokeRoundedRect(x, y, 58, 24, 6);
    this.drawSmallIcon(icon, x + 12, y + 12, color);
    this.textRole(x + 52, y + 3, value, "label", "#edf7ff", 1);
    this.textRole(x + 29, y + 14, label, "micro", "#8ea4b3", 0.5);
  }

  private drawReadyChip(
    x: number,
    y: number,
    label: string,
    ready: boolean,
    color: number
  ): void {
    const chipColor = ready ? color : gameDesign.color.gold;
    const statusText = ready ? "OK" : "FALTA";

    this.graphics.fillStyle(ready ? color : 0x020712, ready ? 0.18 : 0.58);
    this.graphics.fillRoundedRect(x, y, 80, 20, 6);
    this.graphics.lineStyle(1, chipColor, ready ? 0.62 : 0.32);
    this.graphics.strokeRoundedRect(x, y, 80, 20, 6);
    this.graphics.lineStyle(2, chipColor, ready ? 0.9 : 0.54);

    if (ready) {
      this.graphics.strokeCircle(x + 11, y + 10, 6);
      this.graphics.lineBetween(x + 8, y + 10, x + 11, y + 13);
      this.graphics.lineBetween(x + 11, y + 13, x + 16, y + 6);
    } else {
      this.graphics.strokeCircle(x + 11, y + 10, 6);
      this.graphics.lineBetween(x + 7, y + 10, x + 15, y + 10);
    }

    this.text(x + 24, y + 5, label, 9, ready ? "#edf7ff" : "#ffe39d", "900");
    this.text(x + 74, y + 5, statusText, 9, ready ? "#edf7ff" : "#ffe39d", "900", 1);
  }

  private drawHealthStrip(x: number, y: number, width: number, ratio: number): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    const color = clamped > 0.55 ? 0x77ffc7 : clamped > 0.28 ? 0xffd36d : 0xff6d8b;

    this.graphics.fillStyle(0x020712, 0.82);
    this.graphics.fillRoundedRect(x, y, width, 10, 5);
    this.graphics.fillStyle(color, 0.92);
    this.graphics.fillRoundedRect(x, y, width * clamped, 10, 5);
    this.textRole(x + width - 4, y - 3, "Core", "micro", "#020712", 1);
  }

  private drawStatPill(x: number, y: number, icon: GameUiIconId, label: string, value: string, color: number): void {
    this.graphics.fillStyle(0x020712, 0.62);
    this.graphics.fillRoundedRect(x, y, 66, 40, 7);
    this.graphics.lineStyle(1, color, 0.32);
    this.graphics.strokeRoundedRect(x, y, 66, 40, 7);
    this.drawSmallIcon(icon, x + 12, y + 14, color);
    this.textRole(x + 60, y + 6, value, "label", "#edf7ff", 1);
    this.textRole(x + 34, y + 25, label, "micro", "#8ea4b3", 0.5);
  }

  private drawTowerSlot(
    x: number,
    y: number,
    width: number,
    height: number,
    index: number,
    effect: TowerEffect,
    color: number,
    cost: number,
    canBuy: boolean,
    selected: boolean
  ): void {
    const lineColor = canBuy ? color : 0x5c6d78;
    const textColor = canBuy ? "#edf7ff" : "#6f8492";
    const costColor = canBuy ? "#ffe39d" : "#6f8492";

    this.graphics.fillStyle(selected ? color : 0x07131e, selected ? 0.2 : 0.72);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(selected ? 2 : 1, lineColor, selected ? 0.92 : 0.42);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);

    if (selected) {
      this.graphics.fillStyle(color, 0.9);
      this.graphics.fillRoundedRect(x + 5, y + 5, width - 10, 3, 2);
    }

    this.textRole(x + 7, y + 8, `${index}`, "micro", textColor);
    this.drawEffectIcon(effect, x + width / 2, y + 28, 12, canBuy ? color : 0x6f8492, canBuy ? 0.95 : 0.42);
    this.drawSmallIcon("credits", x + 15, y + height - 11, canBuy ? gameDesign.color.gold : 0x6f8492);
    this.textRole(x + width - 7, y + height - 16, `${cost}`, "micro", costColor, 1);
  }

  private drawTowerStatTile(
    x: number,
    y: number,
    width: number,
    icon: GameUiIconId,
    label: string,
    value: string,
    color: number
  ): void {
    this.graphics.fillStyle(0x020712, 0.58);
    this.graphics.fillRoundedRect(x, y, width, 28, 6);
    this.graphics.lineStyle(1, color, 0.26);
    this.graphics.strokeRoundedRect(x, y, width, 28, 6);
    this.drawSmallIcon(icon, x + 13, y + 14, color);
    this.textRole(x + 30, y + 3, value, "label", "#edf7ff");
    this.textRole(x + 30, y + 16, label, "micro", "#8ea4b3", 0, width - 36);
  }

  private drawTinyStat(x: number, y: number, icon: GameUiIconId, label: string, value: string, color: number): void {
    this.drawSmallIcon(icon, x, y + 5, color);
    this.textRole(x + 18, y, label, "micro", "#8ea4b3");
    this.textRole(x + 18, y + 10, value, "label", "#edf7ff");
  }

  private drawAbilitySummary(
    x: number,
    y: number,
    width: number,
    stats: { effectLabel: string; effectDetails: readonly string[] },
    color: number
  ): void {
    this.graphics.fillStyle(color, 0.08);
    this.graphics.fillRoundedRect(x, y, width, 22, 6);
    this.graphics.lineStyle(1, color, 0.28);
    this.graphics.strokeRoundedRect(x, y, width, 22, 6);
    this.textRole(x + 9, y + 6, stats.effectLabel, "micro", toHexColor(color), 0, 62);
    this.textRole(x + width - 8, y + 6, stats.effectDetails.join(" | "), "micro", "#edf7ff", 1, width - 78);
  }

  private drawAbilityTag(
    x: number,
    y: number,
    label: string,
    detail: string,
    color: number,
    width: number
  ): void {
    this.graphics.fillStyle(color, 0.1);
    this.graphics.fillRoundedRect(x, y, width, 34, 7);
    this.graphics.lineStyle(1, color, 0.32);
    this.graphics.strokeRoundedRect(x, y, width, 34, 7);
    this.textRole(x + 10, y + 6, label, "label", toHexColor(color), 0, width - 20);
    this.textRole(x + 10, y + 20, detail, "micro", "#edf7ff", 0, width - 20);
  }

  private drawControlRibbon(x: number, y: number, playerId: PlayerId): void {
    const hints =
      playerId === "p1"
        ? [
            ["Q/E", "Trocar"],
            ["Espaco", "Construir"],
            ["F", "Detalhes"],
            ["R", "Pronto"]
          ]
        : [
            ["PgUp/PgDn", "Trocar"],
            ["Enter", "Construir"],
            ["Shift", "Detalhes"],
            ["Back", "Pronto"]
          ];
    let cursorX = x;

    this.textRole(x, y - 12, "Comandos", "micro", "#8ea4b3");

    hints.forEach(([key, label]) => {
      const width = key.length > 7 ? 76 : key.length > 5 ? 70 : key.length > 2 ? 62 : 54;

      this.graphics.fillStyle(0x020712, 0.58);
      this.graphics.fillRoundedRect(cursorX, y, width, 26, 6);
      this.graphics.lineStyle(1, 0x31556a, 0.44);
      this.graphics.strokeRoundedRect(cursorX, y, width, 26, 6);
      this.text(cursorX + width / 2, y + 3, key, 8, "#edf7ff", "900", 0.5);
      this.text(cursorX + width / 2, y + 14, label, 8, "#8ea4b3", "800", 0.5);
      cursorX += width + 6;
    });
  }

  private drawInputGlyphs(x: number, y: number, playerId: PlayerId): void {
    const labels = playerId === "p1" ? ["Q", "E", "Espaco", "F", "R"] : ["PgUp", "PgDn", "Enter", "Shift", "Back"];

    labels.forEach((label, index) => {
      const width = label.length > 2 ? 42 : 24;
      const offsetX = labels
        .slice(0, index)
        .reduce((sum, item) => sum + (item.length > 2 ? 46 : 28), 0);

      this.graphics.fillStyle(0x020712, 0.58);
      this.graphics.fillRoundedRect(x + offsetX, y, width, 16, 4);
      this.graphics.lineStyle(1, 0x31556a, 0.38);
      this.graphics.strokeRoundedRect(x + offsetX, y, width, 16, 4);
      this.textRole(x + offsetX + width / 2, y + 3, label, "micro", "#8ea4b3", 0.5);
    });
  }

  private drawCompactControls(x: number, y: number, playerId: PlayerId): void {
    const labels =
      playerId === "p1"
        ? ["Q/E trocar  |  Espaco construir", "F detalhes  |  R pronto"]
        : ["PgUp/PgDn trocar  |  Enter construir", "Shift detalhes  |  Backspace pronto"];

    this.textRole(x, y - 2, labels[0], "micro", "#a9bac6", 0, gameDesign.hud.sidePanelWidth - 28);
    this.textRole(x, y + 10, labels[1], "micro", "#a9bac6", 0, gameDesign.hud.sidePanelWidth - 28);
  }

  private drawProgressLine(x: number, y: number, width: number, ratio: number, color: number): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);

    this.graphics.fillStyle(0x020712, 0.72);
    this.graphics.fillRoundedRect(x, y, width, 6, 3);
    this.graphics.fillStyle(color, 0.9);
    this.graphics.fillRoundedRect(x, y, width * clamped, 6, 3);
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
      const inspectKey = playerId === "p1" ? "F" : "Shift";

      return {
        title: towerUnderCursor.ownerId === playerId ? "Evolucao disponivel" : "Torre aliada",
        detail: towerUnderCursor.ownerId === playerId ? `${inspectKey} abre a arvore da torre` : "este espaco ja esta ocupado",
        color: towerUnderCursor.ownerId === playerId ? gameDesign.color.cyan : 0xffd36d
      };
    }

    if (!isInsideGrid(cursor.grid, state.activeMap)) {
      return { title: "Fora do mapa", detail: "mova o cursor para dentro do grid", color: gameDesign.color.danger };
    }

    if (isGridOnPath(cursor.grid, state.activeMap)) {
      return { title: "Rota bloqueada", detail: "construa em um bloco livre ao lado", color: gameDesign.color.danger };
    }

    if (availableCredits < cost) {
      return {
        title: `Faltam ${cost - availableCredits} creditos`,
        detail: `${tower.shortName} custa ${cost}; voce tem ${availableCredits}`,
        color: 0xffd36d
      };
    }

    if (tower.effect === "income") {
      return {
        title: "Renda controlada",
        detail: `${tower.shortName} gera creditos em combate. So 4 torres de renda contam por jogador.`,
        color: gameDesign.color.success
      };
    }

    return { title: "Pronto para construir", detail: `${tower.shortName} disponivel neste bloco`, color: gameDesign.color.success };
  }

  private getWaveStatus(state: GameState): string {
    if (state.phase === "paused") {
      return "Pausado";
    }

    if (state.phase === "reward-selection") {
      return "Recompensa";
    }

    if (state.phase === "victory") {
      return "Vitoria";
    }

    if (state.phase === "defeat") {
      return "Base perdida";
    }

    if (state.wave.active) {
      return "Combate";
    }

    const playerIds = getPlayablePlayerIds(state);
    const readyPlayerIds = playerIds.filter((playerId) => state.wave.readyPlayers[playerId]);

    if (playerIds.length > 0 && readyPlayerIds.length === playerIds.length) {
      return `Entrando em ${(state.wave.nextWaveInMs / 1000).toFixed(1)}s`;
    }

    const missing = playerIds
      .filter((playerId) => !state.wave.readyPlayers[playerId])
      .slice(0, 4)
      .map(getPlayerLabel);

    return missing.length > 0
      ? `Auto em ${(state.wave.nextWaveInMs / 1000).toFixed(0)}s · falta ${missing.join("+")}`
      : `Auto em ${(state.wave.nextWaveInMs / 1000).toFixed(0)}s`;
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

  private drawBranchIcon(branchId: string, x: number, y: number, color: number): void {
    this.graphics.lineStyle(2, color, 0.9);
    this.graphics.fillStyle(color, 0.16);

    if (branchId === "focus") {
      this.graphics.strokeCircle(x, y, 11);
      this.graphics.lineBetween(x - 12, y, x + 12, y);
      this.graphics.lineBetween(x, y - 12, x, y + 12);
      return;
    }

    if (branchId === "reach") {
      this.graphics.strokeCircle(x, y, 14);
      this.graphics.strokeCircle(x, y, 6);
      return;
    }

    if (branchId === "tempo") {
      this.graphics.strokeCircle(x, y, 12);
      this.graphics.lineBetween(x, y, x + 8, y - 6);
      this.graphics.lineBetween(x, y, x - 4, y + 8);
      return;
    }

    if (branchId === "rupture") {
      this.graphics.strokeTriangle(x, y - 13, x - 12, y + 9, x + 12, y + 9);
      this.graphics.fillCircle(x, y + 2, 3);
      return;
    }

    this.graphics.lineBetween(x - 13, y + 8, x - 4, y - 8);
    this.graphics.lineBetween(x - 4, y - 8, x + 4, y + 8);
    this.graphics.lineBetween(x + 4, y + 8, x + 13, y - 8);
  }

  private drawRankDots(x: number, y: number, rank: number, maxRank: number, color: number): void {
    for (let index = 0; index < maxRank; index += 1) {
      this.graphics.fillStyle(index < rank ? color : 0x132231, index < rank ? 0.92 : 0.9);
      this.graphics.fillCircle(x + index * 12, y, 4);
      this.graphics.lineStyle(1, color, index < rank ? 0.78 : 0.26);
      this.graphics.strokeCircle(x + index * 12, y, 4);
    }
  }

  private drawSmallIcon(icon: GameUiIconId | string, x: number, y: number, color: number): void {
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

    if (icon === "range") {
      this.graphics.strokeCircle(x, y, 8);
      this.graphics.fillCircle(x, y, 2);
      return;
    }

    if (icon === "cooldown") {
      this.graphics.strokeCircle(x, y, 7);
      this.graphics.lineBetween(x, y, x, y - 6);
      this.graphics.lineBetween(x, y, x + 5, y + 3);
      return;
    }

    if (icon === "credits") {
      this.graphics.strokeCircle(x, y, 7);
      this.graphics.lineBetween(x - 4, y, x + 4, y);
      this.graphics.lineBetween(x, y - 4, x, y + 4);
      return;
    }

    if (icon === "core") {
      this.graphics.strokeCircle(x, y, 8);
      this.graphics.fillCircle(x, y, 4);
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

    if (icon === "spawn") {
      this.graphics.strokeRoundedRect(x - 7, y - 7, 14, 14, 3);
      this.graphics.lineBetween(x - 3, y, x + 5, y);
      this.graphics.fillTriangle(x + 5, y, x + 1, y - 4, x + 1, y + 4);
      return;
    }

    if (icon === "ready") {
      this.graphics.strokeCircle(x, y, 8);
      this.graphics.lineBetween(x - 4, y, x - 1, y + 4);
      this.graphics.lineBetween(x - 1, y + 4, x + 6, y - 5);
      return;
    }

    if (icon === "pause") {
      this.graphics.lineBetween(x - 4, y - 8, x - 4, y + 8);
      this.graphics.lineBetween(x + 4, y - 8, x + 4, y + 8);
      return;
    }

    if (icon === "restart") {
      this.graphics.beginPath();
      this.graphics.arc(x, y, 8, Math.PI * 0.2, Math.PI * 1.7);
      this.graphics.strokePath();
      this.graphics.fillTriangle(x - 8, y - 4, x - 2, y - 8, x - 2, y - 1);
      return;
    }

    if (icon === "sound") {
      this.graphics.strokeRect(x - 8, y - 4, 5, 8);
      this.graphics.lineBetween(x - 3, y - 4, x + 3, y - 8);
      this.graphics.lineBetween(x - 3, y + 4, x + 3, y + 8);
      this.graphics.beginPath();
      this.graphics.arc(x + 4, y, 6, -0.7, 0.7);
      this.graphics.strokePath();
      return;
    }

    if (icon === "motion") {
      this.graphics.lineBetween(x - 8, y + 5, x - 2, y - 5);
      this.graphics.lineBetween(x - 2, y - 5, x + 4, y + 5);
      this.graphics.lineBetween(x + 4, y + 5, x + 8, y - 2);
      return;
    }

    if (icon === "reward") {
      this.graphics.strokeTriangle(x, y - 9, x - 8, y + 6, x + 8, y + 6);
      this.graphics.fillCircle(x, y + 1, 3);
      return;
    }

    this.graphics.fillCircle(x, y, 5);
  }

  private panel(x: number, y: number, width: number, height: number, color: number, alpha: number): void {
    this.graphics.fillStyle(gameDesign.color.inkStrong, Math.min(0.96, alpha + 0.04));
    this.graphics.fillRoundedRect(x, y, width, height, gameDesign.radius.panel);
    this.graphics.fillStyle(color, 0.045);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, height - 4, Math.max(4, gameDesign.radius.panel - 2));
    this.graphics.lineStyle(1, color, 0.34);
    this.graphics.strokeRoundedRect(x, y, width, height, gameDesign.radius.panel);
  }

  private registerButton(x: number, y: number, width: number, height: number, onClick: () => void, enabled = true): void {
    this.buttons.push({ x, y, width, height, onClick, enabled });
  }

  private textRole(
    x: number,
    y: number,
    value: string,
    role: GameUiTextRole,
    color: string,
    originX = 0,
    wrapWidth?: number
  ): Phaser.GameObjects.Text {
    const style = gameText[role];

    return this.text(x, y, value, style.size, color, style.weight, originX, wrapWidth);
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

  private shorten(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
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
