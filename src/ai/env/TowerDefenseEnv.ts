import {
  INCOME_TOWER_HARD_CAP,
  INCOME_TOWER_REWARD_SCALE,
  INCOME_TOWER_SOFT_CAP,
  KILL_REWARD_MULTIPLIER,
  WAVE_AUTO_START_MS,
  WAVE_COMPLETION_BONUS_PER_PLAYER
} from "../../game/config/constants";
import { getEnemyDefinition } from "../../game/data/enemies";
import { getMapStage } from "../../game/data/map";
import {
  getPlayerClassDefinition,
  playerClassDefinitions
} from "../../game/data/playerClasses";
import {
  getRewardSkillChoices,
  getSkillDefinition,
  getSkillEffectTotals,
  getSkillRank
} from "../../game/data/skills";
import { getTowerDefinition, getTowerDefinitionsForClass } from "../../game/data/towers";
import {
  createEmptyTowerBranchRanks,
  getTowerBranchDefinition,
  getTowerBranchEffectTotals,
  towerAutoBuildDefinitions
} from "../../game/data/towerBranches";
import {
  getTowerLevelBonuses,
  getTowerXpToNextLevel,
  towerProgression
} from "../../game/data/towerProgression";
import { getWaveDefinition } from "../../game/data/waves";
import type {
  ActionError,
  ActionEvent,
  ActionStepResult,
  GameAction
} from "../../game/actions/types";
import type {
  EnemyDefinition,
  GridPoint,
  MapDefinition,
  PlayerId,
  TowerDefinition,
  WaveDefinition,
  WaveGroupDefinition
} from "../../game/models/types";
import { gridKey, isGridOnPath, isInsideGrid } from "../../game/utils/grid";
import { clampPlayerCount, createPlayerId, getPlayerNumber } from "../../game/utils/players";
import { Rng } from "./Rng";
import { checkHeadlessInvariants } from "./invariants";
import type {
  HeadlessGameState,
  HeadlessPlayerState,
  HeadlessResetOptions,
  HeadlessTowerState
} from "./types";

type SimulationGroupResult = {
  cleared: boolean;
  baseDamage: number;
  kills: number;
  leaks: number;
};

type TowerContribution = {
  tower: HeadlessTowerState;
  damagePerSecond: number;
};

const ENV_VERSION = "aegis-headless-v1";
const DEFAULT_TARGET_WAVE_COUNT = 20;

export class TowerDefenseEnv {
  private rng = new Rng(1);
  private stateInternal: HeadlessGameState = createInitialState(
    1,
    {},
    undefined,
    false,
    DEFAULT_TARGET_WAVE_COUNT
  );

  get state(): HeadlessGameState {
    return cloneState(this.stateInternal);
  }

  reset(options: HeadlessResetOptions = {}): HeadlessGameState {
    const seed = options.seed ?? 14729;
    this.rng = new Rng(seed);
    this.stateInternal = createInitialState(
      seed,
      options.players ?? {},
      options.playerCount,
      options.debug ?? false,
      options.targetWaveCount ?? DEFAULT_TARGET_WAVE_COUNT
    );
    this.stateInternal.mapId = options.mapId ?? this.stateInternal.mapId;

    return this.state;
  }

  step(action: GameAction): ActionStepResult<HeadlessGameState> {
    const events: ActionEvent[] = [];
    const errors: ActionError[] = [];
    let reward = 0;

    if (this.isDone() && action.type !== "WAIT") {
      errors.push({
        code: "GAME_DONE",
        message: "a run ja terminou"
      });

      return this.result(reward, events, errors);
    }

    this.stateInternal.tick += 1;

    switch (action.type) {
      case "SELECT_CLASS":
        this.selectClass(action, events, errors);
        break;
      case "BUILD_TOWER":
        reward += this.buildTower(action, events, errors);
        break;
      case "UPGRADE_TOWER":
        reward += this.upgradeTower(action, events, errors);
        break;
      case "SET_READY":
        reward += this.setReady(action.playerId, action.ready, events, errors);
        break;
      case "SELECT_REWARD":
        reward += this.selectReward(action.playerId, action.skillId, events, errors);
        break;
      case "SET_AUTO_BUILD":
        this.setAutoBuild(action, events, errors);
        break;
      case "WAIT":
        reward += this.wait(action.deltaMs, events);
        break;
      case "PAUSE":
        this.pause(action.paused, events, errors);
        break;
      case "DEBUG_ADVANCE_WAVE":
        reward += this.debugAdvance(events, errors);
        break;
    }

    return this.result(reward, events, errors);
  }

