import {
  KILL_REWARD_MULTIPLIER,
  WAVE_COMPLETION_BONUS_PER_PLAYER
} from "../config/constants";
import { getEnemyDefinition } from "../data/enemies";
import { getMapStage, mapDefinition } from "../data/map";
import {
  getPlayerClassDefinition,
  playerClassDefinitions
} from "../data/playerClasses";
import {
  getRewardSkillChoices,
  getSkillEffectTotals,
  getSkillRank
} from "../data/skills";
import { getTowerDefinitionsForClass, towerDefinitions } from "../data/towers";
import {
  createEmptyTowerBranchRanks,
  getTowerBranchDefinition,
  getTowerBranchEffectTotals,
  towerAutoBuildDefinitions
} from "../data/towerBranches";
import {
  getTowerLevelBonuses,
  getTowerXpToNextLevel,
  towerProgression
} from "../data/towerProgression";
import { waveDefinitions } from "../data/waves";
import type {
  EnemyDefinition,
  MapDefinition,
  PlayerId,
  SkillDefinition,
  TowerAutoBuildId,
  TowerBranchRanks,
  TowerDefinition,
  WaveDefinition,
  WaveGroupDefinition
} from "../models/types";

export type BotProfileId =
  | "novice"
  | "mentor"
  | "aggressive"
  | "economist"
  | "experimental";

export type BalanceSimulationOptions = {
  runs?: number;
  seed?: number;
  profiles?: readonly BotProfileId[];
};

export type BalanceSimulationReport = {
  version: string;
  seed: number;
  runs: number;
  winRate: number;
  averageWavesCleared: number;
  averageBaseHpRemaining: number;
  averageCreditsRemaining: number;
  averageTowersBuilt: number;
  botProfiles: Record<BotProfileId, number>;
  classPairs: Record<string, AggregateBucket>;
  waves: WaveAggregate[];
  towers: Record<string, TowerAggregate>;
  deathWaves: Record<string, number>;
  recommendations: string[];
};

export type AggregateBucket = {
  attempts: number;
  wins: number;
  winRate: number;
  averageWavesCleared: number;
  averageBaseHpRemaining: number;
};

export type WaveAggregate = {
  id: string;
  name: string;
  attempts: number;
  clears: number;
  deaths: number;
  clearRate: number;
  averageBaseDamage: number;
  averageLeaks: number;
  averageKills: number;
  routeCount: number;
  mapStageIndex: number;
};

export type TowerAggregate = {
  built: number;
  kills: number;
  damage: number;
  averageLevel: number;
  buildShare: number;
};

type MutableBucket = {
  attempts: number;
  wins: number;
  wavesCleared: number;
  baseHp: number;
};

type MutableWaveAggregate = {
  id: string;
  name: string;
  attempts: number;
  clears: number;
  deaths: number;
  baseDamage: number;
  leaks: number;
  kills: number;
  routeCount: number;
  mapStageIndex: number;
};

type MutableTowerAggregate = {
  built: number;
  kills: number;
  damage: number;
  levelSum: number;
};

type SimPlayer = {
  id: PlayerId;
  classId: string;
  profile: BotProfileId;
  credits: number;
  sigils: number;
  skillRanks: Record<string, number>;
  damage: number;
  kills: number;
  towersBuilt: number;
};

type SimTower = {
  id: number;
  typeId: string;
  ownerId: PlayerId;
  lane: number;
  level: number;
  xp: number;
  xpToNext: number;
  kills: number;
  damage: number;
  skillPoints: number;
  branchRanks: TowerBranchRanks;
  autoBuildId: TowerAutoBuildId;
};

type SimRunState = {
  rng: Rng;
  baseHp: number;
  players: Record<PlayerId, SimPlayer>;
  towers: SimTower[];
  nextTowerId: number;
};

type WaveResult = {
  cleared: boolean;
  baseDamage: number;
  kills: number;
  leaks: number;
};

type TowerContribution = {
  tower: SimTower;
  damagePerSecond: number;
};

const SIM_VERSION = "headless-balance-v1";
const DEFAULT_RUNS = 1000;
const DEFAULT_SEED = 14729;
const playerIds: readonly PlayerId[] = ["p1", "p2"];
const defaultProfiles: readonly BotProfileId[] = [
  "novice",
  "novice",
  "mentor",
  "aggressive",
  "economist",
  "experimental"
];

