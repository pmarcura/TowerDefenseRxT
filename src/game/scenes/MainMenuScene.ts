import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { GameRegistry } from "../GameRegistry";
import { AmbientParticleRenderer } from "../renderers/AmbientParticleRenderer";

export class MainMenuScene extends Phaser.Scene {
  private ambient!: AmbientParticleRenderer;
  private startKeys: Phaser.Input.Keyboard.Key[] = [];
  private titleText!: Phaser.GameObjects.Text;

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
  }

  update(_time: number, delta: number): void {
    this.ambient.update(delta);
    this.ambient.render();

    this.titleText.setY(166 + Math.sin(this.time.now / 840) * 4);

    if (this.startKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.scene.start("GameScene");
    }
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();

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
        fontSize: "20px",
        color: "#9de8ff"
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 524, "Sprint 2: economia dupla, 4 torres, bosses, mapas expansivos", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "15px",
        color: "#b9c9d8"
      })
      .setOrigin(0.5);
  }

  private createStartInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.startKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    ];
  }
}
