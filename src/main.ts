import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { OnlineLobbyScene } from "./game/scenes/OnlineLobbyScene";
import { PreloadScene } from "./game/scenes/PreloadScene";
import { UIScene } from "./game/scenes/UIScene";
import "./styles.css";

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  backgroundColor: "#02040a",
  pixelArt: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, PreloadScene, MainMenuScene, OnlineLobbyScene, GameScene, UIScene]
};

new Phaser.Game(gameConfig);