export const runBalanceSimulation = (
  options: BalanceSimulationOptions = {}
): BalanceSimulationReport => {
  const runs = Math.max(1, Math.floor(options.runs ?? DEFAULT_RUNS));
  const seed = options.seed ?? DEFAULT_SEED;
  const profilePool = options.profiles?.length ? options.profiles : defaultProfiles;
  const rng = new Rng(seed);
  const waveAggregates = createWaveAggregates();
  const towerAggregates = createTowerAggregates();
  const classPairBuckets: Record<string, MutableBucket> = {};
  const deathWaves: Record<string, number> = {};
  const botProfiles: Record<BotProfileId, number> = {
    novice: 0,
    mentor: 0,
    aggressive: 0,
    economist: 0,
    experimental: 0
  };

  let wins = 0;
  let wavesClearedTotal = 0;
  let baseHpTotal = 0;
  let creditsTotal = 0;
  let towersBuiltTotal = 0;

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const run = createRunState(rng, profilePool);
    const classPairKey = `${run.players.p1.classId} + ${run.players.p2.classId}`;
    const classBucket = getMutableBucket(classPairBuckets, classPairKey);
    let wavesCleared = 0;
    let defeatedOnWave: string | null = null;

    classBucket.attempts += 1;
    botProfiles[run.players.p1.profile] += 1;
    botProfiles[run.players.p2.profile] += 1;

    for (let waveIndex = 0; waveIndex < waveDefinitions.length; waveIndex += 1) {
      const wave = waveDefinitions[waveIndex];
      const map = getMapStage(wave.mapStageIndex);
      const waveAggregate = waveAggregates[waveIndex];

      waveAggregate.attempts += 1;
      prepareForWave(run, wave, map, waveIndex);

      const result = simulateWave(run, wave, map);

      waveAggregate.baseDamage += result.baseDamage;
      waveAggregate.leaks += result.leaks;
      waveAggregate.kills += result.kills;

      if (!result.cleared) {
        waveAggregate.deaths += 1;
        defeatedOnWave = wave.id;
        deathWaves[wave.id] = (deathWaves[wave.id] ?? 0) + 1;
        break;
      }

      waveAggregate.clears += 1;
      wavesCleared += 1;
      rewardWaveClear(run, wave);
    }

    if (!defeatedOnWave) {
      wins += 1;
      classBucket.wins += 1;
    }

    for (const tower of run.towers) {
      const aggregate = towerAggregates[tower.typeId];
      aggregate.built += 1;
      aggregate.kills += tower.kills;
      aggregate.damage += tower.damage;
      aggregate.levelSum += tower.level;
    }

    wavesClearedTotal += wavesCleared;
    baseHpTotal += run.baseHp;
    creditsTotal += run.players.p1.credits + run.players.p2.credits;
    towersBuiltTotal += run.towers.length;
    classBucket.wavesCleared += wavesCleared;
    classBucket.baseHp += run.baseHp;
  }

  const totalBuilt = Object.values(towerAggregates).reduce(
    (sum, tower) => sum + tower.built,
    0
  );

  const report: BalanceSimulationReport = {
    version: SIM_VERSION,
    seed,
    runs,
    winRate: wins / runs,
    averageWavesCleared: wavesClearedTotal / runs,
    averageBaseHpRemaining: baseHpTotal / runs,
    averageCreditsRemaining: creditsTotal / runs,
    averageTowersBuilt: towersBuiltTotal / runs,
    botProfiles,
    classPairs: finalizeClassPairs(classPairBuckets),
    waves: waveAggregates.map(finalizeWaveAggregate),
    towers: finalizeTowerAggregates(towerAggregates, totalBuilt),
    deathWaves,
    recommendations: []
  };

  report.recommendations = createRecommendations(report);

  return report;
};

export const formatBalanceReport = (report: BalanceSimulationReport): string => {
  const lines: string[] = [
    "# Aegis Sacra TD - Balance Simulation",
    "",
    `- Version: ${report.version}`,
    `- Runs: ${report.runs}`,
    `- Seed: ${report.seed}`,
    `- Win rate: ${formatPercent(report.winRate)}`,
    `- Avg waves cleared: ${report.averageWavesCleared.toFixed(2)} / ${waveDefinitions.length}`,
    `- Avg base HP remaining: ${report.averageBaseHpRemaining.toFixed(2)}`,
    `- Avg credits remaining: ${report.averageCreditsRemaining.toFixed(1)}`,
    `- Avg towers built: ${report.averageTowersBuilt.toFixed(1)}`,
    "",
    "## Recommendations",
    ""
  ];

  for (const recommendation of report.recommendations) {
    lines.push(`- ${recommendation}`);
  }

  lines.push("", "## Bot Profiles", "");
  lines.push("| Profile | Samples | Share |");
  lines.push("| --- | ---: | ---: |");

  for (const [profile, count] of Object.entries(report.botProfiles)) {
    lines.push(`| ${profile} | ${count} | ${formatPercent(count / (report.runs * 2))} |`);
  }

  lines.push("", "## Waves", "");
  lines.push("| Wave | Clear | Avg base dmg | Avg leaks | Avg kills | Routes | Stage |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const wave of report.waves) {
    lines.push(
      `| ${wave.id} ${wave.name} | ${formatPercent(wave.clearRate)} | ${wave.averageBaseDamage.toFixed(
        2
      )} | ${wave.averageLeaks.toFixed(2)} | ${wave.averageKills.toFixed(1)} | ${wave.routeCount} | ${
        wave.mapStageIndex + 1
      } |`
    );
  }

  lines.push("", "## Towers", "");
  lines.push("| Tower | Built | Build share | Kills | Damage | Avg level |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");

  for (const tower of towerDefinitions) {
    const aggregate = report.towers[tower.id];

    lines.push(
      `| ${tower.shortName} | ${aggregate.built} | ${formatPercent(
        aggregate.buildShare
      )} | ${aggregate.kills} | ${Math.round(aggregate.damage)} | ${aggregate.averageLevel.toFixed(
        2
      )} |`
    );
  }

  lines.push("", "## Class Pairs", "");
  lines.push("| Pair | Attempts | Win | Avg waves | Avg base HP |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");

  for (const [pair, bucket] of Object.entries(report.classPairs).sort(
    (a, b) => b[1].attempts - a[1].attempts
  )) {
    lines.push(
      `| ${pair} | ${bucket.attempts} | ${formatPercent(
        bucket.winRate
      )} | ${bucket.averageWavesCleared.toFixed(2)} | ${bucket.averageBaseHpRemaining.toFixed(
        2
      )} |`
    );
  }

  lines.push("", "## Death Waves", "");
  lines.push("| Wave | Deaths | Share of runs |");
  lines.push("| --- | ---: | ---: |");

  for (const wave of report.waves) {
    const deaths = report.deathWaves[wave.id] ?? 0;
    lines.push(`| ${wave.id} ${wave.name} | ${deaths} | ${formatPercent(deaths / report.runs)} |`);
  }

  return `${lines.join("\n")}\n`;
};

