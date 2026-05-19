import Phaser from "phaser";
import { getTowerDefinition } from "../data/towers";
import type { GameState, ProjectileEntity } from "../models/types";

export class ProjectileRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(8);
  }

  render(state: GameState): void {
    this.graphics.clear();

    for (const projectile of state.projectiles) {
      this.drawProjectile(projectile);
    }
  }

  private drawProjectile(projectile: ProjectileEntity): void {
    const tower = getTowerDefinition(projectile.typeId);

    this.graphics.fillStyle(tower.glow, 0.18);
    this.graphics.fillCircle(projectile.position.x, projectile.position.y, 11);
    this.graphics.fillStyle(tower.color, 0.94);
    this.graphics.fillCircle(projectile.position.x, projectile.position.y, 4);
    this.graphics.lineStyle(1, tower.glow, 0.62);
    this.graphics.strokeCircle(projectile.position.x, projectile.position.y, 8);
  }
}