  private selectClass(
    action: Extract<GameAction, { type: "SELECT_CLASS" }>,
    events: ActionEvent[],
    errors: ActionError[]
  ): void {
    if (!this.stateInternal.players[action.playerId]) {
      errors.push({
        code: "UNKNOWN_PLAYER",
        playerId: action.playerId,
        message: "jogador desconhecido"
      });
      return;
    }

    const playerClass = playerClassDefinitions.find(
      (definition) => definition.id === action.classId
    );

    if (!playerClass) {
      errors.push({
        code: "UNKNOWN_CLASS",
        playerId: action.playerId,
        refId: action.classId,
        message: "classe desconhecida"
      });
      return;
    }

    if (this.stateInternal.towers.some((tower) => tower.ownerId === action.playerId)) {
      errors.push({
        code: "WRONG_PHASE",
        playerId: action.playerId,
        message: "classe so pode mudar antes de construir"
      });
      return;
    }

    this.stateInternal.players[action.playerId].classId = action.classId;
    events.push({
      kind: "class-selected",
      playerId: action.playerId,
      refId: action.classId,
      message: `${action.playerId} escolheu ${playerClass.shortName}`
    });
  }

  private buildTower(
    action: Extract<GameAction, { type: "BUILD_TOWER" }>,
    events: ActionEvent[],
    errors: ActionError[]
  ): number {
    if (this.stateInternal.phase !== "preparation") {
      errors.push({
        code: "WRONG_PHASE",
        playerId: action.playerId,
        message: "so pode construir durante preparacao"
      });
      return -0.08;
    }

    const player = this.getPlayer(action.playerId, errors);
    const tower = getKnownTower(action.towerId);

    if (!player || !tower) {
      errors.push({
        code: "UNKNOWN_TOWER",
        playerId: action.playerId,
        refId: action.towerId,
        message: "torre desconhecida"
      });
      return -0.1;
    }

    if (tower.originClassId !== player.classId) {
      errors.push({
        code: "CLASS_MISMATCH",
        playerId: action.playerId,
        refId: tower.id,
        message: "essa classe nao constrói essa torre"
      });
      return -0.12;
    }

    const map = getCurrentMap(this.stateInternal);

    if (!isInsideGrid(action.grid, map)) {
      errors.push({
        code: "OUT_OF_BOUNDS",
        playerId: action.playerId,
        message: "tile fora do mapa"
      });
      return -0.1;
    }

    if (isGridOnPath(action.grid, map)) {
      errors.push({
        code: "PATH_BLOCKED",
        playerId: action.playerId,
        message: "nao pode construir em rota ativa"
      });
      return -0.12;
    }

    if (this.stateInternal.towers.some((candidate) => sameGrid(candidate.grid, action.grid))) {
      errors.push({
        code: "TILE_OCCUPIED",
        playerId: action.playerId,
        message: "ja existe torre neste tile"
      });
      return -0.1;
    }

    const cost = getTowerCost(player, tower);

    if (player.credits < cost) {
      errors.push({
        code: "NOT_ENOUGH_CREDITS",
        playerId: action.playerId,
        refId: tower.id,
        deficit: cost - player.credits,
        message: `faltam ${cost - player.credits} creditos`
      });
      return -0.1;
    }

    player.credits -= cost;
    player.towersBuilt += 1;
    this.stateInternal.towers.push({
      id: `${action.playerId}-tower-${this.stateInternal.tick}-${this.stateInternal.towers.length + 1}`,
      typeId: tower.id,
      ownerId: action.playerId,
      grid: { ...action.grid },
      level: 1,
      xp: 0,
      xpToNext: getTowerXpToNextLevel(1),
      skillPoints: 0,
      branchRanks: createEmptyTowerBranchRanks(),
      autoBuildId: "balanced",
      kills: 0,
      damageDealt: 0
    });

    player.ready = false;
    events.push({
      kind: "tower-built",
      playerId: action.playerId,
      refId: tower.id,
      amount: cost,
      message: `${tower.name} construida`
    });

    return 0.12;
  }

  private upgradeTower(
    action: Extract<GameAction, { type: "UPGRADE_TOWER" }>,
    events: ActionEvent[],
    errors: ActionError[]
  ): number {
    const tower = this.stateInternal.towers.find((candidate) => candidate.id === action.towerId);

    if (!tower || tower.ownerId !== action.playerId) {
      errors.push({
        code: "UNKNOWN_TOWER",
        playerId: action.playerId,
        refId: action.towerId,
        message: "torre nao encontrada para este jogador"
      });
      return -0.08;
    }

    const branch = getTowerBranchDefinition(action.branchId);

    if (tower.skillPoints <= 0) {
      errors.push({
        code: "NO_SKILL_POINTS",
        playerId: action.playerId,
        refId: tower.id,
        message: "esta torre ainda nao ganhou ponto de experiencia"
      });
      return -0.06;
    }

    if (tower.branchRanks[action.branchId] >= branch.maxRank) {
      errors.push({
        code: "BRANCH_MAXED",
        playerId: action.playerId,
        refId: tower.id,
        message: "essa linha ja esta no maximo"
      });
      return -0.05;
    }

    tower.skillPoints -= 1;
    tower.branchRanks[action.branchId] += 1;
    events.push({
      kind: "tower-upgraded",
      playerId: action.playerId,
      refId: tower.id,
      message: `${getTowerDefinition(tower.typeId).shortName} ganhou ${branch.shortName}`
    });

    return 0.06;
  }