const createRunState = (
  rng: Rng,
  profilePool: readonly BotProfileId[]
): SimRunState => {
  const p1Class = rng.pick(playerClassDefinitions).id;
  const p2Class = rng.pick(playerClassDefinitions).id;
  const p1Profile = rng.pick(profilePool);
  const p2Profile = rng.pick(profilePool);

  return {
    rng,
    baseHp: mapDefinition.baseHp,
    players: {
      p1: createPlayer("p1", p1Class, p1Profile, mapDefinition.startingCreditsByPlayer.p1),
      p2: createPlayer("p2", p2Class, p2Profile, mapDefinition.startingCreditsByPlayer.p2)
    },
    towers: [],
    nextTowerId: 1
  };
};

const createPlayer = (
  id: PlayerId,
  classId: string,
  profile: BotProfileId,
  credits: number
): SimPlayer => ({
  id,
  classId,
  profile,
  credits,
  sigils: 0,
  skillRanks: {},
  damage: 0,
  kills: 0,
  towersBuilt: 0
});

const prepareForWave = (
  run: SimRunState,
  wave: WaveDefinition,
  map: MapDefinition,
  waveIndex: number
): void => {
  const passes = wave.isBoss ? 5 : waveIndex < 2 ? 2 : 3;
  const playerOrder = run.rng.next() > 0.5 ? playerIds : [...playerIds].reverse();

  for (let pass = 0; pass < passes; pass += 1) {
    for (const playerId of playerOrder) {
      const player = run.players[playerId];

      if (player.profile === "novice" && pass > 0 && run.rng.next() < 0.48) {
        continue;
      }

      if (getPlayerTowerCount(run, player.id) >= getDesiredTowerCount(player.profile, waveIndex, wave.isBoss)) {
        continue;
      }

      const tower = chooseTowerForPlayer(run, player, wave, map, waveIndex);

      if (!tower) {
        continue;
      }

      const cost = getTowerCost(player, tower);
      const reserve = getReserveCredits(player.profile, waveIndex, wave.isBoss);

      if (player.credits < cost || (player.credits - cost < reserve && run.towers.length > 2)) {
        continue;
      }

      const lane = chooseLaneForTower(run, wave, map);

      player.credits -= cost;
      player.towersBuilt += 1;
      run.towers.push({
        id: run.nextTowerId,
        typeId: tower.id,
        ownerId: playerId,
        lane,
        level: 1,
        xp: 0,
        xpToNext: getTowerXpToNextLevel(1),
        kills: 0,
        damage: 0,
        skillPoints: 0,
        branchRanks: createEmptyTowerBranchRanks(),
        autoBuildId: chooseSimAutoBuild(player.profile)
      });
      run.nextTowerId += 1;
    }
  }
};

const simulateWave = (
  run: SimRunState,
  wave: WaveDefinition,
  map: MapDefinition
): WaveResult => {
  let baseDamage = 0;
  let kills = 0;
  let leaks = 0;

  const groups = [...wave.groups].sort((a, b) => a.startDelayMs - b.startDelayMs);

  for (const group of groups) {
    const enemy = getEnemyDefinition(group.enemyTypeId);
    const groupResult = simulateGroup(run, group, enemy, map);

    baseDamage += groupResult.baseDamage;
    kills += groupResult.kills;
    leaks += groupResult.leaks;
    run.baseHp = Math.max(0, run.baseHp - groupResult.baseDamage);

    if (run.baseHp <= 0) {
      return { cleared: false, baseDamage, kills, leaks };
    }
  }

  grantSimIncomeForWave(run, wave);

  return { cleared: true, baseDamage, kills, leaks };
};

const simulateGroup = (
  run: SimRunState,
  group: WaveGroupDefinition,
  enemy: EnemyDefinition,
  map: MapDefinition
): WaveResult => {
  const pathIndex = getSafePathIndex(map, group.pathIndex ?? 0);
  const pathLength = getPathLength(map, pathIndex);
  const controlMultiplier = getControlMultiplier(run, enemy, pathIndex, map);
  const exposureSeconds = (pathLength / enemy.speed) * controlMultiplier;
  const contributions = getTowerContributions(run, enemy, pathIndex, map);
  const totalDamagePerSecond = contributions.reduce(
    (sum, contribution) => sum + contribution.damagePerSecond,
    0
  );
  const pressureDivisor =
    1 + Math.max(0, group.count - 1) * (enemy.traits.includes("enxame") ? 0.038 : 0.024);
  const damageNoise = 0.88 + run.rng.next() * 0.24;
  const damageCapacity =
    (totalDamagePerSecond * exposureSeconds * damageNoise) / pressureDivisor;
  const effectiveHp = enemy.maxHp + enemy.armor * 9;
  const killed = Math.min(group.count, Math.floor(damageCapacity / effectiveHp));
  const leaked = group.count - killed;
  const dealtDamage = Math.min(group.count * effectiveHp, damageCapacity);

  distributeDamageAndKills(run, contributions, enemy, killed, dealtDamage);

  return {
    cleared: true,
    baseDamage: leaked * enemy.baseDamage,
    kills: killed,
    leaks: leaked
  };
};

