import { getSkillDefinition } from "../data/skills";
import { getTowerDefinition } from "../data/towers";
import type { GameAction } from "../actions/types";
import type {
  AiDecisionKind,
  GridPoint,
  TowerDefinition,
  TowerUpgradeBranchId,
  PlayerId
} from "../models/types";
import { RunTelemetry } from "../telemetry/RunTelemetry";
import type { GameRegistry } from "../GameRegistry";
import type { BuildSystem } from "./BuildSystem";
import type { GameSystem } from "./GameSystem";
import type { SkillTreeSystem } from "./SkillTreeSystem";
import { choosePolicyAction, mapGameStateToHeadless, getChampionPolicy } from "../../ai/learning/policy";
import { Rng } from "../../ai/env/Rng";
import { onlineClient } from "../network/OnlineClient";
import { gameUiBridge } from "../bridge/RewardBridge";

export class AiPartnerSystem implements GameSystem {
  private readonly telemetry = RunTelemetry.getInstance();
  private readonly rng = new Rng(14729);
  private botThinkTimers: Record<string, number> = {};

  constructor(
    private readonly registry: GameRegistry,
    private readonly buildSystem: BuildSystem,
    private readonly skillTreeSystem: SkillTreeSystem
  ) {}

  update(deltaMs: number): void {
    const state = this.registry.state;

    // Check online status and who is the host
    const isOnline = onlineClient.isOnlineRunActive();
    const isHost = isOnline && onlineClient.getState().clientId === onlineClient.getState().room?.hostClientId;

    // Only run bots if offline, or if online and local client is the host
    if (isOnline && !isHost) {
      return;
    }

    const botSeats = state.session.seats.filter(
      (seat) => seat.kind === "ai-partner" && seat.connected && Boolean(state.playerClasses[seat.id])
    );

    if (botSeats.length === 0) {
      return;
    }

    // Run thinking loop for each bot
    for (const seat of botSeats) {
      const botId = seat.id;
      if (this.botThinkTimers[botId] === undefined) {
        this.botThinkTimers[botId] = this.getNextThinkDelay(botSeats.length);
      }

      this.botThinkTimers[botId] -= deltaMs;

      if (this.botThinkTimers[botId] <= 0) {
        this.botThinkTimers[botId] = this.getNextThinkDelay(botSeats.length);

        this.think(botId, seat.displayName);
      }
    }
  }

  private getNextThinkDelay(botCount: number): number {
    if (botCount >= 10) {
      return this.rng.int(260, 620);
    }

    if (botCount >= 6) {
      return this.rng.int(360, 760);
    }

    return this.rng.int(700, 1100);
  }

  private think(botId: PlayerId, displayName: string): void {
    const state = this.registry.state;
    const headlessState = mapGameStateToHeadless(state);

    // Call policy choosing logic
    const activePolicy = getChampionPolicy();
    const action = choosePolicyAction(activePolicy, headlessState, [botId], this.rng);

    if (!action || action.type === "WAIT") {
      return;
    }

    // Apply the action locally
    const success = gameUiBridge.applyRemoteGameAction(action);

    if (success) {
      // Propagate action via network
      gameUiBridge.sendLocalGameAction(action);

      // Log decision for telemetry & Phaser HUD renderer
      this.commitDecisionFromAction(botId, displayName, action);
    }
  }

  private commitDecisionFromAction(botId: PlayerId, displayName: string, action: GameAction): void {
    const state = this.registry.state;
    let kind: AiDecisionKind;
    let title = "";
    let detail = "";
    let confidence = 0.82;
    let score = 5.0;
    let tags: string[] = [];
    let towerId: string | undefined;

    const localPlayerId = onlineClient.getState().localPlayerId || "p1";

    if (action.type === "BUILD_TOWER") {
      kind = "build";
      try {
        const tower = getTowerDefinition(action.towerId);
        title = `${tower.shortName} em ${action.grid.col},${action.grid.row}`;
        detail = `Foco: ${tower.effect}`;
        tags = ["build", tower.id, tower.effect];
        
        this.registry.pushPlayerNotice(
          localPlayerId,
          `${displayName.toUpperCase()} CONSTRUIU`,
          `${tower.shortName} · col ${action.grid.col} row ${action.grid.row}`,
          "info",
          1500
        );
      } catch {
        title = `${action.towerId} em ${action.grid.col},${action.grid.row}`;
        detail = "Construção de nova torre";
        tags = ["build"];
      }
    } else if (action.type === "UPGRADE_TOWER") {
      kind = "upgrade";
      title = `Upgrade ${action.branchId}`;
      const existing = state.towers.find((t) => t.id === action.towerId);
      if (existing) {
        try {
          const tower = getTowerDefinition(existing.typeId);
          detail = `${tower.shortName} nível ${existing.level}`;
        } catch {
          detail = `Torre nível ${existing.level}`;
        }
      } else {
        detail = `Na torre ${action.towerId}`;
      }
      tags = ["upgrade", action.branchId];
      towerId = action.towerId;
    } else if (action.type === "SELECT_REWARD") {
      kind = "reward";
      try {
        const skill = getSkillDefinition(action.skillId);
        title = `Recompensa: ${skill.shortName}`;
        detail = skill.description;
        tags = ["recompensa", skill.rarity, skill.branch];

        this.registry.pushPlayerNotice(
          localPlayerId,
          `${displayName.toUpperCase()} ESCOLHEU`,
          skill.shortName,
          "info",
          1600
        );
      } catch {
        title = `Recompensa: ${action.skillId}`;
        detail = "Escolha de recompensa";
        tags = ["recompensa"];
      }
    } else if (action.type === "SET_READY") {
      kind = "ready";
      title = "Pronto";
      detail = `${displayName} pronto para próxima onda`;
      tags = ["pronto", "onda"];
    } else {
      return;
    }

    state.aiPartner.active = true;
    state.aiPartner.decisionsLogged += 1;
    state.aiPartner.lastDecision = {
      kind,
      title,
      detail,
      confidence: Math.round(confidence * 100) / 100,
      score: Math.round(score * 10) / 10,
      towerId,
      tags: [...new Set(tags)].slice(0, 5),
      ttlMs: 3600
    };

    this.telemetry.record("ai-decision", state, action);
  }
}
