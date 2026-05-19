import type { WaveDefinition } from "../models/types";

export const waveDefinitions: readonly WaveDefinition[] = [
  {
    id: "wave-01",
    name: "Procissao Inicial",
    mapStageIndex: 0,
    groups: [{ enemyTypeId: "runner", count: 8, intervalMs: 700, startDelayMs: 300 }]
  },
  {
    id: "wave-02",
    name: "Primeira Guarda",
    mapStageIndex: 0,
    groups: [
      { enemyTypeId: "runner", count: 9, intervalMs: 590, startDelayMs: 220 },
      { enemyTypeId: "shield", count: 3, intervalMs: 1060, startDelayMs: 1550 }
    ]
  },
  {
    id: "wave-03",
    name: "Nave Alongada",
    mapStageIndex: 1,
    groups: [
      { enemyTypeId: "swarm", count: 18, intervalMs: 230, startDelayMs: 360, pathIndex: 0 },
      { enemyTypeId: "runner", count: 9, intervalMs: 450, startDelayMs: 1200, pathIndex: 0 }
    ]
  },
  {
    id: "wave-04",
    name: "Muralha Movel",
    mapStageIndex: 1,
    groups: [
      { enemyTypeId: "tank", count: 4, intervalMs: 1340, startDelayMs: 420 },
      { enemyTypeId: "shield", count: 8, intervalMs: 700, startDelayMs: 1100, pathIndex: 0 }
    ]
  },
  {
    id: "wave-05",
    name: "Boss: Reliquiario Solitario",
    isBoss: true,
    mapStageIndex: 2,
    bossRewardSigils: 1,
    groups: [
      { enemyTypeId: "boss-reliquary", count: 1, intervalMs: 1000, startDelayMs: 500, pathIndex: 0 },
      { enemyTypeId: "runner", count: 16, intervalMs: 440, startDelayMs: 1120, pathIndex: 1 },
      { enemyTypeId: "shield", count: 6, intervalMs: 760, startDelayMs: 1900, pathIndex: 1 },
      { enemyTypeId: "oracle-drone", count: 7, intervalMs: 500, startDelayMs: 2600, pathIndex: 1 }
    ]
  },
  {
    id: "wave-06",
    name: "Retorno Ampliado",
    mapStageIndex: 3,
    groups: [
      { enemyTypeId: "runner", count: 22, intervalMs: 320, startDelayMs: 260, pathIndex: 0 },
      { enemyTypeId: "shield", count: 11, intervalMs: 600, startDelayMs: 980, pathIndex: 1 },
      { enemyTypeId: "oracle-drone", count: 7, intervalMs: 520, startDelayMs: 1850, pathIndex: 1 }
    ]
  },
  {
    id: "wave-07",
    name: "Duas Procissoes",
    mapStageIndex: 3,
    groups: [
      { enemyTypeId: "swarm", count: 34, intervalMs: 175, startDelayMs: 320, pathIndex: 0 },
      { enemyTypeId: "tank", count: 6, intervalMs: 1040, startDelayMs: 620, pathIndex: 0 },
      { enemyTypeId: "runner", count: 22, intervalMs: 310, startDelayMs: 1250, pathIndex: 1 },
      { enemyTypeId: "oracle-drone", count: 8, intervalMs: 460, startDelayMs: 2100, pathIndex: 1 },
      { enemyTypeId: "synthetic-archivist", count: 3, intervalMs: 780, startDelayMs: 3000, pathIndex: 1 }
    ]
  },
  {
    id: "wave-08",
    name: "Veu de Escudos",
    mapStageIndex: 3,
    groups: [
      { enemyTypeId: "shield", count: 18, intervalMs: 450, startDelayMs: 280, pathIndex: 1 },
      { enemyTypeId: "runner", count: 24, intervalMs: 285, startDelayMs: 1100, pathIndex: 0 },
      { enemyTypeId: "tank", count: 4, intervalMs: 1080, startDelayMs: 1750, pathIndex: 0 },
      { enemyTypeId: "synthetic-archivist", count: 5, intervalMs: 780, startDelayMs: 2320, pathIndex: 1 }
    ]
  },
  {
    id: "wave-09",
    name: "Clamor Triplo",
    mapStageIndex: 4,
    groups: [
      { enemyTypeId: "tank", count: 8, intervalMs: 940, startDelayMs: 220, pathIndex: 0 },
      { enemyTypeId: "swarm", count: 38, intervalMs: 175, startDelayMs: 760, pathIndex: 2 },
      { enemyTypeId: "shield", count: 16, intervalMs: 520, startDelayMs: 1600, pathIndex: 1 },
      { enemyTypeId: "oracle-drone", count: 10, intervalMs: 460, startDelayMs: 2250, pathIndex: 2 },
      { enemyTypeId: "synthetic-archivist", count: 5, intervalMs: 740, startDelayMs: 3000, pathIndex: 1 }
    ]
  },
  {
    id: "wave-10",
    name: "Boss: Duas Reliquias",
    isBoss: true,
    mapStageIndex: 4,
    bossRewardSigils: 2,
    groups: [
      { enemyTypeId: "boss-reliquary", count: 1, intervalMs: 1000, startDelayMs: 500, pathIndex: 0 },
      { enemyTypeId: "boss-reliquary", count: 1, intervalMs: 1000, startDelayMs: 2300, pathIndex: 1 },
      { enemyTypeId: "boss-reliquary", count: 1, intervalMs: 1000, startDelayMs: 3800, pathIndex: 2 },
      { enemyTypeId: "swarm", count: 44, intervalMs: 132, startDelayMs: 1000, pathIndex: 2 },
      { enemyTypeId: "runner", count: 18, intervalMs: 260, startDelayMs: 1600, pathIndex: 0 },
      { enemyTypeId: "shield", count: 14, intervalMs: 450, startDelayMs: 2500, pathIndex: 1 },
      { enemyTypeId: "oracle-drone", count: 9, intervalMs: 360, startDelayMs: 3150, pathIndex: 2 },
      { enemyTypeId: "synthetic-archivist", count: 7, intervalMs: 620, startDelayMs: 3600, pathIndex: 2 }
    ]
  }
];

