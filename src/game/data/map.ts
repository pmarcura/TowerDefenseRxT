import type { GridPoint, MapDefinition } from "../models/types";

const startingCredits = 132;
const PROCEDURAL_MAP_MAX_WIDTH = 1010;
const PROCEDURAL_MAP_MAX_HEIGHT = 505;
const PROCEDURAL_MAP_MIN_TILE_SIZE = 29;
const GRASS_TD_STAGE_INDEX = 8;
const GRASS_TD_SIZE = 100;
const GRASS_TD_TILE_SIZE = 24;
const GRASS_TD_LANE_ROWS = [6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94] as const;

export const mapStages: readonly MapDefinition[] = [
  {
    id: "stage-01",
    name: "Atrio Curto",
    columns: 14,
    rows: 9,
    tileSize: 43,
    origin: { x: 253, y: 126 },
    baseHp: 24,
    startingCredits,
    paths: [
      [
        { col: 0, row: 4 },
        { col: 1, row: 4 },
        { col: 2, row: 4 },
        { col: 3, row: 4 },
        { col: 4, row: 4 },
        { col: 4, row: 3 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
        { col: 6, row: 2 },
        { col: 7, row: 2 },
        { col: 7, row: 3 },
        { col: 7, row: 4 },
        { col: 8, row: 4 },
        { col: 9, row: 4 },
        { col: 10, row: 4 },
        { col: 10, row: 5 },
        { col: 10, row: 6 },
        { col: 11, row: 6 },
        { col: 12, row: 6 },
        { col: 13, row: 6 }
      ]
    ]
  },
  {
    id: "stage-02",
    name: "Atrio Expandido",
    columns: 15,
    rows: 9,
    tileSize: 43,
    origin: { x: 253, y: 126 },
    baseHp: 24,
    startingCredits,
    paths: [
      [
        { col: 0, row: 4 },
        { col: 1, row: 4 },
        { col: 2, row: 4 },
        { col: 3, row: 4 },
        { col: 4, row: 4 },
        { col: 4, row: 3 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
        { col: 6, row: 2 },
        { col: 7, row: 2 },
        { col: 8, row: 2 },
        { col: 8, row: 3 },
        { col: 8, row: 4 },
        { col: 9, row: 4 },
        { col: 10, row: 4 },
        { col: 11, row: 4 },
        { col: 11, row: 5 },
        { col: 11, row: 6 },
        { col: 12, row: 6 },
        { col: 13, row: 6 },
        { col: 14, row: 6 }
      ]
    ]
  },
  {
    id: "stage-03",
    name: "Dupla Nave",
    columns: 16,
    rows: 9,
    tileSize: 43,
    origin: { x: 253, y: 126 },
    baseHp: 24,
    startingCredits,
    paths: [
      [
        { col: 0, row: 4 },
        { col: 1, row: 4 },
        { col: 2, row: 4 },
        { col: 3, row: 4 },
        { col: 4, row: 4 },
        { col: 4, row: 3 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
        { col: 6, row: 2 },
        { col: 7, row: 2 },
        { col: 8, row: 2 },
        { col: 9, row: 2 },
        { col: 9, row: 3 },
        { col: 9, row: 4 },
        { col: 10, row: 4 },
        { col: 11, row: 4 },
        { col: 12, row: 4 },
        { col: 12, row: 5 },
        { col: 12, row: 6 },
        { col: 13, row: 6 },
        { col: 14, row: 6 },
        { col: 15, row: 6 }
      ],
      [
        { col: 0, row: 1 },
        { col: 1, row: 1 },
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
        { col: 5, row: 3 },
        { col: 6, row: 3 },
        { col: 7, row: 3 },
        { col: 8, row: 3 },
        { col: 9, row: 3 },
        { col: 10, row: 3 },
        { col: 11, row: 3 },
        { col: 12, row: 3 },
        { col: 13, row: 3 },
        { col: 14, row: 4 },
        { col: 15, row: 5 },
        { col: 15, row: 6 }
      ]
    ]
  },
  {
    id: "stage-04",
    name: "Claustro Longo",
    columns: 17,
    rows: 10,
    tileSize: 43,
    origin: { x: 253, y: 126 },
    baseHp: 24,
    startingCredits,
    paths: [
      [
        { col: 0, row: 4 },
        { col: 1, row: 4 },
        { col: 2, row: 4 },
        { col: 3, row: 4 },
        { col: 4, row: 4 },
        { col: 4, row: 3 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
        { col: 6, row: 2 },
        { col: 7, row: 2 },
        { col: 8, row: 2 },
        { col: 9, row: 2 },
        { col: 10, row: 2 },
        { col: 10, row: 3 },
        { col: 10, row: 4 },
        { col: 11, row: 4 },
        { col: 12, row: 4 },
        { col: 13, row: 4 },
        { col: 13, row: 5 },
        { col: 13, row: 6 },
        { col: 14, row: 6 },
        { col: 15, row: 6 },
        { col: 16, row: 6 }
      ],
      [
        { col: 0, row: 1 },
        { col: 1, row: 1 },
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
        { col: 5, row: 3 },
        { col: 6, row: 3 },
        { col: 7, row: 3 },
        { col: 8, row: 3 },
        { col: 9, row: 3 },
        { col: 10, row: 3 },
        { col: 11, row: 3 },
        { col: 12, row: 3 },
        { col: 13, row: 3 },
        { col: 14, row: 4 },
        { col: 15, row: 5 },
        { col: 16, row: 6 }
      ]
    ]
  },
  {
    id: "stage-05",
    name: "Convergencia Tripla",
    columns: 18,
    rows: 10,
    tileSize: 43,
    origin: { x: 253, y: 126 },
    baseHp: 24,
    startingCredits,
    paths: [
      [
        { col: 0, row: 4 },
        { col: 1, row: 4 },
        { col: 2, row: 4 },
        { col: 3, row: 4 },
        { col: 4, row: 4 },
        { col: 4, row: 3 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
        { col: 6, row: 2 },
        { col: 7, row: 2 },
        { col: 8, row: 2 },
        { col: 9, row: 2 },
        { col: 10, row: 2 },
        { col: 11, row: 2 },
        { col: 11, row: 3 },
        { col: 11, row: 4 },
        { col: 12, row: 4 },
        { col: 13, row: 4 },
        { col: 14, row: 4 },
        { col: 14, row: 5 },
        { col: 14, row: 6 },
        { col: 15, row: 6 },
        { col: 16, row: 6 },
        { col: 17, row: 6 }
      ],
      [
        { col: 0, row: 1 },
        { col: 1, row: 1 },
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
        { col: 5, row: 3 },
        { col: 6, row: 3 },
        { col: 7, row: 3 },
        { col: 8, row: 3 },
        { col: 9, row: 3 },
        { col: 10, row: 3 },
        { col: 11, row: 3 },
        { col: 12, row: 3 },
        { col: 13, row: 3 },
        { col: 14, row: 4 },
        { col: 15, row: 5 },
        { col: 16, row: 6 },
        { col: 17, row: 6 }
      ],
      [
        { col: 0, row: 8 },
        { col: 1, row: 8 },
        { col: 2, row: 8 },
        { col: 3, row: 8 },
        { col: 4, row: 8 },
        { col: 5, row: 8 },
        { col: 6, row: 8 },
        { col: 7, row: 7 },
        { col: 8, row: 7 },
        { col: 9, row: 7 },
        { col: 10, row: 7 },
        { col: 11, row: 7 },
        { col: 12, row: 7 },
        { col: 13, row: 7 },
        { col: 14, row: 7 },
        { col: 15, row: 7 },
        { col: 16, row: 6 },
        { col: 17, row: 6 }
      ]
    ]
  }
];

export const mapDefinition = mapStages[0];

export const getMapStage = (stageIndex: number): MapDefinition => {
  const safeIndex = Math.max(0, Math.floor(stageIndex));
  const fixedStage = mapStages[safeIndex];

  if (fixedStage) {
    return fixedStage;
  }

  return createProceduralMapStage(safeIndex);
};

const createProceduralMapStage = (stageIndex: number): MapDefinition => {
  if (stageIndex >= GRASS_TD_STAGE_INDEX) {
    return createGrassTdMapStage(stageIndex);
  }

  const extraIndex = stageIndex - mapStages.length + 1;
  const columns = Math.min(34, 20 + Math.floor(extraIndex * 2));
  const rows = Math.min(17, 11 + Math.floor(extraIndex * 0.8));
  const pathCount = Math.min(8, 4 + Math.floor(extraIndex * 0.75));
  const layout = getProceduralMapLayout(columns, rows);
  const baseRow = Math.floor(rows / 2) + (extraIndex % 2 === 0 ? 1 : 0);
  const paths = Array.from({ length: pathCount }, (_, pathIndex) =>
    createProceduralPath(columns, rows, pathIndex, extraIndex, baseRow)
  );

  return {
    id: `stage-proc-${String(stageIndex + 1).padStart(2, "0")}`,
    name: `Mapa Expandido ${stageIndex + 1}`,
    columns,
    rows,
    tileSize: layout.tileSize,
    origin: layout.origin,
    baseHp: mapDefinition.baseHp + Math.floor(extraIndex / 2) + pathCount * 2,
    startingCredits,
    paths
  };
};

const createGrassTdMapStage = (stageIndex: number): MapDefinition => {
  const paths = GRASS_TD_LANE_ROWS.map((row, laneIndex) =>
    createGrassTdLanePath(row, laneIndex)
  );

  return {
    id: `grass-td-${String(stageIndex + 1).padStart(2, "0")}`,
    name: "Campo Grass TD 100x100",
    columns: GRASS_TD_SIZE,
    rows: GRASS_TD_SIZE,
    tileSize: GRASS_TD_TILE_SIZE,
    origin: { x: 0, y: 0 },
    baseHp: 72,
    startingCredits,
    paths
  };
};

const createGrassTdLanePath = (laneRow: number, laneIndex: number): GridPoint[] => {
  const path: GridPoint[] = [{ col: 0, row: laneRow }];
  const firstBend = clampGrassRow(laneRow + (laneIndex % 2 === 0 ? 3 : -3));
  const secondBend = clampGrassRow(laneRow + ((laneIndex % 3) - 1) * 4);
  const mergeRow = 50;

  appendLine(path, 18, laneRow);
  appendLine(path, 18, firstBend);
  appendLine(path, 42, firstBend);
  appendLine(path, 42, laneRow);
  appendLine(path, 66, laneRow);
  appendLine(path, 66, secondBend);
  appendLine(path, 84, secondBend);
  appendLine(path, 84, mergeRow);
  appendLine(path, 99, mergeRow);

  return dedupeAdjacent(path);
};

const appendLine = (path: GridPoint[], targetCol: number, targetRow: number): void => {
  let current = path[path.length - 1];

  while (current.col !== targetCol) {
    current = {
      col: current.col + (current.col < targetCol ? 1 : -1),
      row: current.row
    };
    path.push(current);
  }

  while (current.row !== targetRow) {
    current = {
      col: current.col,
      row: current.row + (current.row < targetRow ? 1 : -1)
    };
    path.push(current);
  }
};

const clampGrassRow = (row: number): number =>
  Math.max(2, Math.min(GRASS_TD_SIZE - 3, row));

const getProceduralMapLayout = (columns: number, rows: number) => {
  const tileSize = Math.max(
    PROCEDURAL_MAP_MIN_TILE_SIZE,
    Math.floor(Math.min(43, PROCEDURAL_MAP_MAX_WIDTH / columns, PROCEDURAL_MAP_MAX_HEIGHT / rows))
  );
  const width = columns * tileSize;
  const height = rows * tileSize;

  return {
    tileSize,
    origin: {
      x: Math.max(253, Math.round((1280 - width) / 2) + 34),
      y: Math.max(76, Math.round((720 - height) / 2) + 12)
    }
  };
};

const createProceduralPath = (
  columns: number,
  rows: number,
  pathIndex: number,
  extraIndex: number,
  baseRow: number
) => {
  const startRows = [
    baseRow,
    Math.max(1, baseRow - 3),
    Math.min(rows - 2, baseRow + 3),
    Math.max(1, baseRow - 1),
    Math.min(rows - 2, baseRow + 1),
    Math.max(1, baseRow - 4)
  ];
  const points: { col: number; row: number }[] = [];
  let col = 0;
  let row = clampRow(startRows[pathIndex % startRows.length], rows);
  const endRow = clampRow(baseRow + (pathIndex % 2 === 0 ? 0 : pathIndex > 2 ? 1 : -1), rows);

  points.push({ col, row });

  while (col < columns - 1) {
    const segment = 2 + ((extraIndex + pathIndex + col) % 4);
    const targetCol = Math.min(columns - 1, col + segment);
    const shouldBend = col > 0 && targetCol < columns - 1;
    const bendAmplitude = 1 + ((extraIndex + pathIndex + targetCol) % 3);
    const bendDirection = (extraIndex + pathIndex + targetCol) % 2 === 0 ? 1 : -1;
    const targetRow = shouldBend
      ? clampRow(row + bendAmplitude * bendDirection, rows)
      : endRow;

    while (col < targetCol) {
      col += 1;
      points.push({ col, row });
    }

    while (row !== targetRow) {
      row += row < targetRow ? 1 : -1;
      points.push({ col, row });
    }
  }

  while (row !== endRow) {
    row += row < endRow ? 1 : -1;
    points.push({ col, row });
  }

  return dedupeAdjacent(points);
};

const clampRow = (row: number, rows: number): number =>
  Math.max(1, Math.min(rows - 2, row));

const dedupeAdjacent = (points: { col: number; row: number }[]) =>
  points.filter((point, index) => {
    const previous = points[index - 1];

    return !previous || previous.col !== point.col || previous.row !== point.row;
  });