  private setReady(
    playerId: PlayerId,
    ready: boolean,
    events: ActionEvent[],
    errors: ActionError[]
  ): number {
    const player = this.getPlayer(playerId, errors);

    if (!player) {
      return -0.1;
    }

    if (this.stateInternal.phase !== "preparation") {
      errors.push({
        code: "WRONG_PHASE",
        playerId,
        message: "pronto so vale durante preparacao"
      });
      return -0.05;
    }

    player.ready = ready;
    events.push({
      kind: "ready",
      playerId,
      message: ready ? `${playerId} pronto` : `${playerId} cancelou pronto`
    });

    if (this.areBothReady()) {
      return this.startAndResolveWave(events);
    }

    return 0.02;
  }

  private selectReward(
    playerId: PlayerId,
    skillId: string,
    events: ActionEvent[],
    errors: ActionError[]
  ): number {
    if (this.stateInternal.phase !== "reward-selection" || !this.stateInternal.rewardSelection) {
      errors.push({
        code: "WRONG_PHASE",
        playerId,
        message: "nao ha recompensa aberta"
      });
      return -0.08;
    }

    const player = this.getPlayer(playerId, errors);
    const choice = this.stateInternal.rewardSelection.choices[playerId];

    if (!player || !choice || !choice.skillIds.includes(skillId)) {
      errors.push({
        code: "REWARD_NOT_AVAILABLE",
        playerId,
        refId: skillId,
        message: "skill nao esta entre as escolhas"
      });
      return -0.08;
    }

    const skill = getSkillDefinition(skillId);
    const rank = getSkillRank(player.skillRanks, skillId);

    if (rank >= skill.maxRank || player.sigils < skill.costSigils) {
      errors.push({
        code: "REWARD_NOT_AVAILABLE",
        playerId,
        refId: skillId,
        message: "skill no maximo ou sigilos insuficientes"
      });
      return -0.08;
    }

    player.sigils -= skill.costSigils;
    player.skillRanks[skillId] = rank + 1;
    choice.selectedSkillId = skillId;
    events.push({
      kind: "reward-selected",
      playerId,
      refId: skillId,
      message: `${playerId} escolheu ${skill.shortName}`
    });

    if (this.canCloseReward()) {
      this.closeRewardSelection(events);
    }

    return 0.2;
  }

  private setAutoBuild(
    action: Extract<GameAction, { type: "SET_AUTO_BUILD" }>,
    events: ActionEvent[],
    errors: ActionError[]
  ): void {
    const tower = this.stateInternal.towers.find((candidate) => candidate.id === action.towerId);
    const build = towerAutoBuildDefinitions.find((definition) => definition.id === action.buildId);

    if (!tower || tower.ownerId !== action.playerId || !build) {
      errors.push({
        code: "UNKNOWN_TOWER",
        playerId: action.playerId,
        refId: action.towerId,
        message: "torre ou build automatica desconhecida"
      });
      return;
    }

    tower.autoBuildId = action.buildId;
    events.push({
      kind: "auto-build-set",
      playerId: action.playerId,
      refId: tower.id,
      message: `${getTowerDefinition(tower.typeId).shortName}: ${build.name}`
    });
  }

  private wait(deltaMs: number, events: ActionEvent[]): number {
    const delta = Math.max(0, Math.min(60000, deltaMs));
    this.stateInternal.elapsedMs += delta;

    if (this.stateInternal.phase === "preparation") {
      this.stateInternal.readyCountdownMs -= delta;

      if (this.stateInternal.readyCountdownMs <= 0) {
        events.push({
          kind: "wave-started",
          message: "timer automatico iniciou a wave"
        });
        return this.startAndResolveWave(events);
      }
    }

    events.push({
      kind: "wait",
      message: `${delta}ms`
    });

    return 0;
  }

