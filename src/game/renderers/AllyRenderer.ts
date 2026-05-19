import Phaser from "phaser";
import type { GameState } from "../models/types";

export class AllyRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(5);
  }

  render(state: GameState): void {
    this.graphics.clear();

    for (const ally of state.allies) {
      const alpha = ally.alive ? 0.92 : 0.25;

      this.graphics.fillStyle(ally.color, 0.14 * alpha);
      this.graphics.fillCircle(ally.position.x, ally.position.y, 18);
      this.graphics.lineStyle(2, ally.color, 0.78 * alpha);
      this.graphics.strokeCircle(ally.position.x, ally.position.y, 12);
      this.graphics.fillStyle(0x020712, 0.9 * alpha);
      this.graphics.fillCircle(ally.position.x, ally.position.y, 7);
      this.graphics.lineStyle(2, ally.color, alpha);
      this.graphics.lineBetween(ally.position.x - 6, ally.position.y, ally.position.x + 6, ally.position.y);
      this.graphics.lineBetween(ally.position.x, ally.position.y - 6, ally.position.x, ally.position.y + 6);
    }
  }
}
