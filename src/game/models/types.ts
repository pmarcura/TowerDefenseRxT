export type PlayerId = "p1" | "p2";

export type GameSessionMode = "solo-ai" | "local-coop" | "online-lobby-preview";

export type GridPoint = {
  readonly col: number;
  readonly row: number;
};

export type Vec2 = {
  x: number;
  y: number;
};

export type AssetKey =
  | "tower.vitrail"
  | "tower.mandala"
  | "tower.obelisk"
  | "tower.chant"
  | "tower.mihrab"
  | "tower.torii"
  | "tower.stupa"
  | "tower.axeDrum"
  | "tower.giraPoint"
  | "tower.naveBell"
  | "tower.knightOrder"
  | "tower.illuminatedManuscript"
  | "tower.vitrailWorkshop"
  | "tower.guiaLantern"
  | "tower.pembaTrace"
  | "tower.giraCircle"
  | "tower.tacticalSmoke"
  | "tower.supportHouse"
  | "tower.zelligePrism"
  | "tower.minaretPulse"
  | "tower.astrolabeCompass"
  | "tower.symmetryCourt"
  | "tower.geometryBazaar"
  | "tower.lotusChakra"
  | "tower.diyaFlame"
  | "tower.conchPulse"
  | "tower.solarYantra"
  | "tower.lotusGarden"
  | "tower.dharmaWheel"
  | "tower.bodhiLamp"
  | "tower.attentionBell"
  | "tower.middleBridge"
  | "tower.bodhiGarden"
  | "tower.kaguraBell"
  | "tower.omamoriWard"
  | "tower.shimenawaCord"
  | "tower.redPassage"
  | "tower.lanternGarden"
  | "tower.beadCircle"
  | "tower.xireFlame"
  | "tower.atabaqueBeat"
  | "tower.cuttingLeaf"
  | "tower.leafHouse"
  | "enemy.runner"
  | "enemy.tank"
  | "enemy.shield"
  | "enemy.swarm"
  | "enemy.oracleDrone"
  | "enemy.syntheticArchivist"
  | "enemy.bossReliquary"
  | "world.baseCore"
  | "world.spawnGate";

export type TowerEffect =
  | "damage"
  | "slow"
  | "splash"
  | "chain"
  | "income"
  | "summon"
  | "aura"
  | "cleanse"
  | "mark"
  | "ritual-zone"
  | "redirect";

export type TowerUpgradeBranchId =
  | "focus"
  | "reach"
  | "tempo"
  | "rupture"
  | "synod";

export type TowerAutoBuildId = "balanced" | "boss" | "crowd";

export type TowerBranchRanks = Record<TowerUpgradeBranchId, number>;

export type TowerDefinition = {
  readonly id: string;
  readonly assetKey: AssetKey;
  readonly originClassId: string;
  readonly name: string;
  readonly shortName: string;
  readonly role: string;
  readonly summary: string;
  readonly differentiator: string;
  readonly cost: number;
  readonly range: number;
  readonly cooldownMs: number;
  readonly damage: number;
  readonly projectileSpeed: number;
  readonly effect: TowerEffect;
  readonly slowMultiplier?: number;
  readonly slowDurationMs?: number;
  readonly splashRadius?: number;
  readonly chainJumps?: number;
  readonly chainRange?: number;
  readonly incomePerTick?: number;
  readonly incomeIntervalMs?: number;
  readonly summonCount?: number;
  readonly summonDamage?: number;
  readonly summonHp?: number;
  readonly summonDurationMs?: number;
  readonly auraRange?: number;
  readonly auraDamageMultiplier?: number;
  readonly auraCooldownMultiplier?: number;
  readonly markDamageMultiplier?: number;
  readonly markDurationMs?: number;
  readonly armorReduction?: number;
  readonly statusDurationMs?: number;
  readonly zoneRadius?: number;
  readonly zoneDurationMs?: number;
  readonly redirectDistance?: number;
  readonly color: number;
  readonly glow: number;
  readonly lore: string;
};

export type EnemyDefinition = {
  readonly id: string;
  readonly assetKey: AssetKey;
  readonly name: string;
  readonly maxHp: number;
  readonly speed: number;
  readonly armor: number;
  readonly reward: number;
  readonly baseDamage: number;
  readonly radius: number;
  readonly color: number;
  readonly glow: number;
  readonly traits: readonly string[];
};

export type WaveGroupDefinition = {
  readonly enemyTypeId: string;
  readonly count: number;
  readonly intervalMs: number;
  readonly startDelayMs: number;
  readonly pathIndex?: number;
};

