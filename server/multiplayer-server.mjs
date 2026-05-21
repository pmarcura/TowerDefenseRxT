import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.MULTIPLAYER_PORT ?? 8787);
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 2;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_CLASS_ID = "christian-vitrail-custodian";

/** @typedef {{ id: string, socket: import("ws").WebSocket, roomCode: string | null }} Client */
/** @typedef {{ code: string, hostClientId: string | null, minPlayers: 2, maxPlayers: 12, seed: number, mapId: "aegis-endless-procedural", aiFill: boolean, started: boolean, seats: RoomSeat[], createdAt: number, updatedAt: number }} Room */
/** @typedef {{ id: string, kind: "human-online" | "ai-partner" | "empty", displayName: string, classId: string | null, connected: boolean, ready: boolean, clientId: string | null, isHost: boolean }} RoomSeat */

/** @type {Map<string, Room>} */
const rooms = new Map();
/** @type {Map<string, Client>} */
const clients = new Map();

const server = new WebSocketServer({ port: PORT });

server.on("connection", (socket) => {
  const client = {
    id: createClientId(),
    socket,
    roomCode: null
  };

  clients.set(client.id, client);
  send(client, { type: "connected", clientId: client.id });

  socket.on("message", (raw) => {
    try {
      handleClientMessage(client, JSON.parse(String(raw)));
    } catch (error) {
      sendError(client, error instanceof Error ? error.message : "Mensagem invalida");
    }
  });

  socket.on("close", () => {
    leaveRoom(client);
    clients.delete(client.id);
  });
});

server.on("listening", () => {
  console.log(`[multiplayer] WebSocket server listening on ws://127.0.0.1:${PORT}`);
});

const handleClientMessage = (client, message) => {
  if (!message || typeof message.type !== "string") {
    throw new Error("Mensagem sem tipo");
  }

  if (message.type === "create-room") {
    const room = createRoom(client, sanitizeName(message.displayName), Boolean(message.aiFill));
    joinRoom(client, room, sanitizeName(message.displayName), true);
    return;
  }

  if (message.type === "join-room") {
    const roomCode = sanitizeRoomCode(message.roomCode);
    const room = rooms.get(roomCode);

    if (!room) {
      throw new Error("Sala nao encontrada");
    }

    joinRoom(client, room, sanitizeName(message.displayName), false);
    return;
  }

  if (message.type === "leave-room") {
    leaveRoom(client);
    return;
  }

  if (message.type === "select-class") {
    updateSeat(client, (seat) => {
      seat.classId = typeof message.classId === "string" ? message.classId : DEFAULT_CLASS_ID;
      seat.ready = false;
    });
    return;
  }

  if (message.type === "set-ready") {
    updateSeat(client, (seat) => {
      seat.ready = Boolean(message.ready);
      seat.classId = seat.classId ?? DEFAULT_CLASS_ID;
    });
    return;
  }

  if (message.type === "start-room") {
    startRoom(client);
    return;
  }

  if (message.type === "game-action") {
    relayGameAction(client, message.action);
    return;
  }

  throw new Error(`Tipo nao suportado: ${message.type}`);
};

const createRoom = (client, displayName, aiFill) => {
  leaveRoom(client);

  let code = createRoomCode();

  while (rooms.has(code)) {
    code = createRoomCode();
  }

  const now = Date.now();
  /** @type {Room} */
  const room = {
    code,
    hostClientId: client.id,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    seed: Math.floor(Math.random() * 900000) + 100000,
    mapId: "aegis-endless-procedural",
    aiFill,
    started: false,
    seats: createEmptySeats(),
    createdAt: now,
    updatedAt: now
  };

  rooms.set(code, room);
  console.log(`[multiplayer] room ${code} created by ${displayName}`);

  return room;
};

const joinRoom = (client, room, displayName, asHost) => {
  if (room.started) {
    throw new Error("Sala ja iniciou");
  }

  leaveRoom(client);

  const freeSeat = room.seats.find((seat) => seat.kind === "empty" || !seat.connected);

  if (!freeSeat) {
    throw new Error("Sala cheia");
  }

  client.roomCode = room.code;
  freeSeat.kind = "human-online";
  freeSeat.displayName = displayName;
  freeSeat.connected = true;
  freeSeat.ready = false;
  freeSeat.classId = freeSeat.classId ?? DEFAULT_CLASS_ID;
  freeSeat.clientId = client.id;
  freeSeat.isHost = asHost || room.hostClientId === client.id;

  if (!room.hostClientId) {
    room.hostClientId = client.id;
    freeSeat.isHost = true;
  }

  touchRoom(room);
  broadcastRoom(room);
};

