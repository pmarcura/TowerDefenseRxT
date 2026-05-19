import { WAVE_COMPLETION_BONUS_PER_PLAYER } from "../config/constants";
import { getMapStage } from "../data/map";
import { getWaveDefinition } from "../data/waves";
import { GameRegistry } from "../GameRegistry";
import type { WaveDefinition } from "../models/types";
import { RunTelemetry } from "../telemetry/RunTelemetry";
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

    state.activeMap = getMapStage(wave.mapStageIndex);
    state.combatStats.p1.waveDamageDealt = 0;
    state.combatStats.p2.waveDamageDealt = 0;
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
    this.registry.pushPlayerNotice("p1", "WAVE LIVE", wave.name, wave.isBoss ? "danger" : "info", 1600);
    this.registry.pushPlayerNotice("p2", "WAVE LIVE", wave.name, wave.isBoss ? "danger" : "info", 1600);
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
      state.activeMap = getMapStage(nextWave.mapStageIndex);
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
    state.activeMap = getMapStage(nextWave.mapStageIndex);
    state.wave.active = false;
    this.registry.clearWaveReadiness(true);
    this.notifyNewRoutes(currentWave, nextWave);
    this.setRoundNotice(
      "Onda contida",
      `Proxima: ${nextWave.name}. Pronto acelera; timer inicia sozinho.`,
      "complete",
      5200
    );
    this.registry.pushPlayerNotice(
      "p1",
      `+${creditsGranted} CRED`,
      `Dano wave ${Math.round(state.combatStats.p1.waveDamageDealt)}`,
      "success",
      2200
    );
    this.registry.pushPlayerNotice(
      "p2",
      `+${creditsGranted} CRED`,
      `Dano wave ${Math.round(state.combatStats.p2.waveDamageDealt)}`,
      "success",
      2200
    );
    this.registry.pushMessage("Onda contida", 1800);
    this.telemetry.record("wave-clear", state);
  }

  private createRuntimeGroups(wave: WaveDefinition): RuntimeWaveGroup[] {
    return wave.groups.map((group) => ({
      enemyTypeId: group.enemyTypeId,
      remaining: group.count,
      total: group.count,
      intervalMs: group.intervalMs,
      timerMs: group.startDelayMs,
      pathIndex: group.pathIndex ?? 0
    }));
  }

  private updateWaveSnapshot(): void {
    const state = this.registry.state;
    const wave = getWaveDefinition(state.wave.currentWaveIndex);
    const groups = state.wave.active
      ? this.activeGroups
      : wave.groups.map((group) => ({
          enemyTypeId: group.enemyTypeId,
          remaining: group.count,
          total: group.count,
          intervalMs: group.intervalMs,
          timerMs: group.startDelayMs,
          pathIndex: group.pathIndex ?? 0
        })) ?? [];
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

    this.registry.pushPlayerNotice("p1", "NOVA ROTA", detail, "warning", 3600);
    this.registry.pushPlayerNotice("p2", "NOVA ROTA", detail, "warning", 3600);
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
}
