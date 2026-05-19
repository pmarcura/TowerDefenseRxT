import {
  getRewardSkillChoices,
  getSkillDefinition,
  getSkillEffectTotals,
  getSkillRank
} from "../data/skills";
import { GameRegistry } from "../GameRegistry";
import type { PlayerId } from "../models/types";
import type { GameSystem } from "./GameSystem";

const REWARD_CHOICE_COUNT = 3;
const REWARD_AUTO_SELECT_MS = 14000;

export class SkillTreeSystem implements GameSystem {
  constructor(private readonly registry: GameRegistry) {}

  update(deltaMs: number): void {
    this.syncEconomyEffects("p1");
    this.syncEconomyEffects("p2");
    this.updateRewardAutoSelect(deltaMs);
  }

  createRewardChoices(bossWaveId: string): void {
    const state = this.registry.state;
    const returnPhase = state.wave.completed ? "victory" : "playing";
    const p1SkillIds = this.getChoicesForPlayer("p1", bossWaveId);
    const p2SkillIds = this.getChoicesForPlayer("p2", bossWaveId);

    state.rewardSelection = {
      bossWaveId,
      returnPhase,
      autoSelectInMs: REWARD_AUTO_SELECT_MS,
      choices: {
        p1: {
          playerId: "p1",
          skillIds: p1SkillIds,
          selectedSkillId: p1SkillIds.length > 0 ? null : "none"
        },
        p2: {
          playerId: "p2",
          skillIds: p2SkillIds,
          selectedSkillId: p2SkillIds.length > 0 ? null : "none"
        }
      }
    };
    state.phase = "reward-selection";
    this.registry.pushMessage("Escolha recompensas");
    this.registry.pushPlayerNotice("p1", "RECOMPENSA", "escolha ou auto em 14s", "info", 2200);
    this.registry.pushPlayerNotice("p2", "RECOMPENSA", "escolha ou auto em 14s", "info", 2200);
  }

  selectReward(playerId: PlayerId, skillId: string): boolean {
    const state = this.registry.state;
    const rewardSelection = state.rewardSelection;

    if (state.phase !== "reward-selection" || !rewardSelection) {
      return false;
    }

    const playerChoices = rewardSelection.choices[playerId];

    if (playerChoices.selectedSkillId || !playerChoices.skillIds.includes(skillId)) {
      return false;
    }

    const skill = getSkillDefinition(skillId);
    const skillTree = state.skillTrees[playerId];
    const currentRank = getSkillRank(skillTree.skillRanks, skill.id);

    if (currentRank >= skill.maxRank || skillTree.bossSigils < skill.costSigils) {
      return false;
    }

    skillTree.bossSigils -= skill.costSigils;
    skillTree.skillRanks[skill.id] = currentRank + 1;
    playerChoices.selectedSkillId = skill.id;
    this.syncEconomyEffects(playerId);
    this.registry.pushMessage(`${playerId.toUpperCase()} ${skill.shortName}`);

    return true;
  }

  selectHighlightedReward(playerId: PlayerId): boolean {
    const rewardSelection = this.registry.state.rewardSelection;
    const playerChoices = rewardSelection?.choices[playerId];
    const highlightedSkillId = playerChoices?.skillIds[0];

    if (!highlightedSkillId) {
      return false;
    }

    return this.selectReward(playerId, highlightedSkillId);
  }

  canCloseRewardSelection(): boolean {
    const rewardSelection = this.registry.state.rewardSelection;

    if (!rewardSelection) {
      return false;
    }

    return Boolean(
      rewardSelection.choices.p1.selectedSkillId && rewardSelection.choices.p2.selectedSkillId
    );
  }

  completeRewardSelection(): void {
    const state = this.registry.state;
    const rewardSelection = state.rewardSelection;

    if (!rewardSelection || !this.canCloseRewardSelection()) {
      return;
    }

    state.rewardSelection = null;

    if (rewardSelection.returnPhase === "victory") {
      this.registry.finishRun("victory");
      this.registry.pushMessage("Run completa");
      return;
    }

    state.phase = "playing";
    this.registry.clearWaveReadiness(true);
    state.wave.notice = {
      title: "Preparacao liberada",
      subtitle: "Ajustem as torres. A wave entra sozinha se ninguem travar.",
      timerMs: 5200,
      tone: "complete"
    };
    this.registry.pushMessage("Preparem a proxima onda");
  }

  getEffects(playerId: PlayerId) {
    return getSkillEffectTotals(playerId, this.registry.state.skillTrees[playerId].skillRanks);
  }

  private getChoicesForPlayer(playerId: PlayerId, bossWaveId: string): string[] {
    const state = this.registry.state;
    const skillTree = state.skillTrees[playerId];
    const choices = getRewardSkillChoices(
      playerId,
      skillTree.skillRanks,
      skillTree.bossSigils,
      bossWaveId,
      REWARD_CHOICE_COUNT
    );

    return choices.map((skill) => skill.id);
  }

  private updateRewardAutoSelect(deltaMs: number): void {
    const state = this.registry.state;
    const rewardSelection = state.rewardSelection;

    if (state.phase !== "reward-selection" || !rewardSelection) {
      return;
    }

    rewardSelection.autoSelectInMs = Math.max(0, rewardSelection.autoSelectInMs - deltaMs);

    if (rewardSelection.autoSelectInMs > 0) {
      return;
    }

    for (const playerId of ["p1", "p2"] as const) {
      const choices = rewardSelection.choices[playerId];

      if (!choices.selectedSkillId && choices.skillIds[0]) {
        this.selectReward(playerId, choices.skillIds[0]);
      }
    }

    if (this.canCloseRewardSelection()) {
      this.completeRewardSelection();
    }
  }

  private syncEconomyEffects(playerId: PlayerId): void {
    const effects = this.getEffects(playerId);

    this.registry.state.economies[playerId].rewardMultiplier = effects.rewardMultiplier;
  }
}
