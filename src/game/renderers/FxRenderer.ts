import Phaser from "phaser";
import type { GameState, PresentationEvent } from "../models/types";

export class FxRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(20);
  }

  render(state: GameState): void {
    this.graphics.clear();
    const liveEventIds = new Set(state.presentationEvents.map((event) => event.id));

    for (const event of state.presentationEvents) {
      this.drawEvent(event);
    }

    for (const [id, label] of this.labels) {
      if (!liveEventIds.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
  }

  private drawEvent(event: PresentationEvent): void {
    if (!event.position) {
      return;
    }

    const progress = 1 - event.ttlMs / event.durationMs;
    const alpha = Phaser.Math.Clamp(event.ttlMs / Math.min(320, event.durationMs), 0, 1);
    const color = event.color ?? 0xffffff;

    if (event.kind === "build") {
      this.graphics.lineStyle(2, color, 0.8 * alpha);
      this.graphics.strokeCircle(event.position.x, event.position.y, 20 + progress * 24);
      this.graphics.fillStyle(color, 0.1 * alpha);
      this.graphics.fillCircle(event.position.x, event.position.y, 28 + progress * 18);
      this.drawLabel(event, event.label ?? "ARMADO", 0xffffff, alpha, -36 - progress * 8);
      return;
    }

    if (event.kind === "damage") {
      this.drawLabel(event, `${Math.round(event.amount ?? 0)}`, color, alpha, -20 - progress * 22);
      this.graphics.fillStyle(color, 0.1 * alpha);
      this.graphics.fillCircle(event.position.x, event.position.y, 10 + progress * 10);
      return;
    }

    if (event.kind === "critical") {
      this.drawLabel(event, event.label ?? `CRIT ${Math.round(event.amount ?? 0)}`, 0xfff0a6, alpha, -34 - progress * 34);
      this.graphics.lineStyle(3, 0xfff0a6, 0.72 * alpha);
      this.graphics.strokeCircle(event.position.x, event.position.y, 15 + progress * 22);
      this.graphics.fillStyle(0xfff0a6, 0.16 * alpha);
      this.graphics.fillCircle(event.position.x, event.position.y, 16 + progress * 12);
      return;
    }

    if (event.kind === "kill") {
      this.drawLabel(event, event.label ?? "KO", color, alpha, -28 - progress * 32);
      this.graphics.lineStyle(2, color, 0.7 * alpha);
      this.graphics.strokeCircle(event.position.x, event.position.y, 18 + progress * 18);
      return;
    }

    if (event.kind === "income") {
      this.drawLabel(event, event.label ?? "+CRED", 0xffe39d, alpha, -32 - progress * 22);
      this.graphics.fillStyle(0xffe39d, 0.16 * alpha);
      this.graphics.fillCircle(event.position.x, event.position.y, 18 + progress * 12);
      this.graphics.lineStyle(2, 0xffe39d, 0.52 * alpha);
      this.graphics.strokeCircle(event.position.x, event.position.y, 22 + progress * 16);
      return;
    }

    if (event.kind === "level-up") {
      this.drawLabel(event, event.label ?? "LV UP", color, alpha, -44 - progress * 12);
      this.graphics.lineStyle(3, color, 0.78 * alpha);
      this.graphics.strokeCircle(event.position.x, event.position.y, 26 + progress * 18);
      this.graphics.lineStyle(1, 0xffffff, 0.42 * alpha);
      this.graphics.strokeCircle(event.position.x, event.position.y, 39 + progress * 24);
      this.graphics.fillStyle(color, 0.1 * alpha);
      this.graphics.fillCircle(event.position.x, event.position.y, 34 + progress * 18);
    }
  }

  private drawLabel(
    event: PresentationEvent,
    text: string,
    color: number,
    alpha: number,
    yOffset: number
  ): void {
    let label = this.labels.get(event.id);

    if (!label) {
      label = this.scene.add
        .text(event.position?.x ?? 0, event.position?.y ?? 0, text, {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: `${this.getFontSize(event)}px`,
          fontStyle: "800",
          color: `#${color.toString(16).padStart(6, "0")}`,
          stroke: "#02050a",
          strokeThickness: this.getStrokeThickness(event)
        })
        .setOrigin(0.5);
      label.setDepth(21);
      this.labels.set(event.id, label);
    }

    label.setStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: `${this.getFontSize(event)}px`,
      fontStyle: "900",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#02050a",
      strokeThickness: this.getStrokeThickness(event)
    });
    label.setText(text);
    label.setPosition(event.position?.x ?? 0, (event.position?.y ?? 0) + yOffset);
    label.setAlpha(alpha);
  }

  private getFontSize(event: PresentationEvent): number {
    if (event.kind === "critical") {
      return 24;
    }

    if (event.kind === "kill" || event.kind === "income") {
      return 16;
    }

    if (event.kind === "damage") {
      return 14;
    }

    return 12;
  }

  private getStrokeThickness(event: PresentationEvent): number {
    if (event.kind === "critical") {
      return 6;
    }

    if (event.kind === "kill" || event.kind === "income") {
      return 5;
    }

    return 4;
  }
}
