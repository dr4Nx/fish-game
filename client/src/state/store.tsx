import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getDisplayName, getPlayerKey, setDisplayName as persistDisplayName } from "./identity";
import { WsClient } from "../ws/client";
import type {
  ClientMessage,
  ErrorMessage,
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
};

export type AppActions = {
  connect: () => void;
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  setName: (name: string) => void;
  startGame: (roomCode: string) => void;
  resetRoom: (roomCode: string) => void;
  ask: (roomCode: string, targetSeat: number, cardId: string) => void;
  disjoint: (roomCode: string, targetSeat: number) => void;
  claim: (roomCode: string, setId: string, assignments: Record<string, number>) => void;
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
  const clientRef = useRef<WsClient | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const handleServerMessage = useCallback((msg: RoomStateMessage | RoomCreatedMessage | ErrorMessage | ToastMessage) => {
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
    if (msg.type === "error") {
      setLastError(msg);
      return;
    }
    if (msg.type === "toast") {
      setToast(msg);
    }
  }, []);

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
        let name = displayName.trim();
        if (!name) {
          name = `Player-${playerKey.slice(0, 4)}`;
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
    send({ type: "create_room", requestId: newRequestId() });
    const name = displayName.trim();
    if (name) {
      send({ type: "set_name", requestId: newRequestId(), displayName: name });
    }
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
      send({ type: "join_room", requestId: newRequestId(), roomCode: code });
      const name = displayName.trim();
      if (name) {
        send({ type: "set_name", requestId: newRequestId(), displayName: name });
      }
    },
    [displayName, send]
  );

  const setName = useCallback(
    (name: string) => {
      setDisplayName(name);
      persistDisplayName(name);
      if (roomCode) {
        send({ type: "set_name", requestId: newRequestId(), displayName: name });
      }
    },
    [roomCode, send]
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
  };

  const actions: AppActions = {
    connect,
    createRoom,
    joinRoom,
    setName,
    startGame,
    resetRoom,
    ask,
    disjoint,
    claim,
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
