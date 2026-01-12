import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getDisplayName, getPlayerKey, setDisplayName as persistDisplayName } from "./identity";
import { WsClient } from "../ws/client";
import { getRandomName, sanitizeDisplayName } from "../app/nameUtils";
import type {
  ClientMessage,
  ErrorMessage,
  LobbyListMessage,
  RoomCreatedMessage,
  RoomPrivateState,
  RoomPublicState,
  RoomStateMessage,
  ToastMessage,
} from "../ws/client";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type AppState = {
  status: ConnectionStatus;
  roomCode: string | null;
  publicState: RoomPublicState | null;
  privateState: RoomPrivateState | null;
  lastError: ErrorMessage | null;
  toast: ToastMessage | null;
  displayName: string;
  lastExitedRoom: string | null;
  lobbies: LobbyListMessage["lobbies"];
};

export type AppActions = {
  connect: () => void;
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  setName: (name: string) => void;
  sendChat: (roomCode: string, message: string) => void;
  listLobbies: () => void;
  updateSettings: (
    roomCode: string,
    isPublic: boolean,
    historyLength: number,
    botDelayMs: number,
    botForgetfulness: number
  ) => void;
  setTeam: (roomCode: string, teamId: "A" | "B") => void;
  randomizeTeams: (roomCode: string) => void;
  unassignTeam: (roomCode: string) => void;
  fillBots: (roomCode: string) => void;
  fillBotSeat: (roomCode: string, seat: number) => void;
  kickSeat: (roomCode: string, seat: number) => void;
  transferHost: (roomCode: string, seat: number) => void;
  startGame: (roomCode: string) => void;
  resetRoom: (roomCode: string) => void;
  ask: (roomCode: string, targetSeat: number, cardId: string) => void;
  disjoint: (roomCode: string, targetSeat: number) => void;
  claim: (roomCode: string, setId: string, assignments: Record<string, number>) => void;
  claimFocus: (roomCode: string, active: boolean) => void;
  leaveRoom: () => void;
  clearError: () => void;
};

const AppContext = createContext<{ state: AppState; actions: AppActions } | null>(null);

function newRequestId() {
  return crypto.randomUUID();
}

