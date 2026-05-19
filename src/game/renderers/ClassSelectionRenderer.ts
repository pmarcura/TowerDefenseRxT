import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { playerClassDefinitions } from "../data/playerClasses";
import { getTowerDefinitionsForClass } from "../data/towers";
import { GameRegistry } from "../GameRegistry";
import type { GameState, PlayerClassDefinition, PlayerId } from "../models/types";
import type { ClassSelectionSystem } from "../systems/ClassSelectionSystem";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const playerPanels: Record<PlayerId, Rect> = {
  p1: { x: 38, y: 74, width: 570, height: 608 },
  p2: { x: 672, y: 74, width: 570, height: 608 }
};

const soloRects = {
  list: { x: 54, y: 128, width: 372, height: 498 },
  hero: { x: 456, y: 128, width: 514, height: 498 },
  partner: { x: 998, y: 128, width: 226, height: 498 },
  confirm: { x: 456, y: 642, width: 312, height: 42 }
} satisfies Record<string, Rect>;

const playerLabels: Record<PlayerId, string> = {
  p1: "P1",
  p2: "P2"
};

export class ClassSelectionRenderer {
  private readonly registry = GameRegistry.getInstance();
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private usedTexts = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly classSelectionSystem: ClassSelectionSystem
  ) {
    this.graphics = scene.add.graphics().setDepth(60);
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
  }

  render(state: GameState): void {
    this.graphics.clear();
    this.usedTexts = 0;

    if (state.phase !== "class-selection" || !state.classSelection) {
      this.hideUnusedText();
      return;
    }

    this.drawBackdrop(state.elapsedMs);
    this.drawTitle();
    if (state.sessionMode === "solo-ai") {
      this.drawSoloSelection(state);
      this.hideUnusedText();
      return;
    }

    this.drawPlayerPanel(state, "p1");
    this.drawPlayerPanel(state, "p2");
    this.hideUnusedText();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const state = this.registry.state;

    if (state.phase !== "class-selection" || !state.classSelection) {
      return;
    }

    if (state.sessionMode === "solo-ai") {
      const choice = state.classSelection.choices.p1;

      if (!choice.confirmed && this.contains(soloRects.confirm, pointer.x, pointer.y)) {
        this.classSelectionSystem.confirmClass("p1");
        return;
      }

      for (let index = 0; index < playerClassDefinitions.length; index += 1) {
        const bounds = this.getSoloClassCardBounds(index);

        if (this.contains(bounds, pointer.x, pointer.y)) {
          this.classSelectionSystem.selectClass("p1", playerClassDefinitions[index].id);
          return;
        }
      }

      return;
    }

    for (const playerId of ["p1", "p2"] as const) {
      const choice = state.classSelection.choices[playerId];

      if (choice.confirmed) {
        continue;
      }

      const confirmBounds = this.getConfirmBounds(playerId);

      if (this.contains(confirmBounds, pointer.x, pointer.y)) {
        this.classSelectionSystem.confirmClass(playerId);
        return;
      }

      for (let index = 0; index < playerClassDefinitions.length; index += 1) {
        const bounds = this.getClassCardBounds(playerId, index);

        if (this.contains(bounds, pointer.x, pointer.y)) {
          this.classSelectionSystem.selectClass(playerId, playerClassDefinitions[index].id);
          return;
        }
      }
    }
  }

  private drawBackdrop(elapsedMs: number): void {
    this.graphics.fillStyle(0x02040a, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let x = 0; x <= GAME_WIDTH; x += 42) {
      this.graphics.lineStyle(1, 0x163040, 0.16);
      this.graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    for (let y = 0; y <= GAME_HEIGHT; y += 42) {
      this.graphics.lineStyle(1, 0x163040, 0.13);
      this.graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    const pulse = 0.5 + Math.sin(elapsedMs / 900) * 0.12;

    this.graphics.lineStyle(1, 0x83f3ff, 0.08 + pulse * 0.05);
    this.graphics.strokeCircle(GAME_WIDTH / 2, 382, 244);
    this.graphics.strokeCircle(GAME_WIDTH / 2, 382, 330);
    this.graphics.lineStyle(2, 0xffe39d, 0.05);
    this.graphics.lineBetween(GAME_WIDTH / 2, 108, GAME_WIDTH / 2, 676);
  }

  private drawTitle(): void {
    this.drawText(GAME_WIDTH / 2, 18, "AEGIS SACRA TD", 12, "#83f3ff", "900", 0.5);
    this.drawText(
      GAME_WIDTH / 2,
      39,
      this.registry.state.sessionMode === "solo-ai"
        ? "Escolha sua tradição guardiã"
        : "Escolha duas tradições guardiãs",
      26,
      "#edf7ff",
      "900",
      0.5
    );
    this.drawText(
      GAME_WIDTH / 2,
      65,
      "Visual inspirado em arquitetura, ritmo, geometria e objetos culturais. Sem figuras sagradas como armas.",
      11,
      "#8ea4b3",
      "700",
      0.5
    );
  }

  private drawSoloSelection(state: GameState): void {
    const selection = state.classSelection?.choices.p1;

    if (!selection) {
      return;
    }

    const selectedClass = playerClassDefinitions[selection.selectedClassIndex];
    const partnerClass = getPlayerClassDefinitionSafe(state.playerClasses.p2);

    this.drawSoloClassList(selection.selectedClassIndex, selection.confirmed);
    this.drawSoloHero(selectedClass, selection.confirmed);
    this.drawSoloPartner(partnerClass);
    this.drawSoloConfirmButton(selectedClass, selection.confirmed);
  }

  private drawSoloClassList(selectedClassIndex: number, confirmed: boolean): void {
    const rect = soloRects.list;

    this.graphics.fillStyle(0x04101a, 0.92);
    this.graphics.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    this.graphics.lineStyle(1, 0x31556a, 0.48);
    this.graphics.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    this.drawText(rect.x + 20, rect.y + 18, "TRADIÇÕES", 11, "#83f3ff", "900");
    this.drawText(rect.x + 20, rect.y + 38, "A/D, Q/E ou clique", 10, "#8ea4b3", "800");

    playerClassDefinitions.forEach((playerClass, index) => {
      const bounds = this.getSoloClassCardBounds(index);
      const selected = index === selectedClassIndex;
      const alpha = confirmed && !selected ? 0.28 : selected ? 1 : 0.74;

      this.graphics.fillStyle(selected ? 0x0b1b27 : 0x07131e, selected ? 0.95 : 0.68);
      this.graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8);
      this.graphics.lineStyle(selected ? 2 : 1, playerClass.accent, selected ? 0.86 : 0.26);
      this.graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8);
      this.graphics.fillStyle(playerClass.accent, selected ? 0.2 : 0.08);
      this.graphics.fillRoundedRect(bounds.x + 2, bounds.y + 2, 58, bounds.height - 4, 7);
      this.drawClassMotif(playerClass, bounds.x + 31, bounds.y + bounds.height / 2, 0.5, alpha);
      this.drawText(bounds.x + 76, bounds.y + 9, playerClass.shortName, 14, "#edf7ff", "900");
      this.drawText(bounds.x + 76, bounds.y + 29, this.getSimpleClassTag(playerClass), 10, this.toHex(playerClass.secondaryAccent), "800", 0, 222);
      this.drawText(bounds.x + bounds.width - 18, bounds.y + 17, `${index + 1}`, 11, selected ? this.toHex(playerClass.accent) : "#617583", "900", 1);
    });
  }

  private drawSoloHero(playerClass: PlayerClassDefinition, confirmed: boolean): void {
    const rect = soloRects.hero;
    const towers = getTowerDefinitionsForClass(playerClass.id);
    const accentHex = this.toHex(playerClass.accent);

    this.graphics.fillStyle(0x04101a, 0.94);
    this.graphics.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    this.graphics.lineStyle(2, playerClass.accent, confirmed ? 0.78 : 0.48);
    this.graphics.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    this.graphics.fillStyle(playerClass.accent, 0.1);
    this.graphics.fillRoundedRect(rect.x + 2, rect.y + 2, rect.width - 4, 92, 8);

    this.graphics.fillStyle(playerClass.accent, 0.14);
    this.graphics.fillCircle(rect.x + 92, rect.y + 100, 62);
    this.drawClassMotif(playerClass, rect.x + 92, rect.y + 100, 1.46, confirmed ? 1 : 0.78);

    this.drawText(rect.x + 178, rect.y + 28, playerClass.shortName.toUpperCase(), 12, accentHex, "900");
    this.drawText(rect.x + 178, rect.y + 52, playerClass.name, 27, "#edf7ff", "900", 0, 300);
    this.drawText(rect.x + 178, rect.y + 96, playerClass.description, 13, "#b9c9d8", "700", 0, 292);

    this.drawSoloStat(rect.x + 34, rect.y + 188, "FUNÇÃO", playerClass.specialty);
    this.drawSoloStat(rect.x + 196, rect.y + 188, "PASSIVA", playerClass.passive);
    this.drawSoloStat(rect.x + 34, rect.y + 252, "TORRES", towers.map((tower) => tower.shortName).join(", "));

    this.drawText(rect.x + 34, rect.y + 330, "COMO JOGA", 11, accentHex, "900");
    this.drawText(rect.x + 34, rect.y + 354, this.getBeginnerAdvice(playerClass), 14, "#edf7ff", "800", 0, rect.width - 68);
    this.drawText(rect.x + 34, rect.y + 434, playerClass.note, 10, "#6f8492", "700", 0, rect.width - 68);
  }

  private drawSoloPartner(playerClass: PlayerClassDefinition): void {
    const rect = soloRects.partner;

    this.graphics.fillStyle(0x04101a, 0.86);
    this.graphics.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    this.graphics.lineStyle(1, 0xffd36d, 0.42);
    this.graphics.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    this.drawText(rect.x + 18, rect.y + 18, "PARCEIRO IA", 11, "#ffd36d", "900");
    this.drawText(rect.x + 18, rect.y + 42, "invisível na partida", 10, "#8ea4b3", "800");

    this.graphics.fillStyle(playerClass.accent, 0.13);
    this.graphics.fillCircle(rect.x + rect.width / 2, rect.y + 126, 54);
    this.drawClassMotif(playerClass, rect.x + rect.width / 2, rect.y + 126, 1.15, 0.84);
    this.drawText(rect.x + 18, rect.y + 204, playerClass.shortName, 19, "#edf7ff", "900", 0, rect.width - 36);
    this.drawText(rect.x + 18, rect.y + 238, playerClass.specialty, 12, this.toHex(playerClass.secondaryAccent), "900", 0, rect.width - 36);
    this.drawText(
      rect.x + 18,
      rect.y + 286,
      "A IA usa a política aprendida, constrói por P2, dá pronto e registra a partida para melhorar o laboratório.",
      12,
      "#b9c9d8",
      "700",
      0,
      rect.width - 36
    );
  }

  private drawSoloConfirmButton(
    playerClass: PlayerClassDefinition,
    confirmed: boolean
  ): void {
    const rect = soloRects.confirm;

    this.graphics.fillStyle(confirmed ? playerClass.accent : 0x07131e, confirmed ? 0.24 : 0.92);
    this.graphics.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 8);
    this.graphics.lineStyle(2, playerClass.accent, confirmed ? 0.82 : 0.54);
    this.graphics.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 8);
    this.drawText(
      rect.x + rect.width / 2,
      rect.y + 12,
      confirmed ? "PRONTO" : `COMEÇAR COM ${playerClass.shortName.toUpperCase()}`,
      14,
      confirmed ? "#b4ff72" : "#edf7ff",
      "900",
      0.5
    );
    this.drawText(rect.x + rect.width + 18, rect.y + 14, "SPACE ou clique", 11, "#8ea4b3", "800");
  }

  private drawPlayerPanel(state: GameState, playerId: PlayerId): void {
    const selection = state.classSelection?.choices[playerId];

    if (!selection) {
      return;
    }

    const panel = playerPanels[playerId];
    const selectedClass = playerClassDefinitions[selection.selectedClassIndex];
    const accent = selectedClass.accent;
    const secondary = selectedClass.secondaryAccent;
    const accentHex = this.toHex(accent);
    const secondaryHex = this.toHex(secondary);

    this.graphics.fillStyle(0x04101a, 0.93);
    this.graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 10);
    this.graphics.lineStyle(2, accent, 0.48);
    this.graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, 10);
    this.graphics.fillStyle(accent, 0.09);
    this.graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, 72, 8);

    this.drawText(panel.x + 22, panel.y + 18, playerLabels[playerId], 11, accentHex, "900");
    this.drawText(
      panel.x + 22,
      panel.y + 38,
      selection.confirmed ? "CLASSE CONFIRMADA" : "ESCOLHENDO CLASSE",
      18,
      "#edf7ff",
      "900"
    );
    this.drawText(
      panel.x + panel.width - 22,
      panel.y + 22,
      playerId === "p1" ? "A/D ou Q/E  ·  SPACE" : "SETAS ou PGUP/PGDN  ·  ENTER",
      10,
      "#8ea4b3",
      "800",
      1
    );

    this.drawSelectedClassHero(panel, selectedClass, selection.confirmed);

    playerClassDefinitions.forEach((playerClass, index) => {
      this.drawClassCard(playerId, panel, playerClass, index, index === selection.selectedClassIndex, selection.confirmed);
    });

    this.drawConfirmButton(playerId, selectedClass, selection.confirmed, accent, secondary);
    this.drawText(
      panel.x + 22,
      panel.y + panel.height - 18,
      selectedClass.note,
      9,
      "#6f8492",
      "600",
      0,
      panel.width - 44
    );
    this.drawText(
      panel.x + panel.width - 22,
      panel.y + panel.height - 44,
      selectedClass.visualMotif.toUpperCase(),
      10,
      secondaryHex,
      "900",
      1
    );
  }

  private drawSelectedClassHero(
    panel: Rect,
    playerClass: PlayerClassDefinition,
    confirmed: boolean
  ): void {
    const x = panel.x + 22;
    const y = panel.y + 88;
    const width = panel.width - 44;
    const height = 148;

    this.graphics.fillStyle(0x071522, 0.84);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(1, playerClass.accent, confirmed ? 0.72 : 0.34);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
    this.graphics.fillStyle(playerClass.accent, confirmed ? 0.14 : 0.08);
    this.graphics.fillCircle(x + 76, y + 74, 54);
    this.drawClassMotif(playerClass, x + 76, y + 74, 1.35, confirmed ? 0.95 : 0.72);

    this.drawText(x + 152, y + 18, playerClass.shortName.toUpperCase(), 12, this.toHex(playerClass.accent), "900");
    this.drawText(x + 152, y + 42, playerClass.name, 24, "#edf7ff", "900");
    this.drawText(x + 152, y + 74, playerClass.description, 12, "#a9bac6", "650", 0, width - 176);
    this.drawText(x + 152, y + 98, playerClass.passive, 10, "#edf7ff", "800", 0, width - 176);
    this.drawText(
      x + 152,
      y + 122,
      `${playerClass.specialty.toUpperCase()}  ·  Torres: ${getTowerDefinitionsForClass(playerClass.id)
        .map((tower) => tower.shortName)
        .join(", ")}`,
      10,
      "#edf7ff",
      "900",
      0,
      width - 176
    );
  }

  private drawClassCard(
    playerId: PlayerId,
    panel: Rect,
    playerClass: PlayerClassDefinition,
    index: number,
    selected: boolean,
    confirmed: boolean
  ): void {
    const bounds = this.getClassCardBounds(playerId, index);
    const alpha = confirmed && !selected ? 0.34 : selected ? 0.98 : 0.72;

    this.graphics.fillStyle(0x081620, selected ? 0.94 : 0.58);
    this.graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 7);
    this.graphics.lineStyle(selected ? 2 : 1, playerClass.accent, selected ? 0.78 : 0.2);
    this.graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 7);
    this.graphics.fillStyle(playerClass.accent, selected ? 0.18 : 0.08);
    this.graphics.fillRoundedRect(bounds.x + 1, bounds.y + 1, 52, bounds.height - 2, 6);
    this.drawClassMotif(playerClass, bounds.x + 27, bounds.y + bounds.height / 2, 0.48, alpha);

    this.drawText(bounds.x + 66, bounds.y + 8, playerClass.shortName, 13, "#edf7ff", "900");
    this.drawText(bounds.x + 66, bounds.y + 26, playerClass.visualMotif, 9, this.toHex(playerClass.secondaryAccent), "800");
    this.drawText(
      panel.x + panel.width - 36,
      bounds.y + 15,
      this.getCardInputLabel(playerId, index),
      10,
      selected ? this.toHex(playerClass.accent) : "#617583",
      "900",
      1
    );
  }

  private drawConfirmButton(
    playerId: PlayerId,
    playerClass: PlayerClassDefinition,
    confirmed: boolean,
    accent: number,
    secondary: number
  ): void {
    const bounds = this.getConfirmBounds(playerId);

    this.graphics.fillStyle(confirmed ? accent : 0x0b1822, confirmed ? 0.24 : 0.86);
    this.graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8);
    this.graphics.lineStyle(2, confirmed ? secondary : accent, confirmed ? 0.68 : 0.44);
    this.graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8);
    this.drawText(
      bounds.x + bounds.width / 2,
      bounds.y + 13,
      confirmed ? "PRONTO" : `CONFIRMAR ${playerClass.shortName}`,
      13,
      confirmed ? this.toHex(secondary) : "#edf7ff",
      "900",
      0.5
    );
  }

  private drawClassMotif(
    playerClass: PlayerClassDefinition,
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    const accent = playerClass.accent;
    const secondary = playerClass.secondaryAccent;
    const radius = 24 * scale;

    this.graphics.lineStyle(2, accent, alpha);
    this.graphics.strokeCircle(x, y, radius);
    this.graphics.lineStyle(2, secondary, alpha * 0.82);

    if (playerClass.pattern === "vitrail") {
      this.graphics.lineBetween(x - radius, y, x + radius, y);
      this.graphics.lineBetween(x, y - radius, x, y + radius);
      this.graphics.lineBetween(x - radius * 0.7, y - radius * 0.7, x + radius * 0.7, y + radius * 0.7);
      this.graphics.lineBetween(x + radius * 0.7, y - radius * 0.7, x - radius * 0.7, y + radius * 0.7);
      return;
    }

    if (playerClass.pattern === "gira") {
      for (let index = 0; index < 10; index += 1) {
        const angle = index * (Math.PI / 5);
        this.graphics.fillStyle(index % 2 === 0 ? accent : secondary, alpha);
        this.graphics.fillCircle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 3.2 * scale);
      }

      return;
    }

    if (playerClass.pattern === "zellige") {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.lineBetween(x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      }

      this.graphics.strokeRect(x - radius * 0.46, y - radius * 0.46, radius * 0.92, radius * 0.92);
      return;
    }

    if (playerClass.pattern === "lotus") {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.strokeEllipse(
          x + Math.cos(angle) * radius * 0.48,
          y + Math.sin(angle) * radius * 0.48,
          9 * scale,
          20 * scale
        );
      }

      return;
    }

    if (playerClass.pattern === "wheel") {
      this.graphics.strokeCircle(x, y, radius * 0.62);

      for (let index = 0; index < 8; index += 1) {
        const angle = index * (Math.PI / 4);
        this.graphics.lineBetween(x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      }

      return;
    }

    if (playerClass.pattern === "torii") {
      this.graphics.lineStyle(4 * scale, accent, alpha);
      this.graphics.lineBetween(x - radius, y - radius * 0.52, x + radius, y - radius * 0.52);
      this.graphics.lineStyle(2 * scale, secondary, alpha);
      this.graphics.lineBetween(x - radius * 0.72, y - radius * 0.18, x + radius * 0.72, y - radius * 0.18);
      this.graphics.lineBetween(x - radius * 0.48, y - radius * 0.16, x - radius * 0.48, y + radius * 0.72);
      this.graphics.lineBetween(x + radius * 0.48, y - radius * 0.16, x + radius * 0.48, y + radius * 0.72);
      return;
    }

    for (let index = 0; index < 12; index += 1) {
      const angle = index * (Math.PI / 6);

      this.graphics.fillStyle(index % 2 === 0 ? accent : secondary, alpha);
      this.graphics.fillCircle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2.7 * scale);
    }

    this.graphics.strokeCircle(x, y, radius * 0.42);
  }

  private getClassCardBounds(playerId: PlayerId, index: number): Rect {
    const panel = playerPanels[playerId];
    const x = panel.x + 22;
    const y = panel.y + 252 + index * 45;

    return {
      x,
      y,
      width: panel.width - 44,
      height: 38
    };
  }

  private getSoloClassCardBounds(index: number): Rect {
    const rect = soloRects.list;

    return {
      x: rect.x + 18,
      y: rect.y + 78 + index * 58,
      width: rect.width - 36,
      height: 48
    };
  }

  private getConfirmBounds(playerId: PlayerId): Rect {
    const panel = playerPanels[playerId];

    return {
      x: panel.x + 22,
      y: panel.y + 574,
      width: 244,
      height: 38
    };
  }

  private getCardInputLabel(playerId: PlayerId, index: number): string {
    if (playerId === "p1") {
      return `${index + 1}`;
    }

    return "";
  }

  private contains(rect: Rect, x: number, y: number): boolean {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
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
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: `${fontSize}px`,
      fontStyle,
      color,
      lineSpacing: 2,
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined
    });
    text.setOrigin(originX, 0);
    text.setAlpha(1);
    text.setVisible(true);

    return text;
  }

  private getText(): Phaser.GameObjects.Text {
    let text = this.texts[this.usedTexts];

    if (!text) {
      text = this.scene.add.text(0, 0, "", {}).setDepth(61);
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
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  private formatSigned(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  private formatPercent(multiplier: number): string {
    const percent = Math.round((multiplier - 1) * 100);

    if (percent === 0) {
      return "0%";
    }

    return percent > 0 ? `+${percent}%` : `${percent}%`;
  }

  private drawSoloStat(
    x: number,
    y: number,
    label: string,
    value: string
  ): void {
    const width = label === "TORRES" ? 446 : label === "PASSIVA" ? 284 : 142;

    this.graphics.fillStyle(0x07131e, 0.68);
    this.graphics.fillRoundedRect(x, y, width, 46, 7);
    this.graphics.lineStyle(1, 0x31556a, 0.28);
    this.graphics.strokeRoundedRect(x, y, width, 46, 7);
    this.drawText(x + 12, y + 8, label, 9, "#8ea4b3", "900");
    this.drawText(x + 12, y + 24, value, 10, "#edf7ff", "850", 0, width - 24);
  }

  private getSimpleClassTag(playerClass: PlayerClassDefinition): string {
    if (playerClass.rewardMultiplier > 1.05 || playerClass.costMultiplier < 0.96) {
      return "economia e crescimento";
    }

    if (playerClass.damageMultiplier > 1.04) {
      return "dano alto";
    }

    if (playerClass.rangeBonus >= 8) {
      return "alcance e controle";
    }

    return playerClass.visualMotif;
  }

  private getBeginnerAdvice(playerClass: PlayerClassDefinition): string {
    if (playerClass.rewardMultiplier > 1.05 || playerClass.costMultiplier < 0.96) {
      return "Abra com uma torre de renda se a rota estiver segura. Depois use o dinheiro extra para cobrir curvas e boss.";
    }

    if (playerClass.damageMultiplier > 1.04) {
      return "Gaste cedo em torres de ataque. Posicione perto do fim da rota para repetir dano no mesmo inimigo.";
    }

    if (playerClass.rangeBonus >= 8) {
      return "Priorize posições que enxergam duas partes da rota. Alcance alto vale mais quando cobre curvas.";
    }

    return "Comece com dano simples, depois misture controle e área. Evite juntar tudo em um ponto só.";
  }
}

const getPlayerClassDefinitionSafe = (classId: string): PlayerClassDefinition =>
  playerClassDefinitions.find((definition) => definition.id === classId) ?? playerClassDefinitions[0];