  private pause(paused: boolean, events: ActionEvent[], errors: ActionError[]): void {
    if (paused && this.stateInternal.phase !== "paused") {
      this.stateInternal.previousPhase = this.stateInternal.phase;
      this.stateInternal.phase = "paused";
      events.push({ kind: "wait", message: "pausado" });
      return;
    }

    if (!paused && this.stateInternal.phase === "paused") {
      this.stateInternal.phase = this.stateInternal.previousPhase ?? "preparation";
      this.stateInternal.previousPhase = null;
      events.push({ kind: "wait", message: "retomado" });
      return;
    }

    errors.push({
      code: "WRONG_PHASE",
      message: "pause/resume ignorado neste estado"
    });
  }

  private debugAdvance(events: ActionEvent[], errors: ActionError[]): number {
    if (!this.stateInternal.debug) {
      errors.push({
        code: "DEBUG_DISABLED",
        message: "debug desativado"
      });
      return -0.1;
    }

    events.push({
      kind: "debug",
      message: "debug avancou wave"
    });

    return this.startAndResolveWave(events);
  }

  private startAndResolveWave(events: ActionEvent[]): number {
    const wave = getWaveDefinition(this.stateInternal.currentWaveIndex);

    this.stateInternal.phase = "combat";
    events.push({
      kind: "wave-started",
      refId: wave.id,
      message: `${wave.name} iniciou`
    });

    const map = getCurrentMap(this.stateInternal);
    const scaledGroups = getScaledWaveGroups(wave, this.stateInternal, map);
    const result = this.resolveWave(wave, map);
    this.stateInternal.baseHp = Math.max(0, this.stateInternal.baseHp - result.baseDamage);
    this.stateInternal.waveLog.push({
      waveId: wave.id,
      waveName: wave.name,
      cleared: result.cleared,
      baseDamage: result.baseDamage,
      leaks: result.leaks,
      kills: result.kills,
      routeCount: new Set(scaledGroups.map((group) => group.pathIndex ?? 0)).size
    });

    if (!result.cleared || this.stateInternal.baseHp <= 0) {
      this.stateInternal.phase = "defeat";
      events.push({
        kind: "game-ended",
        refId: wave.id,
        message: "derrota"
      });
      return -2;
    }

    this.rewardTeam(WAVE_COMPLETION_BONUS_PER_PLAYER, 1);
    this.stateInternal.currentWaveIndex += 1;
    events.push({
      kind: "wave-cleared",
      refId: wave.id,
      amount: result.kills,
      message: `${wave.name} concluida`
    });

    if (this.stateInternal.currentWaveIndex >= this.stateInternal.targetWaveCount) {
      this.stateInternal.phase = "victory";
      events.push({
        kind: "game-ended",
        message: `sobreviveu ${this.stateInternal.targetWaveCount} waves`
      });
      return 2.5;
    }

    if (wave.isBoss && wave.bossRewardSigils) {
      for (const playerId of this.getPlayerIds()) {
        this.stateInternal.players[playerId].sigils += wave.bossRewardSigils;
      }

      this.openRewardSelection(wave, events);
      return 1.2;
    }

    this.openPreparation();
    return 0.8;
  }

  private resolveWave(wave: WaveDefinition, map: MapDefinition): SimulationGroupResult {
    let baseDamage = 0;
    let kills = 0;
    let leaks = 0;

    for (const group of getScaledWaveGroups(wave, this.stateInternal, map).sort(
      (a, b) => a.startDelayMs - b.startDelayMs
    )) {
      const enemy = getEnemyDefinition(group.enemyTypeId);
      const groupResult = this.resolveGroup(group, enemy, map);

      baseDamage += groupResult.baseDamage;
      kills += groupResult.kills;
      leaks += groupResult.leaks;
    }

    this.grantIncomeTowersForWave(wave);

    return {
      cleared: this.stateInternal.baseHp - baseDamage > 0,
      baseDamage,
      kills,
      leaks
    };
  }

  private resolveGroup(
    group: WaveGroupDefinition,
    enemy: EnemyDefinition,
    map: MapDefinition
  ): SimulationGroupResult {
    const pathIndex = safePathIndex(map, group.pathIndex ?? 0);
    const pathLength = Math.max(1, (map.paths[pathIndex]?.length ?? 1) - 1) * map.tileSize;
    const control = this.getControlMultiplier(enemy, pathIndex, map);
    const exposureSeconds = (pathLength / enemy.speed) * control;
    const contributions = this.getTowerContributions(enemy, pathIndex, map);
    const totalDps = contributions.reduce((sum, item) => sum + item.damagePerSecond, 0);
    const pressureDivisor =
      1 + Math.max(0, group.count - 1) * (enemy.traits.includes("enxame") ? 0.036 : 0.023);
    const damageNoise = 0.9 + this.rng.next() * 0.2;
    const damageCapacity = (totalDps * exposureSeconds * damageNoise) / pressureDivisor;
    const effectiveHp = enemy.maxHp + enemy.armor * 9;
    const killed = Math.min(group.count, Math.floor(damageCapacity / effectiveHp));
    const leaked = group.count - killed;
    const dealtDamage = Math.min(group.count * effectiveHp, damageCapacity);

    this.distributeDamageAndKills(contributions, enemy, killed, dealtDamage);

    return {
      cleared: true,
      baseDamage: leaked * enemy.baseDamage,
      kills: killed,
      leaks: leaked
    };
  }

