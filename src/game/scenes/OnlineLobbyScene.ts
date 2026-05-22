import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { playerClassDefinitions } from "../data/playerClasses";
import { gameDesign, playerColor, toHexColor } from "../design/gameDesignSystem";
import { onlineClient } from "../network/OnlineClient";
import { createSessionFromOnlineRoom } from "../network/onlineSession";
import type { LobbyChat, OnlineClientState, OnlineRoomSeat, OnlineRoomState } from "../network/protocol";

type LobbyButton = {
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  onClick: () => void;
};

type LobbyFieldId = "displayName" | "roomCode" | "chat";

type LobbyField = {
  id: LobbyFieldId;
  x: number;
  y: number;
  width: number;
  height: number;
};

const PLAYER_NAME_KEY = "aegis-online-player-name";
const DEFAULT_CLASS_ID = playerClassDefinitions[0]?.id ?? "christian-vitrail-custodian";

export class OnlineLobbyScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly buttons: LobbyButton[] = [];
  private readonly fields: LobbyField[] = [];
  private usedTexts = 0;
  private displayName = loadPlayerName();
  private roomCode = "";
  private aiFill = true;
  private busy = false;
  private focusedField: LobbyFieldId = "displayName";
  private chatInput = "";
  private readonly chatMessages: LobbyChat[] = [];
  private unsubscribeRoomStarted?: () => void;
  private unsubscribeChat?: () => void;

  constructor() {
    super("OnlineLobbyScene");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.unsubscribeRoomStarted = onlineClient.subscribeRoomStarted((room) => {
      this.startOnlineRun(room);
    });
    this.unsubscribeChat = onlineClient.subscribeChat((msg) => {
      this.chatMessages.push(msg);
      if (this.chatMessages.length > 5) {
        this.chatMessages.shift();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeRoomStarted?.();
      this.unsubscribeRoomStarted = undefined;
      this.unsubscribeChat?.();
      this.unsubscribeChat = undefined;
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  update(): void {
    this.render();
  }

  private render(): void {
    const clientState = onlineClient.getState();
    const room = clientState.room;

    this.graphics.clear();
    this.usedTexts = 0;
    this.buttons.length = 0;
    this.fields.length = 0;

    this.drawBackdrop();
    this.drawHeader(clientState);

    if (room) {
      this.drawRoom(clientState, room);
    } else {
      this.drawEntry(clientState);
    }

    if (clientState.error) {
      this.drawError(clientState.error);
    }

    this.hideUnusedText();
  }

  private drawBackdrop(): void {
    this.graphics.fillStyle(0x02040a, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.graphics.fillStyle(0x071827, 0.92);
    this.graphics.fillRoundedRect(32, 28, GAME_WIDTH - 64, GAME_HEIGHT - 56, 8);
    this.graphics.lineStyle(2, 0x42d8ff, 0.22);
    this.graphics.strokeRoundedRect(32, 28, GAME_WIDTH - 64, GAME_HEIGHT - 56, 8);

    for (let x = 76; x <= GAME_WIDTH - 76; x += 48) {
      this.graphics.lineStyle(1, 0x163040, 0.11);
      this.graphics.lineBetween(x, 76, x, GAME_HEIGHT - 76);
    }

    for (let y = 88; y <= GAME_HEIGHT - 82; y += 48) {
      this.graphics.lineStyle(1, 0x163040, 0.1);
      this.graphics.lineBetween(76, y, GAME_WIDTH - 76, y);
    }
  }

  private drawHeader(clientState: OnlineClientState): void {
    this.text(64, 52, "MULTIPLAYER ONLINE", 12, "#83f3ff", "900");
    this.text(64, 76, clientState.room ? `Sala ${clientState.room.code}` : "Criar ou entrar em sala", 30, "#edf7ff", "900");
    this.text(
      64,
      116,
      clientState.room
        ? "Escolha classe, marque pronto e inicie quando a sala estiver completa."
        : "Use teclado para preencher os campos. Tab alterna entre nome e codigo.",
      13,
      "#a9bac6",
      "700"
    );

    this.drawStatusChip(GAME_WIDTH - 314, 58, getStatusLabel(clientState.status), clientState.serverUrl.replace("ws://", ""));
  }

  private drawEntry(clientState: OnlineClientState): void {
    const cardY = 188;

    this.panel(64, cardY, 352, 302, 0x83f3ff, 0.86);
    this.text(88, cardY + 24, "Identidade", 18, "#edf7ff", "900");
    this.text(88, cardY + 52, "Nome no lobby", 11, "#8ea4b3", "800");
    this.drawField("displayName", 88, cardY + 74, 280, 42, this.displayName, "Jogador");
    this.drawToggle(88, cardY + 144, "Preencher com IA", this.aiFill, () => {
      this.aiFill = !this.aiFill;
    });
    this.text(
      88,
      cardY + 188,
      "Se faltar o segundo humano, o host pode iniciar a sala com parceiro IA.",
      12,
      "#b9c9d8",
      "700",
      0,
      266
    );

    this.panel(452, cardY, 332, 302, 0xffd36d, 0.86);
    this.text(476, cardY + 24, "Criar lobby", 18, "#edf7ff", "900");
    this.text(476, cardY + 54, "Gera codigo de 5 caracteres para ate 12 assentos.", 12, "#b9c9d8", "700", 0, 262);
    this.drawButton(476, cardY + 206, 246, 44, "Criar sala", "host da partida", 0xffd36d, () => {
      void this.createRoom();
    }, !this.busy && this.displayName.trim().length > 0);

    this.panel(820, cardY, 396, 302, 0xb4ff72, 0.86);
    this.text(844, cardY + 24, "Entrar", 18, "#edf7ff", "900");
    this.text(844, cardY + 52, "Codigo", 11, "#8ea4b3", "800");
    this.drawField("roomCode", 844, cardY + 74, 180, 42, this.roomCode, "ABCDE");
    this.text(844, cardY + 132, "Digite o codigo da sala enviado pelo host.", 12, "#b9c9d8", "700", 0, 278);
    this.drawButton(844, cardY + 206, 246, 44, "Entrar na sala", "usa seu nome atual", 0xb4ff72, () => {
      void this.joinRoom();
    }, !this.busy && this.roomCode.length >= 5 && this.displayName.trim().length > 0);

    this.drawFooterButton("Voltar ao menu", () => this.closeLobby(), true);

    if (this.busy) {
      this.text(GAME_WIDTH / 2, 548, "Conectando...", 13, "#ffe39d", "900", 0.5);
    } else if (clientState.status === "idle" || clientState.status === "disconnected") {
      this.text(GAME_WIDTH / 2, 548, `Servidor esperado em ${clientState.serverUrl.replace("ws://", "")}.`, 12, "#8ea4b3", "800", 0.5);
    }
  }

  private drawRoom(clientState: OnlineClientState, room: OnlineRoomState): void {
    const localSeat =
      room.seats.find((seat) => seat.clientId === clientState.clientId) ?? null;
    const isHost = Boolean(clientState.clientId && room.hostClientId === clientState.clientId);
    const selectedClassId = localSeat?.classId ?? DEFAULT_CLASS_ID;
    const activeSeats = room.seats.filter((seat) => seat.connected && seat.kind !== "empty");
    const canStart =
      isHost &&
      activeSeats.length >= room.minPlayers &&
      activeSeats.every((seat) => Boolean(seat.classId));

    this.panel(64, 166, 420, 430, 0x83f3ff, 0.88);
    this.text(88, 190, localSeat ? `${localSeat.id.toUpperCase()} · ${localSeat.displayName}` : "Sem assento", 11, "#83f3ff", "900");
    this.text(88, 212, "Classe do jogador local", 20, "#edf7ff", "900");
    this.drawClassPicker(88, 252, 360, selectedClassId, Boolean(localSeat && !localSeat.ready));

    this.panel(516, 166, 700, 430, 0xffd36d, 0.88);
    this.text(540, 190, `${room.humanCount} humanos · ${room.botCount} bots · ${room.activeCount}/${room.maxPlayers} ativos`, 11, "#ffd36d", "900");
    this.text(540, 212, `${room.readyCount}/${room.activeCount} prontos`, 20, "#edf7ff", "900");
    this.text(
      540,
      244,
      isHost ? (canStart ? "Host pode iniciar" : "Precisa de 2 assentos ativos com classe") : "Aguardando host",
      12,
      "#a9bac6",
      "800"
    );
    this.text(798, 244, `LAN: ${getCurrentAppUrl()}`, 10, "#8ea4b3", "800", 0, 380);
    this.drawRoster(room.seats, isHost);

    this.drawButton(64, 620, 128, 44, "Fechar", "menu", 0x8ea4b3, () => this.closeLobby(), true);
    this.drawButton(206, 620, 130, 44, "Sair", "sala", 0xff8db4, () => onlineClient.leaveRoom(), true);
    this.drawButton(
      350,
      620,
      130,
      44,
      localSeat?.ready ? "Cancelar pronto" : "Pronto",
      localSeat?.ready ? "editar" : "classe",
      0xb4ff72,
      () => onlineClient.setReady(!localSeat?.ready),
      Boolean(localSeat)
    );
    this.drawButton(494, 620, 156, 44, "Completar bots", "ate 12", 0x83f3ff, () => onlineClient.fillBots(), isHost && !room.started && room.activeCount < room.maxPlayers);
    this.drawButton(664, 620, 136, 44, "Remover bots", "limpar", 0xff8db4, () => onlineClient.clearBots(), isHost && !room.started && room.botCount > 0);
    this.drawButton(814, 620, 110, 44, "+1 bot", "host", 0x83f3ff, () => onlineClient.addBot(), isHost && !room.started && room.activeCount < room.maxPlayers);
    this.drawButton(938, 620, 136, 44, "Iniciar", "run", 0xffd36d, () => onlineClient.startRoom(), canStart);
    this.drawChat();
  }

  private drawChat(): void {
    const x = 516;
    const y = 510;
    const width = 700;
    const focused = (this.focusedField as string) === "chat";

    this.graphics.fillStyle(0x020712, 0.72);
    this.graphics.fillRoundedRect(x, y, width, 96, 8);
    this.graphics.lineStyle(focused ? 2 : 1, focused ? 0x83f3ff : 0x31556a, focused ? 0.7 : 0.3);
    this.graphics.strokeRoundedRect(x, y, width, 96, 8);

    this.chatMessages.forEach((msg, i) => {
      this.text(x + 12, y + 6 + i * 14, `${msg.fromDisplayName}: ${msg.text}`, 9, "#a9bac6", "700", 0, width - 24);
    });

    const inputY = y + 72;
    this.graphics.fillStyle(0x07131e, 0.9);
    this.graphics.fillRoundedRect(x + 8, inputY, width - 76, 20, 4);
    this.text(x + 14, inputY + 3, focused ? `${this.chatInput}_` : (this.chatInput || "Escreva e Enter..."), 9, focused ? "#edf7ff" : "#6f8492", "700", 0, width - 90);
    this.graphics.fillStyle(0x83f3ff, 0.18);
    this.graphics.fillRoundedRect(x + width - 64, inputY, 56, 20, 4);
    this.text(x + width - 36, inputY + 3, "CHAT", 8, "#83f3ff", "900", 0.5);
    this.registerButton(x + 8, inputY, width - 16, 20, () => {
      this.focusedField = "chat";
    }, true);
  }

  private drawClassPicker(
    x: number,
    y: number,
    width: number,
    selectedClassId: string,
    enabled: boolean
  ): void {
    const cardWidth = 170;
    const cardHeight = 58;
    const gap = 10;

    playerClassDefinitions.forEach((playerClass, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cardX = x + col * (cardWidth + gap);
      const cardY = y + row * (cardHeight + gap);
      const selected = selectedClassId === playerClass.id;
      const alpha = enabled ? 1 : 0.48;

      this.graphics.fillStyle(selected ? playerClass.accent : 0x020712, selected ? 0.22 : 0.68);
      this.graphics.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 8);
      this.graphics.lineStyle(selected ? 2 : 1, playerClass.accent, selected ? 0.9 : 0.34);
      this.graphics.strokeRoundedRect(cardX, cardY, cardWidth, cardHeight, 8);
      this.graphics.fillStyle(playerClass.accent, selected ? 0.24 : 0.1);
      this.graphics.fillCircle(cardX + 24, cardY + 29, 13);
      this.text(cardX + 46, cardY + 10, playerClass.shortName, 12, enabled ? "#edf7ff" : "#8ea4b3", "900");
      this.text(cardX + 46, cardY + 30, playerClass.specialty, 9, toHexColor(playerClass.secondaryAccent), "800", 0, cardWidth - 58).setAlpha(alpha);
      this.registerButton(cardX, cardY, cardWidth, cardHeight, () => onlineClient.selectClass(playerClass.id), enabled);
    });

    this.text(x, y + 290, enabled ? "Clique para mudar antes de marcar pronto." : "Classe travada enquanto pronto.", 11, "#8ea4b3", "800", 0, width);
  }

  private drawRoster(seats: readonly OnlineRoomSeat[], isHost: boolean): void {
    seats.forEach((seat, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 540 + col * 218;
      const y = 286 + row * 58;
      const width = 196;
      const height = 46;
      const isEmpty = seat.kind === "empty";
      const isBot = seat.kind === "ai-partner";
      const accent = playerColor(seat.id);
      const playerClass = playerClassDefinitions.find((definition) => definition.id === seat.classId);

      this.graphics.fillStyle(isEmpty ? 0x020712 : 0x07131e, isEmpty ? 0.5 : 0.82);
      this.graphics.fillRoundedRect(x, y, width, height, 7);
      this.graphics.lineStyle(seat.ready ? 2 : 1, seat.ready ? 0xb4ff72 : accent, seat.connected ? 0.68 : 0.24);
      this.graphics.strokeRoundedRect(x, y, width, height, 7);
      this.text(x + 12, y + 7, seat.id.toUpperCase(), 10, toHexColor(accent), "900");
      this.text(x + 44, y + 6, seat.connected ? seat.displayName : "Livre", 12, seat.connected ? "#edf7ff" : "#6f8492", "900", 0, 112);
      this.text(x + 44, y + 25, seat.connected ? playerClass?.shortName ?? "Classe" : "Aguardando", 9, "#8ea4b3", "800", 0, 112);

      if (seat.isHost) {
        this.text(x + width - 12, y + 7, "HOST", 8, "#ffe39d", "900", 1);
      }

      if (isHost && isEmpty) {
        this.drawMiniButton(x + width - 46, y + 22, 34, 18, "Bot", 0x83f3ff, () => onlineClient.addBot(seat.id), true);
      } else if (isHost && isBot) {
        this.drawMiniButton(x + width - 28, y + 22, 16, 18, "X", 0xff8db4, () => onlineClient.removeBot(seat.id), true);
      }
    });
  }

  private drawStatusChip(x: number, y: number, status: string, serverUrl: string): void {
    this.graphics.fillStyle(0x020712, 0.78);
    this.graphics.fillRoundedRect(x, y, 250, 54, 8);
    this.graphics.lineStyle(1, 0x31556a, 0.42);
    this.graphics.strokeRoundedRect(x, y, 250, 54, 8);
    this.text(x + 18, y + 10, status, 12, "#edf7ff", "900");
    this.text(x + 18, y + 30, serverUrl, 10, "#8ea4b3", "800", 0, 214);
  }

  private drawField(
    id: LobbyFieldId,
    x: number,
    y: number,
    width: number,
    height: number,
    value: string,
    placeholder: string
  ): void {
    const focused = this.focusedField === id;
    const textValue = value || placeholder;

    this.graphics.fillStyle(0x020712, 0.82);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(focused ? 2 : 1, focused ? 0x83f3ff : 0x31556a, focused ? 0.86 : 0.46);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
    this.text(x + 14, y + 12, focused ? `${textValue}_` : textValue, 15, value ? "#edf7ff" : "#6f8492", "900", 0, width - 28);
    this.fields.push({ id, x, y, width, height });
  }

  private drawToggle(x: number, y: number, label: string, checked: boolean, onClick: () => void): void {
    this.graphics.fillStyle(checked ? 0x83f3ff : 0x020712, checked ? 0.22 : 0.78);
    this.graphics.fillRoundedRect(x, y, 48, 26, 13);
    this.graphics.lineStyle(1, checked ? 0x83f3ff : 0x31556a, checked ? 0.72 : 0.46);
    this.graphics.strokeRoundedRect(x, y, 48, 26, 13);
    this.graphics.fillStyle(checked ? 0xb4ff72 : 0x6f8492, 0.96);
    this.graphics.fillCircle(x + (checked ? 35 : 13), y + 13, 9);
    this.text(x + 62, y + 5, label, 12, "#edf7ff", "850");
    this.registerButton(x, y, 210, 28, onClick, true);
  }

  private drawButton(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    detail: string,
    color: number,
    onClick: () => void,
    enabled: boolean
  ): void {
    this.graphics.fillStyle(enabled ? 0x020712 : 0x07131e, enabled ? 0.82 : 0.48);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(1, color, enabled ? 0.54 : 0.22);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
    this.text(x + 18, y + 8, title, 12, enabled ? "#edf7ff" : "#6f8492", "900", 0, width - 36);
    this.text(x + 18, y + 26, detail, 9, enabled ? "#8ea4b3" : "#4d6070", "800", 0, width - 36);
    this.registerButton(x, y, width, height, onClick, enabled);
  }

  private drawMiniButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    onClick: () => void,
    enabled: boolean
  ): void {
    this.graphics.fillStyle(0x020712, enabled ? 0.84 : 0.42);
    this.graphics.fillRoundedRect(x, y, width, height, 5);
    this.graphics.lineStyle(1, color, enabled ? 0.6 : 0.22);
    this.graphics.strokeRoundedRect(x, y, width, height, 5);
    this.text(x + width / 2, y + 4, label, 8, enabled ? "#edf7ff" : "#6f8492", "900", 0.5);
    this.registerButton(x, y, width, height, onClick, enabled);
  }

  private drawFooterButton(label: string, onClick: () => void, enabled: boolean): void {
    this.drawButton(64, 620, 180, 44, label, "Esc tambem volta", 0x8ea4b3, onClick, enabled);
  }

  private drawError(error: string): void {
    this.graphics.fillStyle(0x2a0611, 0.92);
    this.graphics.fillRoundedRect(340, 620, 600, 44, 8);
    this.graphics.lineStyle(1, 0xff6d8b, 0.66);
    this.graphics.strokeRoundedRect(340, 620, 600, 44, 8);
    this.text(GAME_WIDTH / 2, 633, error, 12, "#ff8db4", "900", 0.5, 560);
  }

  private panel(x: number, y: number, width: number, height: number, color: number, alpha: number): void {
    this.graphics.fillStyle(gameDesign.color.inkStrong, Math.min(0.96, alpha + 0.04));
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.fillStyle(color, 0.045);
    this.graphics.fillRoundedRect(x + 2, y + 2, width - 4, height - 4, 7);
    this.graphics.lineStyle(1, color, 0.34);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    for (const field of this.fields) {
      if (this.contains(field, pointer.x, pointer.y)) {
        this.focusedField = field.id;
        return;
      }
    }

    for (let index = this.buttons.length - 1; index >= 0; index -= 1) {
      const button = this.buttons[index];

      if (!button.enabled || !this.contains(button, pointer.x, pointer.y)) {
        continue;
      }

      button.onClick();
      return;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.closeLobby();
      return;
    }

    if (event.key === "Tab") {
      this.focusedField = this.focusedField === "displayName" ? "roomCode" : "displayName";
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      const room = onlineClient.getState().room;

      if (!room && this.focusedField === "roomCode" && this.roomCode.length >= 5) {
        void this.joinRoom();
      } else if (!room) {
        void this.createRoom();
      } else if (this.focusedField === "chat" as LobbyFieldId) {
        if (this.chatInput.trim().length > 0) {
          onlineClient.sendChat(this.chatInput);
          this.chatMessages.push({ fromDisplayName: this.displayName || "Eu", text: this.chatInput.trim(), ts: Date.now() });
          if (this.chatMessages.length > 5) this.chatMessages.shift();
          this.chatInput = "";
        }
      } else {
        const localSeat = room.seats.find((seat) => seat.clientId === onlineClient.getState().clientId);

        if (localSeat) {
          onlineClient.setReady(!localSeat.ready);
        }
      }

      event.preventDefault();
      return;
    }

    if (event.key === "Backspace") {
      if (this.focusedField === "displayName") {
        this.updateDisplayName(this.displayName.slice(0, -1));
      } else if (this.focusedField === "chat") {
        this.chatInput = this.chatInput.slice(0, -1);
      } else {
        this.roomCode = this.roomCode.slice(0, -1);
      }

      event.preventDefault();
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    if (this.focusedField === "displayName") {
      if (this.displayName.length < 18 && /[\wÀ-ÿ -]/.test(event.key)) {
        this.updateDisplayName(`${this.displayName}${event.key}`);
      }

      return;
    }

    if ((this.focusedField as string) === "chat") {
      if (this.chatInput.length < 80 && event.key.length === 1) {
        this.chatInput += event.key;
      }
      return;
    }

    if (/[a-z0-9]/i.test(event.key) && this.roomCode.length < 5) {
      this.roomCode = `${this.roomCode}${event.key.toUpperCase()}`;
    }
  }

  private async createRoom(): Promise<void> {
    if (this.busy || this.displayName.trim().length === 0) {
      return;
    }

    this.busy = true;

    try {
      await onlineClient.createRoom(this.displayName.trim(), this.aiFill);
    } catch {
      // OnlineClient exposes connection errors through its state.
    } finally {
      this.busy = false;
    }
  }

  private async joinRoom(): Promise<void> {
    if (this.busy || this.roomCode.length < 5 || this.displayName.trim().length === 0) {
      return;
    }

    this.busy = true;

    try {
      await onlineClient.joinRoom(this.roomCode, this.displayName.trim());
    } catch {
      // OnlineClient exposes connection errors through its state.
    } finally {
      this.busy = false;
    }
  }

  private closeLobby(): void {
    const room = onlineClient.getState().room;

    if (room && !room.started) {
      onlineClient.leaveRoom();
    }

    this.scene.start("MainMenuScene");
  }

  private startOnlineRun(room: OnlineRoomState): void {
    const session = createSessionFromOnlineRoom(room, onlineClient.getState().localPlayerId);

    this.scene.start("GameScene", { sessionMode: session.mode, session });
  }

  private updateDisplayName(value: string): void {
    this.displayName = value;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PLAYER_NAME_KEY, value);
    }
  }

  private registerButton(
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void,
    enabled: boolean
  ): void {
    this.buttons.push({ x, y, width, height, enabled, onClick });
  }

  private contains(rect: { x: number; y: number; width: number; height: number }, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  private text(
    x: number,
    y: number,
    value: string,
    fontSize: number,
    color: string,
    fontStyle: string,
    originX = 0,
    wrapWidth?: number
  ): Phaser.GameObjects.Text {
    const text = this.getText();

    text.setPosition(x, y);
    text.setText(value);
    text.setStyle({
      fontFamily: gameDesign.font.family,
      fontSize: `${fontSize}px`,
      fontStyle,
      color,
      lineSpacing: 2,
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined
    });
    text.setOrigin(originX, 0);
    text.setAlpha(1);
    text.setVisible(true);

    return text;
  }

  private getText(): Phaser.GameObjects.Text {
    let text = this.texts[this.usedTexts];

    if (!text) {
      text = this.add.text(0, 0, "", {});
      this.texts.push(text);
    }

    this.usedTexts += 1;

    return text;
  }

  private hideUnusedText(): void {
    for (let index = this.usedTexts; index < this.texts.length; index += 1) {
      this.texts[index].setVisible(false);
    }
  }
}

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

const getCurrentAppUrl = (): string => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:5173/";
  }

  return `${window.location.protocol}//${window.location.host}/`;
};