const leaveRoom = (client) => {
  if (!client.roomCode) {
    return;
  }

  const room = rooms.get(client.roomCode);
  client.roomCode = null;

  if (!room) {
    return;
  }

  const seat = room.seats.find((candidate) => candidate.clientId === client.id);

  if (seat) {
    seat.kind = "empty";
    seat.displayName = seat.id.toUpperCase();
    seat.classId = null;
    seat.connected = false;
    seat.ready = false;
    seat.clientId = null;
    seat.isHost = false;
  }

  if (room.hostClientId === client.id) {
    const nextHost = room.seats.find((candidate) => candidate.connected && candidate.clientId);
    room.hostClientId = nextHost?.clientId ?? null;

    if (nextHost) {
      nextHost.isHost = true;
    }
  }

  const connectedSeats = room.seats.filter((candidate) => candidate.connected);

  if (connectedSeats.length === 0) {
    rooms.delete(room.code);
    console.log(`[multiplayer] room ${room.code} closed`);
    return;
  }

  touchRoom(room);
  broadcastRoom(room);
};

const updateSeat = (client, updater) => {
  const room = requireRoom(client);

  if (room.started) {
    throw new Error("Sala ja iniciou");
  }

  const seat = requireClientSeat(client, room);
  updater(seat);
  touchRoom(room);
  broadcastRoom(room);

  if (canAutoStart(room)) {
    startRoom(client, true);
  }
};

const startRoom = (client, automatic = false) => {
  const room = requireRoom(client);
  const connectedSeats = room.seats.filter((seat) => seat.connected && seat.kind === "human-online");

  if (room.started) {
    return;
  }

  if (!automatic && room.hostClientId !== client.id) {
    throw new Error("Apenas o host inicia a sala");
  }

  if (connectedSeats.length < MIN_PLAYERS && !room.aiFill) {
    throw new Error("Precisa de 2 jogadores ou IA de preenchimento");
  }

  for (const seat of connectedSeats) {
    seat.classId = seat.classId ?? DEFAULT_CLASS_ID;
    seat.ready = true;
  }

  if (connectedSeats.length < MIN_PLAYERS && room.aiFill) {
    const aiSeat = room.seats.find((seat) => seat.kind === "empty" || !seat.connected);

    if (aiSeat) {
      aiSeat.kind = "ai-partner";
      aiSeat.displayName = "IA Aliada";
      aiSeat.classId = "islamic-zellige-geometer";
      aiSeat.connected = true;
      aiSeat.ready = true;
      aiSeat.clientId = null;
      aiSeat.isHost = false;
    }
  }

  room.started = true;
  touchRoom(room);
  broadcast(room, { type: "room-started", room: serializeRoom(room) });
  console.log(`[multiplayer] room ${room.code} started with ${connectedSeats.length} human player(s)`);
};

const relayGameAction = (client, action) => {
  const room = requireRoom(client);
  const seat = requireClientSeat(client, room);

  if (!room.started || !action || action.playerId !== seat.id) {
    return;
  }

  broadcast(room, { type: "game-action", action, fromClientId: client.id }, client.id);
};

const canAutoStart = (room) => {
  const connectedSeats = room.seats.filter((seat) => seat.connected && seat.kind === "human-online");

  return (
    !room.started &&
    connectedSeats.length >= MIN_PLAYERS &&
    connectedSeats.every((seat) => seat.ready && seat.classId)
  );
};

const requireRoom = (client) => {
  if (!client.roomCode) {
    throw new Error("Cliente nao esta em sala");
  }

  const room = rooms.get(client.roomCode);

  if (!room) {
    throw new Error("Sala nao encontrada");
  }

  return room;
};

const requireClientSeat = (client, room) => {
  const seat = room.seats.find((candidate) => candidate.clientId === client.id);

  if (!seat) {
    throw new Error("Assento nao encontrado");
  }

  return seat;
};

const broadcastRoom = (room) => {
  broadcast(room, { type: "room-state", room: serializeRoom(room) });
};

const broadcast = (room, message, exceptClientId = null) => {
  for (const seat of room.seats) {
    if (!seat.clientId || seat.clientId === exceptClientId) {
      continue;
    }

    const client = clients.get(seat.clientId);

    if (client?.socket.readyState === WebSocket.OPEN) {
      send(client, message);
    }
  }
};

const send = (client, message) => {
  if (client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(message));
  }
};

const sendError = (client, message) => {
  send(client, { type: "error", message });
};

const serializeRoom = (room) => {
  const connectedSeats = room.seats.filter((seat) => seat.connected && seat.kind !== "empty");

  return {
    code: room.code,
    hostClientId: room.hostClientId,
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    seed: room.seed,
    mapId: room.mapId,
    aiFill: room.aiFill,
    started: room.started,
    seats: room.seats,
    connectedCount: connectedSeats.filter((seat) => seat.kind === "human-online").length,
    readyCount: connectedSeats.filter((seat) => seat.ready).length,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
};

const touchRoom = (room) => {
  room.updatedAt = Date.now();
};

const createEmptySeats = () =>
  Array.from({ length: MAX_PLAYERS }, (_, index) => ({
    id: `p${index + 1}`,
    kind: "empty",
    displayName: `P${index + 1}`,
    classId: null,
    connected: false,
    ready: false,
    clientId: null,
    isHost: false
  }));

const createClientId = () => `client-${Math.random().toString(36).slice(2, 10)}`;

const createRoomCode = () =>
  Array.from({ length: 5 }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join("");

const sanitizeName = (value) => {
  const name = typeof value === "string" ? value.trim().slice(0, 18) : "";

  return name || "Jogador";
};

const sanitizeRoomCode = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
