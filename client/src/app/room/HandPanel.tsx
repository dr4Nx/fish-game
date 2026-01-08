import type { RoomPrivateState } from "./types";

type Props = {
  privateState: RoomPrivateState;
};

export function HandPanel({ privateState }: Props) {
  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Your Hand</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {privateState.hand.map((card) => (
          <span key={card} style={{ border: "1px solid #cbd5f5", padding: "2px 6px", borderRadius: 4 }}>
            {card}
          </span>
        ))}
      </div>
    </section>
  );
}
