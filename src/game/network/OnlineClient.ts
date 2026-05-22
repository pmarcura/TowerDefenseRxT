import type { GameAction } from "../actions/types";
import type { PlayerId } from "../models/types";
import {
  DEFAULT_MULTIPLAYER_URL,
  DEFAULT_MULTIPLAYER_PORT,
  type OnlineClientMessage,
  type OnlineClientState,
  type OnlineRoomState,
  type OnlineServerMessage
} from "./protocol";

type Listener = () => void;
type GameActionListener = (action: GameAction) => void;
type RoomStartedListener = (room: OnlineRoomState) => void;

const getConfiguredServerUrl = (): string => {
  const envUrl = (import.meta as ImportMeta & { env?: { VITE_MULTIPLAYER_URL?: string } }).env
    ?.VITE_MULTIPLAYER_URL;

  if (typeof envUrl === "string" && envUrl.length > 0) {
    return envUrl;
  }

  if (typeof window === "undefined") {
    return DEFAULT_MULTIPLAYER_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const hostname = window.location.hostname || "127.0.0.1";

  return `${protocol}://${hostname}:${DEFAULT_MULTIPLAYER_PORT}`;
};

class OnlineClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly gameActionListeners = new Set<GameActionListener>();
  private readonly roomStartedListeners = new Set<RoomStartedListener>();
  private reconnectPromise: Promise<void> | null = null;
  private state: OnlineClientState = {
    status: "idle",
    serverUrl: getConfiguredServerUrl(),
    clientId: null,
    localPlayerId: null,
    room: null,
    error: null
  };

  getState(): OnlineClientState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeGameAction(listener: GameActionListener): () => void {
    this.gameActionListeners.add(listener);

    return () => {
      this.gameActionListeners.delete(listener);
    };
  }

  subscribeRoomStarted(listener: RoomStartedListener): () => void {
    this.roomStartedListeners.add(listener);

    return () => {
      this.roomStartedListeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.setState({ status: "connecting", error: null });
    this.reconnectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(this.state.serverUrl);
      this.socket = socket;

      socket.addEventListener("open", () => {
        this.setState({ status: "connected", error: null });
        this.reconnectPromise = null;
        resolve();
      });

      socket.addEventListener("message", (event) => {
        this.handleMessage(event.data);
      });

      socket.addEventListener("error", () => {
        const error = `Nao conectou em ${this.state.serverUrl}. Rode npm run server.`;
        this.setState({ status: "error", error });
        this.reconnectPromise = null;
        reject(new Error(error));
      });

      socket.addEventListener("close", () => {
        this.socket = null;
        this.reconnectPromise = null;
        this.setState({
          status: "disconnected",
          room: null,
          localPlayerId: null,
          error: this.state.error
        });
      });
    });

    return this.reconnectPromise;
  }

  async createRoom(displayName: string, aiFill: boolean): Promise<void> {
    await this.connect();
    this.send({ type: "create-room", displayName, aiFill });
  }

  async joinRoom(roomCode: string, displayName: string): Promise<void> {
    await this.connect();
    this.send({ type: "join-room", roomCode, displayName });
  }

  leaveRoom(): void {
    this.send({ type: "leave-room" });
    this.setState({ room: null, localPlayerId: null, error: null });
  }

  selectClass(classId: string): void {
    this.send({ type: "select-class", classId });
  }

  setReady(ready: boolean): void {
    this.send({ type: "set-ready", ready });
  }

  startRoom(): void {
    this.send({ type: "start-room" });
  }

  addBot(seatId?: string): void {
    this.send({ type: "add-bot", seatId });
  }

  fillBots(): void {
    this.send({ type: "fill-bots" });
  }

  removeBot(seatId: string): void {
    this.send({ type: "remove-bot", seatId });
  }

  clearBots(): void {
    this.send({ type: "clear-bots" });
  }

  sendGameAction(action: GameAction): void {
    if (!this.isOnlineRunActive()) {
      return;
    }

    this.send({ type: "game-action", action });
  }

  isOnlineRunActive(): boolean {
    return (
      this.state.status === "connected" &&
      this.state.room?.started === true &&
      Boolean(this.state.localPlayerId)
    );
  }

  private send(message: OnlineClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.setState({ status: "error", error: `Sem conexao com ${this.state.serverUrl}` });
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private handleMessage(raw: unknown): void {
    let message: OnlineServerMessage;

    try {
      message = JSON.parse(String(raw)) as OnlineServerMessage;
    } catch {
      this.setState({ error: "Mensagem invalida do servidor" });
      return;
    }

    if (message.type === "connected") {
      this.setState({ clientId: message.clientId, status: "connected", error: null });
      return;
    }

    if (message.type === "room-state" || message.type === "room-started") {
      this.applyRoom(message.room);

      if (message.type === "room-started") {
        for (const listener of this.roomStartedListeners) {
          listener(message.room);
        }
      }

      return;
    }

    if (message.type === "game-action") {
      for (const listener of this.gameActionListeners) {
        listener(message.action);
      }
      return;
    }

    if (message.type === "error") {
      this.setState({ error: message.message });
    }
  }

  private applyRoom(room: OnlineRoomState): void {
    const localSeat = room.seats.find((seat) => seat.clientId === this.state.clientId);

    this.setState({
      room,
      localPlayerId: (localSeat?.id as PlayerId | undefined) ?? null,
      error: null
    });
  }

  private setState(partial: Partial<OnlineClientState>): void {
    this.state = {
      ...this.state,
      ...partial
    };

    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const onlineClient = new OnlineClient();
