import { useAppState } from "../../state/store";
import type { RoomPrivateState, RoomPublicState } from "./types";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
};

export function RoomHeader({ roomCode, publicState, privateState }: Props) {
  const { state, actions } = useAppState();
  const yourSeat = privateState.yourSeat;
  const yourTeam = privateState.yourTeam;

  return (
    <header style={{ marginBottom: 16 }}>
      <h1>Room {roomCode}</h1>
      <div>
        Phase: {publicState.phase} | You: Seat {yourSeat} (Team {yourTeam}) | Host seat: {publicState.hostSeat}
      </div>
      <button
        style={{ marginTop: 8 }}
        onClick={() => {
          actions.leaveRoom();
          window.location.hash = "#/";
        }}
        disabled={publicState.phase !== "LOBBY" && publicState.phase !== "FINISHED"}
      >
        Exit room
      </button>
      {publicState.phase === "FINISHED" && publicState.hostSeat === yourSeat && (
        <button style={{ marginTop: 8, marginLeft: 8 }} onClick={() => actions.resetRoom(roomCode)}>
          Return to lobby
        </button>
      )}
      {state.lastError && (
        <div style={{ marginTop: 8, color: "#b91c1c" }}>
          Error: {state.lastError.code} — {state.lastError.message}
          <button style={{ marginLeft: 8 }} onClick={actions.clearError}>
            Dismiss
          </button>
        </div>
      )}
    </header>
  );
}
