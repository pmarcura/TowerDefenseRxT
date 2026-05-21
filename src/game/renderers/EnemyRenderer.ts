import Phaser from "phaser";
import { getEnemyDefinition } from "../data/enemies";
import { gameDesign, playerColor, toHexColor } from "../design/gameDesignSystem";
import type { EnemyEntity, GameState, PlayerId } from "../models/types";

export class EnemyRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly damageLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  render(state: GameState): void {
    this.graphics.clear();
    this.syncSprites(state);

    for (const enemy of state.enemies) {
      this.drawEnemy(enemy);
    }
  }

  private drawEnemy(enemy: EnemyEntity): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const hpRatio = Math.max(0, enemy.hp / definition.maxHp);
    const alpha = enemy.alive ? 1 : 0.28;

    this.graphics.fillStyle(definition.glow, 0.16 * alpha);
    this.graphics.fillCircle(enemy.position.x, enemy.position.y, definition.radius + 14);
    if (enemy.lastHitFlashMs > 0) {
      const hitAlpha = Math.min(0.5, enemy.lastHitFlashMs / 180);
      this.graphics.lineStyle(enemy.recentDamageWasCritical ? 3 : 2, enemy.recentDamageColor, hitAlpha);
      this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 18);
    }
    this.drawTechFrame(enemy, alpha);

    if (this.scene.textures.exists(definition.assetKey)) {
      this.drawHealthBar(enemy, hpRatio, alpha);
      this.drawAccumulatedDamage(enemy, alpha);

      if (enemy.slowTimerMs > 0) {
        this.graphics.lineStyle(1, 0x9de8ff, 0.62 * alpha);
        this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 12);
      }
      return;
    }

    this.graphics.lineStyle(4, 0x02050a, 0.9 * alpha);
    this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 4);
    this.graphics.fillStyle(0x07121d, 0.95 * alpha);
    this.graphics.fillCircle(enemy.position.x, enemy.position.y, definition.radius + 2);
    this.graphics.lineStyle(3, definition.color, 0.95 * alpha);
    this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 2);

    if (definition.id === "swarm") {
      this.graphics.fillStyle(definition.color, 0.92 * alpha);
      this.graphics.fillCircle(enemy.position.x, enemy.position.y, definition.radius * 0.82);
      this.graphics.lineStyle(1, definition.glow, 0.72 * alpha);
      this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 5);
    } else if (definition.id === "runner") {
      this.graphics.fillStyle(definition.color, 0.9 * alpha);
      this.graphics.fillTriangle(
        enemy.position.x + definition.radius,
        enemy.position.y,
        enemy.position.x - definition.radius * 0.65,
        enemy.position.y - definition.radius * 0.75,
        enemy.position.x - definition.radius * 0.65,
        enemy.position.y + definition.radius * 0.75
      );
    } else if (definition.id === "tank") {
      this.graphics.fillStyle(definition.color, 0.86 * alpha);
      this.graphics.fillRoundedRect(
        enemy.position.x - definition.radius,
        enemy.position.y - definition.radius * 0.72,
        definition.radius * 2,
        definition.radius * 1.44,
        4
      );
    } else if (definition.id === "boss-reliquary") {
      this.graphics.fillStyle(definition.color, 0.88 * alpha);
      this.graphics.fillTriangle(
        enemy.position.x,
        enemy.position.y - definition.radius,
        enemy.position.x - definition.radius,
        enemy.position.y,
        enemy.position.x,
        enemy.position.y + definition.radius
      );
      this.graphics.fillTriangle(
        enemy.position.x,
        enemy.position.y - definition.radius,
        enemy.position.x + definition.radius,
        enemy.position.y,
        enemy.position.x,
        enemy.position.y + definition.radius
      );
      this.graphics.lineStyle(2, definition.glow, 0.86 * alpha);
      this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 9);
    } else {
      this.graphics.lineStyle(3, definition.color, 0.88 * alpha);
      this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius * 0.72);
      this.graphics.lineBetween(
        enemy.position.x - definition.radius,
        enemy.position.y,
        enemy.position.x + definition.radius,
        enemy.position.y
      );
    }

    this.drawHealthBar(enemy, hpRatio, alpha);
    this.drawAccumulatedDamage(enemy, alpha);

    if (enemy.slowTimerMs > 0) {
      this.graphics.lineStyle(1, 0x9de8ff, 0.62 * alpha);
      this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 7);
    }
  }

  private drawTechFrame(enemy: EnemyEntity, alpha: number): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const x = enemy.position.x;
    const y = enemy.position.y;
    const radius = definition.radius;
    const circuitAlpha = 0.34 * alpha;

    this.graphics.lineStyle(1, definition.color, circuitAlpha);

    if (definition.traits.includes("boss")) {
      this.graphics.strokeRoundedRect(x - radius - 13, y - radius - 10, radius * 2 + 26, radius * 2 + 20, 6);
      this.graphics.lineBetween(x - radius - 20, y, x - radius - 8, y);
      this.graphics.lineBetween(x + radius + 8, y, x + radius + 20, y);
      this.graphics.lineBetween(x, y - radius - 18, x, y - radius - 8);
      this.graphics.fillStyle(definition.glow, 0.24 * alpha);
      this.graphics.fillCircle(x, y - radius - 15, 3);
      return;
    }

    if (definition.traits.includes("nanobot")) {
      this.graphics.strokeCircle(x, y, radius + 9);
      this.graphics.lineBetween(x - radius - 5, y - 2, x + radius + 5, y + 2);
      return;
    }

    if (definition.traits.includes("vigilancia")) {
      this.graphics.strokeCircle(x, y, radius + 11);
      this.graphics.lineBetween(x - radius - 10, y, x - radius - 1, y);
      this.graphics.lineBetween(x + radius + 1, y, x + radius + 10, y);
      return;
    }

    this.graphics.strokeRoundedRect(x - radius - 5, y - radius - 5, radius * 2 + 10, radius * 2 + 10, 4);
    this.graphics.lineBetween(x - radius - 11, y, x - radius - 5, y);
    this.graphics.lineBetween(x + radius + 5, y, x + radius + 11, y);
  }

  private drawHealthBar(enemy: EnemyEntity, hpRatio: number, alpha: number): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const width = definition.traits.includes("boss") ? 78 : 46;
    const height = definition.traits.includes("boss") ? 7 : 5;
    const x = enemy.position.x - width / 2;
    const y = enemy.position.y - definition.radius - (definition.traits.includes("boss") ? 24 : 18);
    const hpColor = hpRatio > 0.6 ? 0x77ffc7 : hpRatio > 0.3 ? 0xffd36d : 0xff5d7f;

    this.graphics.fillStyle(0x02050a, 0.96 * alpha);
    this.graphics.fillRoundedRect(x - 2, y - 2, width + 4, height + 4, 3);
    this.graphics.fillStyle(0x132231, 0.98 * alpha);
    this.graphics.fillRoundedRect(x, y, width, height, 2);
    this.graphics.fillStyle(hpColor, 0.98 * alpha);
    this.graphics.fillRoundedRect(x, y, width * hpRatio, height, 2);

    if (definition.traits.includes("boss")) {
      this.graphics.lineStyle(1, definition.glow, 0.64 * alpha);
      this.graphics.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, 3);
    }
  }

  private drawAccumulatedDamage(enemy: EnemyEntity, alpha: number): void {
    const definition = getEnemyDefinition(enemy.typeId);
    const topDamage = (Object.entries(enemy.recentDamageByPlayer) as Array<
      [PlayerId, (typeof enemy.recentDamageByPlayer)[PlayerId]]
    >)
      .map(([playerId, accumulator]) => ({
        playerId,
        ...accumulator
      }))
      .filter((entry) => entry.timerMs > 0 && entry.total > 0 && enemy.alive)
      .sort((a, b) => b.total - a.total)
      .slice(0, 2);
    const visibleKeys = new Set<string>();

    topDamage.forEach((entry, index) => {
      const key = this.getDamageLabelKey(enemy.id, entry.playerId);
      const label = this.getDamageLabel(key);
      const isCritical = entry.criticalTimerMs > 0 && entry.criticalTotal > 0;
      const ratio = Math.min(1, entry.timerMs / 980);
      const pulse = Math.min(1, entry.pulseMs / 180);
      const yOffset = definition.traits.includes("boss") ? 56 + index * 25 : 40 + index * 21;
      const xOffset = topDamage.length > 1 ? (index === 0 ? -22 : 22) : 0;
      const color = playerColor(entry.playerId);
      const text = `${entry.playerId.toUpperCase()} ${isCritical ? "CRIT " : ""}${Math.round(entry.total)}`;

      visibleKeys.add(key);
      label.setVisible(true);
      label.setText(text);
      label.setPosition(enemy.position.x + xOffset, enemy.position.y - definition.radius - yOffset);
      label.setAlpha(Math.min(1, ratio * 1.35) * alpha);
      label.setScale(1 + pulse * (isCritical ? 0.24 : 0.12));
      label.setStyle({
        fontFamily: gameDesign.font.family,
        fontSize: `${isCritical ? 18 : 14}px`,
        fontStyle: "900",
        color: toHexColor(color),
        stroke: isCritical ? "#fff0a6" : "#02050a",
        strokeThickness: isCritical ? 6 : 4
      });

      if (isCritical) {
        this.graphics.lineStyle(2, 0xfff0a6, 0.54 * alpha * ratio);
        this.graphics.strokeCircle(enemy.position.x, enemy.position.y, definition.radius + 20 + pulse * 8);
      }
    });

    for (const playerId of Object.keys(enemy.recentDamageByPlayer) as PlayerId[]) {
      const key = this.getDamageLabelKey(enemy.id, playerId);

      if (!visibleKeys.has(key)) {
        this.getDamageLabel(key).setVisible(false);
      }
    }
  }

  private getDamageLabelKey(enemyId: string, playerId: PlayerId): string {
    return `${enemyId}:${playerId}`;
  }

  private getDamageLabel(labelKey: string): Phaser.GameObjects.Text {
    let label = this.damageLabels.get(labelKey);

    if (!label) {
      label = this.scene.add.text(0, 0, "", {}).setOrigin(0.5).setDepth(12);
      this.damageLabels.set(labelKey, label);
    }

    return label;
  }

  private syncSprites(state: GameState): void {
    const liveEnemyIds = new Set(state.enemies.map((enemy) => enemy.id));

    for (const [enemyId, sprite] of this.sprites) {
      if (!liveEnemyIds.has(enemyId)) {
        sprite.destroy();
        this.sprites.delete(enemyId);
      }
    }

    for (const [labelKey, label] of this.damageLabels) {
      const enemyId = labelKey.split(":")[0];

      if (!liveEnemyIds.has(enemyId)) {
        label.destroy();
        this.damageLabels.delete(labelKey);
      }
    }

    for (const enemy of state.enemies) {
      const definition = getEnemyDefinition(enemy.typeId);

      if (!this.scene.textures.exists(definition.assetKey)) {
        continue;
      }

      let sprite = this.sprites.get(enemy.id);

      if (!sprite) {
        sprite = this.scene.add.image(enemy.position.x, enemy.position.y, definition.assetKey);
        const size = definition.id === "boss-reliquary" ? 70 : definition.radius * 3.1;
        sprite.setDisplaySize(size, size);
        sprite.setDepth(4);
        this.sprites.set(enemy.id, sprite);
      }

      const bob = state.settings.reducedMotion ? 0 : Math.sin(state.elapsedMs / 190 + enemy.pathIndex) * 1.2;
      sprite.setPosition(enemy.position.x, enemy.position.y + bob);
      sprite.setAlpha(enemy.alive ? 1 : 0.25);
    }
  }
}
