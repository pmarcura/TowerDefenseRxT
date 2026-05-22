import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";

type AmbientParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: number;
  phase: number;
};

export class AmbientParticleRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly particles: AmbientParticle[];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0);
    this.particles = Array.from({ length: 50 }, () => this.createParticle());
  }

  update(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (const particle of this.particles) {
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.phase += deltaSeconds;

      if (particle.x < -20) {
        particle.x = GAME_WIDTH + 20;
      } else if (particle.x > GAME_WIDTH + 20) {
        particle.x = -20;
      }

      if (particle.y < -20) {
        particle.y = GAME_HEIGHT + 20;
      } else if (particle.y > GAME_HEIGHT + 20) {
        particle.y = -20;
      }
    }
  }

  render(): void {
    this.graphics.clear();

    for (const particle of this.particles) {
      const pulse = 0.5 + Math.sin(particle.phase * 1.7) * 0.2;

      this.graphics.fillStyle(particle.color, particle.alpha * pulse);
      this.graphics.fillCircle(particle.x, particle.y, particle.radius);
    }
  }

  private createParticle(): AmbientParticle {
    const cool = Math.random() > 0.18;
    const centralBandTop = 126;
    const centralBandHeight = 468;

    return {
      x: Math.random() * GAME_WIDTH,
      y: centralBandTop + Math.random() * centralBandHeight,
      vx: -6 + Math.random() * 12,
      vy: -5 + Math.random() * 10,
      radius: 1 + Math.random() * 1.6,
      alpha: 0.07 + Math.random() * 0.15,
      color: cool ? 0x83f3ff : 0xffd98a,
      phase: Math.random() * Math.PI * 2
    };
  }
}
