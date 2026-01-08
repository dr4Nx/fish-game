import { useMemo } from "react";
import type { RoomPrivateState, RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
  nowMs: number;
};

export function SeatsPanel({ publicState, privateState, nowMs }: Props) {
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

  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Seats</h3>
      {publicState.seats.map((seat) => (
        <div key={seat.seat} style={{ marginBottom: 6 }}>
          Seat {seat.seat}: {seat.displayName ?? seat.kind}
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
          {publicState.teams.A.includes(seat.seat) ? " [A]" : publicState.teams.B.includes(seat.seat) ? " [B]" : ""}
        </div>
      ))}
    </section>
  );
}
