import type { PlayerId, SkillDefinition } from "../models/types";

type SkillEffectTotals = {
  rangeBonus: number;
  damageMultiplier: number;
  costMultiplier: number;
  rewardMultiplier: number;
};

export const skillDefinitions: readonly SkillDefinition[] = [
  {
    id: "p1-refraction-geometry",
    playerId: "p1",
    name: "Geometria de Refracao",
    shortName: "+Alcance",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "geometry",
    maxRank: 3,
    weight: 10,
    description: "Torres do P1 ganham alcance por leitura geometrica do campo.",
    effect: { rangeBonus: 14 }
  },
  {
    id: "p1-polished-focus",
    playerId: "p1",
    name: "Foco Polido",
    shortName: "+Dano",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "focus",
    maxRank: 3,
    weight: 9,
    description: "Disparos do P1 recebem multiplicador de dano.",
    effect: { damageMultiplier: 1.1 }
  },
  {
    id: "p1-blueprint-economy",
    playerId: "p1",
    name: "Cartografia de Obra",
    shortName: "-Custo",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "economy",
    maxRank: 2,
    weight: 8,
    description: "Torres do P1 ficam mais baratas por planejamento de construcao.",
    effect: { costMultiplier: 0.94 }
  },
  {
    id: "p1-prismatic-volley",
    playerId: "p1",
    name: "Rajada Prismatica",
    shortName: "+Dano II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "focus",
    maxRank: 2,
    weight: 5,
    description: "Foco de luz aumenta o dano das torres do P1 em rounds longos.",
    effect: { damageMultiplier: 1.16 }
  },
  {
    id: "p1-cathedral-sight",
    playerId: "p1",
    name: "Mira de Catedral",
    shortName: "+Alcance II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "geometry",
    maxRank: 2,
    weight: 5,
    description: "Linhas estruturais ampliam o controle de zona do P1.",
    effect: { rangeBonus: 22 }
  },
  {
    id: "p1-master-plan",
    playerId: "p1",
    name: "Plano Mestre",
    shortName: "Obra",
    tier: 3,
    costSigils: 3,
    rarity: "epic",
    branch: "economy",
    maxRank: 1,
    weight: 2,
    description: "Planejamento total reduz custo e melhora o alcance do P1.",
    effect: { costMultiplier: 0.9, rangeBonus: 16 }
  },
  {
    id: "p2-ritual-ledger",
    playerId: "p2",
    name: "Livro de Ofertas",
    shortName: "+Renda",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "economy",
    maxRank: 3,
    weight: 10,
    description: "Recompensas de abate do P2 aumentam.",
    effect: { rewardMultiplier: 1.12 }
  },
  {
    id: "p2-golden-ratio",
    playerId: "p2",
    name: "Proporcao Radial",
    shortName: "-Custo",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "geometry",
    maxRank: 3,
    weight: 9,
    description: "Torres do P2 ficam mais baratas por simetria de recursos.",
    effect: { costMultiplier: 0.94 }
  },
  {
    id: "p2-resonant-radius",
    playerId: "p2",
    name: "Raio Ressonante",
    shortName: "+Alcance",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "resonance",
    maxRank: 3,
    weight: 9,
    description: "Torres do P2 ganham alcance adicional.",
    effect: { rangeBonus: 12 }
  },
  {
    id: "p2-antiphon-yield",
    playerId: "p2",
    name: "Rendimento Antifonal",
    shortName: "+Renda II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "economy",
    maxRank: 2,
    weight: 5,
    description: "Chamadas e respostas convertem abates em mais economia.",
    effect: { rewardMultiplier: 1.18 }
  },
  {
    id: "p2-mandala-field",
    playerId: "p2",
    name: "Campo Mandala",
    shortName: "+Alcance II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "geometry",
    maxRank: 2,
    weight: 5,
    description: "Padroes radiais ampliam a cobertura das torres do P2.",
    effect: { rangeBonus: 20 }
  },
  {
    id: "p2-gilded-network",
    playerId: "p2",
    name: "Rede Dourada",
    shortName: "Rede",
    tier: 3,
    costSigils: 3,
    rarity: "epic",
    branch: "resonance",
    maxRank: 1,
    weight: 2,
    description: "Economia e ressonancia trabalham juntas em rotas longas.",
    effect: { rewardMultiplier: 1.2, costMultiplier: 0.92 }
  }
];

export const getSkillDefinition = (skillId: string): SkillDefinition => {
  const skill = skillDefinitions.find((definition) => definition.id === skillId);

  if (!skill) {
    throw new Error(`Skill definition not found: ${skillId}`);
  }

  return skill;
};

export const getSkillDefinitionsForPlayer = (playerId: PlayerId): SkillDefinition[] =>
  skillDefinitions
    .filter((skill) => skill.playerId === playerId)
    .sort((a, b) => a.tier - b.tier || b.weight - a.weight);

export const getSkillRank = (
  skillRanks: Record<string, number>,
  skillId: string
): number => skillRanks[skillId] ?? 0;

export const getNextSkillForPlayer = (
  playerId: PlayerId,
  skillRanks: Record<string, number>
): SkillDefinition | null =>
  getSkillDefinitionsForPlayer(playerId).find(
    (skill) => getSkillRank(skillRanks, skill.id) < skill.maxRank
  ) ?? null;

export const getRewardSkillChoices = (
  playerId: PlayerId,
  skillRanks: Record<string, number>,
  availableSigils: number,
  bossWaveId: string,
  choiceCount: number
): SkillDefinition[] => {
  const eligible = getSkillDefinitionsForPlayer(playerId).filter(
    (skill) =>
      getSkillRank(skillRanks, skill.id) < skill.maxRank && skill.costSigils <= availableSigils
  );

  const sorted = [...eligible].sort((a, b) => {
    const aScore = getDeterministicSkillScore(a, bossWaveId);
    const bScore = getDeterministicSkillScore(b, bossWaveId);

    return bScore - aScore;
  });

  return sorted.slice(0, choiceCount);
};

export const getSkillEffectTotals = (
  playerId: PlayerId,
  skillRanks: Record<string, number>
): SkillEffectTotals => {
  const totals: SkillEffectTotals = {
    rangeBonus: 0,
    damageMultiplier: 1,
    costMultiplier: 1,
    rewardMultiplier: 1
  };

  for (const skill of getSkillDefinitionsForPlayer(playerId)) {
    const rank = getSkillRank(skillRanks, skill.id);

    if (rank <= 0) {
      continue;
    }

    totals.rangeBonus += (skill.effect.rangeBonus ?? 0) * rank;
    totals.damageMultiplier *= Math.pow(skill.effect.damageMultiplier ?? 1, rank);
    totals.costMultiplier *= Math.pow(skill.effect.costMultiplier ?? 1, rank);
    totals.rewardMultiplier *= Math.pow(skill.effect.rewardMultiplier ?? 1, rank);
  }

  return totals;
};

const getDeterministicSkillScore = (skill: SkillDefinition, bossWaveId: string): number => {
  const seed = `${bossWaveId}:${skill.id}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }

  const rarityBias = skill.rarity === "epic" ? 12 : skill.rarity === "rare" ? 7 : 3;

  return hash + skill.weight * 100 + rarityBias - skill.tier * 8;
};
