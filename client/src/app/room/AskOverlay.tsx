import { useMemo } from "react";
import { useAppState } from "../../state/store";
import { SETS } from "./constants";
import { getCardDisplay, setLabel } from "./cardUtils";

type Props = {
  roomCode: string;
  targetSeat: number;
  targetName: string;
  legalAskCards: string[];
  onClose: () => void;
};

export function AskOverlay({ roomCode, targetSeat, targetName, legalAskCards, onClose }: Props) {
  const { actions } = useAppState();

  const grouped = useMemo(() => {
    const groups: Array<{ setId: string; cards: string[] }> = [];
    for (const setId of Object.keys(SETS)) {
      const cards = SETS[setId].filter((card) => legalAskCards.includes(card));
      if (cards.length > 0) {
        groups.push({ setId, cards });
      }
    }
    return groups;
  }, [legalAskCards]);

  const renderCard = (card: string) => {
    const { rank, suitSymbol, isRed } = getCardDisplay(card);
    return (
      <button
        key={card}
        className={`room-card-button ${isRed ? "card-red" : ""}`}
        onClick={() => {
          actions.ask(roomCode, targetSeat, card);
          onClose();
        }}
      >
        <div className={`room-card-slot room-card-slot-small ${isRed ? "card-red" : ""}`}>
          <div className="room-card-corner">{suitSymbol}</div>
          <div className="room-card-rank">{rank}</div>
          <div className="room-card-corner room-card-corner-bottom">{suitSymbol}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="room-ask-overlay" onClick={onClose}>
      <div className="room-ask-card" onClick={(event) => event.stopPropagation()}>
        <div className="room-claim-header">
          <h3>Ask {targetName}</h3>
          <button className="home-btn room-link" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="room-claim-subtitle">Choose a card to ask for.</div>
        {grouped.length === 0 && <div className="room-hint">No legal asks available.</div>}
        <div className="room-ask-groups">
          {grouped.map((group) => (
            <div key={group.setId} className="room-ask-group">
              <div className="room-ask-label">{setLabel(group.setId)}</div>
              <div className="room-ask-cards">{group.cards.map(renderCard)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
