import {
  DEBUG_DEFAULT_ENABLED,
  WAVE_AUTO_START_MS,
  WAVE_READY_COUNTDOWN_MS
} from "./config/constants";
import { mapDefinition } from "./data/map";
import { playerClassDefinitions } from "./data/playerClasses";
import {
  applyTowerAutoBuild,
  getTowerAutoBuildDefinition,
  getTowerBranchDefinition,
  spendTowerBranchPoint,
  towerBranchDefinitions
} from "./data/towerBranches";
import { getTowerDefinitionsForClass } from "./data/towers";
import type {
  AudioCueId,
  GamePhase,
  GameSessionMode,
  GameSettings,
  GameState,
  GridPoint,
  MapDefinition,
  PlayerId,
  PlayerNoticeTone,
  PresentationEvent,
  PresentationEventKind,
  RunResult,
  TowerAutoBuildId,
  TowerUpgradeBranchId
} from "./models/types";
import { RunTelemetry } from "./telemetry/RunTelemetry";
import { clampGrid, gridKey, gridToWorld, isGridOnPath, isInsideGrid } from "./utils/grid";

const SETTINGS_STORAGE_KEY = "aegis-sacra-settings";
const runTelemetry = RunTelemetry.getInstance();

const defaultSettings: GameSettings = {
  masterVolume: 0.78,
  sfxVolume: 0.82,
  musicVolume: 0.58,
  muted: false,
  reducedMotion: false
};

const loadSettings = (): GameSettings => {
  if (typeof localStorage === "undefined") {
    return { ...defaultSettings };
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return { ...defaultSettings };
    }

    return { ...defaultSettings, ...JSON.parse(raw) } as GameSettings;
  } catch {
    return { ...defaultSettings };
  }
};

const createInitialCursor = (selectedTowerIndex: number) => ({
  grid: { col: selectedTowerIndex === 0 ? 2 : 11, row: selectedTowerIndex === 0 ? 6 : 2 },
  selectedTowerIndex,
  moveCooldownMs: 0
});

const createInitialState = (sessionMode: GameSessionMode = "solo-ai"): GameState => ({
  phase: "menu",
  previousPhase: null,
  sessionMode,
  debug: DEBUG_DEFAULT_ENABLED,
  settings: loadSettings(),
  runSummary: null,
  aiPartner: {
    active: sessionMode === "solo-ai",
    decisionsLogged: 0,
    lastDecision: null
  },
  presentationEvents: [],
  activeMap: mapDefinition,
  economies: {
    p1: {
      credits: mapDefinition.startingCreditsByPlayer.p1,
      rewardMultiplier: 1
    },
    p2: {
      credits: mapDefinition.startingCreditsByPlayer.p2,
      rewardMultiplier: 1
    }
  },
  combatStats: {
    p1: {
      totalDamageDealt: 0,
      waveDamageDealt: 0,
      kills: 0,
      towersBuilt: 0
    },
    p2: {
      totalDamageDealt: 0,
      waveDamageDealt: 0,
      kills: 0,
      towersBuilt: 0
    }
  },
  skillTrees: {
    p1: {
      bossSigils: 0,
      skillRanks: {}
    },
    p2: {
      bossSigils: 0,
      skillRanks: {}
    }
  },
  rewardSelection: null,
  towerInspection: null,
  classSelection: null,
  playerNotices: {
    p1: null,
    p2: null
  },
  baseHp: mapDefinition.baseHp,
  baseHitFlashMs: 0,
  lastBaseDamage: 0,
  enemies: [],
  towers: [],
  allies: [],
  ritualZones: [],
  projectiles: [],
  cursors: {
    p1: createInitialCursor(0),
    p2: createInitialCursor(1)
  },
  playerClasses: {
    p1: playerClassDefinitions[0].id,
    p2: playerClassDefinitions[1].id
  },
  wave: {
    currentWaveIndex: 0,
    active: false,
    nextWaveInMs: 0,
    readyPlayers: {
      p1: false,
      p2: false
    },
    completed: false,
    notice: null,
    snapshot: {
      groups: [],
      totalSpawnsRemaining: 0,
      aliveEnemies: 0,
      activePathIndexes: []
    }
  },
  messages: [],
  elapsedMs: 0,
  nextId: 1
});