export type WaveDefinition = {
  readonly id: string;
  readonly name: string;
  readonly isBoss?: boolean;
  readonly mapStageIndex: number;
  readonly bossRewardSigils?: number;
  readonly groups: readonly WaveGroupDefinition[];
};

export type MapDefinition = {
  readonly id: string;
  readonly name: string;
  readonly columns: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly origin: Vec2;
  readonly paths: readonly (readonly GridPoint[])[];
  readonly baseHp: number;
  readonly startingCreditsByPlayer: Record<PlayerId, number>;
};

export type PlayerClassDefinition = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly visualMotif: string;
  readonly pattern: "vitrail" | "gira" | "zellige" | "lotus" | "wheel" | "torii" | "axe";
  readonly accent: number;
  readonly secondaryAccent: number;
  readonly rangeBonus: number;
  readonly costMultiplier: number;
  readonly damageMultiplier: number;
  readonly rewardMultiplier: number;
  readonly specialty: string;
  readonly passive: string;
  readonly description: string;
  readonly note: string;
};

export type PlayerEconomyState = {
  credits: number;
  rewardMultiplier: number;
};

export type PlayerCombatStatsState = {
  totalDamageDealt: number;
  waveDamageDealt: number;
  kills: number;
  towersBuilt: number;
};

export type TowerRuntimeStats = {
  towerId: string;
  name: string;
  shortName: string;
  role: string;
  level: number;
  damagePerShot: number;
  cooldownMs: number;
  shotsPerSecond: number;
  dps: number;
  range: number;
  effect: TowerEffect;
  effectLabel: string;
  effectDetails: readonly string[];
  branchSummary: readonly string[];
  kills: number;
  damageDealt: number;
  skillPoints: number;
};

export type SkillEffect = {
  readonly rangeBonus?: number;
  readonly damageMultiplier?: number;
  readonly costMultiplier?: number;
  readonly rewardMultiplier?: number;
};

export type SkillRarity = "common" | "rare" | "epic";

export type SkillBranch = "geometry" | "focus" | "economy" | "resonance";

export type SkillDefinition = {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly name: string;
  readonly shortName: string;
  readonly tier: number;
  readonly costSigils: number;
  readonly rarity: SkillRarity;
  readonly branch: SkillBranch;
  readonly maxRank: number;
  readonly weight: number;
  readonly description: string;
  readonly effect: SkillEffect;
};

export type SkillTreeState = {
  bossSigils: number;
  skillRanks: Record<string, number>;
};

export type RewardChoiceState = {
  readonly playerId: PlayerId;
  readonly skillIds: string[];
  selectedSkillId: string | null;
};

export type RewardSelectionState = {
  readonly bossWaveId: string;
  readonly returnPhase: "playing" | "victory";
  autoSelectInMs: number;
  choices: Record<PlayerId, RewardChoiceState>;
};

export type ClassSelectionChoiceState = {
  selectedClassIndex: number;
  confirmed: boolean;
};

export type ClassSelectionState = {
  choices: Record<PlayerId, ClassSelectionChoiceState>;
};

export type CursorState = {
  grid: GridPoint;
  selectedTowerIndex: number;
  moveCooldownMs: number;
};

export type EnemyEntity = {
  id: string;
  typeId: string;
  position: Vec2;
  pathIndexId: number;
  pathIndex: number;
  hp: number;
  damageSources: Record<string, number>;
  markMultiplier: number;
  markTimerMs: number;
  armorReduction: number;
  armorReductionTimerMs: number;
  slowMultiplier: number;
  slowTimerMs: number;
  reachedBaseTimerMs: number;
  recentDamageTotal: number;
  recentDamageTimerMs: number;
  recentDamageColor: number;
  recentDamageWasCritical: boolean;
  lastHitFlashMs: number;
  alive: boolean;
};

export type TowerEntity = {
  id: string;
  typeId: string;
  ownerId: PlayerId;
  grid: GridPoint;
  position: Vec2;
  cooldownMs: number;
  level: number;
  xp: number;
  xpToNext: number;
  kills: number;
  damageDealt: number;
  skillPoints: number;
  branchRanks: TowerBranchRanks;
  autoUpgradeEnabled: boolean;
  autoBuildId: TowerAutoBuildId;
};

export type AllyEntity = {
  id: string;
  ownerId: PlayerId;
  sourceTowerId: string;
  pathIndexId: number;
  pathIndex: number;
  position: Vec2;
  hp: number;
  damage: number;
  speed: number;
  attackCooldownMs: number;
  durationMs: number;
  alive: boolean;
  color: number;
};

