import Phaser from "phaser";
import { getWaveDefinition } from "../data/waves";
import type { MapDefinition } from "../models/types";
import type { GameState } from "../models/types";
import { gridKey, gridToWorld } from "../utils/grid";

type MapMasks = {
  pathCells: Set<string>;
  nearPathCells: Set<string>;
};

export class GridRenderer {
  private readonly gridGraphics: Phaser.GameObjects.Graphics;
  private readonly pathGraphics: Phaser.GameObjects.Graphics;
  private readonly debugGraphics: Phaser.GameObjects.Graphics;
  private baseSprite?: Phaser.GameObjects.Image;
  private readonly spawnSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly routeLabels = new Map<number, Phaser.GameObjects.Text>();
  private readonly maskCache = new Map<string, MapMasks>();

  constructor(private readonly scene: Phaser.Scene) {
    this.gridGraphics = scene.add.graphics();
    this.pathGraphics = scene.add.graphics();
    this.debugGraphics = scene.add.graphics();
  }

  render(state: GameState): void {
    this.gridGraphics.clear();
    this.pathGraphics.clear();
    this.debugGraphics.clear();
    for (const label of this.routeLabels.values()) {
      label.setAlpha(0);
    }

    this.drawGrid(state.activeMap);
    this.drawPath(state);
    this.drawSpawnTelegraphs(state);
    this.drawBase(state);

    if (state.debug) {
      this.drawDebugPath(state.activeMap);
    }
  }

  private drawGrid(map: MapDefinition): void {
    const { columns, rows, tileSize, origin } = map;
    const largeGrassMap = this.isLargeGrassMap(map);
    const masks = this.getMapMasks(map);
    const visible = this.getVisibleGridBounds(map);

    this.gridGraphics.fillStyle(largeGrassMap ? 0x143a20 : 0x040b12, largeGrassMap ? 0.94 : 0.78);
    this.gridGraphics.fillRoundedRect(
      origin.x - 14,
      origin.y - 14,
      columns * tileSize + 28,
      rows * tileSize + 28,
      8
    );
    this.gridGraphics.fillStyle(largeGrassMap ? 0x0f2c18 : 0x020712, largeGrassMap ? 0.42 : 0.36);
    this.gridGraphics.fillRect(origin.x, origin.y, columns * tileSize, rows * tileSize);

    for (let row = visible.startRow; row <= visible.endRow; row += 1) {
      for (let col = visible.startCol; col <= visible.endCol; col += 1) {
        const x = origin.x + col * tileSize;
        const y = origin.y + row * tileSize;
        const key = `${col}:${row}`;
        const onPath = masks.pathCells.has(key);
        const nearPath = !onPath && masks.nearPathCells.has(key);
        const checker = (col + row) % 2 === 0;

        this.gridGraphics.fillStyle(
          largeGrassMap
            ? onPath
              ? 0x8a7246
              : nearPath
                ? 0x1f542b
                : checker
                  ? 0x194624
                  : 0x173f22
            : onPath
              ? 0x103345
              : nearPath
                ? 0x0b1d22
                : 0x07111a,
          largeGrassMap
            ? onPath
              ? 0.92
              : nearPath
                ? 0.86
                : 0.78
            : onPath
              ? 0.78
              : nearPath
                ? 0.72
                : 0.58
        );
        this.gridGraphics.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        if (this.scene.cameras.main.zoom >= (largeGrassMap ? 0.44 : 0.2)) {
          this.gridGraphics.lineStyle(
            1,
            largeGrassMap
              ? onPath
                ? 0xc9a35f
                : nearPath
                  ? 0x316b39
                  : 0x24502c
              : onPath
                ? 0x2b8cad
                : nearPath
                  ? 0x2d5c55
                  : 0x193346,
            largeGrassMap
              ? onPath
                ? 0.38
                : 0.16
              : onPath
                ? 0.42
                : nearPath
                  ? 0.38
                  : 0.2
          );
          this.gridGraphics.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }

        if (nearPath && this.scene.cameras.main.zoom >= 0.52) {
          this.gridGraphics.fillStyle(0xb4ff72, 0.11);
          this.gridGraphics.fillCircle(x + tileSize / 2, y + tileSize / 2, 2.2);
        }
      }
    }
  }

