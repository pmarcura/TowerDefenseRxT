import Phaser from "phaser";
import type { GameState } from "../models/types";

export class ZoneRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(3);
  }

  render(state: GameState): void {
    this.graphics.clear();

    for (const zone of state.ritualZones) {
      const pulse = state.settings.reducedMotion ? 0 : Math.sin(state.elapsedMs / 180) * 0.08;
      const alpha = Math.min(0.38, Math.max(0.12, zone.durationMs / 4200));

      this.graphics.fillStyle(zone.color, 0.08 + pulse);
      this.graphics.fillCircle(zone.position.x, zone.position.y, zone.radius);
      this.graphics.lineStyle(2, zone.color, alpha);
      this.graphics.strokeCircle(zone.position.x, zone.position.y, zone.radius);
      this.graphics.lineStyle(1, 0xffffff, 0.18);
      this.graphics.strokeCircle(zone.position.x, zone.position.y, zone.radius * 0.62);
    }
  }
}
