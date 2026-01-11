type CardDisplay = {
  rank: string;
  suitSymbol: string;
  isRed: boolean;
  label: string;
};

export function getCardDisplay(card: string): CardDisplay {
  if (card === "JOKER1") {
    return { rank: "SJ", suitSymbol: "★", isRed: false, label: "Small Joker" };
  }
  if (card === "JOKER2") {
    return { rank: "BJ", suitSymbol: "★", isRed: false, label: "Big Joker" };
  }
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const suitSymbol =
    suit === "H" ? "♥" : suit === "D" ? "♦" : suit === "C" ? "♣" : suit === "S" ? "♠" : "";
  const isRed = suit === "H" || suit === "D";
  return { rank, suitSymbol, isRed, label: card };
}

export function cardLabel(card: string): string {
  return getCardDisplay(card).label;
}

export function setLabel(setId: string): string {
  const [range, suit] = setId.split("_");
  if (!range || !suit) {
    return setId;
  }
  if (setId === "SPECIALS") {
    return "Specials";
  }
  const rangeLabel = range === "LOW" ? "Low" : range === "HIGH" ? "High" : range;
  const suitLabel =
    suit === "C"
      ? "Clubs"
      : suit === "D"
        ? "Diamonds"
        : suit === "H"
          ? "Hearts"
          : suit === "S"
            ? "Spades"
            : suit;
  return `${rangeLabel} ${suitLabel}`;
}
