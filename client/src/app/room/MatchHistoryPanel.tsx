import type { RoomPrivateState, RoomPublicState } from "./types";
import { getCardDisplay, setLabel } from "./cardUtils";

type Props = {
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
  seatName: (seatIndex: number) => string;
};

export function MatchHistoryPanel({ publicState, privateState, seatName }: Props) {
  const yourSeat = privateState.yourSeat;
  const yourTeam = privateState.yourTeam;
  const startIndex = (() => {
    for (let i = publicState.history.length - 1; i >= 0; i -= 1) {
      const entry = publicState.history[i];
      if (entry.kind !== "SYSTEM") {
        continue;
      }
      const payload = entry.payload as { message?: string };
      if (payload?.message?.startsWith("Game started")) {
        return i;
      }
    }
    return -1;
  })();

  const seatTeam = (seatIndex: number) => {
    if (publicState.teams.A.includes(seatIndex)) {
      return "A";
    }
    if (publicState.teams.B.includes(seatIndex)) {
      return "B";
    }
    return "";
  };

  const nameClass = (seatIndex: number) => {
    if (seatIndex === yourSeat) {
      return "past-name-self";
    }
    const team = seatTeam(seatIndex);
    if (team && team === yourTeam) {
      return "past-name-team";
    }
    if (team && team !== yourTeam) {
      return "past-name-opponent";
    }
    return "past-name-neutral";
  };

  const renderName = (seatIndex: number) => (
    <span className={nameClass(seatIndex)}>{seatName(seatIndex)}</span>
  );

  const renderCard = (cardId: string) => {
    const { rank, suitSymbol, isRed, label } = getCardDisplay(cardId);
    if (cardId.startsWith("JOKER")) {
      return (
        <span className={`past-card ${isRed ? "past-card-red" : "past-card-dark"}`}>{label}</span>
      );
    }
    return (
      <span className={`past-card ${isRed ? "past-card-red" : "past-card-dark"}`}>
        {rank}
        {suitSymbol}
      </span>
    );
  };

  const matchActions = publicState.history
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry, index }) =>
        index > startIndex && (entry.kind === "ASK" || entry.kind === "CLAIM" || entry.kind === "DISJOINT")
    )
    .map(({ entry }) => entry);

  const askOrder = (() => {
    const order = new Map<string, number>();
    let count = 0;
    for (let i = startIndex + 1; i < publicState.history.length; i += 1) {
      const entry = publicState.history[i];
      if (entry.kind === "ASK") {
        count += 1;
        order.set(entry.id, count);
      }
    }
    return order;
  })();

  const lines = matchActions.map((entry) => {
    const payload = entry.payload as Record<string, unknown>;
    if (entry.kind === "ASK") {
      const fromSeat = payload.fromSeat as number;
      const toSeat = payload.toSeat as number;
      const cardId = payload.cardId as string;
      const result = payload.result as string;
      const askCount = askOrder.get(entry.id);
      return (
        <div key={`${entry.id}-ask`} className="past-turn-line">
          [{askCount ?? "-"}] {renderName(fromSeat)} asked {renderName(toSeat)} for {renderCard(cardId)} ({result}).
        </div>
      );
    }
    if (entry.kind === "CLAIM") {
      const fromSeat = payload.fromSeat as number;
      const setId = payload.setId as string;
      const result = payload.result as string;
      const awarded = payload.awardedToTeam as string;
      return (
        <div key={`${entry.id}-claim`} className="past-turn-line">
          {renderName(fromSeat)} claimed <span className="past-set">{setLabel(setId)}</span> ({result}), awarded to
          Team {awarded}.
        </div>
      );
    }
    if (entry.kind === "DISJOINT") {
      const fromSeat = payload.fromSeat as number;
      const toSeat = payload.toSeat as number;
      const result = payload.result as string;
      const transferred = (payload.transferred as string[]) ?? [];
      if (result === "INCORRECT" && transferred.length > 0) {
        return (
          <div key={`${entry.id}-disjoint`} className="past-turn-line">
            {renderName(fromSeat)} called disjoint with {renderName(toSeat)} ({result}). Transferred:{" "}
            {transferred.map((card, cardIdx) => (
              <span key={`${entry.id}-t-${cardIdx}`} className="past-card-list">
                {renderCard(card)}
              </span>
            ))}
            .
          </div>
        );
      }
      return (
        <div key={`${entry.id}-disjoint`} className="past-turn-line">
          {renderName(fromSeat)} called disjoint with {renderName(toSeat)} ({result}).
        </div>
      );
    }
    return (
      <div key={`${entry.id}-unknown`} className="past-turn-line">
        Unknown action.
      </div>
    );
  });

  return (
    <section className="room-card room-panel room-match-history">
      <h3>Match History</h3>
      <div className="room-card-scroll">
        {lines.length === 0 ? <div style={{ marginTop: 6 }}>No actions recorded yet.</div> : lines}
      </div>
    </section>
  );
}
