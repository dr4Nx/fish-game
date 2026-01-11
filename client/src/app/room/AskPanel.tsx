import { useMemo, useState } from "react";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { SETS } from "./constants";
import { useAppState } from "../../state/store";
import { formatDisplayName } from "../nameUtils";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
};

export function AskPanel({ roomCode, publicState, privateState }: Props) {
  const { actions } = useAppState();
  const yourSeat = privateState.yourSeat;
  const yourTeam = privateState.yourTeam;
  const isYourTurn = publicState.currentAskerSeat === yourSeat;
  const opponentSeats = yourTeam === "A" ? publicState.teams.B : publicState.teams.A;
  const disjointPairKeys = new Set(
    publicState.disjointPairs.map((pair) => `${Math.min(pair.a, pair.b)}-${Math.max(pair.a, pair.b)}`)
  );
  const availableTargets = opponentSeats.filter((seat) => {
    const key = `${Math.min(seat, yourSeat)}-${Math.max(seat, yourSeat)}`;
    const count = publicState.handCounts[String(seat)] ?? 0;
    return !disjointPairKeys.has(key) && count > 0;
  });

  const [askTarget, setAskTarget] = useState<number | "">("");
  const [askCard, setAskCard] = useState<string>("");
  const seatLabel = (seatIndex: number) => {
    const seat = publicState.seats.find((entry) => entry.seat === seatIndex);
    return formatDisplayName(seat?.displayName ?? (seat?.kind === "bot" ? "Bot" : undefined));
  };

  const legalAskCards = useMemo(() => {
    const hand = privateState.hand;
    const haveSet = new Set(hand.map((card) => Object.keys(SETS).find((setId) => SETS[setId].includes(card))));
    const cards: string[] = [];
    for (const setId of haveSet) {
      if (!setId) continue;
      for (const card of SETS[setId]) {
        if (!hand.includes(card)) {
          cards.push(card);
        }
      }
    }
    return cards.sort();
  }, [privateState.hand]);

  return (
    <section className="room-card">
      <h3>Ask</h3>
      <div>Current asker: {seatLabel(publicState.currentAskerSeat)}</div>
      {isYourTurn ? (
        <>
          <label style={{ display: "block", marginTop: 8 }}>Target player</label>
          <select
            className="home-input"
            value={askTarget}
            onChange={(e) => {
              const value = e.target.value;
              setAskTarget(value === "" ? "" : Number(value));
            }}
          >
            <option value="">Select</option>
            {availableTargets.map((seat) => (
              <option key={seat} value={seat}>
                {seatLabel(seat)}
              </option>
            ))}
          </select>
          <label style={{ display: "block", marginTop: 8 }}>Card</label>
          <select className="home-input" value={askCard} onChange={(e) => setAskCard(e.target.value)}>
            <option value="">Select</option>
            {legalAskCards.map((card) => (
              <option key={card} value={card}>
                {card}
              </option>
            ))}
          </select>
          <button
            className="home-btn"
            style={{ display: "block", marginTop: 8 }}
            disabled={askTarget === "" || askCard === ""}
            onClick={() => actions.ask(roomCode, Number(askTarget), askCard)}
          >
            Send ask
          </button>
        </>
      ) : (
        <p>Waiting for your turn.</p>
      )}
    </section>
  );
}