const distributeDamageAndKills = (
  run: SimRunState,
  contributions: readonly TowerContribution[],
  enemy: EnemyDefinition,
  killed: number,
  dealtDamage: number
): void => {
  const totalContribution = contributions.reduce(
    (sum, contribution) => sum + contribution.damagePerSecond,
    0
  );

  if (totalContribution <= 0) {
    return;
  }

  let allocatedKills = 0;

  contributions.forEach((contribution, index) => {
    const share = contribution.damagePerSecond / totalContribution;
    const damage = dealtDamage * share;
    const player = run.players[contribution.tower.ownerId];
    const isLast = index === contributions.length - 1;
    const towerKills = isLast
      ? killed - allocatedKills
      : Math.min(killed - allocatedKills, Math.floor(killed * share + run.rng.next()));

    contribution.tower.damage += damage;
    player.damage += damage;

    if (towerKills > 0) {
      allocatedKills += towerKills;
      contribution.tower.kills += towerKills;
      player.kills += towerKills;
      grantSimTeamCredits(run, towerKills * enemy.reward, KILL_REWARD_MULTIPLIER);
    }
  });

  if (killed <= 0) {
    return;
  }

  for (const contribution of contributions) {
    const share = contribution.damagePerSecond / totalContribution;
    const participationXp = Math.max(1, Math.floor(killed * share));

    for (let index = 0; index < participationXp; index += 1) {
      grantTowerXp(run, contribution.tower);
    }
  }
};

const grantTowerXp = (run: SimRunState, tower: SimTower): void => {
  if (tower.level >= towerProgression.maxLevel) {
    tower.xp = 0;
    tower.xpToNext = 0;
    return;
  }

  tower.xp += towerProgression.xpPerKill;

  while (tower.level < towerProgression.maxLevel && tower.xp >= tower.xpToNext) {
    tower.xp -= tower.xpToNext;
    tower.level += 1;
    tower.skillPoints += 1;
    tower.xpToNext = getTowerXpToNextLevel(tower.level);
    applySimAutoBuild(tower);
  }
};

const applySimAutoBuild = (tower: SimTower): void => {
  const build =
    towerAutoBuildDefinitions.find((definition) => definition.id === tower.autoBuildId) ??
    towerAutoBuildDefinitions[0];

  while (tower.skillPoints > 0) {
    const branchId = [...build.sequence]
      .filter((candidate) => tower.branchRanks[candidate] < getTowerBranchDefinition(candidate).maxRank)
      .sort((a, b) => tower.branchRanks[a] - tower.branchRanks[b])[0];

    if (!branchId) {
      return;
    }

    tower.branchRanks[branchId] += 1;
    tower.skillPoints -= 1;
  }
};

const chooseSimAutoBuild = (profile: BotProfileId): TowerAutoBuildId => {
  if (profile === "aggressive") {
    return "boss";
  }

  if (profile === "experimental") {
    return "crowd";
  }

  if (profile === "novice") {
    return "balanced";
  }

  return "balanced";
};

const rewardWaveClear = (run: SimRunState, wave: WaveDefinition): void => {
  grantSimTeamCredits(run, WAVE_COMPLETION_BONUS_PER_PLAYER, 1);

  if (!wave.isBoss || !wave.bossRewardSigils) {
    return;
  }

  for (const playerId of playerIds) {
    const player = run.players[playerId];
    player.sigils += wave.bossRewardSigils;
    chooseBossReward(player, wave.id);
  }
};

const grantSimTeamCredits = (
  run: SimRunState,
  amount: number,
  scale: number
): number => {
  const credits = Math.ceil(amount * scale * getSimTeamRewardMultiplier(run));

  run.players.p1.credits += credits;
  run.players.p2.credits += credits;

  return credits;
};

const getSimTeamRewardMultiplier = (run: SimRunState): number => {
  const p1 =
    getSkillEffectTotals("p1", run.players.p1.skillRanks).rewardMultiplier *
    getPlayerClassDefinition(run.players.p1.classId).rewardMultiplier;
  const p2 =
    getSkillEffectTotals("p2", run.players.p2.skillRanks).rewardMultiplier *
    getPlayerClassDefinition(run.players.p2.classId).rewardMultiplier;

  return (p1 + p2) / 2;
};

const chooseBossReward = (player: SimPlayer, bossWaveId: string): void => {
  const choices = getRewardSkillChoices(
    player.id,
    player.skillRanks,
    player.sigils,
    bossWaveId,
    3
  );

  if (choices.length === 0) {
    return;
  }

  const chosen = [...choices].sort(
    (a, b) => scoreSkillForProfile(b, player.profile) - scoreSkillForProfile(a, player.profile)
  )[0];
  const rank = getSkillRank(player.skillRanks, chosen.id);

  if (rank >= chosen.maxRank || player.sigils < chosen.costSigils) {
    return;
  }

  player.sigils -= chosen.costSigils;
  player.skillRanks[chosen.id] = rank + 1;
};

