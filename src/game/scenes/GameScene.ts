import Phaser from "phaser";
import { gameUiBridge } from "../bridge/RewardBridge";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { GameRegistry } from "../GameRegistry";
import { KeyboardCoopController } from "../input/KeyboardCoopController";
import { AllyRenderer } from "../renderers/AllyRenderer";
import { AmbientParticleRenderer } from "../renderers/AmbientParticleRenderer";
import { ClassSelectionRenderer } from "../renderers/ClassSelectionRenderer";
import { EnemyRenderer } from "../renderers/EnemyRenderer";
import { FxRenderer } from "../renderers/FxRenderer";
import { GridRenderer } from "../renderers/GridRenderer";
import { ProjectileRenderer } from "../renderers/ProjectileRenderer";
import { TowerRenderer } from "../renderers/TowerRenderer";
import { ZoneRenderer } from "../renderers/ZoneRenderer";
import { AllySystem } from "../systems/AllySystem";
import { AiPartnerSystem } from "../systems/AiPartnerSystem";
import { BuildSystem } from "../systems/BuildSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { ClassSelectionSystem } from "../systems/ClassSelectionSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { EnemySystem } from "../systems/EnemySystem";
import type { GameSystem } from "../systems/GameSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";
import { SkillTreeSystem } from "../systems/SkillTreeSystem";
import { StatusEffectSystem } from "../systems/StatusEffectSystem";
import { TowerSystem } from "../systems/TowerSystem";
import { WaveSystem } from "../systems/WaveSystem";
import type { GameSessionMode, MapDefinition } from "../models/types";
import { onlineClient } from "../network/OnlineClient";
import type { MultiplayerSessionConfig } from "../network/sessionTypes";
import { gridToWorld } from "../utils/grid";
import { getLocalPlayerIds, getPlayablePlayerIds } from "../utils/players";

export class GameScene extends Phaser.Scene {
  private readonly gameRegistry = GameRegistry.getInstance();
  private systems: GameSystem[] = [];
  private keyboardController!: KeyboardCoopController;
  private classSelectionSystem!: ClassSelectionSystem;
  private skillTreeSystem!: SkillTreeSystem;
  private aiPartnerSystem!: AiPartnerSystem;
  private ambientRenderer!: AmbientParticleRenderer;
  private classSelectionRenderer!: ClassSelectionRenderer;
  private gridRenderer!: GridRenderer;
  private towerRenderer!: TowerRenderer;
  private enemyRenderer!: EnemyRenderer;
  private allyRenderer!: AllyRenderer;
  private zoneRenderer!: ZoneRenderer;
  private projectileRenderer!: ProjectileRenderer;
  private fxRenderer!: FxRenderer;
  private audioSystem!: AudioSystem;
  private restartKey?: Phaser.Input.Keyboard.Key;
  private unsubscribeGameActions?: () => void;
  private cameraMapId: string | null = null;
  private cameraTargetZoom = 1;
  private cameraManualHoldMs = 0;
  private cameraDragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private prevBaseHitFlashMs = 0;

  constructor() {
    super("GameScene");
  }

  init(data?: { sessionMode?: GameSessionMode; session?: MultiplayerSessionConfig }): void {
    if (data?.session) {
      this.gameRegistry.setNextSessionConfig(data.session);
      return;
    }

    if (data?.sessionMode) {
      this.gameRegistry.setNextSessionMode(data.sessionMode);
    }
  }

  create(): void {
    this.gameRegistry.startRun();
    this.createSystems();
    this.createRenderers();
    this.createRestartInput();
    this.createCameraInput();
    this.subscribeOnlineActions();

    this.scene.launch("UIScene");
  }

  update(_time: number, delta: number): void {
    const state = this.gameRegistry.state;

    state.elapsedMs += delta;
    this.ambientRenderer.update(delta);
    this.keyboardController.update();
    this.aiPartnerSystem.update(delta);
    this.audioSystem.update(delta);
    this.updateWorldCamera(delta);
    this.applyBaseHitShake(state.baseHitFlashMs, state.lastBaseDamage);
    this.prevBaseHitFlashMs = state.baseHitFlashMs;

    if (state.phase === "playing") {
      for (const system of this.systems) {
        system.update(delta);
      }
    } else if (state.phase === "reward-selection") {
      this.skillTreeSystem.update(delta);
    } else if (
      (state.phase === "victory" || state.phase === "defeat") &&
      this.restartKey &&
      Phaser.Input.Keyboard.JustDown(this.restartKey)
    ) {
      this.scene.restart();
    }

    this.gameRegistry.updateMessages(delta);
    this.render();
    this.gameRegistry.notifyChange();
  }

