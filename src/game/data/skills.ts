import type { PlayerId, SkillDefinition, SkillEffect, SkillRarity } from "../models/types";

type SkillEffectTotals = {
  rangeBonus: number;
  damageMultiplier: number;
  costMultiplier: number;
  rewardMultiplier: number;
};

type SkillTemplate = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly tier: number;
  readonly costSigils: number;
  readonly rarity: SkillRarity;
  readonly branch: SkillDefinition["branch"];
  readonly maxRank: number;
  readonly weight: number;
  readonly description: string;
  readonly effect: SkillEffect;
};

const skillTemplates: readonly SkillTemplate[] = [
  {
    id: "refraction-geometry",
    name: "Geometria de Refracao",
    shortName: "+Alcance",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "geometry",
    maxRank: 3,
    weight: 10,
    description: "Torres deste jogador ganham alcance por leitura geometrica do campo.",
    effect: { rangeBonus: 14 }
  },
  {
    id: "polished-focus",
    name: "Foco Polido",
    shortName: "+Dano",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "focus",
    maxRank: 3,
    weight: 9,
    description: "Disparos deste jogador recebem multiplicador de dano.",
    effect: { damageMultiplier: 1.1 }
  },
  {
    id: "blueprint-economy",
    name: "Cartografia de Obra",
    shortName: "-Custo",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "economy",
    maxRank: 2,
    weight: 8,
    description: "Torres deste jogador ficam mais baratas por planejamento de construcao.",
    effect: { costMultiplier: 0.94 }
  },
  {
    id: "ritual-ledger",
    name: "Livro de Ofertas",
    shortName: "+Renda",
    tier: 1,
    costSigils: 1,
    rarity: "common",
    branch: "economy",
    maxRank: 3,
    weight: 8,
    description: "Recompensas de abate deste jogador aumentam.",
    effect: { rewardMultiplier: 1.12 }
  },
  {
    id: "prismatic-volley",
    name: "Rajada Prismatica",
    shortName: "+Dano II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "focus",
    maxRank: 2,
    weight: 5,
    description: "Foco de luz aumenta o dano das torres deste jogador em rounds longos.",
    effect: { damageMultiplier: 1.16 }
  },
  {
    id: "cathedral-sight",
    name: "Mira de Catedral",
    shortName: "+Alcance II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "geometry",
    maxRank: 2,
    weight: 5,
    description: "Linhas estruturais ampliam o controle de zona deste jogador.",
    effect: { rangeBonus: 22 }
  },
  {
    id: "antiphon-yield",
    name: "Rendimento Antifonal",
    shortName: "+Renda II",
    tier: 2,
    costSigils: 2,
    rarity: "rare",
    branch: "economy",
    maxRank: 2,
    weight: 4,
    description: "Chamadas e respostas convertem abates em mais economia.",
    effect: { rewardMultiplier: 1.18 }
  },
  {
    id: "master-plan",
    name: "Plano Mestre",
    shortName: "Obra",
    tier: 3,
    costSigils: 3,
    rarity: "epic",
    branch: "economy",
    maxRank: 1,
    weight: 2,
    description: "Planejamento total reduz custo e melhora o alcance deste jogador.",
    effect: { costMultiplier: 0.9, rangeBonus: 16 }
  },
  {
    id: "gilded-network",
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

export const skillDefinitions: readonly SkillDefinition[] = skillTemplates.flatMap((template) =>
  (["p1", "p2"] as const).map((playerId) => instantiateSkill(playerId, template))
);

export const getSkillDefinition = (skillId: string): SkillDefinition => {
  const parsed = parseSkillId(skillId);

  if (!parsed) {
    throw new Error(`Skill definition not found: ${skillId}`);
  }

  return instantiateSkill(parsed.playerId, parsed.template);
};

export const getSkillDefinitionsForPlayer = (playerId: PlayerId): SkillDefinition[] =>
  skillTemplates
    .map((template) => instantiateSkill(playerId, template))
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

function instantiateSkill(playerId: PlayerId, template: SkillTemplate): SkillDefinition {
  return {
    ...template,
    id: `${playerId}-${template.id}`,
    playerId
  };
}

const parseSkillId = (
  skillId: string
): { playerId: PlayerId; template: SkillTemplate } | null => {
  const separatorIndex = skillId.indexOf("-");

  if (separatorIndex <= 0) {
    return null;
  }

  const playerId = skillId.slice(0, separatorIndex) as PlayerId;
  const templateId = skillId.slice(separatorIndex + 1);
  const template = skillTemplates.find((candidate) => candidate.id === templateId);

  return template ? { playerId, template } : null;
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
