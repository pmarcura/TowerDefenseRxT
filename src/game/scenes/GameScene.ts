import Phaser from "phaser";
import { gameUiBridge } from "../bridge/RewardBridge";
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

export class GameScene extends Phaser.Scene {
  private readonly gameRegistry = GameRegistry.getInstance();
  private systems: GameSystem[] = [];
  private keyboardController!: KeyboardCoopController;
  private classSelectionSystem!: ClassSelectionSystem;
  private skillTreeSystem!: SkillTreeSystem;
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

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.gameRegistry.startRun();
    this.createSystems();
    this.createRenderers();
    this.createRestartInput();

    this.scene.launch("UIScene");
  }

  update(_time: number, delta: number): void {
    const state = this.gameRegistry.state;

    state.elapsedMs += delta;
    this.ambientRenderer.update(delta);
    this.keyboardController.update();
    this.audioSystem.update(delta);

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
