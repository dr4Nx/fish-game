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
import { SettingsPanel } from "./room/SettingsPanel";

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
    <div style={{ height: "100vh", display: "flex", boxSizing: "border-box" }}>
      <div style={{ flex: 1, padding: 24 }}>
      <RoomHeader roomCode={roomCode} publicState={publicState} privateState={privateState} />

      {publicState.phase === "LOBBY" && (
        <div style={{ marginBottom: 16 }}>
          {(() => {
            const humanSeats = publicState.seats.filter((seat) => seat.kind === "human");
            const assigned = humanSeats.every(
              (seat) => publicState.teams.A.includes(seat.seat) || publicState.teams.B.includes(seat.seat)
            );
            const canStart =
              publicState.hostSeat === privateState.yourSeat &&
              assigned &&
              humanSeats.length > 0 &&
              publicState.teams.A.length <= 3 &&
              publicState.teams.B.length <= 3;
            return (
          <button
              disabled={!canStart}
              onClick={() => actions.startGame(roomCode)}
          >
            Start game (host only)
          </button>
            );
          })()}
        </div>
      )}

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <SeatsPanel roomCode={roomCode} publicState={publicState} privateState={privateState} nowMs={nowMs} />
          {publicState.phase === "LOBBY" && (
            <SettingsPanel roomCode={roomCode} publicState={publicState} privateState={privateState} />
          )}
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
          <DebugPanel publicState={publicState} />
        </div>
      </div>
      <aside
        style={{
          width: 320,
          borderLeft: "1px solid #e5e7eb",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <JoinsDisconnectsPanel roomCode={roomCode} publicState={publicState} seatName={seatName} />
      </aside>
    </div>
  );
}