  private getTowerContributions(
    enemy: EnemyDefinition,
    pathIndex: number,
    map: MapDefinition
  ): TowerContribution[] {
    return this.stateInternal.towers
      .map((tower) => ({
        tower,
        damagePerSecond: this.getTowerDamagePerSecond(tower, enemy, pathIndex, map)
      }))
      .filter((entry) => entry.damagePerSecond > 0);
  }

  private getTowerDamagePerSecond(
    tower: HeadlessTowerState,
    enemy: EnemyDefinition,
    pathIndex: number,
    map: MapDefinition
  ): number {
    const definition = getTowerDefinition(tower.typeId);

    if (definition.effect === "income" || definition.effect === "aura") {
      return 0;
    }

    const owner = this.stateInternal.players[tower.ownerId];
    const playerClass = getPlayerClassDefinition(owner.classId);
    const skillEffects = getSkillEffectTotals(owner.id, owner.skillRanks);
    const levelBonuses = getTowerLevelBonuses(tower.level);
    const branchEffects = getTowerBranchEffectTotals(tower.branchRanks);
    const routeCoverage = getRouteCoverage(tower, definition, pathIndex, map);
    const effectMultiplier = getEffectMultiplier(definition, enemy);
    const auraMultiplier = this.getAuraMultiplier(tower, map);
    const damage = Math.max(
      1,
      definition.damage *
        playerClass.damageMultiplier *
        skillEffects.damageMultiplier *
        levelBonuses.damageMultiplier *
        branchEffects.damageMultiplier *
        auraMultiplier.damage -
        Math.max(0, enemy.armor - getArmorReduction(definition))
    );
    const cooldown =
      definition.cooldownMs *
      levelBonuses.cooldownMultiplier *
      branchEffects.cooldownMultiplier *
      auraMultiplier.cooldown;

    return damage * (1000 / cooldown) * routeCoverage * effectMultiplier;
  }

  private getAuraMultiplier(
    tower: HeadlessTowerState,
    map: MapDefinition
  ): { damage: number; cooldown: number } {
    let damage = 1;
    let cooldown = 1;

    for (const candidate of this.stateInternal.towers) {
      if (candidate.id === tower.id || candidate.ownerId !== tower.ownerId) {
        continue;
      }

      const definition = getTowerDefinition(candidate.typeId);

      if (definition.effect !== "aura") {
        continue;
      }

      const range = definition.auraRange ?? definition.range;
      const gridDistance = Math.abs(candidate.grid.col - tower.grid.col) + Math.abs(candidate.grid.row - tower.grid.row);

      if (gridDistance * map.tileSize <= range) {
        damage *= definition.auraDamageMultiplier ?? 1;
        cooldown *= definition.auraCooldownMultiplier ?? 1;
      }
    }

    return { damage, cooldown };
  }

  private getControlMultiplier(
    enemy: EnemyDefinition,
    pathIndex: number,
    map: MapDefinition
  ): number {
    const controlScore = this.stateInternal.towers.reduce((sum, tower) => {
      const definition = getTowerDefinition(tower.typeId);
      const coverage = getRouteCoverage(tower, definition, pathIndex, map);

      if (definition.effect === "slow") {
        return sum + coverage * (0.12 + tower.level * 0.035);
      }

      if (definition.effect === "redirect") {
        return sum + coverage * (enemy.traits.includes("boss") ? 0.03 : 0.14);
      }

      if (definition.effect === "summon") {
        return sum + coverage * 0.1;
      }

      return sum;
    }, 0);

    return 1 + Math.min(0.76, controlScore + (enemy.traits.includes("boss") ? 0.1 : 0));
  }

