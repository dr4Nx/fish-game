import type { RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
};

export function CapturedSetsPanel({ publicState }: Props) {
  const teamA = publicState.capturedSets.A.length;
  const teamB = publicState.capturedSets.B.length;

  return (
    <section className="room-card room-panel room-captured-panel">
      <h3>Captured Sets</h3>
      <div className="room-card-scroll room-captured-grid">
        <div className="room-captured-team">
          <div className="room-captured-label">Team Alpha</div>
          <div className="room-captured-count">{teamA}</div>
        </div>
        <div className="room-captured-team">
          <div className="room-captured-label">Team Beta</div>
          <div className="room-captured-count">{teamB}</div>
        </div>
      </div>
    </section>
  );
}