  private drawPath(state: GameState): void {
    const map = state.activeMap;
    const activePathIndexes = this.getActivePathIndexes(state);
    const newPathIndexes = this.getNewPathIndexes(state);

    map.paths.forEach((pathDefinition, pathIndex) => {
      const path = pathDefinition.map((grid) => gridToWorld(grid, map));
      const isActiveRoute = activePathIndexes.has(pathIndex);
      const isNewRoute = !state.wave.active && newPathIndexes.has(pathIndex);
      const color = this.getRouteColor(pathIndex);
      const outerAlpha = isNewRoute ? 0.16 : isActiveRoute ? 0.18 : 0.055;
      const innerAlpha = isNewRoute ? 0.24 : isActiveRoute ? 0.44 : 0.14;
      const outerWidth = this.isLargeGrassMap(map)
        ? Math.max(14, map.tileSize * 0.86)
        : isActiveRoute
          ? 17
          : 12;
      const innerWidth = this.isLargeGrassMap(map)
        ? Math.max(3, map.tileSize * 0.18)
        : isActiveRoute
          ? 4
          : 2;

      this.pathGraphics.lineStyle(outerWidth, color, outerAlpha);

      for (let index = 0; index < path.length - 1; index += 1) {
        const current = path[index];
        const next = path[index + 1];

        this.pathGraphics.lineBetween(current.x, current.y, next.x, next.y);
      }

      this.pathGraphics.lineStyle(innerWidth, color, innerAlpha);

      for (let index = 0; index < path.length - 1; index += 1) {
        const current = path[index];
        const next = path[index + 1];

        this.pathGraphics.lineBetween(current.x, current.y, next.x, next.y);
      }

      if (isNewRoute) {
        for (let index = 0; index < path.length - 1; index += 1) {
          this.drawDashedRoute(path[index], path[index + 1], color, 0.66);
        }
      }

      for (let index = 1; index < path.length - 1; index += 4) {
        this.drawRouteArrow(path[index], path[index + 1], color, isNewRoute ? 0.82 : isActiveRoute ? 0.72 : 0.28);
      }

      this.drawRouteLabel(path[0], pathIndex, color, isActiveRoute, isNewRoute);
    });
  }

  private drawDashedRoute(
    current: { x: number; y: number },
    next: { x: number; y: number },
    color: number,
    alpha: number
  ): void {
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const segments = Math.max(1, Math.floor(distance / 12));

    this.pathGraphics.lineStyle(3, color, alpha);

    for (let index = 0; index < segments; index += 1) {
      if (index % 2 !== 0) {
        continue;
      }

      const start = index / segments;
      const end = Math.min(1, (index + 0.72) / segments);

      this.pathGraphics.lineBetween(
        current.x + dx * start,
        current.y + dy * start,
        current.x + dx * end,
        current.y + dy * end
      );
    }
  }

  private drawRouteArrow(
    current: { x: number; y: number },
    next: { x: number; y: number },
    color: number,
    alpha: number
  ): void {
    const angle = Math.atan2(next.y - current.y, next.x - current.x);
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    const tipX = midX + Math.cos(angle) * 9;
    const tipY = midY + Math.sin(angle) * 9;
    const backX = midX - Math.cos(angle) * 7;
    const backY = midY - Math.sin(angle) * 7;
    const normalX = Math.cos(angle + Math.PI / 2) * 6;
    const normalY = Math.sin(angle + Math.PI / 2) * 6;

    this.pathGraphics.fillStyle(color, alpha);
    this.pathGraphics.fillTriangle(
      tipX,
      tipY,
      backX + normalX,
      backY + normalY,
      backX - normalX,
      backY - normalY
    );
  }

