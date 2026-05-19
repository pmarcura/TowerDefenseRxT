import type { PlayerId } from "../models/types";

export type PlayerKeybindingHelp = {
  readonly playerId: PlayerId;
  readonly movement: string;
  readonly cycleTower: string;
  readonly build: string;
  readonly buySkill: string;
};

export const keybindingHelp: Record<PlayerId, PlayerKeybindingHelp> = {
  p1: {
    playerId: "p1",
    movement: "WASD",
    cycleTower: "Q/E",
    build: "Space",
    buySkill: "Z"
  },
  p2: {
    playerId: "p2",
    movement: "Setas",
    cycleTower: "PgUp/PgDn",
    build: "Enter",
    buySkill: "Enter"
  }
};
