import { useEffect, useState } from "react";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { SETS } from "./constants";
import { useAppState } from "../../state/store";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
};

export function ClaimPanel({ roomCode, publicState, privateState }: Props) {
  const { actions } = useAppState();
  const yourSeat = privateState.yourSeat;
  const yourTeam = privateState.yourTeam;
  const teamSeats = yourTeam === "A" ? publicState.teams.A : publicState.teams.B;

  const [claimSet, setClaimSet] = useState<string>("LOW_C");
  const [claimAssignments, setClaimAssignments] = useState<Record<string, number>>({});

  useEffect(() => {
    const defaults: Record<string, number> = {};
    for (const card of SETS[claimSet] ?? []) {
      defaults[card] = teamSeats[0] ?? yourSeat;
    }
    setClaimAssignments(defaults);
  }, [claimSet, teamSeats, yourSeat]);

  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Claim</h3>
      <>
        <label style={{ display: "block" }}>Set</label>
        <select value={claimSet} onChange={(e) => setClaimSet(e.target.value)}>
          {Object.keys(SETS).map((setId) => (
            <option key={setId} value={setId}>
              {setId}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 8 }}>
          {SETS[claimSet].map((card) => (
            <div key={card} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <span style={{ width: 60 }}>{card}</span>
              <select
                value={claimAssignments[card] ?? ""}
                onChange={(e) => setClaimAssignments((prev) => ({ ...prev, [card]: Number(e.target.value) }))}
              >
                {teamSeats.map((seat) => (
                  <option key={seat} value={seat}>
                    Seat {seat}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button style={{ marginTop: 8 }} onClick={() => actions.claim(roomCode, claimSet, claimAssignments)}>
          Submit claim
        </button>
      </>
    </section>
  );
}