  private drawRouteLabel(
    point: { x: number; y: number },
    pathIndex: number,
    color: number,
    isActiveRoute: boolean,
    isNewRoute: boolean
  ): void {
    const labelWidth = isNewRoute ? 76 : 44;

    this.pathGraphics.fillStyle(0x020712, isActiveRoute || isNewRoute ? 0.82 : 0.58);
    this.pathGraphics.fillRoundedRect(point.x - labelWidth / 2, point.y - 34, labelWidth, 17, 4);
    this.pathGraphics.lineStyle(1, color, isActiveRoute || isNewRoute ? 0.74 : 0.28);
    this.pathGraphics.strokeRoundedRect(point.x - labelWidth / 2, point.y - 34, labelWidth, 17, 4);

    let label = this.routeLabels.get(pathIndex);

    if (!label) {
      label = this.scene.add
        .text(point.x, point.y - 25.5, "", {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "9px",
          fontStyle: "900",
          color: "#edf7ff"
        })
        .setOrigin(0.5)
        .setDepth(4);
      this.routeLabels.set(pathIndex, label);
    }

    label.setText(isNewRoute ? "NOVA ROTA" : `ROTA ${pathIndex + 1}`);
    label.setPosition(point.x, point.y - 25.5);
    label.setColor(isActiveRoute || isNewRoute ? `#${color.toString(16).padStart(6, "0")}` : "#718797");
    label.setAlpha(isActiveRoute || isNewRoute ? 1 : 0.58);
  }

  private isNearPath(grid: { col: number; row: number }, map: MapDefinition): boolean {
    return map.paths.some((path) =>
      path.some(
        (pathPoint) =>
          Math.abs(pathPoint.col - grid.col) + Math.abs(pathPoint.row - grid.row) === 1
      )
    );
  }

  private getVisibleGridBounds(map: MapDefinition) {
    const view = this.scene.cameras.main.worldView;
    const startCol = Math.max(0, Math.floor((view.left - map.origin.x) / map.tileSize) - 2);
    const endCol = Math.min(map.columns - 1, Math.ceil((view.right - map.origin.x) / map.tileSize) + 2);
    const startRow = Math.max(0, Math.floor((view.top - map.origin.y) / map.tileSize) - 2);
    const endRow = Math.min(map.rows - 1, Math.ceil((view.bottom - map.origin.y) / map.tileSize) + 2);

    return { startCol, endCol, startRow, endRow };
  }

  private getMapMasks(map: MapDefinition): MapMasks {
    const cached = this.maskCache.get(map.id);

    if (cached) {
      return cached;
    }

    const pathCells = new Set<string>();
    const nearPathCells = new Set<string>();

    for (const path of map.paths) {
      for (const point of path) {
        pathCells.add(gridKey(point));
      }
    }

    for (const key of pathCells) {
      const [col, row] = key.split(":").map(Number);
      const neighbours = [
        { col: col - 1, row },
        { col: col + 1, row },
        { col, row: row - 1 },
        { col, row: row + 1 }
      ];

      for (const neighbour of neighbours) {
        if (
          neighbour.col >= 0 &&
          neighbour.col < map.columns &&
          neighbour.row >= 0 &&
          neighbour.row < map.rows &&
          !pathCells.has(gridKey(neighbour))
        ) {
          nearPathCells.add(gridKey(neighbour));
        }
      }
    }

    const masks = { pathCells, nearPathCells };
    this.maskCache.set(map.id, masks);

    return masks;
  }

  private isLargeGrassMap(map: MapDefinition): boolean {
    return map.columns >= 80 && map.rows >= 80;
  }

  private getActivePathIndexes(state: GameState): Set<number> {
    if (state.wave.snapshot.activePathIndexes.length > 0) {
      return new Set(state.wave.snapshot.activePathIndexes);
    }

    const wave = getWaveDefinition(state.wave.currentWaveIndex);

    return new Set(wave.groups.map((group) => group.pathIndex ?? 0));
  }

  private getNewPathIndexes(state: GameState): Set<number> {
    if (state.wave.currentWaveIndex <= 0) {
      return new Set();
    }

    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const previousWave = getWaveDefinition(state.wave.currentWaveIndex - 1);

    const previousRoutes = new Set(previousWave.groups.map((group) => group.pathIndex ?? 0));

    return new Set(
      wave.groups
        .map((group) => group.pathIndex ?? 0)
        .filter((pathIndex) => !previousRoutes.has(pathIndex))
    );
  }

  private getRouteColor(pathIndex: number): number {
    const colors = [
      0x38d6ff,
      0xffd36d,
      0xff6d8b,
      0xb4ff72,
      0xc084fc,
      0x60a5fa,
      0xfacc15,
      0x34d399,
      0xfb7185,
      0xa3e635,
      0xf97316,
      0x22d3ee
    ];

    return colors[pathIndex % colors.length];
  }

