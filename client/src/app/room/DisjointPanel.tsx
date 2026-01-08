import { useEffect, useState } from "react";
import { useAppState } from "../../state/store";
import type { RoomPrivateState, RoomPublicState } from "./types";

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
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Disjoint</h3>
      <label style={{ display: "block", marginTop: 4 }}>Target seat</label>
      <select
        value={targetSeat}
        onChange={(e) => {
          const value = e.target.value;
          setTargetSeat(value === "" ? "" : Number(value));
        }}
      >
        <option value="">Select</option>
        {availableTargets.map((seat) => (
          <option key={seat} value={seat}>
            Seat {seat}
          </option>
        ))}
      </select>
      <button
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