const chooseTowerForPlayer = (
  run: SimRunState,
  player: SimPlayer,
  wave: WaveDefinition,
  map: MapDefinition,
  waveIndex: number
): TowerDefinition | null => {
  const scoredTowers = getTowerDefinitionsForClass(player.classId)
    .map((tower) => ({
      tower,
      score: scoreTower(run, player, tower, wave, map, waveIndex)
    }))
    .filter((entry) => entry.score > 0 && player.credits >= getTowerCost(player, entry.tower))
    .sort((a, b) => b.score - a.score);

  if (scoredTowers.length === 0) {
    return null;
  }

  const choiceCount = player.profile === "novice" ? Math.min(4, scoredTowers.length) : Math.min(2, scoredTowers.length);
  const topChoices = scoredTowers.slice(0, choiceCount);

  return run.rng.pick(topChoices).tower;
};

const scoreTower = (
  run: SimRunState,
  player: SimPlayer,
  tower: TowerDefinition,
  wave: WaveDefinition,
  map: MapDefinition,
  waveIndex: number
): number => {
  const profileBias = getProfileTowerBias(player.profile, tower);
  const enemyMix = getEnemyMix(wave);
  const existingSameType = run.towers.filter(
    (candidate) => candidate.ownerId === player.id && candidate.typeId === tower.id
  ).length;
  const ownedCombatTowers = run.towers.filter((candidate) => {
    const definition = towerDefinitions.find((entry) => entry.id === candidate.typeId);

    return candidate.ownerId === player.id && definition?.effect !== "income";
  }).length;
  const cost = getTowerCost(player, tower);
  const affordability = Math.max(0, 1.4 - cost / Math.max(1, player.credits));
  let score = 6 + profileBias + affordability * 3 - existingSameType * 1.7;

  if (tower.effect === "income" && (ownedCombatTowers < 2 || waveIndex < 2)) {
    return player.profile === "economist" && ownedCombatTowers >= 1 ? 2 + affordability * 2 : -1;
  }

  if (player.profile === "novice") {
    const incomeBias = tower.effect === "income" && waveIndex < 5 && existingSameType === 0 ? 1.5 : 0;

    return 4 + affordability * 4 + incomeBias - existingSameType * 0.9 + run.rng.next() * 6;
  }

  if (tower.effect === "income") {
    score += player.profile === "economist" ? 6 : waveIndex < 5 ? 3 : waveIndex < 8 ? 1 : -3;
    score -= existingSameType * 5;
  }

  if (tower.effect === "damage") {
    score += enemyMix.runner * 0.7 + enemyMix.boss * 4 + (waveIndex < 2 ? 4 : 0);
  }

  if (tower.effect === "slow") {
    score += enemyMix.tank * 2.5 + enemyMix.shield * 1.6 + enemyMix.boss * 5;
    score -= run.towers.some((candidate) => candidate.typeId === tower.id) ? 2.5 : 0;
  }

  if (tower.effect === "splash") {
    score += enemyMix.swarm * 0.35 + enemyMix.shield * 1.1 + enemyMix.tank * 1.4;
  }

  if (tower.effect === "chain") {
    score += enemyMix.swarm * 0.42 + enemyMix.runner * 0.5 + map.paths.length * 0.9;
  }

  if (wave.isBoss && tower.effect === "chain") {
    score -= 2.5;
  }

  return score + run.rng.next() * 2.2;
};

const getTowerContributions = (
  run: SimRunState,
  enemy: EnemyDefinition,
  pathIndex: number,
  map: MapDefinition
): TowerContribution[] =>
  run.towers
    .map((tower) => ({
      tower,
      damagePerSecond: getTowerDamagePerSecond(run, tower, enemy, pathIndex, map)
    }))
    .filter((contribution) => contribution.damagePerSecond > 0);

const getTowerDamagePerSecond = (
  run: SimRunState,
  tower: SimTower,
  enemy: EnemyDefinition,
  pathIndex: number,
  map: MapDefinition
): number => {
  const definition = towerDefinitions.find((candidate) => candidate.id === tower.typeId);

  if (!definition) {
    return 0;
  }

  const owner = run.players[tower.ownerId];
  const playerClass = getPlayerClassDefinition(owner.classId);
  const skillEffects = getSkillEffectTotals(owner.id, owner.skillRanks);
  const levelBonuses = getTowerLevelBonuses(tower.level);
  const branchEffects = getTowerBranchEffectTotals(tower.branchRanks);
  const shotDamage = Math.max(
    1,
    definition.damage *
      playerClass.damageMultiplier *
      skillEffects.damageMultiplier *
      levelBonuses.damageMultiplier *
      branchEffects.damageMultiplier -
      enemy.armor
  );
  const shotsPerSecond =
    1000 /
    (definition.cooldownMs * levelBonuses.cooldownMultiplier * branchEffects.cooldownMultiplier);
  const routeCoverage = getRouteCoverage(tower, definition, pathIndex, map);
  const effectMultiplier = getEffectMultiplier(definition, enemy, tower.branchRanks);

  return shotDamage * shotsPerSecond * routeCoverage * effectMultiplier;
};

