import { WAVE_COMPLETION_BONUS_PER_PLAYER } from "../config/constants";
import { getMapStage } from "../data/map";
import { getWaveDefinition } from "../data/waves";
import { GameRegistry } from "../GameRegistry";
import type { WaveDefinition } from "../models/types";
import { RunTelemetry } from "../telemetry/RunTelemetry";
import { getPlayablePlayerIds } from "../utils/players";
import type { EconomySystem } from "./EconomySystem";
import type { EnemySystem } from "./EnemySystem";
import type { GameSystem } from "./GameSystem";
import type { SkillTreeSystem } from "./SkillTreeSystem";

type RuntimeWaveGroup = {
  enemyTypeId: string;
  remaining: number;
  total: number;
  intervalMs: number;
  timerMs: number;
  pathIndex: number;
};

export class WaveSystem implements GameSystem {
  private activeGroups: RuntimeWaveGroup[] = [];
  private readonly telemetry = RunTelemetry.getInstance();

  constructor(
    private readonly registry: GameRegistry,
    private readonly enemySystem: EnemySystem,
    private readonly economySystem: EconomySystem,
    private readonly skillTreeSystem: SkillTreeSystem
  ) {}

  update(deltaMs: number): void {
    const state = this.registry.state;

    if (state.phase !== "playing") {
      return;
    }

    if (!state.wave.active) {
      this.updateWaveSnapshot();

      state.wave.nextWaveInMs = Math.max(0, state.wave.nextWaveInMs - deltaMs);

      if (state.wave.nextWaveInMs <= 0 && !state.wave.completed) {
        this.startCurrentWave();
      }

      return;
    }

    this.updateActiveWave(deltaMs);
    this.updateWaveSnapshot();
  }

  private startCurrentWave(): void {
    const state = this.registry.state;
    const wave = getWaveDefinition(state.wave.currentWaveIndex);

    this.registry.applyActiveMap(this.getMapStageForWave(wave));
    for (const playerId of getPlayablePlayerIds(state)) {
      state.combatStats[playerId].waveDamageDealt = 0;
    }
    this.activeGroups = this.createRuntimeGroups(wave);
    state.wave.active = true;
    state.wave.nextWaveInMs = 0;
    this.registry.clearWaveReadiness(false);
    this.setRoundNotice(
      wave.isBoss ? "Boss entrando" : `Onda ${state.wave.currentWaveIndex + 1} iniciada`,
      `${wave.name} - ${state.activeMap.name}`,
      wave.isBoss ? "boss" : "start",
      2100
    );
    this.registry.pushPresentationEvent("wave", 1400, {
      cueId: wave.isBoss ? "boss" : "wave_start",
      label: wave.name
    });
    for (const playerId of getPlayablePlayerIds(state)) {
      this.registry.pushPlayerNotice(playerId, "WAVE LIVE", wave.name, wave.isBoss ? "danger" : "info", 1600);
    }
    this.registry.pushMessage(`${wave.name} - ${state.activeMap.name}`, 2200);
    this.telemetry.record("wave-start", state);
    this.updateWaveSnapshot();
  }

  private updateActiveWave(deltaMs: number): void {
    for (const group of this.activeGroups) {
      if (group.remaining <= 0) {
        continue;
      }

      group.timerMs -= deltaMs;

      while (group.timerMs <= 0 && group.remaining > 0) {
        this.enemySystem.spawn(group.enemyTypeId, group.pathIndex);
        group.remaining -= 1;
        group.timerMs += group.intervalMs;
      }
    }

    const everyGroupFinished = this.activeGroups.every((group) => group.remaining <= 0);
    const noEnemiesInPlay = this.registry.state.enemies.every((enemy) => !enemy.alive);
    this.updateWaveSnapshot();

    if (everyGroupFinished && noEnemiesInPlay) {
      this.completeCurrentWave();
    }
  }

