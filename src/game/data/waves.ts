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
