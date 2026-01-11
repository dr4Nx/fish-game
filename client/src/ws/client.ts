import { WS_URL } from "../config";

export type RoomStateMessage = {
  type: "room_state";
  roomCode: string;
  public: RoomPublicState;
  private: RoomPrivateState;
};

export type ErrorMessage = {
  type: "error";
  requestId: string;
  code: string;
  message: string;
};

export type ToastMessage = {
  type: "toast";
  level: "info" | "warning" | "error";
  message: string;
};

export type RoomCreatedMessage = {
  type: "room_created";
  requestId: string;
  roomCode: string;
};

export type LobbyListMessage = {
  type: "lobby_list";
  lobbies: Array<{ roomCode: string; playerCount: number; players: string[] }>;
};

export type RoomPublicState = {
  phase: "LOBBY" | "DEAL" | "PLAYING" | "FINISHED";
  seats: Array<{
    seat: number;
    kind: "human" | "bot" | "empty";
    displayName: string | null;
    connected: boolean;
    playerKey: string | null;
    botId: string | null;
  }>;
  teams: { A: number[]; B: number[] };
  hostSeat: number;
  currentAskerSeat: number;
  disjointPairs: Array<{ a: number; b: number }>;
  handCounts: Record<string, number>;
  capturedSets: { A: string[]; B: string[] };
  history: HistoryEntry[];
  settings: { isPublic: boolean; historyLength: number };
};

export type RoomPrivateState = {
  yourSeat: number;
  hand: string[];
  yourTeam: "A" | "B" | "";
};

export type HistoryEntry = {
  id: string;
  ts: string;
  kind: "SYSTEM" | "ASK" | "CLAIM" | "DISJOINT" | "CHAT";
  payload: Record<string, unknown>;
};

export type ClientMessage =
  | {
      type: "hello";
      requestId: string;
      playerKey: string;
      displayName: string;
    }
  | { type: "create_room"; requestId: string }
  | { type: "join_room"; requestId: string; roomCode: string }
  | { type: "set_name"; requestId: string; displayName: string }
  | { type: "leave_room"; requestId: string; roomCode: string }
  | { type: "reset_room"; requestId: string; roomCode: string }
  | { type: "start_game"; requestId: string; roomCode: string }
  | { type: "list_lobbies"; requestId: string }
  | {
      type: "update_settings";
      requestId: string;
      roomCode: string;
      isPublic: boolean;
      historyLength: number;
    }
  | {
      type: "set_team";
      requestId: string;
      roomCode: string;
      teamId: "A" | "B";
    }
  | { type: "randomize_teams"; requestId: string; roomCode: string }
  | { type: "unassign_team"; requestId: string; roomCode: string }
  | { type: "fill_bots"; requestId: string; roomCode: string }
  | { type: "fill_bot_seat"; requestId: string; roomCode: string; seat: number }
  | { type: "kick_seat"; requestId: string; roomCode: string; seat: number }
  | { type: "transfer_host"; requestId: string; roomCode: string; seat: number }
  | {
      type: "action_ask";
      requestId: string;
      roomCode: string;
      targetSeat: number;
      cardId: string;
    }
  | {
      type: "action_claim";
      requestId: string;
      roomCode: string;
      setId: string;
      assignments: Record<string, number>;
    }
  | {
      type: "action_disjoint";
      requestId: string;
      roomCode: string;
      targetSeat: number;
    }
  | {
      type: "chat";
      requestId: string;
      roomCode: string;
      message: string;
    };

export type ServerMessage =
  | RoomStateMessage
  | RoomCreatedMessage
  | LobbyListMessage
  | ErrorMessage
  | ToastMessage;

export class WsClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private onMessage?: (msg: ServerMessage) => void;
  private onOpen?: () => void;
  private onClose?: () => void;
  private connectId = 0;

  connect(onOpen: () => void, onClose: () => void, onMessage: (msg: ServerMessage) => void) {
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onMessage = onMessage;

    this.connectId += 1;
    const currentId = this.connectId;
    let closed = false;
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      if (currentId !== this.connectId) {
        ws.close();
        return;
      }
      this.ws = ws;
      this.onOpen?.();
      this.flush();
    };
    ws.onmessage = (event) => {
      if (currentId !== this.connectId) {
        return;
      }
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.onMessage?.(msg);
      } catch {
        // ignore malformed server messages
      }
    };
    ws.onclose = () => {
      if (currentId !== this.connectId) {
        return;
      }
      if (closed) {
        return;
      }
      closed = true;
      this.ws = null;
      this.onClose?.();
    };
    ws.onerror = () => {
      if (currentId !== this.connectId) {
        return;
      }
      if (closed) {
        return;
      }
      closed = true;
      this.ws = null;
      this.onClose?.();
    };
  }

  send(msg: ClientMessage) {
    const payload = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.queue.push(payload);
    }
  }

  disconnect() {
    this.queue = [];
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private flush() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.queue.length > 0) {
      const payload = this.queue.shift();
      if (payload) {
        this.ws.send(payload);
      }
    }
  }
}