  private distributeDamageAndKills(
    contributions: readonly TowerContribution[],
    enemy: EnemyDefinition,
    killed: number,
    dealtDamage: number
  ): void {
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
      const player = this.stateInternal.players[contribution.tower.ownerId];
      const isLast = index === contributions.length - 1;
      const towerKills = isLast
        ? killed - allocatedKills
        : Math.min(killed - allocatedKills, Math.floor(killed * share + this.rng.next()));

      contribution.tower.damageDealt += damage;
      player.damage += damage;

      if (towerKills <= 0) {
        return;
      }

      allocatedKills += towerKills;
      contribution.tower.kills += towerKills;
      player.kills += towerKills;
      this.rewardTeam(towerKills * enemy.reward, KILL_REWARD_MULTIPLIER);

      for (let indexXp = 0; indexXp < Math.max(1, towerKills); indexXp += 1) {
        this.grantTowerXp(contribution.tower);
      }
    });
  }

  private grantTowerXp(tower: HeadlessTowerState): void {
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
      this.applyAutoBuild(tower);
    }
  }

  private applyAutoBuild(tower: HeadlessTowerState): void {
    const build =
      towerAutoBuildDefinitions.find((definition) => definition.id === tower.autoBuildId) ??
      towerAutoBuildDefinitions[0];

    while (tower.skillPoints > 0) {
      const branchId = [...build.sequence]
        .filter(
          (candidate) => tower.branchRanks[candidate] < getTowerBranchDefinition(candidate).maxRank
        )
        .sort((a, b) => tower.branchRanks[a] - tower.branchRanks[b])[0];

      if (!branchId) {
        return;
      }

      tower.branchRanks[branchId] += 1;
      tower.skillPoints -= 1;
    }
  }

  private grantIncomeTowersForWave(wave: WaveDefinition): void {
    const waveDurationMs = wave.groups.reduce(
      (duration, group) => Math.max(duration, group.startDelayMs + group.intervalMs * group.count),
      0
    );

    for (const tower of this.stateInternal.towers) {
      const definition = getTowerDefinition(tower.typeId);

      if (definition.effect !== "income") {
        continue;
      }

      const interval = definition.incomeIntervalMs ?? definition.cooldownMs;
      const ticks = Math.max(0, Math.floor(waveDurationMs / interval));

      if (ticks > 0) {
        const capMultiplier = this.getIncomeTowerCapMultiplier(tower);

        if (capMultiplier > 0) {
          this.rewardTeam(
            ticks * (definition.incomePerTick ?? 1),
            INCOME_TOWER_REWARD_SCALE * capMultiplier
          );
        }
      }
    }
  }

  private rewardTeam(amount: number, scale: number): number {
    if (amount <= 0 || scale <= 0) {
      return 0;
    }

    const credits = Math.max(1, Math.floor(amount * scale * this.getTeamRewardMultiplier()));

    for (const playerId of this.getPlayerIds()) {
      this.stateInternal.players[playerId].credits += credits;
    }

    return credits;
  }

  private getIncomeTowerCapMultiplier(tower: HeadlessTowerState): number {
    const incomeTowers = this.stateInternal.towers.filter((candidate) => {
      const definition = getTowerDefinition(candidate.typeId);

      return candidate.ownerId === tower.ownerId && definition.effect === "income";
    });
    const towerRank = incomeTowers.findIndex((candidate) => candidate.id === tower.id);

    if (towerRank >= INCOME_TOWER_HARD_CAP) {
      return 0;
    }

    return towerRank >= INCOME_TOWER_SOFT_CAP ? 0.52 : 1;
  }

  private getTeamRewardMultiplier(): number {
    const multipliers = this.getPlayerIds().map((playerId) => {
      const player = this.stateInternal.players[playerId];
      const playerClass = getPlayerClassDefinition(player.classId);
      const skills = getSkillEffectTotals(player.id, player.skillRanks);

      return playerClass.rewardMultiplier * skills.rewardMultiplier;
    });

    return multipliers.reduce((sum, value) => sum + value, 0) / multipliers.length;
  }

  private openRewardSelection(wave: WaveDefinition, events: ActionEvent[]): void {
    this.stateInternal.phase = "reward-selection";
    this.stateInternal.rewardSelection = {
      bossWaveId: wave.id,
      choices: Object.fromEntries(
        this.getPlayerIds().map((playerId) => [
          playerId,
          createRewardChoice(this.stateInternal.players[playerId], wave.id)
        ])
      ) as Record<PlayerId, ReturnType<typeof createRewardChoice>>
    };
    events.push({
      kind: "reward-opened",
      refId: wave.id,
      message: "recompensa pos-boss aberta"
    });

    if (this.canCloseReward()) {
      this.closeRewardSelection(events);
    }
  }

  private canCloseReward(): boolean {
    const reward = this.stateInternal.rewardSelection;

    if (!reward) {
      return true;
    }

    return this.getPlayerIds().every((playerId) => {
      const choice = reward.choices[playerId];

      return choice.skillIds.length === 0 || choice.selectedSkillId !== null;
    });
  }

  private closeRewardSelection(events: ActionEvent[]): void {
    this.stateInternal.rewardSelection = null;
    this.openPreparation();
    events.push({
      kind: "reward-selected",
      message: "recompensas concluidas"
    });
  }

  private openPreparation(): void {
    this.stateInternal.phase = "preparation";
    this.stateInternal.readyCountdownMs = WAVE_AUTO_START_MS;

    for (const playerId of this.getPlayerIds()) {
      this.stateInternal.players[playerId].ready = false;
    }
  }

  private areBothReady(): boolean {
    const playerIds = this.getPlayerIds();

    return playerIds.length > 0 && playerIds.every((playerId) => this.stateInternal.players[playerId].ready);
  }

  private getPlayerIds(): PlayerId[] {
    return Object.keys(this.stateInternal.players) as PlayerId[];
  }

  private getPlayer(playerId: PlayerId, errors: ActionError[]): HeadlessPlayerState | null {
    const player = this.stateInternal.players[playerId];

    if (!player) {
      errors.push({
        code: "UNKNOWN_PLAYER",
        playerId,
        message: "jogador desconhecido"
      });
      return null;
    }

    return player;
  }

  private isDone(): boolean {
    return this.stateInternal.phase === "victory" || this.stateInternal.phase === "defeat";
  }

  private result(
    reward: number,
    events: ActionEvent[],
    errors: ActionError[]
  ): ActionStepResult<HeadlessGameState> {
    const invariantFailures = checkHeadlessInvariants(this.stateInternal);

    return {
      state: this.state,
      reward,
      done: this.isDone(),
      events,
      errors,
      invariantFailures
    };
  }
}

