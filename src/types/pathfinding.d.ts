declare module "pathfinding" {
  class Grid {
    constructor(width: number, height: number);
    setWalkableAt(col: number, row: number, walkable: boolean): void;
    clone(): Grid;
  }
  class AStarFinder {
    findPath(sx: number, sy: number, ex: number, ey: number, grid: Grid): number[][];
  }
  export { Grid, AStarFinder };
}
