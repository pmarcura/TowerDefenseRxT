import { GameRegistry } from "../GameRegistry";
import type {
  GameSettings,
  GameState,
  PlayerId,
  TowerAutoBuildId,
  TowerUpgradeBranchId
} from "../models/types";
import type { GameAction } from "../actions/types";
import { onlineClient } from "../network/OnlineClient";
import type { BuildSystem } from "../systems/BuildSystem";
import type { ClassSelectionSystem } from "../systems/ClassSelectionSystem";
import type { SkillTreeSystem } from "../systems/SkillTreeSystem";

class GameUiBridge {
  private readonly registry = GameRegistry.getInstance();
  private buildSystem: BuildSystem | null = null;
  private classSelectionSystem: ClassSelectionSystem | null = null;
  private skillTreeSystem: SkillTreeSystem | null = null;

  bindBuildSystem(buildSystem: BuildSystem): void {
    this.buildSystem = buildSystem;
  }

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
    const changed = this.registry.setPlayerReady(playerId);

    if (changed) {
      this.sendLocalGameAction({ type: "SET_READY", playerId, ready: true });
    }

    return changed;
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
    const changed = this.registry.spendTowerUpgradePoint(playerId, towerId, branchId);

    if (changed) {
      this.sendLocalGameAction({ type: "UPGRADE_TOWER", playerId, towerId, branchId });
    }

    return changed;
  }

  setTowerAutoBuild(playerId: PlayerId, towerId: string, buildId: TowerAutoBuildId): boolean {
    const changed = this.registry.setTowerAutoBuild(playerId, towerId, buildId);

    if (changed) {
      this.sendLocalGameAction({ type: "SET_AUTO_BUILD", playerId, towerId, buildId });
    }

    return changed;
  }

  toggleTowerAutoUpgrade(playerId: PlayerId, towerId: string): boolean {
    return this.registry.toggleTowerAutoUpgrade(playerId, towerId);
  }

  selectClass(playerId: PlayerId, classId: string): boolean {
    const changed = this.classSelectionSystem?.selectClass(playerId, classId) ?? false;

    if (changed) {
      this.sendLocalGameAction({ type: "SELECT_CLASS", playerId, classId });
    }

    return changed;
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

    if (selected) {
      this.sendLocalGameAction({ type: "SELECT_REWARD", playerId, skillId });
    }

    this.registry.notifyChange();

    return selected;
  }

  sendLocalGameAction(action: GameAction): void {
    const clientState = onlineClient.getState();
    const isOnline = onlineClient.isOnlineRunActive();
    if (!isOnline) {
      return;
    }

    const actionPlayerId = "playerId" in action ? action.playerId : null;
    const isLocal = clientState.localPlayerId === actionPlayerId;
    const isHost = clientState.clientId && clientState.room?.hostClientId === clientState.clientId;
    const targetSeat = clientState.room?.seats.find((s) => s.id === actionPlayerId);
    const isTargetAi = targetSeat?.kind === "ai-partner";

    if (isLocal || (isHost && isTargetAi)) {
      onlineClient.sendGameAction(action);
    }
  }

  applyRemoteGameAction(action: GameAction): boolean {
    switch (action.type) {
      case "BUILD_TOWER":
        return this.buildSystem?.tryBuildForPlayerAt(action.playerId, action.towerId, action.grid) ?? false;
      case "UPGRADE_TOWER":
        return this.registry.spendTowerUpgradePoint(action.playerId, action.towerId, action.branchId);
      case "SET_READY":
        return action.ready ? this.registry.setPlayerReady(action.playerId) : false;
      case "SELECT_CLASS":
        return this.classSelectionSystem?.selectClass(action.playerId, action.classId) ?? false;
      case "SELECT_REWARD": {
        if (!this.skillTreeSystem) {
          return false;
        }

        const selected = this.skillTreeSystem.selectReward(action.playerId, action.skillId);

        if (selected && this.skillTreeSystem.canCloseRewardSelection()) {
          this.skillTreeSystem.completeRewardSelection();
        }

        this.registry.notifyChange();

        return selected;
      }
      case "SET_AUTO_BUILD":
        return this.registry.setTowerAutoBuild(action.playerId, action.towerId, action.buildId);
      case "PAUSE":
        return action.paused ? this.registry.pause() : this.registry.resume();
      case "DEBUG_ADVANCE_WAVE":
        return this.registry.debugAdvanceWave();
      case "WAIT":
        return false;
      default:
        return false;
    }
  }
}

export const gameUiBridge = new GameUiBridge();
export const rewardBridge = gameUiBridge;
