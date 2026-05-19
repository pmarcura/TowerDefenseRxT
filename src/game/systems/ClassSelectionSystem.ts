import { playerClassDefinitions } from "../data/playerClasses";
import { waveDefinitions } from "../data/waves";
import { GameRegistry } from "../GameRegistry";
import type { PlayerId } from "../models/types";
import type { GameSystem } from "./GameSystem";

export class ClassSelectionSystem implements GameSystem {
  constructor(private readonly registry: GameRegistry) {}

  update(_deltaMs: number): void {}

  selectClass(playerId: PlayerId, classId: string): boolean {
    const state = this.registry.state;
    const classSelection = state.classSelection;
    const classIndex = playerClassDefinitions.findIndex((definition) => definition.id === classId);

    if (state.phase !== "class-selection" || !classSelection || classIndex < 0) {
      return false;
    }

    const playerChoice = classSelection.choices[playerId];

    if (playerChoice.confirmed) {
      return false;
    }

    playerChoice.selectedClassIndex = classIndex;
    state.playerClasses[playerId] = playerClassDefinitions[classIndex].id;
    this.registry.notifyChange();

    return true;
  }

  cycleClass(playerId: PlayerId, direction: number): boolean {
    const state = this.registry.state;
    const classSelection = state.classSelection;

    if (state.phase !== "class-selection" || !classSelection) {
      return false;
    }

    const playerChoice = classSelection.choices[playerId];

    if (playerChoice.confirmed) {
      return false;
    }

    const total = playerClassDefinitions.length;
    const nextIndex = (playerChoice.selectedClassIndex + direction + total) % total;
    playerChoice.selectedClassIndex = nextIndex;
    state.playerClasses[playerId] = playerClassDefinitions[nextIndex].id;
    this.registry.notifyChange();

    return true;
  }

  confirmClass(playerId: PlayerId): boolean {
    const state = this.registry.state;
    const classSelection = state.classSelection;

    if (state.phase !== "class-selection" || !classSelection) {
      return false;
    }

    const playerChoice = classSelection.choices[playerId];

    if (playerChoice.confirmed) {
      return false;
    }

    playerChoice.confirmed = true;
    state.playerClasses[playerId] =
      playerClassDefinitions[playerChoice.selectedClassIndex].id;
    this.registry.pushPresentationEvent("audio", 500, { cueId: "ui_confirm" });
    this.registry.pushMessage(`${playerId.toUpperCase()} pronto`, 1600);

    if (this.canStartRun()) {
      this.startPlaying();
    }

    this.registry.notifyChange();

    return true;
  }

  canStartRun(): boolean {
    const classSelection = this.registry.state.classSelection;

    return Boolean(
      classSelection?.choices.p1.confirmed && classSelection.choices.p2.confirmed
    );
  }

  private startPlaying(): void {
    const state = this.registry.state;
    const nextWave = waveDefinitions[state.wave.currentWaveIndex];

    state.classSelection = null;
    state.phase = "playing";
    state.wave.active = false;
    state.wave.completed = false;
    this.registry.clearWaveReadiness(true);
    state.wave.notice = {
      title: "Run sincronizada",
      subtitle: nextWave
        ? `${nextWave.name}: construam e deem pronto para iniciar`
        : "Sem waves restantes",
      timerMs: 5200,
      tone: "start"
    };
    this.registry.pushMessage("Classes confirmadas", 1800);
    this.registry.pushPresentationEvent("wave", 1200, {
      cueId: "wave_start",
      label: "Run sincronizada"
    });
  }
}