export const ENDLESS_BOSS_INTERVAL = 5;
export const ENDLESS_TIMELINE_SIZE = 10;

export const getWaveDefinition = (waveIndex: number): WaveDefinition => {
  const safeIndex = Math.max(0, Math.floor(waveIndex));
  const fixedWave = waveDefinitions[safeIndex];

  if (fixedWave) {
    return fixedWave;
  }

  return createProceduralWave(safeIndex);
};

export const getWaveDefinitionsForAnalysis = (count: number): readonly WaveDefinition[] =>
  Array.from({ length: Math.max(1, Math.floor(count)) }, (_, index) => getWaveDefinition(index));

export const getWaveTimelineWindow = (
  currentWaveIndex: number,
  size = ENDLESS_TIMELINE_SIZE
): readonly { wave: WaveDefinition; index: number }[] => {
  const safeSize = Math.max(3, Math.floor(size));
  const start = Math.max(0, currentWaveIndex - Math.floor(safeSize / 2));

  return Array.from({ length: safeSize }, (_, offset) => {
    const index = start + offset;

    return {
      index,
      wave: getWaveDefinition(index)
    };
  });
};

export const getWaveThreat = (wave: WaveDefinition): number => {
  const rawThreat = wave.groups.reduce((sum, group) => {
    const enemyWeight = getEnemyThreatWeight(group.enemyTypeId);
    const routePressure = 1 + (group.pathIndex ?? 0) * 0.06;

    return sum + group.count * enemyWeight * routePressure + (wave.isBoss ? 28 : 0);
  }, 0);

  return Math.min(99, Math.max(1, Math.round(rawThreat)));
};

