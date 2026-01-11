export type SeatInfo = {
  seat: number;
  kind: "human" | "bot" | "empty";
  displayName: string | null;
  connected: boolean;
  playerKey: string | null;
  botId: string | null;
};

export type RoomPublicState = {
  phase: "LOBBY" | "DEAL" | "PLAYING" | "FINISHED";
  seats: SeatInfo[];
  teams: { A: number[]; B: number[] };
  hostSeat: number;
  currentAskerSeat: number;
  disjointPairs: Array<{ a: number; b: number }>;
  handCounts: Record<string, number>;
  capturedSets: { A: string[]; B: string[] };
  settings: { isPublic: boolean; historyLength: number; botDelayMs: number; botForgetfulness: number };
  history: Array<{
    id: string;
    ts: string;
    kind: "SYSTEM" | "ASK" | "CLAIM" | "DISJOINT" | "CHAT";
    payload: Record<string, unknown>;
  }>;
};

export type RoomPrivateState = {
  yourSeat: number;
  hand: string[];
  yourTeam: "A" | "B" | "";
};
