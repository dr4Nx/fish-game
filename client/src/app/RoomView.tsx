import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../state/store";
import { RoomHeader } from "./room/RoomHeader";
import { SeatsPanel } from "./room/SeatsPanel";
import { HandPanel } from "./room/HandPanel";
import { RecentActionsPanel } from "./room/RecentActionsPanel";
import { CapturedSetsPanel } from "./room/CapturedSetsPanel";
import { JoinsDisconnectsPanel } from "./room/JoinsDisconnectsPanel";
import { SettingsPanel } from "./room/SettingsPanel";
import { PlayersPanel } from "./room/PlayersPanel";
import { ClaimOverlay } from "./room/ClaimOverlay";
import { MatchHistoryPanel } from "./room/MatchHistoryPanel";
import { formatDisplayName } from "./nameUtils";
import "./RoomView.css";

export function RoomView({ roomCode }: { roomCode: string }) {
  const { state, actions } = useAppState();
  const publicState = state.publicState;
  const privateState = state.privateState;
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [copyNotice, setCopyNotice] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyNotice = () => {
    setCopyNotice(true);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyNotice(false);
    }, 1000);
  };

  const seatName = useMemo(() => {
    if (!publicState) {
      return () => formatDisplayName();
    }
    const map = new Map(publicState.seats.map((seat) => [seat.seat, seat]));
    return (seatIndex: number) => {
      const seat = map.get(seatIndex);
      if (!seat) {
        return formatDisplayName();
      }
      return formatDisplayName(seat.displayName ?? (seat.kind === "bot" ? "Bot" : undefined));
    };
  }, [publicState]);

  if (!publicState || !privateState) {
    return (
      <div className="room-root">
        <div className="room-main">
          <div className="room-title">Fish Online</div>
          <p>{state.status === "connected" ? "Joining room..." : "Connecting to server..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-root">
      <div className="room-main">
        <RoomHeader
          roomCode={roomCode}
          onCopyRoomCode={handleCopyNotice}
        />
        {publicState.phase === "LOBBY" ? (
          <div className="room-grid">
            <SeatsPanel roomCode={roomCode} publicState={publicState} privateState={privateState} nowMs={nowMs} />
            <SettingsPanel roomCode={roomCode} publicState={publicState} privateState={privateState} />
          </div>
        ) : (
          <div className="room-game">
            <div className="room-game-left">
              <PlayersPanel roomCode={roomCode} publicState={publicState} privateState={privateState} nowMs={nowMs} />
              {(publicState.phase === "PLAYING" || publicState.phase === "FINISHED") && privateState.yourTeam && (
                <div className="room-team-summary">
                  <div className="room-team-summary-label">You are on</div>
                  <div className="room-team-summary-value">
                    Team {privateState.yourTeam === "A" ? "Alpha" : "Beta"}
                  </div>
                </div>
              )}
            </div>
            <div
              className={`room-game-right${publicState.phase === "FINISHED" ? " room-game-right-finished" : ""}`}
            >
              {publicState.phase === "FINISHED" ? (
                <section className="room-card room-panel room-next-step">
                  <h3>Next Step</h3>
                  {privateState.yourSeat === publicState.hostSeat ? (
                    <button className="home-btn room-primary-btn" onClick={() => actions.resetRoom(roomCode)}>
                      Return to lobby
                    </button>
                  ) : (
                    <div className="room-hint">Waiting for host to return to lobby.</div>
                  )}
                </section>
              ) : (
                <RecentActionsPanel publicState={publicState} privateState={privateState} seatName={seatName} />
              )}
              <CapturedSetsPanel publicState={publicState} />
              {publicState.phase === "FINISHED" && (
                <MatchHistoryPanel publicState={publicState} privateState={privateState} seatName={seatName} />
              )}
            </div>
          </div>
        )}
        <div className="room-bottom-bar">
          <div className="room-bottom-left">
            <button
              className="home-btn room-exit"
              onClick={() => {
                actions.leaveRoom();
                window.location.hash = "#/";
              }}
              disabled={publicState.phase !== "LOBBY" && publicState.phase !== "FINISHED"}
            >
              Exit room
            </button>
          </div>
          <div className="room-bottom-center">
            {publicState.phase !== "LOBBY" && publicState.phase !== "FINISHED" && (
              <HandPanel privateState={privateState} />
            )}
          </div>
          <div className="room-bottom-right">
            {publicState.phase !== "LOBBY" && publicState.phase !== "FINISHED" && (
              <ClaimOverlay roomCode={roomCode} publicState={publicState} privateState={privateState} />
            )}
          </div>
        </div>
        <div className={`room-copy-toast ${copyNotice ? "show" : ""}`}>Successfully copied!</div>
      </div>
      <aside className="room-sidebar">
        <JoinsDisconnectsPanel roomCode={roomCode} publicState={publicState} seatName={seatName} />
      </aside>
    </div>
  );
}