const getControlMultiplier = (
  run: SimRunState,
  enemy: EnemyDefinition,
  pathIndex: number,
  map: MapDefinition
): number => {
  const slowPower = run.towers
    .filter((tower) => {
      const definition = towerDefinitions.find((candidate) => candidate.id === tower.typeId);

      return definition?.effect === "slow";
    })
    .reduce((sum, tower) => {
      const definition = towerDefinitions.find((candidate) => candidate.id === tower.typeId);

      if (!definition) {
        return sum;
      }

      return sum + getRouteCoverage(tower, definition, pathIndex, map) * (0.12 + tower.level * 0.035);
    }, 0);
  const bossBonus = enemy.traits.includes("boss") ? 0.12 : 0;

  return 1 + Math.min(0.72, slowPower + bossBonus);
};

const getRouteCoverage = (
  tower: SimTower,
  definition: TowerDefinition,
  pathIndex: number,
  map: MapDefinition
): number => {
  if (tower.lane === pathIndex || map.paths.length === 1) {
    return 1;
  }

  const longRangeBonus = Math.min(0.26, Math.max(0, definition.range - 145) / 180);
  const branchRangeBonus = Math.min(
    0.18,
    getTowerBranchEffectTotals(tower.branchRanks).rangeBonus / 220
  );

  return 0.2 + longRangeBonus + branchRangeBonus;
};

const getEffectMultiplier = (
  tower: TowerDefinition,
  enemy: EnemyDefinition,
  ranks: TowerBranchRanks
): number => {
  const branchEffects = getTowerBranchEffectTotals(ranks);
  const ruptureBonus = branchEffects.splashRadiusBonus > 0 && enemy.traits.includes("enxame")
    ? branchEffects.splashRadiusBonus / 95
    : 0;
  const chainBonus =
    branchEffects.chainJumpsBonus > 0 && (enemy.traits.includes("rapido") || enemy.traits.includes("enxame"))
      ? branchEffects.chainJumpsBonus * 0.16
      : 0;

  if (tower.effect === "damage") {
    return (enemy.traits.includes("boss") ? 1.14 : enemy.traits.includes("rapido") ? 1.08 : 1) + ruptureBonus + chainBonus;
  }

  if (tower.effect === "slow") {
    return (enemy.traits.includes("boss") || enemy.traits.includes("blindado") ? 0.92 : 0.72) + ruptureBonus + chainBonus;
  }

  if (tower.effect === "splash") {
    return (enemy.traits.includes("enxame") ? 2.4 : enemy.traits.includes("escudo") ? 1.28 : 1.05) + ruptureBonus + chainBonus;
  }

  if (tower.effect === "income") {
    return 0;
  }

  return (enemy.traits.includes("enxame") || enemy.traits.includes("rapido") ? 2.05 : 1.02) + ruptureBonus + chainBonus;
};

const grantSimIncomeForWave = (run: SimRunState, wave: WaveDefinition): void => {
  const waveDurationMs = wave.groups.reduce(
    (maxDuration, group) =>
      Math.max(maxDuration, group.startDelayMs + group.intervalMs * group.count),
    0
  );

  for (const tower of run.towers) {
    const definition = towerDefinitions.find((candidate) => candidate.id === tower.typeId);

    if (definition?.effect !== "income") {
      continue;
    }

    const interval = definition.incomeIntervalMs ?? definition.cooldownMs;
    const ticks = Math.max(0, Math.floor(waveDurationMs / interval));

    if (ticks > 0) {
      grantSimTeamCredits(run, ticks * (definition.incomePerTick ?? 1), 1);
    }
  }
};

const chooseLaneForTower = (
  run: SimRunState,
  wave: WaveDefinition,
  map: MapDefinition
): number => {
  const pressures = getRoutePressures(wave, map);
  const sorted = Object.entries(pressures).sort((a, b) => b[1] - a[1]);

  for (const [route] of sorted) {
    const routeIndex = Number(route);
    const towersOnRoute = run.towers.filter((tower) => tower.lane === routeIndex).length;

    if (towersOnRoute <= run.rng.next() * 2.6) {
      return routeIndex;
    }
  }

  return Number(sorted[0]?.[0] ?? 0);
};

const getRoutePressures = (
  wave: WaveDefinition,
  map: MapDefinition
): Record<number, number> => {
  const pressures: Record<number, number> = {};

  for (const group of wave.groups) {
    const enemy = getEnemyDefinition(group.enemyTypeId);
    const pathIndex = getSafePathIndex(map, group.pathIndex ?? 0);
    pressures[pathIndex] =
      (pressures[pathIndex] ?? 0) +
      group.count * (enemy.baseDamage * 2 + enemy.maxHp / 80 + enemy.armor);
  }

  return pressures;
};

const getEnemyMix = (wave: WaveDefinition) => {
  const mix = {
    runner: 0,
    swarm: 0,
    shield: 0,
    tank: 0,
    boss: 0
  };

  for (const group of wave.groups) {
    const enemy = getEnemyDefinition(group.enemyTypeId);

    if (enemy.traits.includes("boss")) {
      mix.boss += group.count;
    } else if (enemy.traits.includes("enxame")) {
      mix.swarm += group.count;
    } else if (enemy.traits.includes("blindado")) {
      mix.tank += group.count;
    } else if (enemy.traits.includes("escudo")) {
      mix.shield += group.count;
    } else {
      mix.runner += group.count;
    }
  }

  return mix;
};