export class GameRegistry {
  private static instance: GameRegistry | null = null;
  private readonly listeners = new Set<() => void>();
  private nextSessionMode: GameSessionMode = "solo-ai";

  state: GameState = createInitialState();

  static getInstance(): GameRegistry {
    if (!GameRegistry.instance) {
      GameRegistry.instance = new GameRegistry();
    }

    return GameRegistry.instance;
  }

  resetForMenu(): void {
    this.state = createInitialState(this.nextSessionMode);
    this.notifyChange();
  }

  setNextSessionMode(sessionMode: GameSessionMode): void {
    this.nextSessionMode = sessionMode;
    this.state.sessionMode = sessionMode;
    this.notifyChange();
  }

  getNextSessionMode(): GameSessionMode {
    return this.nextSessionMode;
  }

  startRun(sessionMode = this.nextSessionMode): void {
    this.nextSessionMode = sessionMode;
    this.state = createInitialState(sessionMode);
    this.state.phase = "class-selection";
    const p1ClassIndex = 0;
    const p2ClassIndex = this.getComplementaryClassIndex(p1ClassIndex);
    this.state.classSelection = {
      choices: {
        p1: {
          selectedClassIndex: p1ClassIndex,
          confirmed: false
        },
        p2: {
          selectedClassIndex: p2ClassIndex,
          confirmed: sessionMode === "solo-ai"
        }
      }
    };
    this.state.playerClasses.p1 = playerClassDefinitions[p1ClassIndex].id;
    this.state.playerClasses.p2 = playerClassDefinitions[p2ClassIndex].id;
    runTelemetry.startRun(this.state, sessionMode === "solo-ai" ? "local-ai" : "local-human");
    this.notifyChange();
  }

  restartRun(): void {
    this.startRun();
  }

  pause(): boolean {
    if (this.state.phase !== "playing") {
      return false;
    }

    this.state.previousPhase = "playing";
    this.state.phase = "paused";
    this.pushPresentationEvent("audio", 700, { cueId: "ui_confirm" });
    this.notifyChange();

    return true;
  }

  resume(): boolean {
    if (this.state.phase !== "paused") {
      return false;
    }

    this.state.phase = this.state.previousPhase ?? "playing";
    this.state.previousPhase = null;
    this.pushPresentationEvent("audio", 700, { cueId: "ui_confirm" });
    this.notifyChange();

    return true;
  }

  finishRun(result: RunResult): void {
    if (this.state.runSummary) {
      this.state.phase = result;
      return;
    }

    this.state.phase = result;
    this.state.wave.active = false;
    this.state.wave.completed = true;
    this.state.runSummary = this.createRunSummary(result);
    this.pushPresentationEvent("audio", 1600, { cueId: result });
    runTelemetry.record("run-end", this.state);
    this.notifyChange();
  }

  createId(prefix: string): string {
    const id = `${prefix}-${this.state.nextId}`;
    this.state.nextId += 1;

    return id;
  }

  pushMessage(text: string, ttlMs = 1200): void {
    this.state.messages = [{ text, ttlMs }, ...this.state.messages].slice(0, 3);
  }

  pushPresentationEvent(
    kind: PresentationEventKind,
    ttlMs = 900,
    event: Partial<Omit<PresentationEvent, "id" | "kind" | "ttlMs" | "durationMs">> = {}
  ): void {
    this.state.presentationEvents = [
      {
        id: this.createId("evt"),
        kind,
        ttlMs,
        durationMs: ttlMs,
        ...event
      },
      ...this.state.presentationEvents
    ].slice(0, 48);
  }

