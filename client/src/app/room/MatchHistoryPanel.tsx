import { useLayoutEffect, useRef } from "react";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { getCardDisplay, setLabel } from "./cardUtils";

type Props = {
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
  seatName: (seatIndex: number) => string;
};

export function MatchHistoryPanel({ publicState, privateState, seatName }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
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

  const lines = matchActions.map((entry) => {
    const payload = entry.payload as Record<string, unknown>;
    if (entry.kind === "ASK") {
      const fromSeat = payload.fromSeat as number;
      const toSeat = payload.toSeat as number;
      const cardId = payload.cardId as string;
      const result = payload.result as string;
      const resultLabel = result === "HIT" ? "Hit" : "Miss";
      return (
        <div key={`${entry.id}-ask`} className="past-turn-entry">
          <div className="past-turn-line">
            {renderName(fromSeat)} asked {renderName(toSeat)}
          </div>
          <div className="past-turn-line">
            {renderCard(cardId)} - <span className="past-result">{resultLabel}</span>
          </div>
        </div>
      );
    }
    if (entry.kind === "CLAIM") {
      const fromSeat = payload.fromSeat as number;
      const setId = payload.setId as string;
      const result = payload.result as string;
      const awarded = payload.awardedToTeam as string;
      const holders = (payload.holders as Array<{ seat: number; cards: string[] }>) ?? [];
      const awardedLabel = awarded === "A" ? "Alpha" : awarded === "B" ? "Beta" : awarded;
      return (
        <div key={`${entry.id}-claim`} className="past-turn-entry">
          <div className="past-turn-line">
            {renderName(fromSeat)} claimed <span className="past-set">{setLabel(setId)}</span> ({result}), awarded to
            Team {awardedLabel}.
          </div>
          {holders.length > 0 && (
            <div className="past-turn-line past-claim-holders">
              {holders.map((holder, holderIdx) => (
                <span key={`${entry.id}-holder-${holder.seat}`} className="past-claim-holder">
                  {renderName(holder.seat)}:{" "}
                  {holder.cards.map((card, cardIdx) => (
                    <span key={`${entry.id}-holder-${holder.seat}-${cardIdx}`} className="past-card-list">
                      {renderCard(card)}
                    </span>
                  ))}
                  {holderIdx < holders.length - 1 ? "; " : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (entry.kind === "DISJOINT") {
      const fromSeat = payload.fromSeat as number;
      const toSeat = payload.toSeat as number;
      const result = payload.result as string;
      const transferredSets = (payload.transferredSets as string[]) ?? [];
      const awarded = payload.awardedToTeam as string | undefined;
      const awardedLabel = awarded === "A" ? "Alpha" : awarded === "B" ? "Beta" : awarded;
      if (result === "INCORRECT" && transferredSets.length > 0) {
        return (
          <div key={`${entry.id}-disjoint`} className="past-turn-entry">
            <div className="past-turn-line">
            {renderName(fromSeat)} called disjoint with {renderName(toSeat)} ({result}). Transferred:{" "}
            {awardedLabel ? `Team ${awardedLabel}: ` : ""}
            {transferredSets.map((setId, setIdx) => (
              <span key={`${entry.id}-set-${setIdx}`} className="past-set">
                {setLabel(setId)}
                {setIdx < transferredSets.length - 1 ? ", " : ""}
              </span>
            ))}
            .
            </div>
          </div>
        );
      }
      return (
        <div key={`${entry.id}-disjoint`} className="past-turn-entry">
          <div className="past-turn-line">
            {renderName(fromSeat)} called disjoint with {renderName(toSeat)} ({result}).
          </div>
        </div>
      );
    }
    return (
      <div key={`${entry.id}-unknown`} className="past-turn-entry">
        <div className="past-turn-line">Unknown action.</div>
      </div>
    );
  });

  const latestActionId = matchActions.length > 0 ? matchActions[matchActions.length - 1].id : "";

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    const scrollToBottom = () => {
      node.scrollTop = node.scrollHeight;
      endRef.current?.scrollIntoView({ block: "end" });
    };
    scrollToBottom();
    const raf = requestAnimationFrame(scrollToBottom);
    const timer = window.setTimeout(scrollToBottom, 100);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [latestActionId]);

  return (
    <section className="room-card room-panel room-match-history">
      <h3>Match History</h3>
      <div className="room-card-scroll" ref={scrollRef}>
        {lines.length === 0 ? <div style={{ marginTop: 6 }}>No actions recorded yet.</div> : lines}
        <div ref={endRef} />
      </div>
    </section>
  );
}
