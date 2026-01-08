import type { RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
};

export function CapturedSetsPanel({ publicState }: Props) {
  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Captured Sets</h3>
      <div>Team A: {publicState.capturedSets.A.join(", ") || "-"}</div>
      <div>Team B: {publicState.capturedSets.B.join(", ") || "-"}</div>
    </section>
  );
}