  pushPlayerNotice(
    playerId: PlayerId,
    title: string,
    detail: string,
    tone: PlayerNoticeTone = "info",
    ttlMs = 1800
  ): void {
    this.state.playerNotices[playerId] = {
      title,
      detail,
      tone,
      timerMs: ttlMs
    };
  }

  updateMessages(deltaMs: number): void {
    this.state.messages = this.state.messages
      .map((message) => ({ ...message, ttlMs: message.ttlMs - deltaMs }))
      .filter((message) => message.ttlMs > 0);

    if (this.state.aiPartner.lastDecision) {
      this.state.aiPartner.lastDecision.ttlMs -= deltaMs;

      if (this.state.aiPartner.lastDecision.ttlMs <= 0) {
        this.state.aiPartner.lastDecision = null;
      }
    }

    this.state.presentationEvents = this.state.presentationEvents
      .map((event) => ({ ...event, ttlMs: event.ttlMs - deltaMs }))
      .filter((event) => event.ttlMs > 0);

    if (this.state.wave.notice) {
      this.state.wave.notice.timerMs -= deltaMs;

      if (this.state.wave.notice.timerMs <= 0) {
        this.state.wave.notice = null;
      }
    }

    this.state.baseHitFlashMs = Math.max(0, this.state.baseHitFlashMs - deltaMs);

    this.updatePlayerNotice("p1", deltaMs);
    this.updatePlayerNotice("p2", deltaMs);
  }

  getSelectedTowerId(playerId: PlayerId): string {
    const cursor = this.state.cursors[playerId];
    const availableTowers = getTowerDefinitionsForClass(this.state.playerClasses[playerId]);
    const tower = availableTowers[cursor.selectedTowerIndex % availableTowers.length];

    return tower.id;
  }

  applyActiveMap(nextMap: MapDefinition): void {
    const previousMapId = this.state.activeMap.id;

    this.state.activeMap = nextMap;

    const occupied = new Set<string>();
    let movedTowers = 0;

    for (const tower of this.state.towers) {
      const nextGrid = this.findNearestBuildableGrid(tower.grid, nextMap, occupied);

      if (gridKey(nextGrid) !== gridKey(tower.grid)) {
        movedTowers += 1;
      }

      tower.grid = nextGrid;
      tower.position = gridToWorld(nextGrid, nextMap);
      occupied.add(gridKey(nextGrid));
    }

    for (const playerId of ["p1", "p2"] as const) {
      const cursor = this.state.cursors[playerId];
      const clampedGrid = clampGrid(cursor.grid, nextMap);

      cursor.grid =
        isInsideGrid(clampedGrid, nextMap) &&
        !isGridOnPath(clampedGrid, nextMap) &&
        !occupied.has(gridKey(clampedGrid))
          ? clampedGrid
          : this.findNearestBuildableGrid(clampedGrid, nextMap, occupied);
    }

    if (previousMapId !== nextMap.id && movedTowers > 0) {
      const detail = `${movedTowers} torre(s) reposicionada(s) fora da nova rota`;

      this.pushPlayerNotice("p1", "MAPA EXPANDIU", detail, "warning", 2600);
      this.pushPlayerNotice("p2", "MAPA EXPANDIU", detail, "warning", 2600);
    }

    if (previousMapId !== nextMap.id) {
      this.pushPresentationEvent("level-up", 1100, {
        cueId: "wave_start",
        position: {
          x: nextMap.origin.x + (nextMap.columns * nextMap.tileSize) / 2,
          y: nextMap.origin.y + (nextMap.rows * nextMap.tileSize) / 2
        },
        color: 0x83f3ff,
        label: nextMap.name
      });
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  updateSettings(partial: Partial<GameSettings>): void {
    this.state.settings = {
      ...this.state.settings,
      ...partial,
      masterVolume: this.clampVolume(partial.masterVolume ?? this.state.settings.masterVolume),
      sfxVolume: this.clampVolume(partial.sfxVolume ?? this.state.settings.sfxVolume),
      musicVolume: this.clampVolume(partial.musicVolume ?? this.state.settings.musicVolume)
    };

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.state.settings));
    }

