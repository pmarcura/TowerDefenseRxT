import { mapDefinition } from "../data/map";
import type { GridPoint, MapDefinition, Vec2 } from "../models/types";

export const gridToWorld = (grid: GridPoint, map: MapDefinition = mapDefinition): Vec2 => ({
  x: map.origin.x + grid.col * map.tileSize + map.tileSize / 2,
  y: map.origin.y + grid.row * map.tileSize + map.tileSize / 2
});

export const gridKey = (grid: GridPoint): string => `${grid.col}:${grid.row}`;

export const isInsideGrid = (grid: GridPoint, map: MapDefinition = mapDefinition): boolean =>
  grid.col >= 0 && grid.col < map.columns && grid.row >= 0 && grid.row < map.rows;

export const isGridOnPath = (grid: GridPoint, map: MapDefinition = mapDefinition): boolean =>
  map.paths.some((path) =>
    path.some((pathPoint) => pathPoint.col === grid.col && pathPoint.row === grid.row)
  );

export const clampGrid = (grid: GridPoint, map: MapDefinition = mapDefinition): GridPoint => ({
  col: Math.min(Math.max(grid.col, 0), map.columns - 1),
  row: Math.min(Math.max(grid.row, 0), map.rows - 1)
});

export const buildPathWorldPoints = (
  map: MapDefinition = mapDefinition,
  pathIndex = 0
): Vec2[] => {
  const path = map.paths[pathIndex] ?? map.paths[0];

  return path.map((pathPoint) => gridToWorld(pathPoint, map));
};
