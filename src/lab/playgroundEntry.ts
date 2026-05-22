import { TowerDefenseEnv } from "../ai/env/TowerDefenseEnv";
import { trainPolicy, evaluatePolicy } from "../ai/learning/evolutionTrainer";
import {
  championPolicy,
  defaultProPolicy,
  getChampionPolicy,
  choosePolicyAction,
  normalizePolicy,
  createMutatedPolicy,
  createCrossoverPolicy,
  createRandomPolicy,
  type LearningPolicy
} from "../ai/learning/policy";
import { balanceConfig, type BalanceOverrides } from "../game/config/BalanceConfig";
import { getMapStage } from "../game/data/map";
import { Rng } from "../ai/env/Rng";

// Attach to window object for access within tools/balance-playground.html
(window as any).AegisAI = {
  TowerDefenseEnv,
  trainPolicy,
  evaluatePolicy,
  championPolicy,
  defaultProPolicy,
  getChampionPolicy,
  choosePolicyAction,
  balanceConfig,
  getMapStage,
  Rng,
  runBrowserBatchSimulations: (runs: number, overrides: BalanceOverrides) => {
    // Apply overrides temporary
    balanceConfig.setTemporaryOverrides(overrides);

    const env = new TowerDefenseEnv();
    const rng = new Rng(12345);
    const activePolicy = getChampionPolicy();

    let wins = 0;
    let wavesTotal = 0;
    let baseHpTotal = 0;
    let towersBuiltTotal = 0;
    
    // Wave tracking for chart
    const waveAttempts = Array.from({ length: 20 }, () => 0);
    const waveClears = Array.from({ length: 20 }, () => 0);

    // Tower damage tracking
    const towerDamage: Record<string, number> = {
      "vitrail-laser": 0,
      "chant-chain": 0,
      "nave-bell": 0
    };

    // Class combinations tracking
    const classPairs: Record<string, { attempts: number; wins: number; wavesCleared: number }> = {};

    const classesPool = ["crusader", "zealot", "templar", "monk"];

    for (let i = 0; i < runs; i++) {
      const episodeSeed = 54321 + i * 1337;
      const class1 = classesPool[i % classesPool.length];
      const class2 = classesPool[(i + 1) % classesPool.length];
      const pairName = `${class1} + ${class2}`;

      if (!classPairs[pairName]) {
        classPairs[pairName] = { attempts: 0, wins: 0, wavesCleared: 0 };
      }
      classPairs[pairName].attempts++;

      // Pick a random map stage (0 to 4)
      const stageIdx = i % 5;

      const state = env.reset({
        seed: episodeSeed,
        players: { p1: class1, p2: class2 },
        targetWaveCount: 20,
        mapId: `stage-0${stageIdx + 1}`
      });

      let steps = 0;
      let currentState = state;
      let isVictory = false;

      while (steps < 300) {
        const action = choosePolicyAction(activePolicy, currentState, ["p1", "p2"], rng);
        const stepResult = env.step(action);
        currentState = stepResult.state;
        steps++;

        if (stepResult.done) {
          if (currentState.phase === "victory") {
            isVictory = true;
          }
          break;
        }
      }

      if (isVictory) {
        wins++;
        classPairs[pairName].wins++;
      }

      const wavesCleared = currentState.waveLog.filter(w => w.cleared).length;
      wavesTotal += wavesCleared;
      classPairs[pairName].wavesCleared += wavesCleared;
      baseHpTotal += currentState.baseHp;

      // Accumulate tower damage
      currentState.towers.forEach(t => {
        if (towerDamage[t.typeId] !== undefined) {
          towerDamage[t.typeId] += t.damageDealt;
        }
      });

      // Towers built
      towersBuiltTotal += currentState.towers.length;

      // Accumulate wave statistics
      for (let w = 0; w < 20; w++) {
        if (w < currentState.waveLog.length) {
          waveAttempts[w]++;
          if (currentState.waveLog[w].cleared) {
            waveClears[w]++;
          }
        } else if (isVictory) {
          // If won, all subsequent waves were cleared
          waveAttempts[w]++;
          waveClears[w]++;
        }
      }
    }

    // Format the results to match latest-balance-results.json structure
    const results = {
      timestamp: new Date().toISOString(),
      winRate: wins / runs,
      averageWavesCleared: wavesTotal / runs,
      averageBaseHpRemaining: baseHpTotal / runs,
      averageTowersBuilt: towersBuiltTotal / runs,
      waves: waveAttempts.map((attempts, index) => ({
        name: `Onda ${index + 1}`,
        attempts,
        clears: waveClears[index]
      })),
      towers: {
        "tower.vitrail-laser": { damage: Math.round(towerDamage["vitrail-laser"] / runs) },
        "tower.chant-chain": { damage: Math.round(towerDamage["chant-chain"] / runs) },
        "tower.nave-bell": { damage: Math.round(towerDamage["nave-bell"] / runs) }
      },
      classPairs: Object.fromEntries(
        Object.entries(classPairs).map(([pair, stats]) => [
          pair,
          {
            attempts: stats.attempts,
            winRate: stats.wins / stats.attempts,
            averageWavesCleared: stats.wavesCleared / stats.attempts
          }
        ])
      ),
      recommendations: [] as string[]
    };

    // Generate heuristics-based balance recommendations
    if (results.winRate > 0.85) {
      results.recommendations.push("HP ou Velocidade dos inimigos parecem baixos demais (Win Rate > 85%). Dificulte o jogo.");
    } else if (results.winRate < 0.15) {
      results.recommendations.push("O jogo está muito punitivo (Win Rate < 15%). Tente reduzir HP dos monstros ou buffar o dano das torres.");
    }

    // Check individual towers balance
    const vitrailDmg = results.towers["tower.vitrail-laser"].damage;
    const chantDmg = results.towers["tower.chant-chain"].damage;
    const bellDmg = results.towers["tower.nave-bell"].damage;
    const totalDmg = Math.max(1, vitrailDmg + chantDmg + bellDmg);

    if (vitrailDmg / totalDmg > 0.6) {
      results.recommendations.push("Vitrail Laser representa mais de 60% do dano. Cogite nerfá-la ou buffar outras torres.");
    }
    if (chantDmg / totalDmg > 0.6) {
      results.recommendations.push("Chant Chain representa mais de 60% do dano. Cogite nerfá-la.");
    }
    if (bellDmg / totalDmg > 0.6) {
      results.recommendations.push("Nave Bell representa mais de 60% do dano. Cogite nerfá-la.");
    }

    return results;
  },

  runBrowserBatchSimulationsAsync: async (
    runs: number,
    overrides: BalanceOverrides,
    onProgress: (current: number, total: number, resultsSoFar: any) => void
  ) => {
    // Apply overrides temporary
    balanceConfig.setTemporaryOverrides(overrides);

    const env = new TowerDefenseEnv();
    const rng = new Rng(12345);
    const activePolicy = getChampionPolicy();

    let wins = 0;
    let wavesTotal = 0;
    let baseHpTotal = 0;
    let towersBuiltTotal = 0;
    
    // Wave tracking for chart
    const waveAttempts = Array.from({ length: 20 }, () => 0);
    const waveClears = Array.from({ length: 20 }, () => 0);

    // Tower damage tracking
    const towerDamage: Record<string, number> = {
      "vitrail-laser": 0,
      "chant-chain": 0,
      "nave-bell": 0
    };

    // Class combinations tracking
    const classPairs: Record<string, { attempts: number; wins: number; wavesCleared: number }> = {};
    const classesPool = ["crusader", "zealot", "templar", "monk"];

    // Run in chunks of 5 to keep the browser main thread responsive
    const chunkSize = 5;
    for (let i = 0; i < runs; i += chunkSize) {
      const currentChunkLimit = Math.min(runs, i + chunkSize);
      for (let j = i; j < currentChunkLimit; j++) {
        const episodeSeed = 54321 + j * 1337;
        const class1 = classesPool[j % classesPool.length];
        const class2 = classesPool[(j + 1) % classesPool.length];
        const pairName = `${class1} + ${class2}`;

        if (!classPairs[pairName]) {
          classPairs[pairName] = { attempts: 0, wins: 0, wavesCleared: 0 };
        }
        classPairs[pairName].attempts++;

        const stageIdx = j % 5;

        const state = env.reset({
          seed: episodeSeed,
          players: { p1: class1, p2: class2 },
          targetWaveCount: 20,
          mapId: `stage-0${stageIdx + 1}`
        });

        let steps = 0;
        let currentState = state;
        let isVictory = false;

        while (steps < 300) {
          const action = choosePolicyAction(activePolicy, currentState, ["p1", "p2"], rng);
          const stepResult = env.step(action);
          currentState = stepResult.state;
          steps++;

          if (stepResult.done) {
            if (currentState.phase === "victory") {
              isVictory = true;
            }
            break;
          }
        }

        if (isVictory) {
          wins++;
          classPairs[pairName].wins++;
        }

        const wavesCleared = currentState.waveLog.filter(w => w.cleared).length;
        wavesTotal += wavesCleared;
        classPairs[pairName].wavesCleared += wavesCleared;
        baseHpTotal += currentState.baseHp;

        // Accumulate tower damage
        currentState.towers.forEach(t => {
          if (towerDamage[t.typeId] !== undefined) {
            towerDamage[t.typeId] += t.damageDealt;
          }
        });

        // Towers built
        towersBuiltTotal += currentState.towers.length;

        // Accumulate wave statistics
        for (let w = 0; w < 20; w++) {
          if (w < currentState.waveLog.length) {
            waveAttempts[w]++;
            if (currentState.waveLog[w].cleared) {
              waveClears[w]++;
            }
          } else if (isVictory) {
            waveAttempts[w]++;
            waveClears[w]++;
          }
        }
      }

      // Calculate progress and format temporary results
      const currentCompleted = currentChunkLimit;
      const tempResults = {
        timestamp: new Date().toISOString(),
        winRate: wins / currentCompleted,
        averageWavesCleared: wavesTotal / currentCompleted,
        averageBaseHpRemaining: baseHpTotal / currentCompleted,
        averageTowersBuilt: towersBuiltTotal / currentCompleted,
        waves: waveAttempts.map((attempts, index) => ({
          name: `Onda ${index + 1}`,
          attempts: attempts || 1,
          clears: waveClears[index]
        })),
        towers: {
          "tower.vitrail-laser": { damage: Math.round(towerDamage["vitrail-laser"] / currentCompleted) },
          "tower.chant-chain": { damage: Math.round(towerDamage["chant-chain"] / currentCompleted) },
          "tower.nave-bell": { damage: Math.round(towerDamage["nave-bell"] / currentCompleted) }
        },
        classPairs: Object.fromEntries(
          Object.entries(classPairs).map(([pair, stats]) => [
            pair,
            {
              attempts: stats.attempts,
              winRate: stats.wins / stats.attempts,
              averageWavesCleared: stats.wavesCleared / stats.attempts
            }
          ])
        ),
        recommendations: [] as string[]
      };

      onProgress(currentCompleted, runs, tempResults);
      // Yield back to the browser event loop
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Final recommendations
    const finalResults = {
      timestamp: new Date().toISOString(),
      winRate: wins / runs,
      averageWavesCleared: wavesTotal / runs,
      averageBaseHpRemaining: baseHpTotal / runs,
      averageTowersBuilt: towersBuiltTotal / runs,
      waves: waveAttempts.map((attempts, index) => ({
        name: `Onda ${index + 1}`,
        attempts,
        clears: waveClears[index]
      })),
      towers: {
        "tower.vitrail-laser": { damage: Math.round(towerDamage["vitrail-laser"] / runs) },
        "tower.chant-chain": { damage: Math.round(towerDamage["chant-chain"] / runs) },
        "tower.nave-bell": { damage: Math.round(towerDamage["nave-bell"] / runs) }
      },
      classPairs: Object.fromEntries(
        Object.entries(classPairs).map(([pair, stats]) => [
          pair,
          {
            attempts: stats.attempts,
            winRate: stats.wins / stats.attempts,
            averageWavesCleared: stats.wavesCleared / stats.attempts
          }
        ])
      ),
      recommendations: [] as string[]
    };

    if (finalResults.winRate > 0.85) {
      finalResults.recommendations.push("HP ou Velocidade dos inimigos parecem baixos demais (Win Rate > 85%). Dificulte o jogo.");
    } else if (finalResults.winRate < 0.15) {
      finalResults.recommendations.push("O jogo está muito punitivo (Win Rate < 15%). Tente reduzir HP dos monstros ou buffar o dano das torres.");
    }

    const vitrailDmg = finalResults.towers["tower.vitrail-laser"].damage;
    const chantDmg = finalResults.towers["tower.chant-chain"].damage;
    const bellDmg = finalResults.towers["tower.nave-bell"].damage;
    const totalDmg = Math.max(1, vitrailDmg + chantDmg + bellDmg);

    if (vitrailDmg / totalDmg > 0.6) {
      finalResults.recommendations.push("Vitrail Laser representa mais de 60% do dano. Cogite nerfá-la ou buffar outras torres.");
    }
    if (chantDmg / totalDmg > 0.6) {
      finalResults.recommendations.push("Chant Chain representa mais de 60% do dano. Cogite nerfá-la.");
    }
    if (bellDmg / totalDmg > 0.6) {
      finalResults.recommendations.push("Nave Bell representa mais de 60% do dano. Cogite nerfá-la.");
    }

    return finalResults;
  },

  trainPolicyAsync: async (
    options: {
      seed?: number;
      generations?: number;
      population?: number;
      episodesPerPolicy?: number;
      eliteCount?: number;
      mutationRate?: number;
      mutationScale?: number;
      maxSteps?: number;
      targetWaveCount?: number;
      curriculum?: boolean;
      promotionEpisodes?: number;
    } = {},
    onProgress: (status: {
      generation: number;
      totalGenerations: number;
      policyIndex: number;
      totalPolicies: number;
      bestFitness: number;
      currentBestFitness: number;
      averageFitness: number;
    }) => void
  ) => {
    // Fast but functional default options for browser
    const normalized = {
      seed: options.seed ?? 14729,
      generations: options.generations ?? 3,
      population: options.population ?? 8,
      episodesPerPolicy: options.episodesPerPolicy ?? 5,
      eliteCount: options.eliteCount ?? 2,
      mutationRate: options.mutationRate ?? 0.38,
      mutationScale: options.mutationScale ?? 0.18,
      maxSteps: options.maxSteps ?? 280,
      targetWaveCount: options.targetWaveCount ?? 20,
      curriculum: options.curriculum ?? true,
      promotionEpisodes: options.promotionEpisodes ?? 8,
      seedPolicies: [getChampionPolicy()],
      seedPolicyIds: [] as string[]
    };
    normalized.seedPolicyIds = normalized.seedPolicies.map(p => p.id);

    const rng = new Rng(normalized.seed);
    const seededPolicies = [defaultProPolicy, ...normalized.seedPolicies].map(normalizePolicy);
    
    // Deduplicate
    const seenIds = new Set<string>();
    const uniqueSeeded: LearningPolicy[] = [];
    for (const p of seededPolicies) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        uniqueSeeded.push(p);
      }
    }

    const randomCount = Math.max(0, normalized.population - uniqueSeeded.length);
    const population: LearningPolicy[] = [
      ...uniqueSeeded,
      ...Array.from({ length: randomCount }, () => createRandomPolicy(rng))
    ].slice(0, normalized.population);

    // Evaluate starting champion
    let champion = evaluatePolicy(
      normalized.seedPolicies[0] || defaultProPolicy,
      { ...normalized, episodesPerPolicy: normalized.promotionEpisodes } as any,
      normalized.seed + 11,
      normalized.generations
    );

    const generationSummaries: any[] = [];
    let currentPopulation = population;

    for (let gen = 0; gen < normalized.generations; gen++) {
      const evaluations: any[] = [];
      
      for (let pIdx = 0; pIdx < currentPopulation.length; pIdx++) {
        const policy = currentPopulation[pIdx];
        
        onProgress({
          generation: gen,
          totalGenerations: normalized.generations,
          policyIndex: pIdx,
          totalPolicies: currentPopulation.length,
          bestFitness: champion.fitness,
          currentBestFitness: evaluations.length > 0 ? evaluations[0].fitness : 0,
          averageFitness: evaluations.length > 0 ? (evaluations.reduce((sum, e) => sum + e.fitness, 0) / evaluations.length) : 0
        });

        // Yield to browser main thread
        await new Promise(resolve => setTimeout(resolve, 0));

        const evalResult = evaluatePolicy(
          policy,
          normalized as any,
          normalized.seed + gen * 100003 + pIdx * 4099,
          gen
        );
        evaluations.push(evalResult);
      }

      // Sort
      evaluations.sort((a, b) => b.fitness - a.fitness);
      const generationBest = evaluations[0];

      if (generationBest.fitness > champion.fitness) {
        champion = generationBest;
      }

      const avgFitness = evaluations.reduce((sum, e) => sum + e.fitness, 0) / evaluations.length;

      generationSummaries.push({
        generation: gen,
        bestFitness: generationBest.fitness,
        averageFitness: avgFitness,
        bestWinRate: generationBest.winRate,
        bestAverageWaves: generationBest.averageWavesCleared,
        bestPolicyId: generationBest.policy.id
      });

      // Selection for next population
      const elites = evaluations.slice(0, normalized.eliteCount).map(e => e.policy);
      const nextPopulation: LearningPolicy[] = [champion.policy, ...elites.slice(0, normalized.eliteCount - 1)];

      while (nextPopulation.length < normalized.population) {
        const tournamentSize = 3;
        const picks: any[] = [];
        for (let t = 0; t < tournamentSize; t++) {
          picks.push(evaluations[Math.floor(rng.next() * evaluations.length)]);
        }
        picks.sort((a, b) => b.fitness - a.fitness);
        const parentA = picks[0].policy;

        const picksB: any[] = [];
        for (let t = 0; t < tournamentSize; t++) {
          picksB.push(evaluations[Math.floor(rng.next() * evaluations.length)]);
        }
        picksB.sort((a, b) => b.fitness - a.fitness);
        const parentB = picksB[0].policy;

        const child = rng.next() < 0.68
          ? createCrossoverPolicy(
              parentA,
              parentB,
              rng,
              gen + 1,
              normalized.mutationRate,
              normalized.mutationScale
            )
          : createMutatedPolicy(
              parentA,
              rng,
              gen + 1,
              normalized.mutationRate,
              normalized.mutationScale
            );

        nextPopulation.push(child);
      }

      currentPopulation = nextPopulation;
    }

    // Final evaluation for champion
    const promotionOptions = {
      ...normalized,
      episodesPerPolicy: normalized.promotionEpisodes,
      curriculum: false
    };

    const finalChampionEval = evaluatePolicy(
      champion.policy,
      promotionOptions as any,
      normalized.seed + 9911,
      normalized.generations
    );

    // Save final policy to localStorage
    localStorage.setItem("aegis-champion-policy", JSON.stringify(finalChampionEval.policy));

    const report = {
      version: "aegis-self-learning-v1",
      generatedAt: new Date().toISOString(),
      options: normalized,
      champion: finalChampionEval,
      baseline: finalChampionEval,
      improvement: {
        fitness: 0,
        winRate: 0,
        averageWavesCleared: 0
      },
      generations: generationSummaries,
      recommendations: [] as string[],
      knowledge: []
    };

    if (finalChampionEval.winRate > 0.8) {
      report.recommendations.push("A IA aprendeu uma estratégia extremamente forte (Win Rate > 80%). Considere dificultar o balanço.");
    } else if (finalChampionEval.winRate < 0.2) {
      report.recommendations.push("A IA tem dificuldades para vencer com essa configuração (Win Rate < 20%). Tente facilitar o balanço.");
    }

    return report;
  }
};
