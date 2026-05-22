import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { getEnemyDefinition } from "../data/enemies";
import { getWaveDefinition } from "../data/waves";
import { gameDesign } from "../design/gameDesignSystem";
import { GameRegistry } from "../GameRegistry";
import type { GamePhase, GameState, RoundNoticeTone } from "../models/types";
import { PhaserHudRenderer } from "../renderers/PhaserHudRenderer";

const roundToneColors: Record<RoundNoticeTone, string> = {
  start: "#d9f8ff",
  complete: "#ffe39d",
  boss: "#ff8db4",
  danger: "#ff6d8b"
};

export class UIScene extends Phaser.Scene {
  private readonly gameRegistry = GameRegistry.getInstance();
  private graphics!: Phaser.GameObjects.Graphics;
  private forecastTitleText!: Phaser.GameObjects.Text;
  private forecastBodyText!: Phaser.GameObjects.Text;
  private threatText!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private noticeTitleText!: Phaser.GameObjects.Text;
  private noticeSubtitleText!: Phaser.GameObjects.Text;
  private startBannerTitleText!: Phaser.GameObjects.Text;
  private startBannerBodyText!: Phaser.GameObjects.Text;
  private hudRenderer!: PhaserHudRenderer;
  private entranceFlash!: Phaser.GameObjects.Rectangle;
  private prevPhase: GamePhase | null = null;
  private waveCompleteFlashMs = 0;
  private bossKillFlashMs = 0;
  private prevNoticeTitle: string | null = null;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.forecastTitleText = this.createText(GAME_WIDTH / 2, 612, 12, "#83f3ff", "800").setOrigin(0.5);
    this.forecastBodyText = this.createText(GAME_WIDTH / 2, 634, 11, "#b8cad6", "700", 520).setOrigin(0.5);
    this.threatText = this.createText(GAME_WIDTH / 2, 656, 11, "#ff8db4", "800").setOrigin(0.5);
    this.feedText = this.createText(GAME_WIDTH / 2, 578, 11, "#d9f4ff", "600", 640).setOrigin(0.5);
    this.resultText = this.createText(GAME_WIDTH / 2, 354, 44, "#ffffff", "700").setOrigin(0.5);
    this.noticeTitleText = this.createText(GAME_WIDTH / 2, 86, 30, "#edf7ff", "700").setOrigin(0.5);
    this.noticeSubtitleText = this.createText(GAME_WIDTH / 2, 120, 13, "#aabac6", "600", 620).setOrigin(0.5);
    this.startBannerTitleText = this.createText(GAME_WIDTH / 2, 82, 20, "#ffe39d", "900").setOrigin(0.5, 0);
    this.startBannerBodyText = this.createText(GAME_WIDTH / 2, 108, 10, "#edf7ff", "800", 360).setOrigin(0.5, 0);
    this.hudRenderer = new PhaserHudRenderer(this);
    this.entranceFlash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setOrigin(0)
      .setDepth(90);
  }

  update(_time: number, delta: number): void {
    const state = this.gameRegistry.state;

    this.trackPhaseTransition(state.phase);
    this.trackWaveNotice(state, delta);

    this.graphics.clear();
    this.drawBaseHitFlash(state);
    this.drawWaveFlash();
    this.drawWaveForecast(state);
    this.drawWaveStartBanner(state);
    this.updateRoundNotice(state);
    this.feedText.setPosition(GAME_WIDTH / 2, this.getFeedY(state));
    this.feedText.setText(state.messages.map((message) => message.text).join("   "));
    this.updateResultText(state);
    this.hudRenderer.render(state);
  }

  private trackPhaseTransition(phase: GamePhase): void {
    if (this.prevPhase === phase) {
      return;
    }

    const overlayPhases: GamePhase[] = ["paused", "reward-selection", "victory", "defeat"];

    if (overlayPhases.includes(phase)) {
      this.entranceFlash.setAlpha(0.38);
      this.tweens.add({
        targets: this.entranceFlash,
        alpha: 0,
        duration: 220,
        ease: "Quad.easeOut"
      });
    }

    this.prevPhase = phase;
  }

  private trackWaveNotice(state: GameState, delta: number): void {
    const notice = state.wave.notice;

    if (notice && notice.title !== this.prevNoticeTitle) {
      if (notice.tone === "complete") {
        this.waveCompleteFlashMs = 700;
      } else if (notice.tone === "boss") {
        this.bossKillFlashMs = 900;
      }
    }

    this.prevNoticeTitle = notice ? notice.title : null;
    this.waveCompleteFlashMs = Math.max(0, this.waveCompleteFlashMs - delta);
    this.bossKillFlashMs = Math.max(0, this.bossKillFlashMs - delta);
  }

  private drawWaveFlash(): void {
    if (this.waveCompleteFlashMs > 0) {
      const t = Phaser.Math.Clamp(this.waveCompleteFlashMs / 700, 0, 1);
      const alpha = t * (1 - t) * 4 * 0.55;

      this.graphics.lineStyle(6, 0xb4ff72, alpha);
      this.graphics.strokeRect(3, 3, GAME_WIDTH - 6, GAME_HEIGHT - 6);
      this.graphics.fillStyle(0x4ade80, alpha * 0.12);
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (this.bossKillFlashMs > 0) {
      const t = Phaser.Math.Clamp(this.bossKillFlashMs / 900, 0, 1);
      const alpha = t * (1 - t) * 4 * 0.6;

      this.graphics.lineStyle(6, 0xff8db4, alpha);
      this.graphics.strokeRect(3, 3, GAME_WIDTH - 6, GAME_HEIGHT - 6);
      this.graphics.fillStyle(0xff4f9a, alpha * 0.1);
      this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  private createText(
    x: number,
    y: number,
    fontSize: number,
    color: string,
    fontStyle = "400",
    wrapWidth?: number
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, "", {
      fontFamily: gameDesign.font.family,
      fontSize: `${fontSize}px`,
      fontStyle,
      color,
      lineSpacing: 2,
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined
    });
  }

  private drawBaseHitFlash(state: GameState): void {
    if (state.baseHitFlashMs <= 0) {
      return;
    }

    const flash = Phaser.Math.Clamp(state.baseHitFlashMs / 640, 0, 1);

    this.graphics.lineStyle(4, 0xff4f9a, 0.68 * flash);
    this.graphics.strokeRect(4, 4, GAME_WIDTH - 8, GAME_HEIGHT - 8);
    this.graphics.fillStyle(0xff174f, 0.045 * flash);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private drawWaveForecast(state: GameState): void {
    if (
      state.phase === "class-selection" ||
      state.phase === "paused" ||
      state.phase === "reward-selection" ||
      state.phase === "victory" ||
      state.phase === "defeat" ||
      state.phase === "menu"
    ) {
      this.forecastTitleText.setText("");
      this.forecastBodyText.setText("");
      this.threatText.setText("");
      return;
    }

    const forecast = this.getWaveForecast(state);
    const accent = forecast.isBoss ? 0xff4f9a : 0x83f3ff;
    const aliveEnemies = state.enemies.filter((enemy) => enemy.alive).length;

    if (state.wave.active) {
      this.graphics.fillStyle(0x020712, 0.72);
      this.graphics.fillRoundedRect(500, 64, 280, 30, 6);
      this.graphics.lineStyle(1, accent, forecast.isBoss ? 0.58 : 0.28);
      this.graphics.strokeRoundedRect(500, 64, 280, 30, 6);
      this.forecastTitleText.setPosition(GAME_WIDTH / 2, 72);
      this.forecastTitleText.setText(
        `${forecast.isBoss ? "BOSS" : "AMEACA"} ${forecast.threat} | VIVOS ${aliveEnemies} | ROTAS ${forecast.routes}`
      );
      this.forecastTitleText.setColor(forecast.isBoss ? "#ff8db4" : "#83f3ff");
      this.forecastBodyText.setText("");
      this.threatText.setText("");
      return;
    }

    this.forecastTitleText.setPosition(GAME_WIDTH / 2, 612);
    this.graphics.fillStyle(0x020712, 0.82);
    this.graphics.fillRoundedRect(382, 600, 516, 72, 8);
    this.graphics.lineStyle(1, accent, forecast.isBoss ? 0.5 : 0.24);
    this.graphics.strokeRoundedRect(382, 600, 516, 72, 8);
    this.graphics.fillStyle(0x132231, 0.96);
    this.graphics.fillRoundedRect(470, 662, 340, 5, 3);
    this.graphics.fillStyle(accent, 0.92);
    this.graphics.fillRoundedRect(470, 662, 340 * Phaser.Math.Clamp(forecast.threat / 90, 0.08, 1), 5, 3);
    this.forecastTitleText.setText(forecast.title);
    this.forecastTitleText.setColor(forecast.isBoss ? "#ff8db4" : "#83f3ff");
    this.forecastBodyText.setText(forecast.body);
    this.threatText.setText(`AMEACA ${forecast.threat}  |  ROTAS ${forecast.routes}  |  VIVOS ${aliveEnemies}`);
  }

  private drawWaveStartBanner(state: GameState): void {
    void state;
    this.startBannerTitleText.setText("");
    this.startBannerBodyText.setText("");
  }

  private getWaveForecast(state: GameState) {
    const wave = getWaveDefinition(state.wave.currentWaveIndex);

    const counts = new Map<string, number>();
    const routes = new Set<number>();
    let rawThreat = 0;

    for (const group of wave.groups) {
      const enemy = getEnemyDefinition(group.enemyTypeId);
      counts.set(enemy.id, (counts.get(enemy.id) ?? 0) + group.count);
      routes.add(group.pathIndex ?? 0);
      rawThreat += group.count * (enemy.baseDamage * 2 + enemy.armor + enemy.maxHp / 90);

      if (enemy.traits.includes("boss")) {
        rawThreat += 36;
      }
    }

    const body = [...counts.entries()]
      .map(([enemyId, count]) => `${getEnemyDefinition(enemyId).name} x${count}`)
      .join("  |  ");

    const titlePrefix =
      state.phase === "class-selection"
        ? "APOS CLASSES"
        : `PROXIMA EM ${Math.ceil(state.wave.nextWaveInMs / 1000)}S`;

    return {
      title: `${titlePrefix}: ${wave.name}`,
      body,
      threat: Math.min(99, Math.max(1, Math.round(rawThreat))),
      routes: routes.size,
      isBoss: Boolean(wave.isBoss)
    };
  }

  private updateRoundNotice(state: GameState): void {
    const notice = state.wave.notice;

    if (!notice || this.isStartCountdownVisible(state)) {
      this.noticeTitleText.setText("");
      this.noticeSubtitleText.setText("");
      return;
    }

    const fadeAlpha = Phaser.Math.Clamp(notice.timerMs / 420, 0, 1);
    const color = roundToneColors[notice.tone];
    const colorHex = Number.parseInt(color.replace("#", "0x"), 16);
    const isBossNotice = notice.tone === "boss";

    if (isBossNotice) {
      const panelW = 620;
      const panelX = (GAME_WIDTH - panelW) / 2;
      const panelY = 66;
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 160);

      this.graphics.fillStyle(0x0d0208, 0.88 * fadeAlpha);
      this.graphics.fillRoundedRect(panelX, panelY, panelW, 76, 10);
      this.graphics.lineStyle(3, colorHex, 0.72 * fadeAlpha);
      this.graphics.strokeRoundedRect(panelX, panelY, panelW, 76, 10);
      this.graphics.lineStyle(1, colorHex, 0.18 * fadeAlpha * pulse);
      this.graphics.strokeRoundedRect(panelX - 10, panelY - 6, panelW + 20, 88, 12);
      this.graphics.lineStyle(2, colorHex, 0.12 * fadeAlpha);
      this.graphics.lineBetween(panelX + 20, panelY + 38, panelX + panelW - 20, panelY + 38);

      this.noticeTitleText.setFontSize(28);
      this.noticeTitleText.setPosition(GAME_WIDTH / 2, panelY + 14);
      this.noticeSubtitleText.setPosition(GAME_WIDTH / 2, panelY + 50);
    } else {
      this.graphics.fillStyle(0x020712, 0.74 * fadeAlpha);
      this.graphics.fillRoundedRect(442, 76, 396, 54, 8);
      this.graphics.lineStyle(2, colorHex, 0.55 * fadeAlpha);
      this.graphics.strokeRoundedRect(442, 76, 396, 54, 8);
      this.noticeTitleText.setFontSize(22);
      this.noticeTitleText.setPosition(GAME_WIDTH / 2, 84);
      this.noticeSubtitleText.setPosition(GAME_WIDTH / 2, 112);
    }

    this.noticeTitleText.setText(notice.title.toUpperCase());
    this.noticeTitleText.setColor(color);
    this.noticeTitleText.setAlpha(fadeAlpha);
    this.noticeSubtitleText.setText(notice.subtitle);
    this.noticeSubtitleText.setAlpha(fadeAlpha);
  }

  private updateResultText(state: GameState): void {
    if (state.phase === "victory") {
      this.resultText.setText("VITORIA");
      return;
    }

    if (state.phase === "defeat") {
      this.resultText.setText("BASE PERDIDA");
      return;
    }

    this.resultText.setText("");
  }

  private isStartCountdownVisible(state: GameState): boolean {
    return (
      state.phase === "playing" &&
      !state.wave.active &&
      !state.wave.completed &&
      state.wave.nextWaveInMs > 0
    );
  }

  private getFeedY(state: GameState): number {
    if (state.phase === "playing" && state.sessionMode === "solo-ai") {
      return GAME_HEIGHT - gameDesign.hud.quickbarHeight - 20;
    }

    return 578;
  }

}
