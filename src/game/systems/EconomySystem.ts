import type { GameSystem } from "./GameSystem";
import { GameRegistry } from "../GameRegistry";
import {
  INCOME_TOWER_HARD_CAP,
  INCOME_TOWER_REWARD_SCALE,
  INCOME_TOWER_SOFT_CAP,
  KILL_REWARD_MULTIPLIER
} from "../config/constants";
import { getPlayerClassDefinition } from "../data/playerClasses";
import { getTowerDefinition } from "../data/towers";
import type { PlayerId } from "../models/types";
import { getPlayablePlayerIds } from "../utils/players";
import { balanceConfig } from "../config/BalanceConfig";

export class EconomySystem implements GameSystem {
  constructor(private readonly registry: GameRegistry) {}

  update(_deltaMs: number): void {}

  canSpend(playerId: PlayerId, amount: number): boolean {
    return this.registry.state.economies[playerId].credits >= amount;
  }

  spend(playerId: PlayerId, amount: number): boolean {
    if (!this.canSpend(playerId, amount)) {
      return false;
    }

    this.registry.state.economies[playerId].credits -= amount;

    return true;
  }

  reward(_playerId: PlayerId, amount: number): number {
    return this.grantTeamCredits(amount, balanceConfig.getKillRewardMultiplier(KILL_REWARD_MULTIPLIER));
  }

  rewardTeam(amountPerPlayer: number): number {
    return this.grantTeamCredits(amountPerPlayer, balanceConfig.getWaveCompletionBonus(1.0));
  }

  rewardIncome(ownerId: PlayerId, baseAmount: number, sourceTowerId: string): number {
    const incomeTowers = this.registry.state.towers.filter(
      (tower) =>
        tower.ownerId === ownerId &&
        getTowerDefinition(tower.typeId).effect === "income"
    );
    const towerRank = incomeTowers.findIndex((tower) => tower.id === sourceTowerId);

    if (towerRank >= INCOME_TOWER_HARD_CAP) {
      return 0;
    }

    const capMultiplier = towerRank >= INCOME_TOWER_SOFT_CAP ? 0.52 : 1;

    return this.grantTeamCredits(baseAmount, INCOME_TOWER_REWARD_SCALE * capMultiplier);
  }

  getTeamRewardMultiplier(): number {
    const state = this.registry.state;
    const playerIds = getPlayablePlayerIds(state);

    if (playerIds.length === 0) {
      return 1;
    }

    const total = playerIds.reduce((sum, playerId) => {
      const economy = state.economies[playerId];
      const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);

      return sum + economy.rewardMultiplier * playerClass.rewardMultiplier;
    }, 0);

    return total / playerIds.length;
  }

  private grantTeamCredits(amount: number, scale: number): number {
    if (amount <= 0 || scale <= 0) {
      return 0;
    }

    const credits = Math.max(1, Math.floor(amount * scale * this.getTeamRewardMultiplier()));

    for (const playerId of getPlayablePlayerIds(this.registry.state)) {
      this.registry.state.economies[playerId].credits += credits;
    }

    return credits;
  }


  rewardBossSigils(amount: number): void {
    for (const playerId of getPlayablePlayerIds(this.registry.state)) {
      this.registry.state.skillTrees[playerId].bossSigils += amount;
    }
  }

  damageBase(amount: number): void {
    const state = this.registry.state;

    state.baseHp = Math.max(0, state.baseHp - amount);
    state.lastBaseDamage = amount;
    state.baseHitFlashMs = 640;
    this.registry.pushPresentationEvent("base-hit", 900, {
      cueId: "base_hit",
      amount
    });
    state.wave.notice = {
      title: `Base sofreu -${amount}`,
      subtitle: `HP restante ${state.baseHp}/${state.activeMap.baseHp}`,
      timerMs: 900,
      tone: "danger"
    };
    for (const playerId of getPlayablePlayerIds(state)) {
      this.registry.pushPlayerNotice(playerId, "BASE ATINGIDA", `-${amount} HP`, "danger", 1300);
    }

    if (state.baseHp <= 0 && state.phase === "playing") {
      this.registry.pushMessage("Base perdida");
      this.registry.finishRun("defeat");
    }
  }
}