export type RitualZoneEntity = {
  id: string;
  ownerId: PlayerId;
  sourceTowerId: string;
  position: Vec2;
  radius: number;
  damageMultiplier: number;
  armorReduction: number;
  tickDamage: number;
  tickMs: number;
  durationMs: number;
  color: number;
};

export type TowerInspectionState = {
  playerId: PlayerId;
  towerId: string;
  selectedOptionIndex: number;
};

export type ProjectileEntity = {
  id: string;
  typeId: string;
  towerId: string;
  targetEnemyId: string;
  position: Vec2;
  speed: number;
  damage: number;
  criticalChance: number;
  criticalMultiplier: number;
  effect: TowerEffect;
  alive: boolean;
};

export type GamePhase =
  | "menu"
  | "class-selection"
  | "playing"
  | "paused"
  | "reward-selection"
  | "victory"
  | "defeat";

export type RunResult = "victory" | "defeat";

export type RunStats = {
  result: RunResult;
  elapsedMs: number;
  wavesCleared: number;
  baseHpRemaining: number;
  playerClasses: Record<PlayerId, string>;
  combatStats: Record<PlayerId, PlayerCombatStatsState>;
  towerCounts: Record<PlayerId, Record<string, number>>;
};

export type GameSettings = {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  reducedMotion: boolean;
};

export type AudioCueId =
  | "ui_confirm"
  | "ui_error"
  | "build"
  | "tower_fire"
  | "hit"
  | "crit"
  | "kill"
  | "kill_heavy"
  | "income_tick"
  | "wave_start"
  | "boss"
  | "reward"
  | "base_hit"
  | "victory"
  | "defeat";

export type PresentationEventKind =
  | "audio"
  | "damage"
  | "critical"
  | "kill"
  | "combo"
  | "income"
  | "build"
  | "level-up"
  | "wave"
  | "base-hit";

export type PresentationEvent = {
  id: string;
  kind: PresentationEventKind;
  cueId?: AudioCueId;
  ttlMs: number;
  durationMs: number;
  position?: Vec2;
  amount?: number;
  color?: number;
  label?: string;
  sourcePlayerId?: PlayerId;
  sourceTowerId?: string;
};

export type RoundNoticeTone = "start" | "complete" | "boss" | "danger";

export type RoundNoticeState = {
  title: string;
  subtitle: string;
  timerMs: number;
  tone: RoundNoticeTone;
};

export type PlayerNoticeTone = "info" | "success" | "warning" | "danger";

export type PlayerNoticeState = {
  title: string;
  detail: string;
  timerMs: number;
  tone: PlayerNoticeTone;
};

export type WaveState = {
  currentWaveIndex: number;
  active: boolean;
  nextWaveInMs: number;
  readyPlayers: Record<PlayerId, boolean>;
  completed: boolean;
  notice: RoundNoticeState | null;
  snapshot: WaveHudSnapshot;
};

export type WaveGroupHudSnapshot = {
  enemyTypeId: string;
  remaining: number;
  total: number;
  pathIndex: number;
};

export type WaveHudSnapshot = {
  groups: WaveGroupHudSnapshot[];
  totalSpawnsRemaining: number;
  aliveEnemies: number;
  activePathIndexes: number[];
};

export type HudMessage = {
  text: string;
  ttlMs: number;
};

export type GameState = {
  phase: GamePhase;
  previousPhase: GamePhase | null;
  sessionMode: GameSessionMode;
  debug: boolean;
  settings: GameSettings;
  runSummary: RunStats | null;
  presentationEvents: PresentationEvent[];
  activeMap: MapDefinition;
  economies: Record<PlayerId, PlayerEconomyState>;
  combatStats: Record<PlayerId, PlayerCombatStatsState>;
  skillTrees: Record<PlayerId, SkillTreeState>;
  rewardSelection: RewardSelectionState | null;
  towerInspection: TowerInspectionState | null;
  classSelection: ClassSelectionState | null;
  playerNotices: Record<PlayerId, PlayerNoticeState | null>;
  baseHp: number;
  baseHitFlashMs: number;
  lastBaseDamage: number;
  enemies: EnemyEntity[];
  towers: TowerEntity[];
  allies: AllyEntity[];
  ritualZones: RitualZoneEntity[];
  projectiles: ProjectileEntity[];
  cursors: Record<PlayerId, CursorState>;
  playerClasses: Record<PlayerId, string>;
  wave: WaveState;
  messages: HudMessage[];
  elapsedMs: number;
  nextId: number;
};