    this.notifyChange();
  }

  openTowerInspection(playerId: PlayerId): boolean {
    const tower = this.getTowerUnderCursor(playerId);

    if (!tower) {
      this.pushPresentationEvent("audio", 500, { cueId: "ui_error" });
      this.pushPlayerNotice(playerId, "SEM TORRE", "coloque o cursor em cima de uma torre", "warning", 1700);
      this.notifyChange();

      return false;
    }

    this.state.towerInspection = {
      playerId,
      towerId: tower.id,
      selectedOptionIndex: 0
    };
    this.pushPresentationEvent("audio", 400, { cueId: "ui_confirm" });
    this.notifyChange();

    return true;
  }

  closeTowerInspection(): void {
    this.state.towerInspection = null;
    this.notifyChange();
  }

  cycleTowerInspectionOption(playerId: PlayerId, direction: -1 | 1): boolean {
    const inspection = this.state.towerInspection;

    if (!inspection || inspection.playerId !== playerId) {
      return false;
    }

    const optionCount = towerBranchDefinitions.length;
    inspection.selectedOptionIndex =
      (inspection.selectedOptionIndex + direction + optionCount) % optionCount;
    this.pushPresentationEvent("audio", 250, { cueId: "ui_confirm" });
    this.notifyChange();

    return true;
  }

  setTowerInspectionOption(playerId: PlayerId, optionIndex: number): boolean {
    const inspection = this.state.towerInspection;

    if (!inspection || inspection.playerId !== playerId) {
      return false;
    }

    inspection.selectedOptionIndex = Math.max(
      0,
      Math.min(towerBranchDefinitions.length - 1, optionIndex)
    );
    this.notifyChange();

    return true;
  }

  activateTowerInspectionOption(playerId: PlayerId): boolean {
    const inspection = this.state.towerInspection;

    if (!inspection || inspection.playerId !== playerId) {
      return false;
    }

    const branch = towerBranchDefinitions[inspection.selectedOptionIndex];

    if (!branch) {
      return false;
    }

    return this.spendTowerUpgradePoint(playerId, inspection.towerId, branch.id);
  }

  spendTowerUpgradePoint(
    playerId: PlayerId,
    towerId: string,
    branchId: TowerUpgradeBranchId
  ): boolean {
    const tower = this.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower || tower.ownerId !== playerId) {
      return false;
    }

    const branch = getTowerBranchDefinition(branchId);

    if (tower.branchRanks[branchId] >= branch.maxRank) {
      this.pushPresentationEvent("audio", 500, { cueId: "ui_error" });
      this.pushPlayerNotice(playerId, "RANK MAXIMO", `${branch.shortName} ja esta completo`, "warning", 1500);
      this.notifyChange();

      return false;
    }

    if (tower.skillPoints <= 0) {
      this.pushPresentationEvent("audio", 500, { cueId: "ui_error" });
      this.pushPlayerNotice(
        playerId,
        "SEM PONTO",
        "ganhe XP com abates e assistencias",
        "warning",
        1500
      );
      this.notifyChange();

      return false;
    }

    if (!spendTowerBranchPoint(tower, branchId)) {
      this.pushPresentationEvent("audio", 500, { cueId: "ui_error" });
      this.pushPlayerNotice(playerId, "UPGRADE BLOQUEADO", branch.shortName, "warning", 1500);
      this.notifyChange();

      return false;
    }

    tower.autoUpgradeEnabled = false;
    this.pushPresentationEvent("level-up", 900, {
      cueId: "reward",
      position: { ...tower.position },
      color: branch.color,
      label: branch.shortName
    });
    this.pushPlayerNotice(
      playerId,
      branch.shortName.toUpperCase(),
      "usou 1 ponto de XP da torre",
      "success",
      1500
    );
    runTelemetry.record("player-action", this.state, {
      type: "UPGRADE_TOWER",
      playerId,
      towerId,
      branchId
    });
    this.notifyChange();

    return true;
  }

  setTowerAutoBuild(
    playerId: PlayerId,
    towerId: string,
    buildId: TowerAutoBuildId
  ): boolean {
    const tower = this.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower || tower.ownerId !== playerId) {
      return false;
    }

    tower.autoBuildId = buildId;
    tower.autoUpgradeEnabled = true;
    this.applyAutoUpgradesForTower(tower.id);
    this.pushPlayerNotice(
      playerId,
      "AUTO ATIVO",
      getTowerAutoBuildDefinition(buildId).name,
      "info",
      1500
    );
    this.notifyChange();

    return true;
  }

  toggleTowerAutoUpgrade(playerId: PlayerId, towerId: string): boolean {
    const tower = this.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower || tower.ownerId !== playerId) {
      return false;
    }

    tower.autoUpgradeEnabled = !tower.autoUpgradeEnabled;

    if (tower.autoUpgradeEnabled) {
      this.applyAutoUpgradesForTower(tower.id);
    }

    this.pushPlayerNotice(
      playerId,
      tower.autoUpgradeEnabled ? "AUTO ATIVO" : "AUTO MANUAL",
      getTowerAutoBuildDefinition(tower.autoBuildId).name,
      "info",
      1500
    );
    this.notifyChange();

    return true;
  }

  applyAutoUpgradesForTower(towerId: string): void {
    const tower = this.state.towers.find((candidate) => candidate.id === towerId);

    if (!tower?.autoUpgradeEnabled || tower.skillPoints <= 0) {
      return;
    }

    const spentBranches = applyTowerAutoBuild(tower);

    if (spentBranches.length === 0) {
      return;
    }

    const branch = getTowerBranchDefinition(spentBranches[spentBranches.length - 1]);

    this.pushPresentationEvent("level-up", 900, {
      cueId: "reward",
      position: { ...tower.position },
      color: branch.color,
      label: branch.shortName
    });
  }

  setPlayerReady(playerId: PlayerId): boolean {
    const state = this.state;

    if (
      state.phase !== "playing" ||
      state.wave.active ||
      state.wave.completed ||
      state.wave.readyPlayers[playerId]
    ) {
      return false;
    }

    state.wave.readyPlayers[playerId] = true;
    this.pushPresentationEvent("audio", 500, { cueId: "ui_confirm" });
    this.pushPlayerNotice(playerId, "PRONTO", "timer acelerado", "success", 1600);
    this.pushMessage(`${playerId.toUpperCase()} pronto para a wave`, 1500);
    runTelemetry.record("player-action", state, {
      type: "SET_READY",
      playerId,
      ready: true
    });

    if (state.wave.nextWaveInMs <= 0) {
      state.wave.nextWaveInMs = WAVE_AUTO_START_MS;
    }

    if (this.arePlayersReadyForWave()) {
      state.wave.nextWaveInMs = Math.min(state.wave.nextWaveInMs, WAVE_READY_COUNTDOWN_MS);
      state.wave.notice = {
        title: "Ambos prontos",
        subtitle: `A wave entra em ${(WAVE_READY_COUNTDOWN_MS / 1000).toFixed(1)}s`,
        timerMs: WAVE_READY_COUNTDOWN_MS + 500,
        tone: "start"
      };
    } else {
      const missingPlayer = playerId === "p1" ? "P2" : "P1";

      state.wave.notice = {
        title: `${playerId.toUpperCase()} pronto`,
        subtitle: `${missingPlayer} pode acelerar. Sem pronto, a wave entra pelo timer.`,
        timerMs: 2600,
        tone: "start"
      };
    }

    this.notifyChange();

    return true;
  }

  debugAdvanceWave(): boolean {
    const state = this.state;

    if (!state.debug || state.phase !== "playing" || state.wave.completed) {
      return false;
    }

    if (!state.wave.active) {
      state.wave.readyPlayers.p1 = true;
      state.wave.readyPlayers.p2 = true;
      state.wave.nextWaveInMs = 0;
      this.pushMessage("DEBUG wave imediata", 1200);
      this.pushPlayerNotice("p1", "DEBUG", "wave imediata", "info", 1000);
      this.pushPlayerNotice("p2", "DEBUG", "wave imediata", "info", 1000);
      this.notifyChange();

      return true;
    }

    state.enemies = [];
    state.projectiles = [];
    state.wave.active = false;
    state.wave.currentWaveIndex += 1;

    this.clearWaveReadiness(true);
    this.pushMessage("DEBUG wave pulada", 1200);
    this.pushPlayerNotice("p1", "DEBUG", "proxima wave armada", "info", 1000);
    this.pushPlayerNotice("p2", "DEBUG", "proxima wave armada", "info", 1000);
    this.notifyChange();

    return true;
  }

  clearWaveReadiness(armAutoStart = false): void {
    this.state.wave.readyPlayers = {
      p1: false,
      p2: false
    };
    this.state.wave.nextWaveInMs = armAutoStart ? WAVE_AUTO_START_MS : 0;
  }

  arePlayersReadyForWave(): boolean {
    return this.state.wave.readyPlayers.p1 && this.state.wave.readyPlayers.p2;
  }

  getTowerUnderCursor(playerId: PlayerId) {
    const cursor = this.state.cursors[playerId];

    return this.state.towers.find((tower) => gridKey(tower.grid) === gridKey(cursor.grid)) ?? null;
  }

  private createRunSummary(result: RunResult) {
    const towerCounts = {
      p1: this.countTowersForPlayer("p1"),
      p2: this.countTowersForPlayer("p2")
    };
    const cloneStats = {
      p1: { ...this.state.combatStats.p1 },
      p2: { ...this.state.combatStats.p2 }
    };

    return {
      result,
      elapsedMs: this.state.elapsedMs,
      wavesCleared: Math.max(0, this.state.wave.currentWaveIndex),
      baseHpRemaining: this.state.baseHp,
      playerClasses: { ...this.state.playerClasses },
      combatStats: cloneStats,
      towerCounts
    };
  }

  private countTowersForPlayer(playerId: PlayerId): Record<string, number> {
    return this.state.towers
      .filter((tower) => tower.ownerId === playerId)
      .reduce<Record<string, number>>((counts, tower) => {
        counts[tower.typeId] = (counts[tower.typeId] ?? 0) + 1;

        return counts;
      }, {});
  }

  private clampVolume(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private updatePlayerNotice(playerId: PlayerId, deltaMs: number): void {
    const notice = this.state.playerNotices[playerId];

    if (!notice) {
      return;
    }

    notice.timerMs -= deltaMs;

    if (notice.timerMs <= 0) {
      this.state.playerNotices[playerId] = null;
    }
  }

  private getComplementaryClassIndex(selectedClassIndex: number): number {
    return (selectedClassIndex + 1) % playerClassDefinitions.length;
  }

  private findNearestBuildableGrid(
    origin: GridPoint,
    map: MapDefinition,
    occupied: ReadonlySet<string>
  ): GridPoint {
    const clampedOrigin = clampGrid(origin, map);

    if (this.isBuildableGrid(clampedOrigin, map, occupied)) {
      return clampedOrigin;
    }

    const maxRadius = Math.max(map.columns, map.rows);

    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
          if (Math.abs(rowOffset) !== radius && Math.abs(colOffset) !== radius) {
            continue;
          }

          const candidate = {
            col: clampedOrigin.col + colOffset,
            row: clampedOrigin.row + rowOffset
          };

          if (this.isBuildableGrid(candidate, map, occupied)) {
            return candidate;
          }
        }
      }
    }

    return clampedOrigin;
  }

  private isBuildableGrid(
    grid: GridPoint,
    map: MapDefinition,
    occupied: ReadonlySet<string>
  ): boolean {
    return isInsideGrid(grid, map) && !isGridOnPath(grid, map) && !occupied.has(gridKey(grid));
  }
}