const getTowerCost = (player: SimPlayer, tower: TowerDefinition): number => {
  const playerClass = getPlayerClassDefinition(player.classId);
  const skillEffects = getSkillEffectTotals(player.id, player.skillRanks);

  return Math.ceil(tower.cost * playerClass.costMultiplier * skillEffects.costMultiplier);
};

const getReserveCredits = (
  profile: BotProfileId,
  waveIndex: number,
  isBoss?: boolean
): number => {
  if (isBoss) {
    return 8;
  }

  if (profile === "economist") {
    return 44 + waveIndex * 3;
  }

  if (profile === "novice") {
    return 30 + waveIndex * 4;
  }

  if (profile === "aggressive") {
    return 10 + waveIndex;
  }

  return 24 + waveIndex * 2;
};

const getPlayerTowerCount = (run: SimRunState, playerId: PlayerId): number =>
  run.towers.filter((tower) => tower.ownerId === playerId).length;

const getDesiredTowerCount = (
  profile: BotProfileId,
  waveIndex: number,
  isBoss?: boolean
): number => {
  const bossBonus = isBoss ? 1 : 0;

  if (profile === "novice") {
    return Math.min(7, 1 + Math.floor(waveIndex * 0.55) + bossBonus);
  }

  if (profile === "economist") {
    return Math.min(8, 1 + Math.floor(waveIndex * 0.68) + bossBonus);
  }

  if (profile === "aggressive") {
    return Math.min(11, 2 + Math.floor(waveIndex * 0.95) + bossBonus);
  }

  if (profile === "experimental") {
    return Math.min(9, 2 + Math.floor(waveIndex * 0.72) + bossBonus);
  }

  return Math.min(9, 2 + Math.floor(waveIndex * 0.75) + bossBonus);
};

const getProfileTowerBias = (
  profile: BotProfileId,
  tower: TowerDefinition
): number => {
  if (profile === "aggressive") {
    return tower.effect === "damage" || tower.effect === "splash" ? 2.8 : 0;
  }

  if (profile === "economist") {
    return tower.cost <= 72 ? 2.4 : -0.6;
  }

  if (profile === "experimental") {
    return tower.effect === "chain" || tower.effect === "slow" ? 2.2 : 0.4;
  }

  if (profile === "novice") {
    return tower.cost <= 72 ? 2 : 0;
  }

  return tower.effect === "slow" ? 1.6 : 1;
};

const scoreSkillForProfile = (
  skill: SkillDefinition,
  profile: BotProfileId
): number => {
  let score = skill.weight * 10 - skill.tier * 3;

  if (profile === "aggressive") {
    score += skill.effect.damageMultiplier ? 45 : 0;
  }

  if (profile === "economist") {
    score += skill.effect.costMultiplier ? 34 : 0;
    score += skill.effect.rewardMultiplier ? 42 : 0;
  }

  if (profile === "mentor") {
    score += skill.effect.rangeBonus ? 26 : 0;
    score += skill.effect.damageMultiplier ? 20 : 0;
  }

  if (profile === "experimental") {
    score += skill.rarity === "epic" ? 34 : skill.rarity === "rare" ? 18 : 7;
  }

  if (profile === "novice") {
    score += skill.costSigils <= 1 ? 22 : 0;
    score += skill.effect.rangeBonus ? 12 : 0;
  }

  return score;
};

const getPathLength = (map: MapDefinition, pathIndex: number): number => {
  const path = map.paths[getSafePathIndex(map, pathIndex)] ?? map.paths[0];

  return Math.max(1, path.length - 1) * map.tileSize;
};

const getSafePathIndex = (map: MapDefinition, pathIndex: number): number =>
  map.paths[pathIndex] ? pathIndex : 0;

const createWaveAggregates = (): MutableWaveAggregate[] =>
  waveDefinitions.map((wave) => ({
    id: wave.id,
    name: wave.name,
    attempts: 0,
    clears: 0,
    deaths: 0,
    baseDamage: 0,
    leaks: 0,
    kills: 0,
    routeCount: new Set(wave.groups.map((group) => group.pathIndex ?? 0)).size,
    mapStageIndex: wave.mapStageIndex
  }));

const createTowerAggregates = (): Record<string, MutableTowerAggregate> =>
  Object.fromEntries(
    towerDefinitions.map((tower) => [
      tower.id,
      {
        built: 0,
        kills: 0,
        damage: 0,
        levelSum: 0
      }
    ])
  );

const getMutableBucket = (
  buckets: Record<string, MutableBucket>,
  key: string
): MutableBucket => {
  buckets[key] ??= {
    attempts: 0,
    wins: 0,
    wavesCleared: 0,
    baseHp: 0
  };

  return buckets[key];
};

const finalizeClassPairs = (
  buckets: Record<string, MutableBucket>
): Record<string, AggregateBucket> =>
  Object.fromEntries(
    Object.entries(buckets).map(([key, bucket]) => [
      key,
      {
        attempts: bucket.attempts,
        wins: bucket.wins,
        winRate: bucket.attempts > 0 ? bucket.wins / bucket.attempts : 0,
        averageWavesCleared:
          bucket.attempts > 0 ? bucket.wavesCleared / bucket.attempts : 0,
        averageBaseHpRemaining: bucket.attempts > 0 ? bucket.baseHp / bucket.attempts : 0
      }
    ])
  );

