import { useMemo } from "react";
import { useAppState } from "../../state/store";
import type { RoomPrivateState, RoomPublicState } from "./types";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
  nowMs: number;
};

export function SeatsPanel({ roomCode, publicState, privateState, nowMs }: Props) {
  const { actions } = useAppState();
  const yourSeat = privateState.yourSeat;
  const seatsByIndex = useMemo(() => {
    return new Map(publicState.seats.map((seat) => [seat.seat, seat]));
  }, [publicState.seats]);

  const seatName = (seatIndex: number) => {
    const seat = seatsByIndex.get(seatIndex);
    if (!seat) {
      return `Seat ${seatIndex}`;
    }
    return seat.displayName ?? `Seat ${seatIndex}`;
  };

  const teamCounts = {
    A: publicState.teams.A.length,
    B: publicState.teams.B.length,
  };
  const isLobby = publicState.phase === "LOBBY";
  const isHost = publicState.hostSeat === privateState.yourSeat;

  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Seats</h3>
      {isLobby && (
        <div style={{ marginBottom: 8 }}>
          Teams: A ({teamCounts.A}/3)
          {teamCounts.A >= 3 ? <span style={{ color: "#b91c1c" }}> FULL</span> : null},{" "}
          B ({teamCounts.B}/3)
          {teamCounts.B >= 3 ? <span style={{ color: "#b91c1c" }}> FULL</span> : null}
          {isHost && (
            <button style={{ marginLeft: 8 }} onClick={() => actions.randomizeTeams(roomCode)}>
              Randomize teams
            </button>
          )}
        </div>
      )}
      {publicState.seats.map((seat) => (
        <div key={seat.seat} style={{ marginBottom: 6 }}>
          Seat {seat.seat}: {seat.displayName ?? seat.kind}
          {publicState.phase !== "LOBBY" && seat.kind !== "empty"
            ? ` (${publicState.handCounts[String(seat.seat)] ?? 0} cards)`
            : ""}
          {seat.seat === publicState.hostSeat ? " (host)" : ""}
          {seat.seat === yourSeat ? " (you)" : ""}
          {seat.kind === "human" && !seat.connected ? " (disconnected" : ""}
          {seat.kind === "human" && !seat.connected
            ? (() => {
                const lastDisconnect = [...publicState.history]
                  .reverse()
                  .find((entry) => {
                    if (entry.kind !== "SYSTEM") {
                      return false;
                    }
                    const payload = entry.payload as { message?: string; data?: { seat?: number } };
                    return (
                      payload?.message?.startsWith("Player left/disconnected") &&
                      payload?.data?.seat === seat.seat
                    );
                  });
                if (!lastDisconnect) {
                  return ")";
                }
                const tsMs = Date.parse(lastDisconnect.ts);
                if (Number.isNaN(tsMs)) {
                  return ")";
                }
                const remaining = Math.max(0, 120 - Math.floor((nowMs - tsMs) / 1000));
                return `, ${remaining}s)`;
              })()
            : ""}
          {publicState.teams.A.includes(seat.seat)
            ? " [A]"
            : publicState.teams.B.includes(seat.seat)
              ? " [B]"
              : isLobby && seat.kind === "human"
                ? " [Unassigned]"
                : ""}
          {isLobby && seat.seat === yourSeat && seat.kind === "human" && (
            <span style={{ marginLeft: 8 }}>
              <button
                onClick={() => actions.setTeam(roomCode, "A")}
                disabled={publicState.teams.A.includes(seat.seat) || teamCounts.A >= 3}
                style={{ marginRight: 6 }}
              >
                Join A
              </button>
              <button
                onClick={() => actions.setTeam(roomCode, "B")}
                disabled={publicState.teams.B.includes(seat.seat) || teamCounts.B >= 3}
                style={{ marginRight: 6 }}
              >
                Join B
              </button>
              <button
                onClick={() => actions.unassignTeam(roomCode)}
                disabled={!publicState.teams.A.includes(seat.seat) && !publicState.teams.B.includes(seat.seat)}
              >
                Unassign
              </button>
            </span>
          )}
        </div>
      ))}
    </section>
  );
}
