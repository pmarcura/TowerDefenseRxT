import type { Vec2 } from "../models/types";

export const distanceSquared = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy;
};

export const distance = (a: Vec2, b: Vec2): number => Math.sqrt(distanceSquared(a, b));

export const moveToward = (position: Vec2, target: Vec2, distanceToMove: number): Vec2 => {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length <= distanceToMove || length === 0) {
    return { x: target.x, y: target.y };
  }

  const ratio = distanceToMove / length;

  return {
    x: position.x + dx * ratio,
    y: position.y + dy * ratio
  };
};
