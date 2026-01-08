import type { RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
  seatName: (seatIndex: number) => string;
};

export function JoinsDisconnectsPanel({ publicState, seatName }: Props) {
  const joinLeaveEvents = publicState.history
    .filter((entry) => entry.kind === "SYSTEM")
    .map((entry) => {
      const payload = entry.payload as { message?: string; data?: { seat?: number } };
      const message = payload?.message ?? "";
      const seatIndex = payload?.data?.seat;
      if (message.startsWith("Player joined") && typeof seatIndex === "number") {
        return `${seatName(seatIndex)} joined.`;
      }
      if (message.startsWith("Player left/disconnected") && typeof seatIndex === "number") {
        return `${seatName(seatIndex)} disconnected.`;
      }
      if (message.startsWith("Player reconnected and reclaimed seat") && typeof seatIndex === "number") {
        return `${seatName(seatIndex)} reconnected.`;
      }
      if (message.startsWith("Player left room voluntarily") && typeof seatIndex === "number") {
        return `${seatName(seatIndex)} left the room.`;
      }
      return null;
    })
    .filter((entry): entry is string => Boolean(entry))
    .slice(-10);

  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Joins & Disconnects</h3>
      {joinLeaveEvents.length === 0 ? (
        <div style={{ marginTop: 6 }}>No recent joins/disconnects.</div>
      ) : (
        joinLeaveEvents.map((line, idx) => (
          <div key={`${line}-${idx}`} style={{ marginTop: 6 }}>
            {line}
          </div>
        ))
      )}
    </section>
  );
}