const finalizeWaveAggregate = (wave: MutableWaveAggregate): WaveAggregate => ({
  id: wave.id,
  name: wave.name,
  attempts: wave.attempts,
  clears: wave.clears,
  deaths: wave.deaths,
  clearRate: wave.attempts > 0 ? wave.clears / wave.attempts : 0,
  averageBaseDamage: wave.attempts > 0 ? wave.baseDamage / wave.attempts : 0,
  averageLeaks: wave.attempts > 0 ? wave.leaks / wave.attempts : 0,
  averageKills: wave.attempts > 0 ? wave.kills / wave.attempts : 0,
  routeCount: wave.routeCount,
  mapStageIndex: wave.mapStageIndex
});

const finalizeTowerAggregates = (
  aggregates: Record<string, MutableTowerAggregate>,
  totalBuilt: number
): Record<string, TowerAggregate> =>
  Object.fromEntries(
    Object.entries(aggregates).map(([key, aggregate]) => [
      key,
      {
        built: aggregate.built,
        kills: aggregate.kills,
        damage: aggregate.damage,
        averageLevel: aggregate.built > 0 ? aggregate.levelSum / aggregate.built : 0,
        buildShare: totalBuilt > 0 ? aggregate.built / totalBuilt : 0
      }
    ])
  );

const createRecommendations = (report: BalanceSimulationReport): string[] => {
  const recommendations: string[] = [];

  if (report.winRate < 0.42) {
    recommendations.push(
      `Run esta dura demais para bots intermediarios (${formatPercent(
        report.winRate
      )} vitorias). Reduzir HP/count nas waves com maior death share.`
    );
  } else if (report.winRate > 0.82) {
    recommendations.push(
      `Run esta permissiva demais (${formatPercent(
        report.winRate
      )} vitorias). Aumentar pressao depois da primeira recompensa de boss.`
    );
  } else {
    recommendations.push(
      `Dificuldade macro esta dentro de uma janela util (${formatPercent(
        report.winRate
      )} vitorias). Ajustar picos, nao o jogo inteiro.`
    );
  }

  if (report.averageCreditsRemaining > 900) {
    recommendations.push(
      `Economia esta sobrando demais (${report.averageCreditsRemaining.toFixed(
        0
      )} creditos medios no fim). Reduzir recompensa por abate/onda ou criar mais gasto util antes das waves 8-10.`
    );
  }

  if (report.averageTowersBuilt > 18 && report.winRate > 0.8) {
    recommendations.push(
      `Bots vencem com muitas torres (${report.averageTowersBuilt.toFixed(
        1
      )} media). Limitar pontos fortes de construcao ou aumentar custo progressivo por torre pode melhorar decisao.`
    );
  }

  for (const wave of report.waves) {
    const deathShare = wave.deaths / report.runs;

    if (deathShare > 0.16) {
      recommendations.push(
        `${wave.id} "${wave.name}" esta matando ${formatPercent(
          deathShare
        )} das runs. Revisar count/HP ou atrasar a rota extra.`
      );
    }

    if (wave.averageLeaks > 2.4 && wave.clearRate > 0.65) {
      recommendations.push(
        `${wave.id} esta vazando muito sem necessariamente matar. Isso costuma gerar frustracao: reduzir baseDamage ou espacamento de spawn.`
      );
    }

    if (wave.name.includes("Boss") && wave.clearRate > 0.98 && wave.averageBaseDamage < 0.5) {
      recommendations.push(
        `${wave.id} boss esta com pouca pressao (${formatPercent(
          wave.clearRate
        )} clear, ${wave.averageBaseDamage.toFixed(
          2
        )} dano medio na base). Dar mecanica de suporte ou spawn lateral mais legivel.`
      );
    }
  }

  const towerEntries = Object.entries(report.towers);

  for (const [towerId, tower] of towerEntries) {
    const definition = towerDefinitions.find((candidate) => candidate.id === towerId);

    if (!definition) {
      continue;
    }

    if (tower.buildShare < 0.08) {
      recommendations.push(
        `${definition.shortName} quase nao e escolhido (${formatPercent(
          tower.buildShare
        )}). Melhorar custo, funcao visual ou vantagem situacional.`
      );
    }

    if (tower.buildShare > 0.44) {
      recommendations.push(
        `${definition.shortName} domina escolhas (${formatPercent(
          tower.buildShare
        )}). Nerfar levemente ou fortalecer alternativas.`
      );
    }
  }

  const classRates = Object.values(report.classPairs).map((bucket) => bucket.winRate);
  const classSpread =
    classRates.length > 0 ? Math.max(...classRates) - Math.min(...classRates) : 0;

  if (classSpread > 0.28) {
    recommendations.push(
      `Spread de classe esta alto (${formatPercent(
        classSpread
      )}). Checar multiplicadores de custo/dano das piores duplas.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Nenhum alerta forte detectado. Proxima melhoria: simular posicoes reais por tile.");
  }

  return recommendations;
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;

    return this.state / 4294967296;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}
