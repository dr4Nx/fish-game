import { useMemo, useState } from "react";
import { useAppState } from "../../state/store";
import { SETS } from "./constants";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { AskOverlay } from "./AskOverlay";
import { formatDisplayName } from "../nameUtils";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
  nowMs: number;
};

export function PlayersPanel({ roomCode, publicState, privateState, nowMs }: Props) {
  const { actions } = useAppState();
  const yourSeat = privateState.yourSeat;
  const yourTeam = privateState.yourTeam;
  const isPlaying = publicState.phase === "PLAYING";
  const isYourTurn = isPlaying && publicState.currentAskerSeat === yourSeat;
  const isFinished = publicState.phase === "FINISHED";
  const [askSeat, setAskSeat] = useState<number | null>(null);

  const disjointPairKeys = useMemo(
    () =>
      new Set(
        publicState.disjointPairs.map((pair) => `${Math.min(pair.a, pair.b)}-${Math.max(pair.a, pair.b)}`)
      ),
    [publicState.disjointPairs]
  );

  const legalAskCards = useMemo(() => {
    const hand = privateState.hand;
    const haveSet = new Set(hand.map((card) => Object.keys(SETS).find((setId) => SETS[setId].includes(card))));
    const cards: string[] = [];
    for (const setId of haveSet) {
      if (!setId) {
        continue;
      }
      for (const card of SETS[setId]) {
        if (!hand.includes(card)) {
          cards.push(card);
        }
      }
    }
    return cards.sort();
  }, [privateState.hand]);

  const seatTeam = (seatIndex: number) => {
    if (publicState.teams.A.includes(seatIndex)) {
      return "A";
    }
    if (publicState.teams.B.includes(seatIndex)) {
      return "B";
    }
    return "";
  };

  const seatName = (seatIndex: number) => {
    const seat = publicState.seats.find((entry) => entry.seat === seatIndex);
    if (!seat) {
      return formatDisplayName();
    }
    return formatDisplayName(seat.displayName ?? (seat.kind === "bot" ? "Bot" : undefined));
  };

  const handleDisjoint = (seatIndex: number) => {
    actions.disjoint(roomCode, seatIndex);
  };

  const disconnectCountdown = (seatIndex: number) => {
    const lastDisconnect = [...publicState.history]
      .reverse()
      .find((entry) => {
        if (entry.kind !== "SYSTEM") {
          return false;
        }
        const payload = entry.payload as { message?: string; data?: { seat?: number } };
        return payload?.message?.startsWith("Player left/disconnected") && payload?.data?.seat === seatIndex;
      });
    if (!lastDisconnect) {
      return 120;
    }
    const tsMs = Date.parse(lastDisconnect.ts);
    if (Number.isNaN(tsMs)) {
      return 120;
    }
    const remaining = Math.max(0, 120 - Math.floor((nowMs - tsMs) / 1000));
    return remaining;
  };

  const finishMessage = (() => {
    if (!isFinished || !yourTeam) {
      return "";
    }
    const scoreA = publicState.capturedSets.A.length;
    const scoreB = publicState.capturedSets.B.length;
    if (scoreA === scoreB) {
      return "Draw!";
    }
    const won = yourTeam === "A" ? scoreA > scoreB : scoreB > scoreA;
    return won ? "You Won!" : "You Lost!";
  })();

  return (
    <section className="room-card room-players">
      <div className="room-players-header">
        <h3>Players</h3>
        <div className="room-players-hint">Use the buttons to act.</div>
      </div>
      <div className="room-players-grid">
        {publicState.seats
          .filter((seat) => seat.kind !== "empty")
          .map((seat) => {
            const team = seatTeam(seat.seat);
            const isSelf = seat.seat === yourSeat;
            const isTeam = team && team === yourTeam;
            const isOpponent = team && team !== yourTeam;
            const isTurn = publicState.currentAskerSeat === seat.seat && isPlaying;
            const isHost = seat.seat === publicState.hostSeat;
            const cardCount = publicState.handCounts[String(seat.seat)] ?? 0;
            const pairKey = `${Math.min(seat.seat, yourSeat)}-${Math.max(seat.seat, yourSeat)}`;
            const isDisjoint = disjointPairKeys.has(pairKey);
            const canAsk =
              isPlaying &&
              seat.seat !== yourSeat &&
              isOpponent &&
              !isDisjoint &&
              publicState.currentAskerSeat === yourSeat &&
              cardCount > 0 &&
              legalAskCards.length > 0;
            const canDisjoint = isPlaying && seat.seat !== yourSeat && isOpponent && !isDisjoint;
            const finishedTeamClass =
              publicState.phase === "FINISHED"
                ? team === "A"
                  ? "player-team-a"
                  : team === "B"
                    ? "player-team-b"
                    : ""
                : "";
            const cardClasses = [
              "player-card",
              publicState.phase === "FINISHED" ? finishedTeamClass : isSelf ? "player-self" : "",
              publicState.phase === "FINISHED" ? "" : !isSelf && isTeam ? "player-team" : "",
              publicState.phase === "FINISHED" ? "" : isOpponent ? "player-opponent" : "",
              isTurn ? "player-turn" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const metaParts: string[] = [];
            if (isSelf) {
              metaParts.push("You");
            }
            metaParts.push(seat.kind === "bot" ? "Bot" : "Human");
            metaParts.push(`${cardCount} cards`);

            const displayName = formatDisplayName(seat.displayName ?? (seat.kind === "bot" ? "Bot" : undefined));

            return (
              <div key={seat.seat} className={cardClasses}>
                <div className="player-card-main">
                  <div className={`player-name ${seat.kind === "human" && !seat.connected ? "player-name-offline" : ""}`}>
                    {isHost ? "👑 " : ""}
                    {displayName}
                    {seat.kind === "human" && !seat.connected && (
                      <span className="player-disconnect-timer">({disconnectCountdown(seat.seat)}s)</span>
                    )}
                    {isDisjoint && <span className="player-disjoint-tag"> · Disjoint</span>}
                  </div>
                  <div className="player-meta">
                    {metaParts.join(" · ")}
                  </div>
                </div>
                {isOpponent && (
                  <div className="player-actions">
                    <button
                      className={`home-btn room-secondary-btn ${!canDisjoint ? "player-action-muted" : ""}`}
                      disabled={!canDisjoint}
                      onClick={() => handleDisjoint(seat.seat)}
                    >
                      Call disjoint
                    </button>
                    <button
                      className={`home-btn room-secondary-btn ${!canAsk ? "player-action-muted" : ""}`}
                      disabled={!canAsk}
                      onClick={() => setAskSeat(seat.seat)}
                    >
                      Ask
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      {isYourTurn && <div className="player-your-turn">Your Turn!</div>}
      {finishMessage && <div className="player-finish-result">{finishMessage}</div>}
      {askSeat !== null && (
        <AskOverlay
          roomCode={roomCode}
          targetSeat={askSeat}
          targetName={seatName(askSeat)}
          legalAskCards={legalAskCards}
          onClose={() => setAskSeat(null)}
        />
      )}
    </section>
  );
}
