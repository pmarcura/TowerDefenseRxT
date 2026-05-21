export type BalanceOverrides = {
  towerDamageMultipliers?: Record<string, number>;
  enemyHpMultiplier?: number;
  startingCredits?: number;
  killRewardMultiplier?: number;
  waveCompletionBonus?: number;
};

class BalanceConfigManager {
  private overrides: BalanceOverrides = {};

  constructor() {
    this.load();
  }

  load(): void {
    if (typeof window === "undefined") {
      // Headless/Node environment — overrides set via setTemporaryOverrides()
      return;
    }

    // Browser environment
    try {
      const saved = localStorage.getItem("aegis-balance-overrides");
      if (saved) {
        this.overrides = JSON.parse(saved);
      }
    } catch {
      this.overrides = {};
    }
  }

  save(overrides: BalanceOverrides): void {
    this.overrides = overrides;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("aegis-balance-overrides", JSON.stringify(overrides));
    } catch (e) {
      console.error("Erro ao salvar balanceamento:", e);
    }
  }

  setTemporaryOverrides(overrides: BalanceOverrides): void {
    this.overrides = overrides;
  }

  getOverrides(): BalanceOverrides {
    return this.overrides;
  }

  getTowerDamageMultiplier(towerId: string): number {
    return this.overrides.towerDamageMultipliers?.[towerId] ?? 1.0;
  }

  getEnemyHpMultiplier(): number {
    return this.overrides.enemyHpMultiplier ?? 1.0;
  }

  getStartingCredits(fallback: number): number {
    return this.overrides.startingCredits ?? fallback;
  }

  getKillRewardMultiplier(fallback: number): number {
    return this.overrides.killRewardMultiplier ?? fallback;
  }

  getWaveCompletionBonus(fallback: number): number {
    return this.overrides.waveCompletionBonus ?? fallback;
  }
}

export const balanceConfig = new BalanceConfigManager();
