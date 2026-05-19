import type {
  TowerAutoBuildId,
  TowerBranchRanks,
  TowerEntity,
  TowerUpgradeBranchId
} from "../models/types";

export type TowerBranchEffectTotals = {
  damageMultiplier: number;
  rangeBonus: number;
  cooldownMultiplier: number;
  projectileSpeedMultiplier: number;
  slowDurationBonusMs: number;
  splashRadiusBonus: number;
  splashDamageMultiplier: number;
  chainJumpsBonus: number;
  chainRangeBonus: number;
  chainDamageMultiplier: number;
};

export type TowerBranchDefinition = {
  id: TowerUpgradeBranchId;
  name: string;
  shortName: string;
  role: string;
  description: string;
  visual: string;
  color: number;
  maxRank: number;
  rankSummary: string;
};

export type TowerAutoBuildDefinition = {
  id: TowerAutoBuildId;
  name: string;
  description: string;
  sequence: readonly TowerUpgradeBranchId[];
};

export const towerBranchDefinitions: readonly TowerBranchDefinition[] = [
  {
    id: "focus",
    name: "Foco Prismático",
    shortName: "Foco",
    role: "dano direto",
    description: "Converte a torre em execução de alvo prioritário. Cada ponto aumenta dano bruto.",
    visual: "Núcleo azul concentrado e anel interno mais brilhante.",
    color: 0x83f3ff,
    maxRank: 4,
    rankSummary: "+12% dano por ponto"
  },
  {
    id: "reach",
    name: "Arquitetura Longa",
    shortName: "Alcance",
    role: "cobertura",
    description: "Amplia zona de controle e velocidade de projétil para cobrir rotas mais extensas.",
    visual: "Linhas brancas externas marcando área de domínio.",
    color: 0xe7f3ff,
    maxRank: 4,
    rankSummary: "+14 alcance e +4% velocidade de projétil por ponto"
  },
  {
    id: "tempo",
    name: "Ritmo Coral",
    shortName: "Ritmo",
    role: "cadência",
    description: "Acelera disparos. Em torres de lentidão, aumenta a duração do controle.",
    visual: "Pulso dourado em compassos curtos ao redor da torre.",
    color: 0xffe39d,
    maxRank: 4,
    rankSummary: "-5% recarga e +140ms slow por ponto"
  },
  {
    id: "rupture",
    name: "Ruptura do Obelisco",
    shortName: "Ruptura",
    role: "área",
    description: "Adiciona dano em área mesmo a torres que antes batiam em um só alvo.",
    visual: "Halo rosa pesado e marcas triangulares de impacto.",
    color: 0xff6d8b,
    maxRank: 4,
    rankSummary: "+16 raio de explosão por ponto"
  },
  {
    id: "synod",
    name: "Sínodo Ressonante",
    shortName: "Sínodo",
    role: "propagação",
    description: "Faz disparos saltarem entre ameaças próximas. Excelente contra rotas paralelas.",
    visual: "Arcos verdes orbitais ligando pontos próximos.",
    color: 0xb4ff72,
    maxRank: 4,
    rankSummary: "+1 salto a cada 2 pontos e +16 alcance de salto por ponto"
  }
];

export const towerAutoBuildDefinitions: readonly TowerAutoBuildDefinition[] = [
  {
    id: "balanced",
    name: "Equilíbrio",
    description: "Distribui pontos para uma torre segura em qualquer wave.",
    sequence: ["focus", "reach", "tempo", "rupture", "synod"]
  },
  {
    id: "boss",
    name: "Quebra-Boss",
    description: "Prioriza dano, alcance e cadência para segurar alvos grandes.",
    sequence: ["focus", "tempo", "reach", "focus", "rupture"]
  },
  {
    id: "crowd",
    name: "Anti-Enxame",
    description: "Prioriza área e propagação para ondas densas.",
    sequence: ["rupture", "synod", "tempo", "rupture", "reach"]
  }
];

export const createEmptyTowerBranchRanks = (): TowerBranchRanks => ({
  focus: 0,
  reach: 0,
  tempo: 0,
  rupture: 0,
  synod: 0
});

export const getTowerBranchDefinition = (
  branchId: TowerUpgradeBranchId
): TowerBranchDefinition => {
  const branch = towerBranchDefinitions.find((definition) => definition.id === branchId);

  if (!branch) {
    throw new Error(`Tower branch definition not found: ${branchId}`);
  }

  return branch;
};

export const getTowerAutoBuildDefinition = (
  buildId: TowerAutoBuildId
): TowerAutoBuildDefinition => {
  const build = towerAutoBuildDefinitions.find((definition) => definition.id === buildId);

  if (!build) {
    throw new Error(`Tower auto build definition not found: ${buildId}`);
  }

  return build;
};

export const getTowerBranchEffectTotals = (
  ranks: TowerBranchRanks
): TowerBranchEffectTotals => ({
  damageMultiplier: 1 + ranks.focus * 0.12,
  rangeBonus: ranks.reach * 14,
  cooldownMultiplier: Math.pow(0.95, ranks.tempo),
  projectileSpeedMultiplier: 1 + ranks.reach * 0.04,
  slowDurationBonusMs: ranks.tempo * 140,
  splashRadiusBonus: ranks.rupture * 16,
  splashDamageMultiplier: ranks.rupture > 0 ? 0.2 + ranks.rupture * 0.06 : 0,
  chainJumpsBonus: Math.floor(ranks.synod / 2),
  chainRangeBonus: ranks.synod * 16,
  chainDamageMultiplier: ranks.synod > 0 ? 0.24 + ranks.synod * 0.05 : 0
});

export const getDominantTowerBranch = (
  ranks: TowerBranchRanks
): TowerBranchDefinition | null => {
  const sortedBranches = [...towerBranchDefinitions]
    .filter((branch) => ranks[branch.id] > 0)
    .sort((a, b) => ranks[b.id] - ranks[a.id]);

  return sortedBranches[0] ?? null;
};

export const spendTowerBranchPoint = (
  tower: TowerEntity,
  branchId: TowerUpgradeBranchId
): boolean => {
  const branch = getTowerBranchDefinition(branchId);

  if (tower.skillPoints <= 0 || tower.branchRanks[branchId] >= branch.maxRank) {
    return false;
  }

  tower.skillPoints -= 1;
  tower.branchRanks[branchId] += 1;

  return true;
};

export const applyTowerAutoBuild = (tower: TowerEntity): TowerUpgradeBranchId[] => {
  const spentBranches: TowerUpgradeBranchId[] = [];
  const build = getTowerAutoBuildDefinition(tower.autoBuildId);

  while (tower.skillPoints > 0) {
    const branchId = chooseNextAutoBranch(tower, build.sequence);

    if (!branchId) {
      break;
    }

    if (!spendTowerBranchPoint(tower, branchId)) {
      break;
    }

    spentBranches.push(branchId);
  }

  return spentBranches;
};

const chooseNextAutoBranch = (
  tower: TowerEntity,
  sequence: readonly TowerUpgradeBranchId[]
): TowerUpgradeBranchId | null => {
  const eligibleBranches = sequence.filter(
    (branchId) => tower.branchRanks[branchId] < getTowerBranchDefinition(branchId).maxRank
  );

  if (eligibleBranches.length === 0) {
    return null;
  }

  return [...eligibleBranches].sort(
    (a, b) => tower.branchRanks[a] - tower.branchRanks[b]
  )[0];
};
