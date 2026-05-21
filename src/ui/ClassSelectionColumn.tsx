import type { CSSProperties } from "react";
import { gameUiBridge } from "../game/bridge/RewardBridge";
import { playerClassDefinitions } from "../game/data/playerClasses";
import type { PlayerId } from "../game/models/types";
import { getPlayerLabel } from "../game/utils/players";

const playerCopy: Partial<Record<
  PlayerId,
  { label: string; accentClass: string; keys: string; confirm: string }
>> = {
  p1: {
    label: "P1",
    accentClass: "p1",
    keys: "A/D ou Q/E",
    confirm: "Space"
  },
  p2: {
    label: "P2",
    accentClass: "p2",
    keys: "Setas ou PgUp/PgDn",
    confirm: "Enter"
  }
};

export const ClassSelectionColumn = ({ playerId }: { playerId: PlayerId }) => {
  const state = gameUiBridge.getState();
  const selection = state.classSelection?.choices[playerId];
  const copy = playerCopy[playerId] ?? {
    label: getPlayerLabel(playerId),
    accentClass: "p1",
    keys: "A/D ou Q/E",
    confirm: "Space"
  };

  if (!selection) {
    return null;
  }

  return (
    <section className={`class-column class-column-${copy.accentClass}`}>
      <div className="class-column-head">
        <div>
          <h2>{copy.label}</h2>
          <p>
            Trocar {copy.keys} · Confirmar {copy.confirm}
          </p>
        </div>
        <span className={selection.confirmed ? "class-status class-status-done" : "class-status"}>
          {selection.confirmed ? "Pronto" : "Escolhendo"}
        </span>
      </div>

      <div className="class-options">
        {playerClassDefinitions.map((playerClass, index) => {
          const selected = selection.selectedClassIndex === index;

          return (
            <button
              key={playerClass.id}
              className={`class-option${selected ? " class-option-selected" : ""}`}
              style={
                {
                  "--class-accent": `#${playerClass.accent.toString(16).padStart(6, "0")}`,
                  "--class-secondary": `#${playerClass.secondaryAccent
                    .toString(16)
                    .padStart(6, "0")}`
                } as CSSProperties
              }
              type="button"
              disabled={selection.confirmed}
              onClick={() => gameUiBridge.selectClass(playerId, playerClass.id)}
            >
              <span className="class-option-top">
                <span className={`class-sigil class-sigil-${playerClass.pattern}`} aria-hidden="true" />
                <span className="class-name">{playerClass.name}</span>
                <span className="class-short">{playerClass.shortName}</span>
              </span>
              <span className="class-motif">{playerClass.visualMotif}</span>
              <span className="class-description">{playerClass.description}</span>
              <span className="class-note">{playerClass.note}</span>
              <span className="class-stats">
                <span>Alc {formatSigned(playerClass.rangeBonus)}</span>
                <span>Custo {formatPercent(playerClass.costMultiplier)}</span>
                <span>Dano {formatPercent(playerClass.damageMultiplier)}</span>
                <span>Cred {formatPercent(playerClass.rewardMultiplier)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="class-confirm"
        type="button"
        disabled={selection.confirmed}
        onClick={() => gameUiBridge.confirmClass(playerId)}
      >
        {selection.confirmed ? "Classe confirmada" : `Confirmar ${copy.confirm}`}
      </button>
    </section>
  );
};

const formatSigned = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

const formatPercent = (multiplier: number): string => {
  const percent = Math.round((multiplier - 1) * 100);

  if (percent === 0) {
    return "0%";
  }

  return percent > 0 ? `+${percent}%` : `${percent}%`;
};
