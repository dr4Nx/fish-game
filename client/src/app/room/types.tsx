export type SeatInfo = {
  seat: number;
  kind: "human" | "bot" | "empty";
  displayName: string | null;
  connected: boolean;
  playerKey: string | null;
  botId: string | null;
};

export type RoomPublicState = {
  phase: "LOBBY" | "TEAM_DRAW" | "DEAL" | "PLAYING" | "FINISHED";
  seats: SeatInfo[];
  teams: { A: number[]; B: number[] };
  teamDrawCards: Record<string, string>;
  hostSeat: number;
  currentAskerSeat: number;
  disjointPairs: Array<{ a: number; b: number }>;
  capturedSets: { A: string[]; B: string[] };
  history: Array<{
    id: string;
    ts: string;
    kind: "SYSTEM" | "ASK" | "CLAIM" | "DISJOINT";
    payload: Record<string, unknown>;
  }>;
};

export type RoomPrivateState = {
  yourSeat: number;
  hand: string[];
  yourTeam: "A" | "B" | "";
};
