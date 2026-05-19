import type { MapDefinition } from "../models/types";

const startingCreditsByPlayer = {
  p1: 132,
  p2: 132
} as const;

export const mapStages: readonly MapDefinition[] = [
  {
    id: "stage-01",
    name: "Atrio Curto",
    columns: 14,
    rows: 9,
    tileSize: 43,
    origin: { x: 253, y: 126 },
    baseHp: 24,
    startingCreditsByPlayer,
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
    startingCreditsByPlayer,
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
    startingCreditsByPlayer,
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
    startingCreditsByPlayer,
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
    startingCreditsByPlayer,
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
  const extraIndex = stageIndex - mapStages.length + 1;
  const columns = Math.min(24, 18 + Math.floor(extraIndex / 2));
  const rows = Math.min(12, 10 + Math.floor(extraIndex / 4));
  const pathCount = Math.min(6, 3 + Math.floor(extraIndex / 2));
  const baseRow = Math.floor(rows / 2) + (extraIndex % 2 === 0 ? 1 : 0);
  const paths = Array.from({ length: pathCount }, (_, pathIndex) =>
    createProceduralPath(columns, rows, pathIndex, extraIndex, baseRow)
  );

  return {
    id: `stage-proc-${String(stageIndex + 1).padStart(2, "0")}`,
    name: `Mapa Expandido ${stageIndex + 1}`,
    columns,
    rows,
    tileSize: 43,
    origin: {
      x: Math.max(186, 253 - Math.max(0, columns - 18) * 18),
      y: Math.max(96, 126 - Math.max(0, rows - 10) * 10)
    },
    baseHp: mapDefinition.baseHp + Math.floor(extraIndex / 3),
    startingCreditsByPlayer,
    paths
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
