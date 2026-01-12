import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../state/store";
import { SETS } from "./constants";
import { getCardDisplay, setLabel } from "./cardUtils";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { formatDisplayName } from "../nameUtils";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
};

export function ClaimOverlay({ roomCode, publicState, privateState }: Props) {
  const { actions } = useAppState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "assign">("choose");
  const [claimSet, setClaimSet] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const yourTeam = privateState.yourTeam;
  const isPlaying = publicState.phase === "PLAYING";
  const claimFocus = actions.claimFocus;

  useEffect(() => {
    if (!open) {
      return;
    }
    claimFocus(roomCode, true);
    return () => {
      claimFocus(roomCode, false);
    };
  }, [claimFocus, open, roomCode]);

  const captured = useMemo(
    () => new Set([...publicState.capturedSets.A, ...publicState.capturedSets.B]),
    [publicState.capturedSets.A, publicState.capturedSets.B]
  );

  const availableSets = useMemo(
    () => Object.keys(SETS).filter((setId) => !captured.has(setId)),
    [captured]
  );

  const teamSeats = yourTeam === "A" ? publicState.teams.A : publicState.teams.B;
  const seatLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const seat of publicState.seats) {
      map.set(seat.seat, formatDisplayName(seat.displayName ?? (seat.kind === "bot" ? "Bot" : undefined)));
    }
    return map;
  }, [publicState.seats]);

  const openClaim = () => {
    if (!isPlaying) {
      return;
    }
    setOpen(true);
    setStep("choose");
    setClaimSet(null);
    setAssignments({});
  };

  const selectSet = (setId: string) => {
    if (!teamSeats.length) {
      return;
    }
    const defaults: Record<string, number> = {};
    for (const card of SETS[setId]) {
      defaults[card] = teamSeats[0];
    }
    setClaimSet(setId);
    setAssignments(defaults);
    setStep("assign");
  };

  const submitClaim = () => {
    if (!claimSet) {
      return;
    }
    actions.claim(roomCode, claimSet, assignments);
    setOpen(false);
    setStep("choose");
    setClaimSet(null);
  };

  return (
    <>
      <button className="home-btn room-claim-button" disabled={!isPlaying} onClick={openClaim}>
        Claim
      </button>
      {open && (
        <div className="room-claim-overlay">
          <div className="room-claim-card">
            <div className="room-claim-header">
              <h3>Claim a set</h3>
              <button className="home-btn room-link" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {step === "choose" && (
              <>
                <div className="room-claim-subtitle">Choose a half-suit to claim.</div>
                <div className="room-claim-grid">
                  {availableSets.length === 0 && <div className="room-hint">All sets are captured.</div>}
                  {availableSets.map((setId) => (
                    <button
                      key={setId}
                      className="home-btn room-secondary-btn"
                      onClick={() => selectSet(setId)}
                    >
                      {setLabel(setId)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === "assign" && claimSet && (
              <>
                <div className="room-claim-subtitle">
                  Assign each card in <strong>{setLabel(claimSet)}</strong> to a teammate.
                </div>
                <div className="room-claim-assignments">
                  {SETS[claimSet].map((card) => {
                    const { rank, suitSymbol, isRed } = getCardDisplay(card);
                    return (
                      <div key={card} className="room-claim-row">
                        <div className={`room-card-slot room-card-slot-small ${isRed ? "card-red" : ""}`}>
                          <div className="room-card-corner">{suitSymbol}</div>
                          <div className="room-card-rank">{rank}</div>
                          <div className="room-card-corner room-card-corner-bottom">{suitSymbol}</div>
                        </div>
                        <div className="room-claim-buttons">
                          {teamSeats.map((seat) => (
                            <button
                              key={seat}
                              className={`home-btn room-secondary-btn ${
                                assignments[card] === seat ? "room-claim-selected" : ""
                              }`}
                              onClick={() => setAssignments((prev) => ({ ...prev, [card]: seat }))}
                            >
                              {seatLabels.get(seat) ?? "Player"}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="room-claim-actions">
                  <button
                    className="home-btn room-link"
                    onClick={() => {
                      setStep("choose");
                      setClaimSet(null);
                    }}
                  >
                    Back
                  </button>
                  <button className="home-btn room-primary-btn" onClick={submitClaim}>
                    Submit claim
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
