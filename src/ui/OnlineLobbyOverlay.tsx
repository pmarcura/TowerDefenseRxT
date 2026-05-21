import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { playerClassDefinitions } from "../game/data/playerClasses";
import { playerColor } from "../game/design/gameDesignSystem";
import { onlineClient } from "../game/network/OnlineClient";
import type { OnlineClientState, OnlineRoomSeat } from "../game/network/protocol";

const PLAYER_NAME_KEY = "aegis-online-player-name";
const DEFAULT_CLASS_ID = playerClassDefinitions[0]?.id ?? "christian-vitrail-custodian";

type OnlineLobbyOverlayProps = {
  onClose: () => void;
};

export const OnlineLobbyOverlay = ({ onClose }: OnlineLobbyOverlayProps) => {
  const [clientState, setClientState] = useState<OnlineClientState>(onlineClient.getState());
  const [displayName, setDisplayName] = useState(() => loadPlayerName());
  const [roomCode, setRoomCode] = useState("");
  const [aiFill, setAiFill] = useState(true);
  const [busy, setBusy] = useState(false);
  const room = clientState.room;
  const localSeat = useMemo(
    () => room?.seats.find((seat) => seat.clientId === clientState.clientId) ?? null,
    [clientState.clientId, room]
  );
  const selectedClassId = localSeat?.classId ?? DEFAULT_CLASS_ID;
  const isHost = Boolean(clientState.clientId && room?.hostClientId === clientState.clientId);
  const canStart = room ? isHost && (room.connectedCount >= room.minPlayers || room.aiFill) : false;

  useEffect(() => onlineClient.subscribe(() => setClientState(onlineClient.getState())), []);

  const rememberName = (value: string) => {
    setDisplayName(value);
    localStorage.setItem(PLAYER_NAME_KEY, value);
  };

  const createRoom = async () => {
    setBusy(true);
    try {
      await onlineClient.createRoom(displayName, aiFill);
    } catch {
      // OnlineClient already exposes the connection error in its reactive state.
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    setBusy(true);
    try {
      await onlineClient.joinRoom(roomCode, displayName);
    } catch {
      // OnlineClient already exposes the connection error in its reactive state.
    } finally {
      setBusy(false);
    }
  };

  const closeLobby = () => {
    if (room && !room.started) {
      onlineClient.leaveRoom();
    }

    onClose();
  };

  return (
    <div className="overlay-shell online-lobby-shell" role="dialog" aria-modal="true" aria-label="Lobby online">
      <section className="overlay-panel online-lobby-panel">
        <header className="overlay-header online-lobby-header">
          <div>
            <p className="overlay-kicker">Multiplayer online</p>
            <h1>{room ? `Sala ${room.code}` : "Criar ou entrar em sala"}</h1>
          </div>
          <div className="online-lobby-status">
            <span>{getStatusLabel(clientState.status)}</span>
            <strong>{clientState.serverUrl.replace("ws://", "")}</strong>
          </div>
        </header>

        {room ? (
          <LobbyRoom
            roomSeats={room.seats}
            connectedCount={room.connectedCount}
            readyCount={room.readyCount}
            isHost={isHost}
            localSeat={localSeat}
            selectedClassId={selectedClassId}
            canStart={canStart}
          />
        ) : (
          <div className="online-entry-grid">
            <section className="online-entry-card">
              <h2>Identidade</h2>
              <label>
                <span>Nome no lobby</span>
                <input
                  maxLength={18}
                  value={displayName}
                  onChange={(event) => rememberName(event.currentTarget.value)}
                />
              </label>
              <label className="online-toggle-row">
                <input
                  type="checkbox"
                  checked={aiFill}
                  onChange={(event) => setAiFill(event.currentTarget.checked)}
                />
                <span>Preencher com IA se faltar o segundo jogador</span>
              </label>
            </section>

            <section className="online-entry-card">
              <h2>Criar lobby</h2>
              <p>Gera um código de 5 caracteres para até 12 assentos.</p>
              <button type="button" disabled={busy} onClick={createRoom}>
                Criar sala
              </button>
            </section>

            <section className="online-entry-card">
              <h2>Entrar</h2>
              <label>
                <span>Código</span>
                <input
                  maxLength={5}
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.currentTarget.value.toUpperCase())}
                />
              </label>
              <button type="button" disabled={busy || roomCode.length < 5} onClick={joinRoom}>
                Entrar na sala
              </button>
            </section>
          </div>
        )}

        {clientState.error ? <p className="online-error">{clientState.error}</p> : null}

        <footer className="online-lobby-actions">
          <button type="button" onClick={closeLobby}>
            Fechar
          </button>
          {room ? (
            <>
              <button type="button" onClick={() => onlineClient.leaveRoom()}>
                Sair da sala
              </button>
              <button type="button" disabled={!localSeat} onClick={() => onlineClient.setReady(!localSeat?.ready)}>
                {localSeat?.ready ? "Cancelar pronto" : "Pronto"}
              </button>
              {isHost && !room.started ? (
                <button type="button" onClick={() => onlineClient.addBot()}>
                  Adicionar Bot
                </button>
              ) : null}
              <button type="button" disabled={!canStart} onClick={() => onlineClient.startRoom()}>
                Iniciar
              </button>
            </>
          ) : null}
        </footer>
      </section>
    </div>
  );
};

