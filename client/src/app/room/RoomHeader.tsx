import { useAppState } from "../../state/store";
type Props = {
  roomCode: string;
  onCopyRoomCode: () => void;
};

export function RoomHeader({ roomCode, onCopyRoomCode }: Props) {
  const { state, actions } = useAppState();

  const copyRoomCode = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(roomCode).then(onCopyRoomCode).catch(() => {});
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = roomCode;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (copied) {
      onCopyRoomCode();
    }
  };

  return (
    <header className="room-topbar">
      <div>
        <div className="room-title">Fish Online</div>
        <div className="room-subtitle">
          <span className="room-code-label">Room Code</span>
          <button type="button" className="room-code-button" onClick={copyRoomCode} title="Copy room code">
            <span className="room-code room-code-large">{roomCode}</span>
            <span className="room-code-icon">⧉</span>
          </button>
        </div>
        {state.lastError && (
          <div className="room-error">
            Error: {state.lastError.code} — {state.lastError.message}
            <button className="home-btn room-link" onClick={actions.clearError}>
              Dismiss
            </button>
          </div>
        )}
      </div>
      <div className="room-top-actions" />
    </header>
  );
}