  private createSystems(): void {
    const classSelectionSystem = new ClassSelectionSystem(this.gameRegistry);
    this.classSelectionSystem = classSelectionSystem;
    this.audioSystem = new AudioSystem(this.gameRegistry);
    const economySystem = new EconomySystem(this.gameRegistry);
    const skillTreeSystem = new SkillTreeSystem(this.gameRegistry);
    this.skillTreeSystem = skillTreeSystem;
    gameUiBridge.bindClassSelectionSystem(classSelectionSystem);
    gameUiBridge.bindSkillTreeSystem(skillTreeSystem);
    const enemySystem = new EnemySystem(this.gameRegistry, economySystem);
    const projectileSystem = new ProjectileSystem(this.gameRegistry, economySystem);
    const allySystem = new AllySystem(this.gameRegistry, economySystem);
    const statusEffectSystem = new StatusEffectSystem(this.gameRegistry);
    const towerSystem = new TowerSystem(
      this.gameRegistry,
      projectileSystem,
      skillTreeSystem,
      economySystem,
      allySystem
    );
    const buildSystem = new BuildSystem(this.gameRegistry, economySystem, skillTreeSystem);
    this.aiPartnerSystem = new AiPartnerSystem(this.gameRegistry, buildSystem, skillTreeSystem);
    gameUiBridge.bindBuildSystem(buildSystem);
    const waveSystem = new WaveSystem(
      this.gameRegistry,
      enemySystem,
      economySystem,
      skillTreeSystem
    );

    this.systems = [
      classSelectionSystem,
      buildSystem,
      skillTreeSystem,
      waveSystem,
      statusEffectSystem,
      enemySystem,
      towerSystem,
      allySystem,
      projectileSystem,
      economySystem
    ];

    this.keyboardController = new KeyboardCoopController(
      this,
      this.gameRegistry,
      buildSystem,
      classSelectionSystem,
      skillTreeSystem
    );
    this.towerRenderer = new TowerRenderer(this, this.gameRegistry, buildSystem, towerSystem);
  }

  private subscribeOnlineActions(): void {
    this.unsubscribeGameActions?.();
    this.unsubscribeGameActions = onlineClient.subscribeGameAction((action) => {
      gameUiBridge.applyRemoteGameAction(action);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeGameActions?.();
      this.unsubscribeGameActions = undefined;
      this.input.off("wheel", this.handleCameraWheel, this);
      this.input.off("pointerdown", this.handleCameraPointerDown, this);
      this.input.off("pointermove", this.handleCameraPointerMove, this);
      this.input.off("pointerup", this.handleCameraPointerUp, this);
      this.scene.stop("UIScene");
    });
  }

  private createRenderers(): void {
    this.ambientRenderer = new AmbientParticleRenderer(this);
    this.classSelectionRenderer = new ClassSelectionRenderer(this, this.classSelectionSystem);
    this.gridRenderer = new GridRenderer(this);
    this.enemyRenderer = new EnemyRenderer(this);
    this.allyRenderer = new AllyRenderer(this);
    this.zoneRenderer = new ZoneRenderer(this);
    this.projectileRenderer = new ProjectileRenderer(this);
    this.fxRenderer = new FxRenderer(this);
  }

