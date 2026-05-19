import { useEffect, useState } from "react";
import { gameUiBridge } from "../game/bridge/RewardBridge";
import { PauseOverlay } from "./PauseOverlay";
import { RewardColumn } from "./RewardColumn";
import { RunSummaryOverlay } from "./RunSummaryOverlay";

export const GameOverlayApp = () => {
  const [, setTick] = useState(0);

  useEffect(() => gameUiBridge.subscribe(() => setTick((tick) => tick + 1)), []);

  const state = gameUiBridge.getState();
  const rewardSelection = state.rewardSelection;

  if (state.phase === "class-selection") {
    return null;
  }

  if (state.phase === "paused") {
    return <PauseOverlay settings={state.settings} />;
  }

  if ((state.phase === "victory" || state.phase === "defeat") && state.runSummary) {
    return <RunSummaryOverlay summary={state.runSummary} />;
  }

  if (state.phase !== "reward-selection" || !rewardSelection) {
    return null;
  }

  return (
    <>
      <div
        className="overlay-shell reward-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Recompensas pós-boss"
      >
        <section className="overlay-panel reward-panel">
          <header className="overlay-header reward-header">
            <div>
              <p className="overlay-kicker reward-kicker">Boss Contido</p>
              <h1>Escolha a evolução da run</h1>
            </div>
            <p className="overlay-meta reward-meta">
              Ambos escolhem 1 habilidade. Auto em {Math.ceil(rewardSelection.autoSelectInMs / 1000)}s.
            </p>
          </header>

          <div className="reward-columns">
            <RewardColumn playerId="p1" />
            <RewardColumn playerId="p2" />
          </div>
        </section>
      </div>
    </>
  );
};
