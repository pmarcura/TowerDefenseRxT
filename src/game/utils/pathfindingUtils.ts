/**
 * pathfindingUtils.ts
 *
 * Wraps pathfinding.js (A* and variants) for dynamic path validation.
 * Currently used to:
 *   - Verify a valid path still exists after tower placement (future maze maps)
 *   - Compute shortest-path length in tiles for accurate exposure-time simulation
 *
 * The predefined paths in map.ts are sufficient for current maps, but as maps
 * grow more complex (procedural, maze-mode), this will become the primary
 * pathfinding source for TowerDefenseEnv and AiPartnerSystem.
 */

import * as PF from "pathfinding";
import type { GridPoint, MapDefinition } from "../models/types";

/**
 * Build a walkable PF.Grid from map dimensions and a set of occupied (tower) tiles.
 * Path tiles are kept walkable so enemies can still traverse them.
 */
export const buildWalkableGrid = (
  map: MapDefinition,
  occupied: ReadonlySet<string>
): InstanceType<typeof PF.Grid> => {
  const grid = new PF.Grid(map.columns, map.rows);

  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.columns; col++) {
      if (occupied.has(`${col}:${row}`)) {
        grid.setWalkableAt(col, row, false);
      }
    }
  }

  return grid;
};

/**
 * Find the A* shortest path between two grid points given current tower placements.
 * Returns an array of [col, row] pairs, or empty if no path exists.
 */
export const findShortestPath = (
  map: MapDefinition,
  from: GridPoint,
  to: GridPoint,
  occupied: ReadonlySet<string>
): GridPoint[] => {
  const grid = buildWalkableGrid(map, occupied);
  const finder = new PF.AStarFinder();
  const raw = finder.findPath(from.col, from.row, to.col, to.row, grid);

  return raw.map((pair) => ({ col: pair[0], row: pair[1] }));
};

/**
 * Check whether a valid path still exists from start to end after placing a tower.
 * Useful for bot validation before committing a BUILD_TOWER action on maze maps.
 */
export const isPathStillReachable = (
  map: MapDefinition,
  from: GridPoint,
  to: GridPoint,
  occupied: ReadonlySet<string>
): boolean => findShortestPath(map, from, to, occupied).length > 0;

/**
 * Compute the shortest-path length in tiles between two points.
 * More accurate than straight-line distance for winding maps.
 */
export const getShortestPathLength = (
  map: MapDefinition,
  from: GridPoint,
  to: GridPoint,
  occupied: ReadonlySet<string>
): number => {
  const path = findShortestPath(map, from, to, occupied);
  return path.length > 0 ? path.length - 1 : 0;
};
