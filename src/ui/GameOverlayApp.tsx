import { useEffect, useMemo, useState } from "react";
import { gameUiBridge } from "../game/bridge/RewardBridge";
import type { GameState, PlayerId } from "../game/models/types";
import { onlineClient } from "../game/network/OnlineClient";
import { createSessionFromOnlineRoom } from "../game/network/onlineSession";
import type { OnlineRoomState } from "../game/network/protocol";
import { getLocalPlayerIds, getPlayablePlayerIds } from "../game/utils/players";
import { ClassSelectionColumn } from "./ClassSelectionColumn";
import { OnlineLobbyOverlay } from "./OnlineLobbyOverlay";
import { PauseOverlay } from "./PauseOverlay";
import { RewardColumn } from "./RewardColumn";
import { RunSummaryOverlay } from "./RunSummaryOverlay";
import { TowerInspectionOverlay } from "./TowerInspectionOverlay";

export const GameOverlayApp = () => {
  const [state, setState] = useState<GameState>(() => gameUiBridge.getState());
  const [lobbyOpen, setLobbyOpen] = useState(false);

  useEffect(() => gameUiBridge.subscribe(() => setState(gameUiBridge.getState())), []);

  useEffect(() => {
    const openLobby = () => setLobbyOpen(true);
    const startOnlineRun = (event: Event) => {
      const room = (event as CustomEvent<OnlineRoomState>).detail;
      const localPlayerId = onlineClient.getState().localPlayerId;
      const session = createSessionFromOnlineRoom(room, localPlayerId);

      setLobbyOpen(false);
      window.dispatchEvent(new CustomEvent("aegis:start-online-run", { detail: session }));
    };

    window.addEventListener("aegis:open-online-lobby", openLobby);
    window.addEventListener("aegis:online-room-started", startOnlineRun);

    return () => {
      window.removeEventListener("aegis:open-online-lobby", openLobby);
      window.removeEventListener("aegis:online-room-started", startOnlineRun);
    };
  }, []);

  useEffect(() => onlineClient.subscribeGameAction((action) => gameUiBridge.applyRemoteGameAction(action)), []);

  const localPlayerIds = useMemo(() => getLocalPlayerIds(state.session), [state.session]);
  const activePlayerIds = useMemo(() => getPlayablePlayerIds(state), [state]);

  return (
    <>
      {lobbyOpen ? <OnlineLobbyOverlay onClose={() => setLobbyOpen(false)} /> : null}
      <ClassSelectionOverlay state={state} localPlayerIds={localPlayerIds} activePlayerIds={activePlayerIds} />
      <RewardSelectionOverlay state={state} localPlayerIds={localPlayerIds} activePlayerIds={activePlayerIds} />
      {state.phase === "paused" ? <PauseOverlay settings={state.settings} /> : null}
      <TowerInspectionOverlay state={state} />
      {state.runSummary ? <RunSummaryOverlay summary={state.runSummary} /> : null}
    </>
  );
};

const ClassSelectionOverlay = ({
  state,
  localPlayerIds,
  activePlayerIds
}: {
  state: GameState;
  localPlayerIds: PlayerId[];
  activePlayerIds: PlayerId[];
}) => {
  if (state.phase !== "class-selection") {
    return null;
  }

  const visiblePlayerIds = localPlayerIds.length > 0 ? localPlayerIds : activePlayerIds;

  return (
    <div className="overlay-shell class-shell" role="dialog" aria-modal="true" aria-label="Selecao de classes">
      <section className="overlay-panel class-panel">
        <header className="overlay-header">
          <div>
            <p className="overlay-kicker">Preparacao</p>
            <h1>Escolha sua classe</h1>
          </div>
          <p className="overlay-meta">Cada navegador controla o proprio assento; o time inicia quando todos confirmam.</p>
        </header>
        <div className="class-columns dynamic-columns">
          {visiblePlayerIds.map((playerId) => (
            <ClassSelectionColumn key={playerId} playerId={playerId} />
          ))}
        </div>
      </section>
    </div>
  );
};

const RewardSelectionOverlay = ({
  state,
  localPlayerIds,
  activePlayerIds
}: {
  state: GameState;
  localPlayerIds: PlayerId[];
  activePlayerIds: PlayerId[];
}) => {
  if (state.phase !== "reward-selection" || !state.rewardSelection) {
    return null;
  }

  const visiblePlayerIds = localPlayerIds.length > 0 ? localPlayerIds : activePlayerIds;

  return (
    <div className="overlay-shell reward-shell" role="dialog" aria-modal="true" aria-label="Recompensas">
      <section className="overlay-panel class-panel">
        <header className="overlay-header">
          <div>
            <p className="overlay-kicker">Boss vencido</p>
            <h1>Recompensa do time</h1>
          </div>
          <p className="overlay-meta">
            Auto em {(state.rewardSelection.autoSelectInMs / 1000).toFixed(0)}s para quem nao escolher.
          </p>
        </header>
        <div className="reward-columns dynamic-columns">
          {visiblePlayerIds.map((playerId) => (
            <RewardColumn key={playerId} playerId={playerId} />
          ))}
        </div>
      </section>
    </div>
  );
};
