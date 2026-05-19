import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { GameRegistry } from "../GameRegistry";
import type { GameSessionMode } from "../models/types";
import { AmbientParticleRenderer } from "../renderers/AmbientParticleRenderer";

type MenuOption = {
  label: string;
  detail: string;
  mode: GameSessionMode;
  enabled: boolean;
};

const menuOptions: readonly MenuOption[] = [
  {
    label: "Solo + IA",
    detail: "voce joga P1, a IA assume P2 e aprende com a run",
    mode: "solo-ai",
    enabled: true
  },
  {
    label: "Co-op Local",
    detail: "duas pessoas no mesmo teclado",
    mode: "local-coop",
    enabled: true
  },
  {
    label: "Lobby Online",
    detail: "estrutura preparada para 2-12 jogadores",
    mode: "online-lobby-preview",
    enabled: false
  }
];

export class MainMenuScene extends Phaser.Scene {
  private ambient!: AmbientParticleRenderer;
  private confirmKeys: Phaser.Input.Keyboard.Key[] = [];
  private upKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private menuGraphics!: Phaser.GameObjects.Graphics;
  private readonly optionTexts: Phaser.GameObjects.Text[] = [];
  private readonly optionDetailTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;

  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    GameRegistry.getInstance().resetForMenu();
    this.scene.stop("UIScene");

    this.ambient = new AmbientParticleRenderer(this);
    this.drawBackdrop();
    this.createTexts();
    this.createStartInput();
    this.input.on("pointerdown", this.handlePointerDown, this);
  }

  update(_time: number, delta: number): void {
    this.ambient.update(delta);
    this.ambient.render();

    this.titleText.setY(166 + Math.sin(this.time.now / 840) * 4);

    if (this.upKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.moveSelection(-1);
    }

    if (this.downKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.moveSelection(1);
    }

    if (this.confirmKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.confirmSelection();
    }

    this.renderOptions();
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    this.menuGraphics = this.add.graphics().setDepth(3);

    graphics.fillStyle(0x02040a, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    graphics.fillStyle(0x071827, 0.92);
    graphics.fillRoundedRect(176, 92, 928, 536, 8);
    graphics.lineStyle(2, 0x42d8ff, 0.22);
    graphics.strokeRoundedRect(176, 92, 928, 536, 8);

    graphics.lineStyle(1, 0xffd98a, 0.26);
    graphics.strokeCircle(GAME_WIDTH / 2, 356, 226);
    graphics.strokeCircle(GAME_WIDTH / 2, 356, 276);

    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      const inner = 114;
      const outer = 276;

      graphics.lineBetween(
        GAME_WIDTH / 2 + Math.cos(angle) * inner,
        356 + Math.sin(angle) * inner,
        GAME_WIDTH / 2 + Math.cos(angle) * outer,
        356 + Math.sin(angle) * outer
      );
    }
  }

  private createTexts(): void {
    this.add
      .text(GAME_WIDTH / 2, 106, "Aegis Sacra", {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#f8e5aa"
      })
      .setOrigin(0.5);

    this.titleText = this.add
      .text(GAME_WIDTH / 2, 166, "Tower Defense Co-op", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "50px",
        color: "#eaf8ff",
        align: "center"
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 486, "Pressione Space ou Enter", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "15px",
        color: "#9de8ff"
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 526, "W/S ou setas escolhem  ·  Enter confirma  ·  Mouse funciona nos menus", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "13px",
        color: "#b9c9d8"
      })
      .setOrigin(0.5);

    menuOptions.forEach((_option, index) => {
      const text = this.add
        .text(0, 0, "", {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "18px",
          fontStyle: "900",
          color: "#edf7ff"
        })
        .setDepth(4);
      this.optionTexts[index] = text;
      const detailText = this.add
        .text(0, 0, "", {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "12px",
          fontStyle: "800",
          color: "#8ea4b3"
        })
        .setDepth(4);
      this.optionDetailTexts[index] = detailText;
    });
    this.renderOptions();
  }

  private createStartInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.confirmKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    ];
    this.upKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    ];
    this.downKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    ];
  }

  private renderOptions(): void {
    this.menuGraphics.clear();

    menuOptions.forEach((option, index) => {
      const selected = index === this.selectedIndex;
      const x = GAME_WIDTH / 2 - 220;
      const y = 278 + index * 66;
      const width = 440;
      const height = 52;
      const accent = option.mode === "solo-ai" ? 0x83f3ff : option.mode === "local-coop" ? 0xffd36d : 0x8ea4b3;
      const alpha = option.enabled ? 1 : 0.42;

      this.menuGraphics.fillStyle(selected ? 0x0b1b27 : 0x04101a, selected ? 0.96 : 0.74);
      this.menuGraphics.fillRoundedRect(x, y, width, height, 8);
      this.menuGraphics.lineStyle(selected ? 2 : 1, accent, selected ? 0.86 : 0.28);
      this.menuGraphics.strokeRoundedRect(x, y, width, height, 8);
      this.menuGraphics.fillStyle(accent, selected ? 0.16 : 0.06);
      this.menuGraphics.fillRoundedRect(x + 2, y + 2, 74, height - 4, 7);

      const text = this.optionTexts[index];
      text.setText(option.label);
      text.setPosition(x + 96, y + 7);
      text.setStyle({
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "18px",
        fontStyle: "900",
        color: selected ? "#edf7ff" : "#b9c9d8"
      });
      text.setAlpha(alpha);

      const detailText = this.optionDetailTexts[index];
      detailText.setText(option.detail);
      detailText.setPosition(x + 96, y + 31);
      detailText.setStyle({
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "800",
        color: selected ? "#a9bac6" : "#6f8492",
        wordWrap: { width: 314 }
      });
      detailText.setAlpha(alpha);

      this.addOptionGlyph(x + 39, y + height / 2, accent, selected ? 0.9 : 0.54);
    });
  }

  private addOptionGlyph(x: number, y: number, color: number, alpha: number): void {
    this.menuGraphics.lineStyle(2, color, alpha);
    this.menuGraphics.strokeCircle(x, y, 14);
    this.menuGraphics.lineBetween(x - 14, y, x + 14, y);
    this.menuGraphics.lineBetween(x, y - 14, x, y + 14);
  }

  private moveSelection(direction: -1 | 1): void {
    this.selectedIndex =
      (this.selectedIndex + direction + menuOptions.length) % menuOptions.length;
  }

  private confirmSelection(): void {
    const option = menuOptions[this.selectedIndex];

    if (!option.enabled) {
      GameRegistry.getInstance().pushPresentationEvent("audio", 500, { cueId: "ui_error" });
      return;
    }

    GameRegistry.getInstance().setNextSessionMode(option.mode);
    this.scene.start("GameScene", { sessionMode: option.mode });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    for (let index = 0; index < menuOptions.length; index += 1) {
      const x = GAME_WIDTH / 2 - 220;
      const y = 278 + index * 66;

      if (pointer.x >= x && pointer.x <= x + 440 && pointer.y >= y && pointer.y <= y + 52) {
        this.selectedIndex = index;
        this.confirmSelection();
        return;
      }
    }
  }
}
