import { GameRegistry } from "../GameRegistry";
import type {
  GameSettings,
  GameState,
  PlayerId,
  TowerAutoBuildId,
  TowerUpgradeBranchId
} from "../models/types";
import type { ClassSelectionSystem } from "../systems/ClassSelectionSystem";
import type { SkillTreeSystem } from "../systems/SkillTreeSystem";

class GameUiBridge {
  private readonly registry = GameRegistry.getInstance();
  private classSelectionSystem: ClassSelectionSystem | null = null;
  private skillTreeSystem: SkillTreeSystem | null = null;

  bindClassSelectionSystem(classSelectionSystem: ClassSelectionSystem): void {
    this.classSelectionSystem = classSelectionSystem;
  }

  bindSkillTreeSystem(skillTreeSystem: SkillTreeSystem): void {
    this.skillTreeSystem = skillTreeSystem;
  }

  getState(): GameState {
    return this.registry.state;
  }

  subscribe(listener: () => void): () => void {
    return this.registry.subscribe(listener);
  }

  pause(): boolean {
    return this.registry.pause();
  }

  resume(): boolean {
    return this.registry.resume();
  }

  restartRun(): void {
    this.registry.restartRun();
  }

  updateSettings(partial: Partial<GameSettings>): void {
    this.registry.updateSettings(partial);
  }

  setPlayerReady(playerId: PlayerId): boolean {
    return this.registry.setPlayerReady(playerId);
  }

  openTowerInspection(playerId: PlayerId): boolean {
    return this.registry.openTowerInspection(playerId);
  }

  closeTowerInspection(): void {
    this.registry.closeTowerInspection();
  }

  cycleTowerInspectionOption(playerId: PlayerId, direction: -1 | 1): boolean {
    return this.registry.cycleTowerInspectionOption(playerId, direction);
  }

  setTowerInspectionOption(playerId: PlayerId, optionIndex: number): boolean {
    return this.registry.setTowerInspectionOption(playerId, optionIndex);
  }

  activateTowerInspectionOption(playerId: PlayerId): boolean {
    return this.registry.activateTowerInspectionOption(playerId);
  }

  spendTowerUpgradePoint(
    playerId: PlayerId,
    towerId: string,
    branchId: TowerUpgradeBranchId
  ): boolean {
    return this.registry.spendTowerUpgradePoint(playerId, towerId, branchId);
  }

  setTowerAutoBuild(playerId: PlayerId, towerId: string, buildId: TowerAutoBuildId): boolean {
    return this.registry.setTowerAutoBuild(playerId, towerId, buildId);
  }

  toggleTowerAutoUpgrade(playerId: PlayerId, towerId: string): boolean {
    return this.registry.toggleTowerAutoUpgrade(playerId, towerId);
  }

  selectClass(playerId: PlayerId, classId: string): boolean {
    return this.classSelectionSystem?.selectClass(playerId, classId) ?? false;
  }

  cycleClass(playerId: PlayerId, direction: number): boolean {
    return this.classSelectionSystem?.cycleClass(playerId, direction) ?? false;
  }

  confirmClass(playerId: PlayerId): boolean {
    return this.classSelectionSystem?.confirmClass(playerId) ?? false;
  }

  selectReward(playerId: PlayerId, skillId: string): boolean {
    if (!this.skillTreeSystem) {
      return false;
    }

    const selected = this.skillTreeSystem.selectReward(playerId, skillId);

    if (selected && this.skillTreeSystem.canCloseRewardSelection()) {
      this.skillTreeSystem.completeRewardSelection();
    }

    this.registry.notifyChange();

    return selected;
  }
}

export const gameUiBridge = new GameUiBridge();
export const rewardBridge = gameUiBridge;
