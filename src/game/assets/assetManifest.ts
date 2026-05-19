import type { AssetKey } from "../models/types";

export type AssetDefinition = {
  key: AssetKey;
  url: string;
  type: "svg";
};

export const assetManifest: readonly AssetDefinition[] = [
  { key: "tower.vitrail", url: "/assets/sprites/tower-vitrail.svg", type: "svg" },
  { key: "tower.mandala", url: "/assets/sprites/tower-mandala.svg", type: "svg" },
  { key: "tower.obelisk", url: "/assets/sprites/tower-obelisk.svg", type: "svg" },
  { key: "tower.chant", url: "/assets/sprites/tower-chant.svg", type: "svg" },
  { key: "tower.mihrab", url: "/assets/sprites/tower-mihrab.svg", type: "svg" },
  { key: "tower.torii", url: "/assets/sprites/tower-torii.svg", type: "svg" },
  { key: "tower.stupa", url: "/assets/sprites/tower-stupa.svg", type: "svg" },
  { key: "tower.axeDrum", url: "/assets/sprites/tower-axe-drum.svg", type: "svg" },
  { key: "tower.giraPoint", url: "/assets/sprites/tower-gira-point.svg", type: "svg" },
  { key: "enemy.runner", url: "/assets/sprites/enemy-runner.svg", type: "svg" },
  { key: "enemy.tank", url: "/assets/sprites/enemy-tank.svg", type: "svg" },
  { key: "enemy.shield", url: "/assets/sprites/enemy-shield.svg", type: "svg" },
  { key: "enemy.swarm", url: "/assets/sprites/enemy-swarm.svg", type: "svg" },
  { key: "enemy.oracleDrone", url: "/assets/sprites/enemy-oracle-drone.svg", type: "svg" },
  {
    key: "enemy.syntheticArchivist",
    url: "/assets/sprites/enemy-synthetic-archivist.svg",
    type: "svg"
  },
  { key: "enemy.bossReliquary", url: "/assets/sprites/enemy-boss-reliquary.svg", type: "svg" },
  { key: "world.baseCore", url: "/assets/sprites/world-base-core.svg", type: "svg" },
  { key: "world.spawnGate", url: "/assets/sprites/world-spawn-gate.svg", type: "svg" }
];
