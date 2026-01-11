import { useEffect, useState } from "react";
import { useAppState } from "../../state/store";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { formatDisplayName } from "../nameUtils";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
};

export function DisjointPanel({ roomCode, publicState, privateState }: Props) {
  const { actions } = useAppState();
  const [targetSeat, setTargetSeat] = useState<number | "">("");
  const [pendingTargets, setPendingTargets] = useState<number[]>([]);
  const yourSeat = privateState.yourSeat;
  const yourTeam = privateState.yourTeam;
  const opponentSeats = yourTeam === "A" ? publicState.teams.B : publicState.teams.A;
  const seatLabel = (seatIndex: number) => {
    const seat = publicState.seats.find((entry) => entry.seat === seatIndex);
    return formatDisplayName(seat?.displayName ?? (seat?.kind === "bot" ? "Bot" : undefined));
  };
  const disjointPairKeys = new Set(
    publicState.disjointPairs.map((pair) => `${Math.min(pair.a, pair.b)}-${Math.max(pair.a, pair.b)}`)
  );

  useEffect(() => {
    setPendingTargets((prev) =>
      prev.filter((seat) => {
        const key = `${Math.min(seat, yourSeat)}-${Math.max(seat, yourSeat)}`;
        return !disjointPairKeys.has(key);
      })
    );
  }, [disjointPairKeys, yourSeat]);

  const availableTargets = opponentSeats.filter((seat) => {
    const key = `${Math.min(seat, yourSeat)}-${Math.max(seat, yourSeat)}`;
    return !disjointPairKeys.has(key) && !pendingTargets.includes(seat);
  });

  return (
    <section className="room-card">
      <h3>Disjoint</h3>
      <label style={{ display: "block", marginTop: 4 }}>Target player</label>
      <select
        className="home-input"
        value={targetSeat}
        onChange={(e) => {
          const value = e.target.value;
          setTargetSeat(value === "" ? "" : Number(value));
        }}
      >
        <option value="">Select</option>
        {availableTargets.map((seat) => (
          <option key={seat} value={seat}>
            {seatLabel(seat)}
          </option>
        ))}
      </select>
      <button
        className="home-btn"
        style={{ display: "block", marginTop: 8 }}
        disabled={targetSeat === ""}
        onClick={() => {
          const seat = Number(targetSeat);
          actions.disjoint(roomCode, seat);
          setPendingTargets((prev) => (prev.includes(seat) ? prev : [...prev, seat]));
          setTargetSeat("");
        }}
      >
        Call disjoint
      </button>
    </section>
  );
}
