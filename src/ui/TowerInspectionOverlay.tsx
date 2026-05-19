import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gameUiBridge } from "../game/bridge/RewardBridge";
import {
  getDominantTowerBranch,
  towerAutoBuildDefinitions,
  towerBranchDefinitions
} from "../game/data/towerBranches";
import { getTowerDefinition } from "../game/data/towers";
import type { GameState, TowerUpgradeBranchId } from "../game/models/types";
import { calculateTowerRuntimeStats } from "../game/utils/towerStats";

type TowerInspectionOverlayProps = {
  state: GameState;
};

export const TowerInspectionOverlay = ({ state }: TowerInspectionOverlayProps) => {
  const inspection = state.towerInspection;
  const holdTimerRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);
  const [holdTarget, setHoldTarget] = useState<string | null>(null);

  const cancelHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    setHoldTarget(null);
  };

  useEffect(() => () => cancelHold(), []);

  if (!inspection) {
    return null;
  }

  const tower = state.towers.find((candidate) => candidate.id === inspection.towerId);

  if (!tower) {
    return null;
  }

  const definition = getTowerDefinition(tower.typeId);
  const runtimeStats = calculateTowerRuntimeStats(state, tower);
  const dominantBranch = getDominantTowerBranch(tower.branchRanks);
  const selectedBranch =
    towerBranchDefinitions[inspection.selectedOptionIndex] ?? towerBranchDefinitions[0];
  const selectedRank = tower.branchRanks[selectedBranch.id];
  const canEdit = tower.ownerId === inspection.playerId;
  const canUpgrade =
    canEdit &&
    tower.skillPoints > 0 &&
    selectedRank < selectedBranch.maxRank;
  const accentColor = `#${(dominantBranch?.color ?? selectedBranch.color ?? definition.color)
    .toString(16)
    .padStart(6, "0")}`;
  const controls =
    inspection.playerId === "p1"
      ? "WASD/Q/E navegam · SPACE aplica · R auto · F fecha"
      : "Setas/PgUp/PgDn navegam · ENTER aplica · Backspace auto · Shift fecha";
  const upgradeStatus =
    selectedRank >= selectedBranch.maxRank
      ? "Linha completa"
      : tower.skillPoints <= 0
        ? "Ganhe XP com abates e assistencias"
        : "Usa 1 ponto da torre";
  const xpProgress =
    tower.xpToNext > 0 ? Math.min(100, (tower.xp / tower.xpToNext) * 100) : 100;

  const beginHold = (target: string, action: () => void) => {
    cancelHold();
    holdTriggeredRef.current = false;
    setHoldTarget(target);
    holdTimerRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true;
      holdTimerRef.current = null;
      setHoldTarget(null);
      action();
    }, 520);
  };

  const clickWithHoldGuard = (action: () => void) => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }

    action();
  };

  const selectBranch = (branchId: TowerUpgradeBranchId) => {
    const optionIndex = towerBranchDefinitions.findIndex((branch) => branch.id === branchId);

    if (optionIndex >= 0) {
      gameUiBridge.setTowerInspectionOption(inspection.playerId, optionIndex);
    }
  };

  const applySelectedUpgrade = () => {
    gameUiBridge.activateTowerInspectionOption(inspection.playerId);
  };

  return (
    <div
      className="tower-radial-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Menu radial de torre"
    >
      <section
        className="tower-radial-panel"
        style={{ "--tower-accent": accentColor } as CSSProperties}
      >
        <header className="tower-radial-topbar">
          <div>
            <span>{tower.ownerId.toUpperCase()} · {definition.role}</span>
            <strong>{definition.name}</strong>
          </div>
          <button type="button" onClick={() => gameUiBridge.closeTowerInspection()}>
            Fechar
          </button>
        </header>

        <div className="tower-radial-stage">
          <div className="tower-radial-orbit" aria-label="Linhas de evolução">
            {towerBranchDefinitions.map((branch, index) => {
              const angle = -90 + index * (360 / towerBranchDefinitions.length);
              const radians = (angle * Math.PI) / 180;
              const selected = branch.id === selectedBranch.id;
              const rank = tower.branchRanks[branch.id];
              const branchStyle = {
                "--x": `${Math.cos(radians) * 188}px`,
                "--y": `${Math.sin(radians) * 150}px`,
                "--branch-color": `#${branch.color.toString(16).padStart(6, "0")}`
              } as CSSProperties;

              return (
                <button
                  key={branch.id}
                  type="button"
                  className={`tower-radial-option${selected ? " selected" : ""}`}
                  style={branchStyle}
                  onClick={() => selectBranch(branch.id)}
                >
                  <span>{branch.shortName}</span>
                  <strong>{rank}/{branch.maxRank}</strong>
                  <small>{rank >= branch.maxRank ? "MAX" : "1 pt"}</small>
                </button>
              );
            })}
          </div>

          <div className="tower-radial-core">
            <span className="tower-radial-eyebrow">LV {tower.level} · {tower.skillPoints} pts</span>
            <strong>{definition.shortName}</strong>
            <div className="tower-radial-xp">
              <span style={{ width: `${xpProgress}%` }} />
            </div>
            <dl>
              <div>
                <dt>{runtimeStats.effect === "income" ? "Renda" : "DPS"}</dt>
                <dd>{runtimeStats.effect === "income" ? runtimeStats.effectDetails[0] : runtimeStats.dps.toFixed(1)}</dd>
              </div>
              <div>
                <dt>{runtimeStats.effect === "income" ? "Quando" : "Alcance"}</dt>
                <dd>{runtimeStats.effect === "income" ? "Wave" : Math.round(runtimeStats.range)}</dd>
              </div>
              <div>
                <dt>{runtimeStats.effect === "income" ? "Tempo" : "Recarga"}</dt>
                <dd>{runtimeStats.effect === "income" ? runtimeStats.effectDetails[1] : `${(runtimeStats.cooldownMs / 1000).toFixed(2)}s`}</dd>
              </div>
              <div>
                <dt>Abates</dt>
                <dd>{tower.kills}</dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="tower-radial-details">
          <div className="tower-selected-branch">
            <span>{selectedBranch.role}</span>
            <strong>{selectedBranch.name}</strong>
            <p>{selectedBranch.description}</p>
            <small>{selectedBranch.rankSummary}</small>
          </div>

          <div className="tower-upgrade-command">
            <div>
              <span>{upgradeStatus}</span>
              <strong>{canUpgrade ? "Upgrade pronto" : "Upgrade bloqueado"}</strong>
            </div>
            <button
              type="button"
              className={holdTarget === "upgrade" ? "holding" : ""}
              disabled={!canEdit}
              onPointerDown={() => beginHold("upgrade", applySelectedUpgrade)}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onClick={() => clickWithHoldGuard(applySelectedUpgrade)}
            >
              Aplicar
            </button>
          </div>
        </section>

        <footer className="tower-radial-footer">
          <div className="tower-auto-strip">
            <button
              type="button"
              className={tower.autoUpgradeEnabled ? "enabled" : ""}
              onClick={() => gameUiBridge.toggleTowerAutoUpgrade(inspection.playerId, tower.id)}
            >
              {tower.autoUpgradeEnabled ? "Auto ON" : "Auto OFF"}
            </button>
            {towerAutoBuildDefinitions.map((build) => (
              <button
                key={build.id}
                type="button"
                className={build.id === tower.autoBuildId ? "selected" : ""}
                onClick={() =>
                  gameUiBridge.setTowerAutoBuild(inspection.playerId, tower.id, build.id)
                }
              >
                {build.name}
              </button>
            ))}
          </div>
          <span>{controls}</span>
        </footer>
      </section>
    </div>
  );
};
