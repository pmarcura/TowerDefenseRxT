import type { PlayerId } from "../models/types";
import { getPlayerNumber } from "../utils/players";

const playerAccentPalette = [
  0x83f3ff,
  0xffd36d,
  0xb4ff72,
  0xff8ab3,
  0xb89cff,
  0x70e0b8,
  0xff9f68,
  0x7fa8ff,
  0xf4fbff,
  0xe5a7ff,
  0x8cffd4,
  0xff6d8b
] as const;

export const gameDesign = {
  font: {
    family: "Inter, system-ui, sans-serif",
    weight: {
      micro: "700",
      body: "600",
      label: "800",
      strong: "900"
    },
    size: {
      micro: 8,
      meta: 9,
      label: 10,
      body: 12,
      stat: 13,
      title: 16,
      player: 19,
      banner: 24,
      overlayTitle: 30
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
    inkStrong: 0x020813,
    panel: 0x07131e,
    panelRaised: 0x0a1a27,
    line: 0x31556a,
    text: "#edf7ff",
    muted: "#8ea4b3",
    soft: "#a9bac6",
    cyan: 0x83f3ff,
    gold: 0xffe39d,
    pink: 0xff4f9a,
    danger: 0xff6d8b,
    success: 0xb4ff72,
    white: 0xf4fbff,
    shadow: 0x02050a
  },
  alpha: {
    panel: 0.72,
    panelStrong: 0.84,
    panelSolid: 0.94,
    stroke: 0.34,
    strokeStrong: 0.62,
    fillHint: 0.1,
    focus: 0.86,
    muted: 0.34
  },
  hud: {
    sidePanelWidth: 238,
    statusPanelHeight: 136,
    contextPanelHeight: 216,
    timelineWidth: 720,
    timelineHeight: 88,
    quickbarHeight: 136
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
    palette: playerAccentPalette
  }
} as const;

export const toHexColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export type GameUiTextRole =
  | "micro"
  | "meta"
  | "label"
  | "body"
  | "stat"
  | "title"
  | "player"
  | "banner"
  | "overlayTitle";

export type GameUiIconId =
  | "damage"
  | "range"
  | "cooldown"
  | "kill"
  | "tower"
  | "brain"
  | "credits"
  | "core"
  | "threat"
  | "route"
  | "enemy"
  | "spawn"
  | "ready"
  | "pause"
  | "restart"
  | "sound"
  | "motion"
  | "reward";

export const gameText = {
  micro: { size: gameDesign.font.size.micro, weight: gameDesign.font.weight.micro },
  meta: { size: gameDesign.font.size.meta, weight: gameDesign.font.weight.label },
  label: { size: gameDesign.font.size.label, weight: gameDesign.font.weight.label },
  body: { size: gameDesign.font.size.body, weight: gameDesign.font.weight.body },
  stat: { size: gameDesign.font.size.stat, weight: gameDesign.font.weight.strong },
  title: { size: gameDesign.font.size.title, weight: gameDesign.font.weight.strong },
  player: { size: gameDesign.font.size.player, weight: gameDesign.font.weight.strong },
  banner: { size: gameDesign.font.size.banner, weight: gameDesign.font.weight.strong },
  overlayTitle: { size: gameDesign.font.size.overlayTitle, weight: gameDesign.font.weight.strong }
} satisfies Record<GameUiTextRole, { size: number; weight: string }>;

export const playerColor = (playerId: PlayerId): number =>
  playerAccentPalette[(getPlayerNumber(playerId) - 1) % playerAccentPalette.length] ?? playerAccentPalette[0];