function isValidRoomCode(code: string) {
  return /^[A-Z2-7]{6}$/.test(code);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const playerKey = useMemo(() => getPlayerKey(), []);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [publicState, setPublicState] = useState<RoomPublicState | null>(null);
  const [privateState, setPrivateState] = useState<RoomPrivateState | null>(null);
  const [lastError, setLastError] = useState<ErrorMessage | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [displayName, setDisplayName] = useState<string>(getDisplayName());
  const [lastExitedRoom, setLastExitedRoom] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<LobbyListMessage["lobbies"]>([]);
  const clientRef = useRef<WsClient | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const handleServerMessage = useCallback(
    (msg: RoomStateMessage | RoomCreatedMessage | ErrorMessage | ToastMessage | LobbyListMessage) => {
      if (msg.type === "room_state") {
        setRoomCode(msg.roomCode);
        setLastExitedRoom(null);
        setPublicState(msg.public);
        setPrivateState(msg.private);
        setLastError(null);
        return;
      }
      if (msg.type === "room_created") {
        setRoomCode(msg.roomCode);
        setLastExitedRoom(null);
        return;
      }
      if (msg.type === "lobby_list") {
        setLobbies(msg.lobbies);
        return;
      }
      if (msg.type === "error") {
        if (msg.code === "KICKED") {
          setRoomCode(null);
          setPublicState(null);
          setPrivateState(null);
          setLastExitedRoom(null);
          window.location.hash = "#/";
        }
        setLastError(msg);
        return;
      }
      if (msg.type === "toast") {
        setToast(msg);
      }
    },
    []
  );

  const connect = useCallback(() => {
    if (status !== "disconnected") {
      return;
    }
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setStatus("connecting");
    const client = new WsClient();
    clientRef.current = client;
    client.connect(
      () => {
        setStatus("connected");
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        let name = sanitizeDisplayName(displayName);
        if (!name) {
          const hash = window.location.hash.replace("#", "");
          if (hash.startsWith("/room/")) {
            name = getRandomName();
            setDisplayName(name);
            persistDisplayName(name);
          } else {
            name = `Player-${playerKey.slice(0, 4)}`;
          }
        }
        if (name && name !== displayName) {
          setDisplayName(name);
          persistDisplayName(name);
        }
        const hello: ClientMessage = {
          type: "hello",
          requestId: newRequestId(),
          playerKey,
          displayName: name,
        };
        client.send(hello);
      },
      () => {
        setStatus("disconnected");
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 1000);
      },
      handleServerMessage
    );
  }, [displayName, handleServerMessage, playerKey, status]);

  const send = useCallback((msg: ClientMessage) => {
    clientRef.current?.send(msg);
  }, []);

  const createRoom = useCallback(() => {
    setLastExitedRoom(null);
    const name = sanitizeDisplayName(displayName);
    if (name) {
      send({ type: "set_name", requestId: newRequestId(), displayName: name });
    }
    send({ type: "create_room", requestId: newRequestId() });
  }, [displayName, send]);

  const joinRoom = useCallback(
    (code: string) => {
      if (!isValidRoomCode(code)) {
        setLastError({
          type: "error",
          requestId: newRequestId(),
          code: "ROOM_NOT_FOUND",
          message: "Invalid room code",
        });
        return;
      }
      setLastExitedRoom(null);
      const name = sanitizeDisplayName(displayName);
      if (name) {
        send({ type: "set_name", requestId: newRequestId(), displayName: name });
      }
      send({ type: "join_room", requestId: newRequestId(), roomCode: code });
    },
    [displayName, send]
  );

  const setName = useCallback(
    (name: string) => {
      const cleaned = sanitizeDisplayName(name);
      setDisplayName(cleaned);
      persistDisplayName(cleaned);
      if (cleaned) {
        send({ type: "set_name", requestId: newRequestId(), displayName: cleaned });
      }
    },
    [send]
  );

  const sendChat = useCallback(
    (code: string, message: string) => {
      send({ type: "chat", requestId: newRequestId(), roomCode: code, message });
    },
    [send]
  );

  const listLobbies = useCallback(() => {
    send({ type: "list_lobbies", requestId: newRequestId() });
  }, [send]);

  const updateSettings = useCallback(
    (code: string, isPublic: boolean, historyLength: number, botDelayMs: number, botForgetfulness: number) => {
      send({
        type: "update_settings",
        requestId: newRequestId(),
        roomCode: code,
        isPublic,
        historyLength,
        botDelayMs,
        botForgetfulness,
      });
    },
    [send]
  );

  const setTeam = useCallback(
    (code: string, teamId: "A" | "B") => {
      send({ type: "set_team", requestId: newRequestId(), roomCode: code, teamId });
    },
    [send]
  );

  const randomizeTeams = useCallback(
    (code: string) => {
      send({ type: "randomize_teams", requestId: newRequestId(), roomCode: code });
    },
    [send]
  );

  const unassignTeam = useCallback(
    (code: string) => {
      send({ type: "unassign_team", requestId: newRequestId(), roomCode: code });
    },
    [send]
  );

  const fillBots = useCallback(
    (code: string) => {
      send({ type: "fill_bots", requestId: newRequestId(), roomCode: code });
    },
    [send]
  );

  const fillBotSeat = useCallback(
    (code: string, seat: number) => {
      send({ type: "fill_bot_seat", requestId: newRequestId(), roomCode: code, seat });
    },
    [send]
  );

  const kickSeat = useCallback(
    (code: string, seat: number) => {
      send({ type: "kick_seat", requestId: newRequestId(), roomCode: code, seat });
    },
    [send]
  );
  const transferHost = useCallback(
    (code: string, seat: number) => {
      send({ type: "transfer_host", requestId: newRequestId(), roomCode: code, seat });
    },
    [send]
  );

  const startGame = useCallback(
    (code: string) => {
      send({ type: "start_game", requestId: newRequestId(), roomCode: code });
    },
    [send]
  );

  const resetRoom = useCallback(
    (code: string) => {
      send({ type: "reset_room", requestId: newRequestId(), roomCode: code });
    },
    [send]
  );

  const ask = useCallback(
    (code: string, targetSeat: number, cardId: string) => {
      send({ type: "action_ask", requestId: newRequestId(), roomCode: code, targetSeat, cardId });
    },
    [send]
  );

  const disjoint = useCallback(
    (code: string, targetSeat: number) => {
      send({ type: "action_disjoint", requestId: newRequestId(), roomCode: code, targetSeat });
    },
    [send]
  );

  const claim = useCallback(
    (code: string, setId: string, assignments: Record<string, number>) => {
      send({ type: "action_claim", requestId: newRequestId(), roomCode: code, setId, assignments });
    },
    [send]
  );

  const claimFocus = useCallback(
    (code: string, active: boolean) => {
      send({ type: "claim_focus", requestId: newRequestId(), roomCode: code, active });
    },
    [send]
  );

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const leaveRoom = useCallback(() => {
    if (roomCode) {
      send({ type: "leave_room", requestId: newRequestId(), roomCode });
    }
    setLastExitedRoom(roomCode);
    setRoomCode(null);
    setPublicState(null);
    setPrivateState(null);
    setLastError(null);
    setToast(null);
  }, [roomCode]);

  const state: AppState = {
    status,
    roomCode,
    publicState,
    privateState,
    lastError,
    toast,
    displayName,
    lastExitedRoom,
    lobbies,
  };

  const actions: AppActions = {
    connect,
    createRoom,
    joinRoom,
    setName,
    sendChat,
    listLobbies,
    updateSettings,
    setTeam,
    randomizeTeams,
    unassignTeam,
    fillBots,
    fillBotSeat,
    kickSeat,
    transferHost,
    startGame,
    resetRoom,
    ask,
    disjoint,
    claim,
    claimFocus,
    leaveRoom,
    clearError,
  };

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("AppProvider missing");
  }
  return ctx;
}
