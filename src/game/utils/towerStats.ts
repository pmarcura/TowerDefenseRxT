import { getPlayerClassDefinition } from "../data/playerClasses";
import { getSkillEffectTotals } from "../data/skills";
import {
  createEmptyTowerBranchRanks,
  getTowerBranchDefinition,
  getTowerBranchEffectTotals
} from "../data/towerBranches";
import { getTowerDefinition } from "../data/towers";
import { getTowerLevelBonuses } from "../data/towerProgression";
import type {
  GameState,
  PlayerId,
  TowerBranchRanks,
  TowerEntity,
  TowerRuntimeStats
} from "../models/types";

type TowerStatInput = {
  towerId: string;
  playerId: PlayerId;
  level: number;
  kills: number;
  damageDealt: number;
  skillPoints: number;
  branchRanks: TowerBranchRanks;
};

export const calculateTowerCost = (
  state: GameState,
  playerId: PlayerId,
  towerId: string
): number => {
  const tower = getTowerDefinition(towerId);
  const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
  const skillEffects = getSkillEffectTotals(playerId, state.skillTrees[playerId].skillRanks);

  return Math.ceil(tower.cost * playerClass.costMultiplier * skillEffects.costMultiplier);
};

export const calculateTowerRuntimeStats = (
  state: GameState,
  tower: TowerEntity
): TowerRuntimeStats =>
  calculateStats(state, {
    towerId: tower.typeId,
    playerId: tower.ownerId,
    level: tower.level,
    kills: tower.kills,
    damageDealt: tower.damageDealt,
    skillPoints: tower.skillPoints,
    branchRanks: tower.branchRanks
  });

export const calculateTowerPreviewStats = (
  state: GameState,
  playerId: PlayerId,
  towerId: string
): TowerRuntimeStats =>
  calculateStats(state, {
    towerId,
    playerId,
    level: 1,
    kills: 0,
    damageDealt: 0,
    skillPoints: 0,
    branchRanks: createEmptyTowerBranchRanks()
  });

const calculateStats = (state: GameState, input: TowerStatInput): TowerRuntimeStats => {
  const definition = getTowerDefinition(input.towerId);
  const playerClass = getPlayerClassDefinition(state.playerClasses[input.playerId]);
  const skillEffects = getSkillEffectTotals(input.playerId, state.skillTrees[input.playerId].skillRanks);
  const levelBonuses = getTowerLevelBonuses(input.level);
  const branchEffects = getTowerBranchEffectTotals(input.branchRanks);
  const damagePerShot =
    definition.damage *
    playerClass.damageMultiplier *
    skillEffects.damageMultiplier *
    levelBonuses.damageMultiplier *
    branchEffects.damageMultiplier;
  const cooldownMs =
    definition.cooldownMs * levelBonuses.cooldownMultiplier * branchEffects.cooldownMultiplier;
  const shotsPerSecond = 1000 / cooldownMs;
  const range =
    definition.range +
    playerClass.rangeBonus +
    skillEffects.rangeBonus +
    levelBonuses.rangeBonus +
    branchEffects.rangeBonus;
  const slowDuration = (definition.slowDurationMs ?? 0) + branchEffects.slowDurationBonusMs;
  const splashRadius = (definition.splashRadius ?? 0) + branchEffects.splashRadiusBonus;
  const chainJumps = (definition.chainJumps ?? 0) + branchEffects.chainJumpsBonus;
  const chainRange = (definition.chainRange ?? 0) + branchEffects.chainRangeBonus;

  return {
    towerId: definition.id,
    name: definition.name,
    shortName: definition.shortName,
    role: definition.role,
    level: input.level,
    damagePerShot,
    cooldownMs,
    shotsPerSecond,
    dps: damagePerShot * shotsPerSecond,
    range,
    effect: definition.effect,
    effectLabel: getEffectLabel(definition.effect),
    effectDetails: getEffectDetails(
      definition.effect,
      definition.slowMultiplier,
      slowDuration,
      splashRadius,
      chainJumps,
      chainRange,
      definition.incomePerTick,
      definition.incomeIntervalMs
    ),
    branchSummary: getBranchSummary(input.branchRanks),
    kills: input.kills,
    damageDealt: input.damageDealt,
    skillPoints: input.skillPoints
  };
};

const getEffectLabel = (effect: TowerRuntimeStats["effect"]): string => {
  if (effect === "slow") {
    return "Controle";
  }

  if (effect === "splash") {
    return "Area";
  }

  if (effect === "chain") {
    return "Corrente";
  }

  if (effect === "income") {
    return "Renda";
  }

  if (effect === "summon") {
    return "Aliados";
  }

  if (effect === "aura") {
    return "Aura";
  }

  if (effect === "cleanse") {
    return "Quebra-escudo";
  }

  if (effect === "mark") {
    return "Marca";
  }

  if (effect === "ritual-zone") {
    return "Zona";
  }

  if (effect === "redirect") {
    return "Empurra";
  }

  return "Precisao";
};

const getEffectDetails = (
  effect: TowerRuntimeStats["effect"],
  slowMultiplier = 1,
  slowDurationMs: number,
  splashRadius: number,
  chainJumps: number,
  chainRange: number,
  incomePerTick = 0,
  incomeIntervalMs = 0
): readonly string[] => {
  if (effect === "slow") {
    return [
      `slow ${Math.round((1 - slowMultiplier) * 100)}%`,
      `${(slowDurationMs / 1000).toFixed(1)}s`
    ];
  }

  if (effect === "splash") {
    return [`raio ${Math.round(splashRadius)}`, "dano em area"];
  }

  if (effect === "chain") {
    return [`${chainJumps} saltos`, `elo ${Math.round(chainRange)}`];
  }

  if (effect === "income") {
    return [`+${incomePerTick} creditos`, `cada ${(incomeIntervalMs / 1000).toFixed(1)}s`];
  }

  if (effect === "summon") {
    return ["invoca aliados", "sobem a rota"];
  }

  if (effect === "aura") {
    return ["buffa torres", "perto dela"];
  }

  if (effect === "cleanse") {
    return ["reduz armadura", "quebra firewall"];
  }

  if (effect === "mark") {
    return ["marca alvo", "+dano do time"];
  }

  if (effect === "ritual-zone") {
    return ["cria zona", "enfraquece tecnologia"];
  }

  if (effect === "redirect") {
    return ["empurra leve", "boss resiste"];
  }

  return ["alvo unico", "dps estavel"];
};

const getBranchSummary = (branchRanks: TowerBranchRanks): readonly string[] =>
  Object.entries(branchRanks)
    .filter(([, rank]) => rank > 0)
    .map(([branchId, rank]) => `${getTowerBranchDefinition(branchId as keyof TowerBranchRanks).shortName} ${rank}`);