  private createRestartInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  private createCameraInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on("wheel", this.handleCameraWheel, this);
    this.input.on("pointerdown", this.handleCameraPointerDown, this);
    this.input.on("pointermove", this.handleCameraPointerMove, this);
    this.input.on("pointerup", this.handleCameraPointerUp, this);
  }

  private updateWorldCamera(deltaMs: number): void {
    const state = this.gameRegistry.state;
    const camera = this.cameras.main;

    this.configureCameraForMap(state.activeMap);
    camera.zoom = Phaser.Math.Linear(camera.zoom, this.cameraTargetZoom, 0.14);

    if (this.cameraManualHoldMs > 0) {
      this.cameraManualHoldMs = Math.max(0, this.cameraManualHoldMs - deltaMs);
      return;
    }

    const playerId = getLocalPlayerIds(state.session)[0] ?? getPlayablePlayerIds(state)[0];
    const cursor = playerId ? state.cursors[playerId] : null;

    if (!cursor || state.phase === "class-selection") {
      return;
    }

    const target = gridToWorld(cursor.grid, state.activeMap);
    const targetScrollX = target.x - GAME_WIDTH / (2 * camera.zoom);
    const targetScrollY = target.y - GAME_HEIGHT / (2 * camera.zoom);

    camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetScrollX, 0.055);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetScrollY, 0.055);
  }

  private configureCameraForMap(map: MapDefinition): void {
    if (this.cameraMapId === map.id) {
      return;
    }

    const camera = this.cameras.main;
    const margin = map.columns >= 80 ? 260 : 80;
    const width = map.columns * map.tileSize;
    const height = map.rows * map.tileSize;
    const minZoom = this.getMinZoom(map);

    this.cameraMapId = map.id;
    this.cameraTargetZoom = map.columns >= 80 ? 0.36 : 1;
    camera.setBounds(
      map.origin.x - margin,
      map.origin.y - margin,
      width + margin * 2,
      height + margin * 2
    );
    camera.setZoom(Math.max(minZoom, this.cameraTargetZoom));

    const playerId = getLocalPlayerIds(this.gameRegistry.state.session)[0] ?? getPlayablePlayerIds(this.gameRegistry.state)[0];
    const cursor = playerId ? this.gameRegistry.state.cursors[playerId] : null;
    const focus = cursor
      ? gridToWorld(cursor.grid, map)
      : {
          x: map.origin.x + width / 2,
          y: map.origin.y + height / 2
        };

    camera.centerOn(focus.x, focus.y);
  }

  private handleCameraWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    const minZoom = this.getMinZoom(this.gameRegistry.state.activeMap);
    const maxZoom = this.gameRegistry.state.activeMap.columns >= 80 ? 0.95 : 1.15;
    const zoomDelta = deltaY > 0 ? -0.06 : 0.06;

    this.cameraTargetZoom = Phaser.Math.Clamp(this.cameraTargetZoom + zoomDelta, minZoom, maxZoom);
    this.cameraManualHoldMs = 2400;
  }

  private handleCameraPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.rightButtonDown()) {
      return;
    }

    const camera = this.cameras.main;

    this.cameraDragStart = {
      x: pointer.x,
      y: pointer.y,
      scrollX: camera.scrollX,
      scrollY: camera.scrollY
    };
    this.cameraManualHoldMs = 2400;
  }

  private handleCameraPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.cameraDragStart || !pointer.rightButtonDown()) {
      return;
    }

    const camera = this.cameras.main;

    camera.scrollX = this.cameraDragStart.scrollX - (pointer.x - this.cameraDragStart.x) / camera.zoom;
    camera.scrollY = this.cameraDragStart.scrollY - (pointer.y - this.cameraDragStart.y) / camera.zoom;
    this.cameraManualHoldMs = 2400;
  }

  private handleCameraPointerUp(): void {
    this.cameraDragStart = null;
  }

  private applyBaseHitShake(flashMs: number, lastDamage: number): void {
    if (flashMs > 0 && this.prevBaseHitFlashMs <= 0) {
      const intensity = Phaser.Math.Clamp(lastDamage / 30, 0.003, 0.014);
      this.cameras.main.shake(300, intensity);
    }
  }

  private getMinZoom(map: MapDefinition): number {
    if (map.columns < 80) {
      return 0.75;
    }

    return Math.max(
      0.26,
      Math.min(GAME_WIDTH / (map.columns * map.tileSize + 220), GAME_HEIGHT / (map.rows * map.tileSize + 220))
    );
  }

  private render(): void {
    const state = this.gameRegistry.state;

    this.ambientRenderer.render();
    this.gridRenderer.render(state);
    this.zoneRenderer.render(state);
    this.towerRenderer.render(state);
    this.enemyRenderer.render(state);
    this.allyRenderer.render(state);
    this.projectileRenderer.render(state);
    this.fxRenderer.render(state);
    this.classSelectionRenderer.render(state);
  }
}