  private drawSpawnTelegraphs(state: GameState): void {
    const wave = getWaveDefinition(state.wave.currentWaveIndex);

    for (const sprite of this.spawnSprites.values()) {
      sprite.setVisible(false);
    }

    const pathIndexes =
      state.wave.snapshot.activePathIndexes.length > 0
        ? state.wave.snapshot.activePathIndexes
        : [...new Set(wave.groups.map((group) => group.pathIndex ?? 0))];
    const pulse = 0.5 + Math.sin(state.elapsedMs / 180) * 0.25;
    const color = wave.isBoss ? 0xff4f9a : 0x77ffc7;
    const activeAlpha = state.wave.active ? 0.72 : 0.42;

    for (const pathIndex of pathIndexes) {
      const path = state.activeMap.paths[pathIndex];

      if (!path) {
        continue;
      }

      const point = gridToWorld(path[0], state.activeMap);

      if (this.scene.textures.exists("world.spawnGate")) {
        let sprite = this.spawnSprites.get(pathIndex);

        if (!sprite) {
          sprite = this.scene.add.image(point.x, point.y, "world.spawnGate");
          sprite.setDisplaySize(54, 54);
          sprite.setDepth(2);
        this.spawnSprites.set(pathIndex, sprite);
      }

        sprite.setVisible(true);
        sprite.setPosition(point.x, point.y);
        sprite.setAlpha(0.55 + pulse * 0.3);
      }

      this.pathGraphics.fillStyle(color, 0.08 + pulse * 0.08);
      this.pathGraphics.fillCircle(point.x, point.y, 36 + pulse * 5);
      this.pathGraphics.lineStyle(3, color, activeAlpha);
      this.pathGraphics.strokeCircle(point.x, point.y, 25 + pulse * 4);
      this.pathGraphics.lineStyle(1, color, 0.38);
      this.pathGraphics.strokeCircle(point.x, point.y, 39 + pulse * 8);
    }
  }

  private drawBase(state: GameState): void {
    const map = state.activeMap;
    const start = gridToWorld(map.paths[0][0], map);
    const endPath = map.paths[0];
    const end = gridToWorld(endPath[endPath.length - 1], map);
    const baseRatio = Math.max(0, state.baseHp / state.activeMap.baseHp);
    const dangerPulse = state.baseHitFlashMs > 0 ? Math.max(0.35, state.baseHitFlashMs / 640) : 0;

    this.gridGraphics.fillStyle(0x77ffc7, 0.14);
    this.gridGraphics.fillCircle(start.x, start.y, 24);
    this.gridGraphics.lineStyle(2, 0x77ffc7, 0.62);
    this.gridGraphics.strokeCircle(start.x, start.y, 24);

    this.gridGraphics.fillStyle(0xff6688, 0.14 + dangerPulse * 0.18);
    this.gridGraphics.fillCircle(end.x, end.y, 28 + dangerPulse * 8);

    if (this.scene.textures.exists("world.baseCore")) {
      if (!this.baseSprite) {
        this.baseSprite = this.scene.add.image(end.x, end.y, "world.baseCore");
        this.baseSprite.setDisplaySize(64, 64);
        this.baseSprite.setDepth(3);
      }

      this.baseSprite.setPosition(end.x, end.y);
      this.baseSprite.setScale(0.66 + dangerPulse * 0.08);
      this.baseSprite.setAlpha(0.96);
    }

    this.gridGraphics.lineStyle(3, dangerPulse > 0 ? 0xff4f9a : 0xff99ad, 0.9);
    this.gridGraphics.strokeCircle(end.x, end.y, 28 + dangerPulse * 5);
    this.gridGraphics.fillStyle(baseRatio > 0.35 ? 0xff99ad : 0xff4f9a, 0.92);
    this.gridGraphics.fillRect(end.x - 22, end.y + 34, 44 * baseRatio, 5);
  }

  private drawDebugPath(map: MapDefinition): void {
    this.debugGraphics.lineStyle(1, 0xffffff, 0.28);

    map.paths.forEach((path) => {
      path.forEach((grid, index) => {
        const point = gridToWorld(grid, map);

        this.debugGraphics.strokeCircle(point.x, point.y, 8);
        this.debugGraphics.fillStyle(0xffffff, 0.64);
        this.debugGraphics.fillCircle(point.x, point.y, index === 0 ? 4 : 2);
      });
    });
  }
}