const createProceduralWave = (waveIndex: number): WaveDefinition => {
  const waveNumber = waveIndex + 1;
  const endlessIndex = waveIndex - waveDefinitions.length + 1;
  const isBoss = waveNumber % ENDLESS_BOSS_INTERVAL === 0;
  const mapStageIndex = 4 + Math.floor(endlessIndex * 0.72);
  const routeCount = Math.min(6, 3 + Math.floor((mapStageIndex - 4) / 2));
  const pressureTier = 1 + endlessIndex * 0.16;
  const routeIndexes = Array.from({ length: routeCount }, (_, index) => index);
  const groups = isBoss
    ? createProceduralBossGroups(waveNumber, pressureTier, routeIndexes)
    : createProceduralCombatGroups(waveNumber, pressureTier, routeIndexes);

  return {
    id: `wave-${String(waveNumber).padStart(2, "0")}`,
    name: isBoss
      ? `Boss: Nucleo Autonomo ${Math.floor(waveNumber / ENDLESS_BOSS_INTERVAL)}`
      : `Incursao Tech ${waveNumber}`,
    isBoss,
    mapStageIndex,
    bossRewardSigils: isBoss ? Math.min(3, 1 + Math.floor(waveNumber / 15)) : undefined,
    groups
  };
};

const createProceduralCombatGroups = (
  waveNumber: number,
  pressureTier: number,
  routeIndexes: readonly number[]
) => {
  const primaryRoute = routeIndexes[waveNumber % routeIndexes.length] ?? 0;
  const secondaryRoute = routeIndexes[(waveNumber + 1) % routeIndexes.length] ?? primaryRoute;
  const tertiaryRoute = routeIndexes[(waveNumber + 2) % routeIndexes.length] ?? secondaryRoute;
  const scale = 1 + Math.floor((waveNumber - 11) / 3) * 0.12;

  return [
    {
      enemyTypeId: waveNumber % 3 === 0 ? "swarm" : "runner",
      count: Math.round((24 + pressureTier * 5) * scale),
      intervalMs: Math.max(110, Math.round(320 - pressureTier * 10)),
      startDelayMs: 260,
      pathIndex: primaryRoute
    },
    {
      enemyTypeId: waveNumber % 4 === 0 ? "tank" : "shield",
      count: Math.round(8 + pressureTier * 2.2),
      intervalMs: Math.max(420, Math.round(760 - pressureTier * 18)),
      startDelayMs: 1050,
      pathIndex: secondaryRoute
    },
    {
      enemyTypeId: waveNumber % 2 === 0 ? "oracle-drone" : "synthetic-archivist",
      count: Math.round(6 + pressureTier * 1.7),
      intervalMs: Math.max(360, Math.round(620 - pressureTier * 12)),
      startDelayMs: 2100,
      pathIndex: tertiaryRoute
    }
  ] as const;
};

const createProceduralBossGroups = (
  waveNumber: number,
  pressureTier: number,
  routeIndexes: readonly number[]
) => {
  const bossCount = Math.min(routeIndexes.length, 1 + Math.floor(waveNumber / 10));
  const bossGroups = routeIndexes.slice(0, bossCount).map((pathIndex, index) => ({
    enemyTypeId: "boss-reliquary",
    count: 1,
    intervalMs: 1000,
    startDelayMs: 500 + index * 1350,
    pathIndex
  }));
  const supportGroups = [
    {
      enemyTypeId: "swarm",
      count: Math.round(38 + pressureTier * 6),
      intervalMs: Math.max(95, Math.round(150 - pressureTier * 3)),
      startDelayMs: 900,
      pathIndex: routeIndexes.at(-1) ?? 0
    },
    {
      enemyTypeId: "shield",
      count: Math.round(12 + pressureTier * 2.6),
      intervalMs: Math.max(360, Math.round(520 - pressureTier * 9)),
      startDelayMs: 1900,
      pathIndex: routeIndexes[1] ?? 0
    },
    {
      enemyTypeId: "synthetic-archivist",
      count: Math.round(6 + pressureTier * 1.8),
      intervalMs: Math.max(420, Math.round(680 - pressureTier * 10)),
      startDelayMs: 2850,
      pathIndex: routeIndexes[2] ?? routeIndexes[0] ?? 0
    }
  ];

  return [...bossGroups, ...supportGroups];
};

const getEnemyThreatWeight = (enemyTypeId: string): number => {
  if (enemyTypeId.includes("boss")) {
    return 13.5;
  }

  if (enemyTypeId === "tank") {
    return 6.4;
  }

  if (enemyTypeId === "shield" || enemyTypeId === "synthetic-archivist") {
    return 4.8;
  }

  if (enemyTypeId === "oracle-drone") {
    return 3.8;
  }

  if (enemyTypeId === "swarm") {
    return 1.8;
  }

  return 2.6;
};
