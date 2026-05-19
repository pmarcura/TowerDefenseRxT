import Phaser from "phaser";
import { assetManifest } from "../assets/assetManifest";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create(): void {
    this.scene.start("MainMenuScene");
  }

  preload(): void {
    for (const asset of assetManifest) {
      if (asset.type === "svg") {
        this.load.svg(asset.key, asset.url, { width: 96, height: 96 });
      }
    }
  }
}
