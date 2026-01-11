import { useCallback, useEffect, useMemo, useRef } from "react";
import { SETS } from "./constants";
import { getCardDisplay } from "./cardUtils";
import type { RoomPrivateState } from "./types";

type Props = {
  privateState: RoomPrivateState;
};

export function HandPanel({ privateState }: Props) {
  const groupedHand = useMemo(() => {
    const hand = privateState.hand;
    const ordered: string[] = [];
    for (const setId of Object.keys(SETS)) {
      const cards = SETS[setId].filter((card) => hand.includes(card));
      if (cards.length > 0) {
        ordered.push(...cards);
      }
    }
    return ordered;
  }, [privateState.hand]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    return () => {
    };
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    if (node.scrollWidth <= node.clientWidth + 1) {
      return;
    }
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (delta !== 0) {
      node.scrollLeft += delta;
      event.preventDefault();
    }
  }, []);

  return (
    <section className="room-hand-panel">
      <div className="room-hand-title">Your hand</div>
      <div className="room-hand-scroll" ref={scrollRef} onWheel={handleWheel}>
        {groupedHand.length === 0 && <div className="room-hint">No cards in hand.</div>}
        {groupedHand.length > 0 && (
          <div className="room-hand-cards">
            {groupedHand.map((card) => {
              const { rank, suitSymbol, isRed } = getCardDisplay(card);
              return (
                <div key={card} className={`room-card-slot ${isRed ? "card-red" : ""}`}>
                  <div className="room-card-corner">{suitSymbol}</div>
                  <div className="room-card-rank">{rank}</div>
                  <div className="room-card-corner room-card-corner-bottom">{suitSymbol}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
