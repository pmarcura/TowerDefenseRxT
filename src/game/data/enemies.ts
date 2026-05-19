import type { EnemyDefinition } from "../models/types";

export const enemyDefinitions: readonly EnemyDefinition[] = [
  {
    id: "runner",
    assetKey: "enemy.runner",
    name: "Drone Ceifador",
    maxHp: 42,
    speed: 104,
    armor: 0,
    reward: 9,
    baseDamage: 1,
    radius: 12,
    color: 0x7cf7bd,
    glow: 0x8effd0,
    traits: ["rapido", "leve", "drone", "tecnologico"]
  },
  {
    id: "tank",
    assetKey: "enemy.tank",
    name: "Tanque Industrial",
    maxHp: 156,
    speed: 48,
    armor: 5,
    reward: 20,
    baseDamage: 3,
    radius: 17,
    color: 0xffb84d,
    glow: 0xffd48a,
    traits: ["blindado", "lento", "maquina", "tecnologico"]
  },
  {
    id: "shield",
    assetKey: "enemy.shield",
    name: "Firewall Móvel",
    maxHp: 96,
    speed: 68,
    armor: 3,
    reward: 15,
    baseDamage: 2,
    radius: 15,
    color: 0xa891ff,
    glow: 0xc4b5ff,
    traits: ["escudo", "regular", "algoritmico", "tecnologico"]
  },
  {
    id: "swarm",
    assetKey: "enemy.swarm",
    name: "Enxame Nanobot",
    maxHp: 24,
    speed: 132,
    armor: 0,
    reward: 6,
    baseDamage: 1,
    radius: 9,
    color: 0xf7ff7a,
    glow: 0xfbffad,
    traits: ["enxame", "muito rapido", "nanobot", "tecnologico"]
  },
  {
    id: "oracle-drone",
    assetKey: "enemy.oracleDrone",
    name: "Drone de Vigilância",
    maxHp: 74,
    speed: 118,
    armor: 1,
    reward: 12,
    baseDamage: 1,
    radius: 11,
    color: 0x66f0ff,
    glow: 0xa8f8ff,
    traits: ["analitico", "rapido", "vigilancia", "tecnologico"]
  },
  {
    id: "synthetic-archivist",
    assetKey: "enemy.syntheticArchivist",
    name: "Arquivista de Dados",
    maxHp: 132,
    speed: 62,
    armor: 6,
    reward: 18,
    baseDamage: 2,
    radius: 16,
    color: 0xd7e2ff,
    glow: 0xffffff,
    traits: ["adaptativo", "blindado", "memoria", "tecnologico"]
  },
  {
    id: "boss-reliquary",
    assetKey: "enemy.bossReliquary",
    name: "Boss: Robô Idolátrico",
    maxHp: 1350,
    speed: 42,
    armor: 16,
    reward: 64,
    baseDamage: 10,
    radius: 24,
    color: 0xff4f9a,
    glow: 0xff9ac5,
    traits: ["boss", "blindado", "robo", "tecnologico"]
  }
];

export const getEnemyDefinition = (enemyId: string): EnemyDefinition => {
  const enemy = enemyDefinitions.find((definition) => definition.id === enemyId);

  if (!enemy) {
    throw new Error(`Enemy definition not found: ${enemyId}`);
  }

  return enemy;
};
