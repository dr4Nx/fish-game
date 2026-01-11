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
  const botDelayMs = publicState.settings?.botDelayMs ?? 5000;
  const botForgetfulness = publicState.settings?.botForgetfulness ?? 7;
  const teamCounts = {
    A: publicState.teams.A.length,
    B: publicState.teams.B.length,
  };
  const humanSeats = publicState.seats.filter((seat) => seat.kind === "human");
  const emptySeats = publicState.seats.filter((seat) => seat.kind === "empty");
  const unassignedHumans = humanSeats.filter(
    (seat) => !publicState.teams.A.includes(seat.seat) && !publicState.teams.B.includes(seat.seat)
  );
  const hasEmptySeat = publicState.seats.some((seat) => seat.kind === "empty");
  const canFillBots =
    isHost &&
    publicState.phase === "LOBBY" &&
    emptySeats.length > 0 &&
    teamCounts.A <= 3 &&
    teamCounts.B <= 3;
  const canStart =
    isHost &&
    !hasEmptySeat &&
    unassignedHumans.length === 0 &&
    publicState.teams.A.length <= 3 &&
    publicState.teams.B.length <= 3;

  return (
    <section className="room-card room-settings">
      <h3>Settings</h3>
      <div className="room-field">
        <div style={{ marginBottom: 6, fontWeight: 600 }}>Lobby visibility</div>
        <div className="room-toggle">
          <button
            className={`room-toggle-btn ${!isPublic ? "active" : ""}`}
            onClick={() => actions.updateSettings(roomCode, false, historyLength, botDelayMs, botForgetfulness)}
            disabled={!isHost}
          >
            Private
          </button>
          <button
            className={`room-toggle-btn ${isPublic ? "active" : ""}`}
            onClick={() => actions.updateSettings(roomCode, true, historyLength, botDelayMs, botForgetfulness)}
            disabled={!isHost}
          >
            Public
          </button>
        </div>
      </div>
      <div className="room-field">
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Recent actions length</label>
        <select
          className="home-input room-select"
          value={historyLength}
          disabled={!isHost}
          onChange={(e) =>
            actions.updateSettings(roomCode, isPublic, Number(e.target.value), botDelayMs, botForgetfulness)
          }
        >
          {Array.from({ length: 20 }, (_, idx) => idx + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="room-field">
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Bot forgetfulness</label>
        <select
          className="home-input room-select"
          value={botForgetfulness}
          disabled={!isHost}
          onChange={(e) =>
            actions.updateSettings(roomCode, isPublic, historyLength, botDelayMs, Number(e.target.value))
          }
        >
          {Array.from({ length: 31 }, (_, idx) => idx).map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
      </div>
      <div className="room-field">
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Bot speed</label>
        <select
          className="home-input room-select"
          value={botDelayMs}
          disabled={!isHost}
          onChange={(e) =>
            actions.updateSettings(roomCode, isPublic, historyLength, Number(e.target.value), botForgetfulness)
          }
        >
          {[3000, 5000, 7000, 10000, 15000, 20000].map((value) => (
            <option key={value} value={value}>
              {(value / 1000).toFixed(1)}s
            </option>
          ))}
        </select>
      </div>
      <div className="room-field">
        <div style={{ marginBottom: 6, fontWeight: 600 }}>Lobby tools</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            className="home-btn room-secondary-btn"
            onClick={() => actions.randomizeTeams(roomCode)}
            disabled={!isHost}
          >
            Randomize teams
          </button>
          <button
            className="home-btn room-secondary-btn"
            disabled={!canFillBots}
            onClick={() => actions.fillBots(roomCode)}
          >
            Fill empty seats with bots
          </button>
        </div>
      </div>
      {!isHost && <div className="room-hint">You can't edit settings.</div>}
      <div className="room-settings-footer">
        {isHost ? (
          <button
            className="home-btn room-primary-btn"
            disabled={!canStart}
            onClick={() => actions.startGame(roomCode)}
          >
            Start game
          </button>
        ) : (
          <div className="room-hint">Waiting for the game to start.</div>
        )}
        {isHost && !canStart && (
          <div className="room-hint">Fill all seats and assign teams before starting.</div>
        )}
      </div>
    </section>
  );
}
