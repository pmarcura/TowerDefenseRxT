import { gameUiBridge } from "../game/bridge/RewardBridge";
import { getPlayerClassDefinition } from "../game/data/playerClasses";
import type { RunStats } from "../game/models/types";
import { getPlayerLabel } from "../game/utils/players";

type RunSummaryOverlayProps = {
  summary: RunStats;
};

export const RunSummaryOverlay = ({ summary }: RunSummaryOverlayProps) => (
  <div className="overlay-shell summary-shell" role="dialog" aria-modal="true" aria-label="Resumo da run">
    <section className="overlay-panel summary-panel">
      <header className="overlay-header">
        <div>
          <p className="overlay-kicker">{summary.result === "victory" ? "Vitória" : "Derrota"}</p>
          <h1>{summary.result === "victory" ? "Aegis estabilizada" : "Base rompida"}</h1>
        </div>
        <p className="overlay-meta">
          Waves {summary.wavesCleared}/10 · Base {summary.baseHpRemaining} HP · {formatTime(summary.elapsedMs)}
        </p>
      </header>

      <div className="summary-columns">
        {(Object.keys(summary.playerClasses) as Array<keyof typeof summary.playerClasses>).map((playerId) => {
          const playerClass = getPlayerClassDefinition(summary.playerClasses[playerId]);
          const stats = summary.combatStats[playerId];
          const towerCount = Object.values(summary.towerCounts[playerId]).reduce(
            (total, count) => total + count,
            0
          );

          return (
            <section key={playerId} className={`summary-player summary-${playerId}`}>
              <h2>{getPlayerLabel(playerId)} {playerClass.shortName}</h2>
              <dl>
                <dt>Dano total</dt>
                <dd>{Math.round(stats.totalDamageDealt)}</dd>
                <dt>Kills</dt>
                <dd>{stats.kills}</dd>
                <dt>Torres construídas</dt>
                <dd>{towerCount}</dd>
              </dl>
            </section>
          );
        })}
      </div>

      <button className="summary-restart" type="button" onClick={() => gameUiBridge.restartRun()}>
        Jogar novamente
      </button>
    </section>
  </div>
);

const formatTime = (elapsedMs: number): string => {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
