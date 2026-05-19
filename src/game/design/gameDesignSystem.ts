import type { PlayerId } from "../models/types";

export const gameDesign = {
  font: {
    family: "Inter, system-ui, sans-serif",
    weight: {
      body: "600",
      label: "800",
      strong: "900"
    },
    size: {
      meta: 8,
      label: 9,
      body: 10,
      stat: 11,
      title: 15,
      player: 18,
      banner: 20
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
    panel: 9
  },
  color: {
    void: 0x020712,
    ink: 0x04101a,
    panel: 0x07131e,
    line: 0x31556a,
    text: "#edf7ff",
    muted: "#8ea4b3",
    soft: "#a9bac6",
    cyan: 0x83f3ff,
    gold: 0xffe39d,
    pink: 0xff4f9a,
    danger: 0xff6d8b,
    success: 0xb4ff72
  },
  alpha: {
    panel: 0.72,
    panelStrong: 0.84,
    stroke: 0.34,
    strokeStrong: 0.62,
    fillHint: 0.1,
    focus: 0.86,
    muted: 0.34
  },
  hud: {
    sidePanelWidth: 236,
    sidePanelHeight: 338,
    timelineWidth: 500,
    timelineHeight: 52
  },
  tower: {
    spriteSize: 42,
    focusedSpriteSize: 52,
    maxSpriteGrowth: 9,
    ambientGlow: 0.055,
    focusedGlow: 0.15,
    branchAmbient: 0.12,
    branchFocused: 0.4
  },
  player: {
    p1: { accent: 0x83f3ff },
    p2: { accent: 0xffd36d }
  } satisfies Record<PlayerId, { accent: number }>
} as const;

export const toHexColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;