const createInitialState = (
  seed: number,
  requestedPlayers: Partial<Record<PlayerId, string>>,
  requestedPlayerCount: number | undefined,
  debug: boolean,
  targetWaveCount: number
): HeadlessGameState => {
  const playerCount = resolveHeadlessPlayerCount(requestedPlayers, requestedPlayerCount);
  const playerIds = Array.from({ length: playerCount }, (_, index) => createPlayerId(index + 1));
  const openingMap = getMapStage(getMapStageBoostForPlayerCount(playerCount));

  return {
    version: ENV_VERSION,
    seed,
    mapId: openingMap.id,
    phase: "preparation",
    previousPhase: null,
    debug,
    tick: 0,
    elapsedMs: 0,
    currentWaveIndex: 0,
    targetWaveCount: Math.max(1, Math.floor(targetWaveCount)),
    baseHp: openingMap.baseHp,
    readyCountdownMs: WAVE_AUTO_START_MS,
    players: Object.fromEntries(
      playerIds.map((playerId, index) => [
        playerId,
        createPlayer(
          playerId,
          requestedPlayers[playerId] ?? playerClassDefinitions[index % playerClassDefinitions.length].id,
          openingMap.startingCredits
        )
      ])
    ) as Record<PlayerId, HeadlessPlayerState>,
    towers: [],
    rewardSelection: null,
    waveLog: []
  };
};

const createPlayer = (id: PlayerId, classId: string, credits: number): HeadlessPlayerState => ({
  id,
  classId,
  credits,
  sigils: 0,
  ready: false,
  skillRanks: {},
  damage: 0,
  kills: 0,
  towersBuilt: 0
});

const resolveHeadlessPlayerCount = (
  requestedPlayers: Partial<Record<PlayerId, string>>,
  requestedPlayerCount?: number
): number => {
  if (requestedPlayerCount !== undefined) {
    return clampPlayerCount(requestedPlayerCount);
  }

  const maxRequestedId = (Object.keys(requestedPlayers) as PlayerId[]).reduce(
    (max, playerId) => Math.max(max, getPlayerNumber(playerId)),
    0
  );

  return clampPlayerCount(Math.max(2, maxRequestedId));
};

const createRewardChoice = (
  player: HeadlessPlayerState,
  bossWaveId: string
) => {
  const choices = getRewardSkillChoices(player.id, player.skillRanks, player.sigils, bossWaveId, 3);

  return {
    playerId: player.id,
    skillIds: choices.map((choice) => choice.id),
    selectedSkillId: null
  };
};

const getCurrentMap = (state: HeadlessGameState): MapDefinition => {
  const wave = getWaveDefinition(state.currentWaveIndex);

  return getMapStage(wave.mapStageIndex + getMapStageBoostForPlayerCount(Object.keys(state.players).length));
};

