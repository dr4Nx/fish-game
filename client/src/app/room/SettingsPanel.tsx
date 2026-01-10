import { useAppState } from "../../state/store";
import type { RoomPrivateState, RoomPublicState } from "./types";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
};

export function SettingsPanel({ roomCode, publicState, privateState }: Props) {
  const { actions } = useAppState();
  const isHost = publicState.hostSeat === privateState.yourSeat;
  const isPublic = publicState.settings?.isPublic ?? false;
  const historyLength = publicState.settings?.historyLength ?? 3;

  return (
    <section style={{ border: "1px solid #e5e7eb", padding: 12 }}>
      <h3>Settings</h3>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={isPublic}
            disabled={!isHost}
            onChange={(e) => actions.updateSettings(roomCode, e.target.checked, historyLength)}
          />
          Make room public
        </label>
      </div>
      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Recent actions length</label>
        <select
          value={historyLength}
          disabled={!isHost}
          onChange={(e) => actions.updateSettings(roomCode, isPublic, Number(e.target.value))}
          style={{ width: "100%", padding: 8 }}
        >
          {Array.from({ length: 20 }, (_, idx) => idx + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      {!isHost && <div style={{ marginTop: 8, color: "#6b7280" }}>Only the host can edit settings.</div>}
    </section>
  );
}
