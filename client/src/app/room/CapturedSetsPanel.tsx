import type { RoomPublicState } from "./types";

type Props = {
  publicState: RoomPublicState;
};

export function CapturedSetsPanel({ publicState }: Props) {
  const teamA = publicState.capturedSets.A;
  const teamB = publicState.capturedSets.B;

  const shortLabel = (setId: string) => {
    if (setId === "SPECIALS") {
      return { text: "★", suit: "special" };
    }
    const [tier, suit] = setId.split("_");
    const symbolMap: Record<string, string> = { C: "♣", D: "♦", H: "♥", S: "♠" };
    const symbol = symbolMap[suit] ?? "";
    const prefix = tier === "LOW" ? "L" : tier === "HIGH" ? "H" : "";
    const suitClass = suit === "D" || suit === "H" ? "red" : "dark";
    return { text: `${prefix}${symbol}`, suit: suitClass };
  };

  return (
    <section className="room-card room-panel room-captured-panel">
      <h3>Captured Sets</h3>
      <div className="room-card-scroll room-captured-grid">
        <div className="room-captured-team">
          <div className="room-captured-label">Team Alpha</div>
          <div className="room-captured-list">
            {teamA.length === 0
              ? "None"
              : teamA.map((setId) => {
                  const { text, suit } = shortLabel(setId);
                  return (
                    <span key={setId} className={`room-captured-set ${suit}`}>
                      {text}
                    </span>
                  );
                })}
          </div>
        </div>
        <div className="room-captured-team">
          <div className="room-captured-label">Team Beta</div>
          <div className="room-captured-list">
            {teamB.length === 0
              ? "None"
              : teamB.map((setId) => {
                  const { text, suit } = shortLabel(setId);
                  return (
                    <span key={setId} className={`room-captured-set ${suit}`}>
                      {text}
                    </span>
                  );
                })}
          </div>
        </div>
      </div>
    </section>
  );
}
