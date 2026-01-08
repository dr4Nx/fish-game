import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../state/store";
import { RoomHeader } from "./room/RoomHeader";
import { SeatsPanel } from "./room/SeatsPanel";
import { HandPanel } from "./room/HandPanel";
import { AskPanel } from "./room/AskPanel";
import { DisjointPanel } from "./room/DisjointPanel";
import { ClaimPanel } from "./room/ClaimPanel";
import { CapturedSetsPanel } from "./room/CapturedSetsPanel";
import { RecentActionsPanel } from "./room/RecentActionsPanel";
import { JoinsDisconnectsPanel } from "./room/JoinsDisconnectsPanel";
import { DebugPanel } from "./room/DebugPanel";

export function RoomView({ roomCode }: { roomCode: string }) {
  const { state, actions } = useAppState();
  const publicState = state.publicState;
  const privateState = state.privateState;
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seatName = useMemo(() => {
    if (!publicState) {
      return (seatIndex: number) => `Seat ${seatIndex}`;
    }
    const map = new Map(publicState.seats.map((seat) => [seat.seat, seat]));
    return (seatIndex: number) => {
      const seat = map.get(seatIndex);
      if (!seat) {
        return `Seat ${seatIndex}`;
      }
      return seat.displayName ?? `Seat ${seatIndex}`;
    };
  }, [publicState]);

  if (!publicState || !privateState) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Room {roomCode}</h1>
        <p>{state.status === "connected" ? "Joining room..." : "Connecting to server..."}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <RoomHeader roomCode={roomCode} publicState={publicState} privateState={privateState} />

      {publicState.phase === "LOBBY" && (
        <div style={{ marginBottom: 16 }}>
          <button disabled={publicState.hostSeat !== privateState.yourSeat} onClick={() => actions.startGame(roomCode)}>
            Start game (host only)
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <SeatsPanel publicState={publicState} privateState={privateState} nowMs={nowMs} />
        {publicState.phase !== "LOBBY" && publicState.phase !== "FINISHED" && (
          <HandPanel privateState={privateState} />
        )}
        {publicState.phase !== "LOBBY" && publicState.phase !== "FINISHED" && (
          <>
            <AskPanel roomCode={roomCode} publicState={publicState} privateState={privateState} />
            <DisjointPanel roomCode={roomCode} publicState={publicState} privateState={privateState} />
            <ClaimPanel roomCode={roomCode} publicState={publicState} privateState={privateState} />
          </>
        )}
        {publicState.phase !== "LOBBY" && <CapturedSetsPanel publicState={publicState} />}
        <RecentActionsPanel publicState={publicState} seatName={seatName} />
        <JoinsDisconnectsPanel publicState={publicState} seatName={seatName} />
        <DebugPanel publicState={publicState} />
      </div>
    </div>
  );
}
