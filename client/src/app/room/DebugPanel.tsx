import type { RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
};

export function DebugPanel({ publicState }: Props) {
  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Debug</h3>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {publicState.history.map((entry) => (
          <div key={entry.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{entry.ts}</div>
            <div>
              <strong>{entry.kind}</strong>: {JSON.stringify(entry.payload)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