  private completeCurrentWave(): void {
    const state = this.registry.state;
    const currentWave = getWaveDefinition(state.wave.currentWaveIndex);
    const nextWaveIndex = state.wave.currentWaveIndex + 1;
    const nextWave = getWaveDefinition(nextWaveIndex);

    const creditsGranted = this.economySystem.rewardTeam(WAVE_COMPLETION_BONUS_PER_PLAYER);
    state.enemies = [];
    state.allies = [];
    state.ritualZones = [];
    state.projectiles = [];

    if (currentWave.isBoss && currentWave.bossRewardSigils) {
      this.economySystem.rewardBossSigils(currentWave.bossRewardSigils);
      this.registry.pushPresentationEvent("audio", 1200, { cueId: "reward" });

      state.wave.active = false;
      state.wave.currentWaveIndex = nextWaveIndex;
      this.registry.applyActiveMap(this.getMapStageForWave(nextWave));
      this.registry.clearWaveReadiness(true);
      this.notifyNewRoutes(currentWave, nextWave);

      this.setRoundNotice(
        "Boss vencido",
        `Recompensa liberada. Depois: ${nextWave.name}`,
        "boss",
        2600
      );
      this.skillTreeSystem.createRewardChoices(currentWave.id);
      this.registry.pushMessage(`Boss vencido: +${currentWave.bossRewardSigils} sigilo`);
      this.telemetry.record("wave-clear", state);
      return;
    }

    state.wave.currentWaveIndex = nextWaveIndex;
    this.registry.applyActiveMap(this.getMapStageForWave(nextWave));
    state.wave.active = false;
    this.registry.clearWaveReadiness(true);
    this.notifyNewRoutes(currentWave, nextWave);
    this.setRoundNotice(
      "Onda contida",
      `Proxima: ${nextWave.name}. Pronto acelera; timer inicia sozinho.`,
      "complete",
      5200
    );
    for (const playerId of getPlayablePlayerIds(state)) {
      this.registry.pushPlayerNotice(
        playerId,
        `+${creditsGranted} CRED`,
        `Dano wave ${Math.round(state.combatStats[playerId].waveDamageDealt)}`,
        "success",
        2200
      );
    }
    this.registry.pushMessage("Onda contida", 1800);
    this.telemetry.record("wave-clear", state);
  }

  private createRuntimeGroups(wave: WaveDefinition): RuntimeWaveGroup[] {
    const playerCount = getPlayablePlayerIds(this.registry.state).length;
    const pressureScale = this.getPlayerPressureScale(playerCount);
    const routeCount = Math.max(1, this.registry.state.activeMap.paths.length);
    const routeCopies = this.getRouteCopies(playerCount, routeCount);

    return wave.groups.flatMap((group, groupIndex) => {
      const totalCount = Math.max(1, Math.round(group.count * pressureScale));
      const countPerRoute = Math.max(1, Math.ceil(totalCount / routeCopies));
      const basePathIndex = group.pathIndex ?? groupIndex % routeCount;

      return Array.from({ length: routeCopies }, (_, copyIndex) => ({
        enemyTypeId: group.enemyTypeId,
        remaining: countPerRoute,
        total: countPerRoute,
        intervalMs: Math.max(90, Math.round(group.intervalMs / this.getTempoScale(playerCount))),
        timerMs: group.startDelayMs + copyIndex * 420,
        pathIndex: (basePathIndex + copyIndex) % routeCount
      }));
    });
  }

  private updateWaveSnapshot(): void {
    const state = this.registry.state;
    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const groups = state.wave.active ? this.activeGroups : this.createRuntimeGroups(wave);
    const activePathIndexes = [...new Set(groups.map((group) => group.pathIndex))];

    state.wave.snapshot = {
      groups: groups.map((group) => ({
        enemyTypeId: group.enemyTypeId,
        remaining: group.remaining,
        total: group.total,
        pathIndex: group.pathIndex
      })),
      totalSpawnsRemaining: groups.reduce((sum, group) => sum + group.remaining, 0),
      aliveEnemies: state.enemies.filter((enemy) => enemy.alive).length,
      activePathIndexes
    };
  }

  private notifyNewRoutes(currentWave: WaveDefinition, nextWave: WaveDefinition): void {
    const currentRoutes = new Set(currentWave.groups.map((group) => group.pathIndex ?? 0));
    const newRoutes = [...new Set(nextWave.groups.map((group) => group.pathIndex ?? 0))].filter(
      (pathIndex) => !currentRoutes.has(pathIndex)
    );

    if (newRoutes.length === 0) {
      return;
    }

    const detail = `rota ${newRoutes.map((route) => route + 1).join(", ")} marcada no mapa`;

    for (const playerId of getPlayablePlayerIds(this.registry.state)) {
      this.registry.pushPlayerNotice(playerId, "NOVA ROTA", detail, "warning", 3600);
    }
  }

  private setRoundNotice(
    title: string,
    subtitle: string,
    tone: "start" | "complete" | "boss" | "danger",
    timerMs: number
  ): void {
    this.registry.state.wave.notice = {
      title,
      subtitle,
      tone,
      timerMs
    };
  }

  private getMapStageForWave(wave: WaveDefinition) {
    return getMapStage(wave.mapStageIndex + this.getMapStageBoost());
  }

  private getMapStageBoost(): number {
    const playerCount = getPlayablePlayerIds(this.registry.state).length;

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
  }

  private getPlayerPressureScale(playerCount: number): number {
    return 1 + Math.max(0, playerCount - 2) * 0.14;
  }

  private getTempoScale(playerCount: number): number {
    return 1 + Math.max(0, playerCount - 2) * 0.025;
  }

  private getRouteCopies(playerCount: number, routeCount: number): number {
    if (playerCount >= 8) {
      return Math.min(routeCount, 3);
    }

    if (playerCount >= 4) {
      return Math.min(routeCount, 2);
    }

    return 1;
  }
}