const LobbyRoom = ({
  roomSeats,
  connectedCount,
  readyCount,
  isHost,
  localSeat,
  selectedClassId,
  canStart
}: {
  roomSeats: OnlineRoomSeat[];
  connectedCount: number;
  readyCount: number;
  isHost: boolean;
  localSeat: OnlineRoomSeat | null;
  selectedClassId: string;
  canStart: boolean;
}) => (
  <div className="online-room-layout">
    <section className="online-class-picker">
      <header>
        <span>{localSeat ? `${localSeat.id.toUpperCase()} · ${localSeat.displayName}` : "Sem assento"}</span>
        <strong>Classe do jogador local</strong>
      </header>
      <div className="online-class-grid">
        {playerClassDefinitions.map((playerClass) => (
          <button
            key={playerClass.id}
            type="button"
            className={selectedClassId === playerClass.id ? "selected" : ""}
            style={
              {
                "--class-accent": `#${playerClass.accent.toString(16).padStart(6, "0")}`
              } as CSSProperties
            }
            disabled={!localSeat || localSeat.ready}
            onClick={() => onlineClient.selectClass(playerClass.id)}
          >
            <span>{playerClass.shortName}</span>
            <strong>{playerClass.name}</strong>
            <small>{playerClass.specialty}</small>
          </button>
        ))}
      </div>
    </section>

    <section className="online-room-roster">
      <header>
        <div>
          <span>{connectedCount}/12 conectados</span>
          <strong>{readyCount} prontos</strong>
        </div>
        <p>{isHost ? (canStart ? "Host pode iniciar" : "Aguardando mais jogadores") : "Aguardando host"}</p>
      </header>
      <div className="online-seat-grid">
        {roomSeats.map((seat) => (
          <LobbySeat key={seat.id} seat={seat} isHost={isHost} />
        ))}
      </div>
    </section>
  </div>
);

const LobbySeat = ({ seat, isHost }: { seat: OnlineRoomSeat; isHost: boolean }) => {
  const playerClass = playerClassDefinitions.find((definition) => definition.id === seat.classId);
  const accent = `#${playerColor(seat.id).toString(16).padStart(6, "0")}`;
  const isEmpty = seat.kind === "empty";
  const isBot = seat.kind === "ai-partner";

  return (
    <div
      className={[
        "online-seat",
        seat.connected ? "connected" : "empty",
        seat.ready ? "ready" : "",
        seat.isHost ? "host" : "",
        isBot ? "bot" : ""
      ].join(" ")}
      style={{ "--player-accent": accent } as CSSProperties}
    >
      <span>{seat.id.toUpperCase()}</span>
      <strong>{seat.connected ? seat.displayName : "Livre"}</strong>
      <small>{seat.connected ? playerClass?.shortName ?? "Classe" : "Aguardando"}</small>
      {isHost && isEmpty ? (
        <button
          type="button"
          className="online-seat-bot-btn"
          onClick={() => onlineClient.addBot(seat.id)}
        >
          Bot
        </button>
      ) : null}
      {isHost && isBot ? (
        <button
          type="button"
          className="online-seat-bot-btn"
          onClick={() => onlineClient.removeBot(seat.id)}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
};

const getStatusLabel = (status: OnlineClientState["status"]): string => {
  if (status === "connecting") {
    return "Conectando";
  }

  if (status === "connected") {
    return "Conectado";
  }

  if (status === "error") {
    return "Erro";
  }

  if (status === "disconnected") {
    return "Desconectado";
  }

  return "Pronto";
};

const loadPlayerName = (): string => {
  if (typeof localStorage === "undefined") {
    return "Jogador";
  }

  return localStorage.getItem(PLAYER_NAME_KEY) || "Jogador";
};
