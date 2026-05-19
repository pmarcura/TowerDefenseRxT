export const towerProgression = {
  maxLevel: 5,
  xpPerKill: 1,
  xpToNextByLevel: {
    1: 4,
    2: 7,
    3: 11,
    4: 17
  },
  damageBonusPerLevel: 0.16,
  rangeBonusPerLevel: 7,
  cooldownReductionPerLevel: 0.045,
  minimumCooldownMultiplier: 0.78
} as const;

export const getTowerXpToNextLevel = (level: number): number => {
  if (level >= towerProgression.maxLevel) {
    return 0;
  }

  return towerProgression.xpToNextByLevel[level as keyof typeof towerProgression.xpToNextByLevel];
};

export const getTowerLevelBonuses = (level: number) => {
  const completedLevels = Math.max(0, level - 1);
  const cooldownMultiplier = Math.max(
    towerProgression.minimumCooldownMultiplier,
    1 - completedLevels * towerProgression.cooldownReductionPerLevel
  );

  return {
    damageMultiplier: 1 + completedLevels * towerProgression.damageBonusPerLevel,
    rangeBonus: completedLevels * towerProgression.rangeBonusPerLevel,
    cooldownMultiplier
  };
};
