import type { RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
  seatName: (seatIndex: number) => string;
};

export function RecentActionsPanel({ publicState, seatName }: Props) {
  const lastFinishIndex = (() => {
    for (let i = publicState.history.length - 1; i >= 0; i -= 1) {
      const entry = publicState.history[i];
      if (entry.kind !== "SYSTEM") {
        continue;
      }
      const payload = entry.payload as { message?: string };
      if (payload?.message?.startsWith("Game finished")) {
        return i;
      }
    }
    return -1;
  })();

  const recentActions = publicState.history
    .filter((entry, index) => index > lastFinishIndex && (entry.kind === "ASK" || entry.kind === "CLAIM"))
    .slice(-3)
    .map((entry) => {
      const payload = entry.payload as Record<string, unknown>;
      if (entry.kind === "ASK") {
        const fromSeat = payload.fromSeat as number;
        const toSeat = payload.toSeat as number;
        const cardId = payload.cardId as string;
        const result = payload.result as string;
        return `${seatName(fromSeat)} asked ${seatName(toSeat)} for ${cardId} (${result}).`;
      }
      if (entry.kind === "CLAIM") {
        const fromSeat = payload.fromSeat as number;
        const setId = payload.setId as string;
        const result = payload.result as string;
        const awarded = payload.awardedToTeam as string;
        return `${seatName(fromSeat)} claimed ${setId} (${result}), awarded to Team ${awarded}.`;
      }
      return "Unknown action.";
    });

  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Recent Actions</h3>
      {recentActions.length === 0 ? (
        <div style={{ marginTop: 6 }}>No actions yet.</div>
      ) : (
        recentActions.map((line, idx) => (
          <div key={`${line}-${idx}`} style={{ marginTop: 6 }}>
            {line}
          </div>
        ))
      )}
    </section>
  );
}
