import Phaser from "phaser";
import { GameRegistry } from "../GameRegistry";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    GameRegistry.getInstance().resetForMenu();
    this.scene.start("PreloadScene");
  }
}