const getScaledWaveGroups = (
  wave: WaveDefinition,
  state: HeadlessGameState,
  map: MapDefinition
): WaveGroupDefinition[] => {
  const playerCount = Object.keys(state.players).length;
  const pressureScale = 1 + Math.max(0, playerCount - 2) * 0.14;
  const tempoScale = 1 + Math.max(0, playerCount - 2) * 0.025;
  const routeCount = Math.max(1, map.paths.length);
  const routeCopies = getRouteCopiesForPlayerCount(playerCount, routeCount);

  return wave.groups.flatMap((group, groupIndex) => {
    const totalCount = Math.max(1, Math.round(group.count * pressureScale));
    const countPerRoute = Math.max(1, Math.ceil(totalCount / routeCopies));
    const basePathIndex = group.pathIndex ?? groupIndex % routeCount;

    return Array.from({ length: routeCopies }, (_, copyIndex) => ({
      ...group,
      count: countPerRoute,
      intervalMs: Math.max(90, Math.round(group.intervalMs / tempoScale)),
      startDelayMs: group.startDelayMs + copyIndex * 420,
      pathIndex: (basePathIndex + copyIndex) % routeCount
    }));
  });
};

const getMapStageBoostForPlayerCount = (playerCount: number): number => {
  if (playerCount >= 10) {
    return 4;
  }

  if (playerCount >= 8) {
    return 3;
  }

  if (playerCount >= 4) {
    return 2;
  }

  return 0;
};

const getRouteCopiesForPlayerCount = (playerCount: number, routeCount: number): number => {
  if (playerCount >= 8) {
    return Math.min(routeCount, 3);
  }

  if (playerCount >= 4) {
    return Math.min(routeCount, 2);
  }

  return 1;
};

const getKnownTower = (towerId: string): TowerDefinition | null =>
  getTowerDefinitionsForClass(playerClassDefinitions[0].id)
    .concat(...playerClassDefinitions.slice(1).map((playerClass) => getTowerDefinitionsForClass(playerClass.id)))
    .find((tower) => tower.id === towerId) ?? null;

const sameGrid = (a: GridPoint, b: GridPoint): boolean => a.col === b.col && a.row === b.row;

const getTowerCost = (player: HeadlessPlayerState, tower: TowerDefinition): number => {
  const playerClass = getPlayerClassDefinition(player.classId);
  const skillEffects = getSkillEffectTotals(player.id, player.skillRanks);

  return Math.ceil(tower.cost * playerClass.costMultiplier * skillEffects.costMultiplier);
};

const safePathIndex = (map: MapDefinition, pathIndex: number): number =>
  map.paths[pathIndex] ? pathIndex : 0;

const getRouteCoverage = (
  tower: HeadlessTowerState,
  definition: TowerDefinition,
  pathIndex: number,
  map: MapDefinition
): number => {
  const path = map.paths[safePathIndex(map, pathIndex)] ?? map.paths[0];
  const nearestDistance = path.reduce((min, point) => {
    const distance = Math.abs(point.col - tower.grid.col) + Math.abs(point.row - tower.grid.row);

    return Math.min(min, distance);
  }, Number.POSITIVE_INFINITY);
  const rangeTiles = Math.max(1, definition.range / map.tileSize);
  const localCoverage = Math.max(0, 1 - nearestDistance / (rangeTiles + 0.4));
  const laneCoverage = map.paths.length === 1 ? 1 : 0.58;

  return Math.min(1, localCoverage * (nearestDistance <= rangeTiles ? 1 : laneCoverage));
};

const getEffectMultiplier = (tower: TowerDefinition, enemy: EnemyDefinition): number => {
  if (tower.effect === "damage") {
    return enemy.traits.includes("boss") ? 1.14 : enemy.traits.includes("rapido") ? 1.08 : 1;
  }

  if (tower.effect === "slow") {
    return enemy.traits.includes("boss") || enemy.traits.includes("blindado") ? 0.94 : 0.74;
  }

  if (tower.effect === "splash") {
    return enemy.traits.includes("enxame") ? 2.35 : enemy.traits.includes("escudo") ? 1.28 : 1.04;
  }

  if (tower.effect === "chain") {
    return enemy.traits.includes("enxame") || enemy.traits.includes("rapido") ? 2.02 : 1.04;
  }

  if (tower.effect === "summon") {
    return enemy.traits.includes("boss") ? 0.88 : 1.18;
  }

  if (tower.effect === "mark") {
    return enemy.traits.includes("boss") ? 1.38 : 1.1;
  }

  if (tower.effect === "cleanse") {
    return enemy.traits.includes("escudo") || enemy.traits.includes("blindado") ? 1.32 : 1;
  }

  if (tower.effect === "ritual-zone") {
    return enemy.traits.includes("enxame") ? 1.4 : 1.16;
  }

  if (tower.effect === "redirect") {
    return enemy.traits.includes("boss") ? 0.62 : 1.08;
  }

  return 1;
};

const getArmorReduction = (tower: TowerDefinition): number =>
  tower.effect === "cleanse" || tower.effect === "ritual-zone"
    ? tower.armorReduction ?? 0
    : 0;

const cloneState = (state: HeadlessGameState): HeadlessGameState =>
  JSON.parse(JSON.stringify(state)) as HeadlessGameState;
