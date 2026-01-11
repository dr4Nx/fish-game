import { useAppState } from "../../state/store";
import type { RoomPrivateState, RoomPublicState } from "./types";
import { formatDisplayName } from "../nameUtils";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  privateState: RoomPrivateState;
  nowMs: number;
};

export function SeatsPanel({ roomCode, publicState, privateState, nowMs }: Props) {
  const { actions } = useAppState();
  const yourSeat = privateState.yourSeat;

  const teamCounts = {
    A: publicState.teams.A.length,
    B: publicState.teams.B.length,
  };
  const isLobby = publicState.phase === "LOBBY";
  const isHost = publicState.hostSeat === privateState.yourSeat;
  const unassignedHumans = publicState.seats.filter(
    (seat) =>
      seat.kind === "human" && !publicState.teams.A.includes(seat.seat) && !publicState.teams.B.includes(seat.seat)
  );
  const canFillSingleBot = isLobby && isHost && (teamCounts.A < 3 || teamCounts.B < 3);
  const canKick = isHost && publicState.phase === "LOBBY";

  return (
    <section className="room-card">
      <h3>Seats</h3>
      {isLobby && (
        <div className="room-team-row">
          <span className={`room-team-pill ${teamCounts.A >= 3 ? "full" : ""}`}>Team Alpha {teamCounts.A}/3</span>
          <span className={`room-team-pill ${teamCounts.B >= 3 ? "full" : ""}`}>Team Beta {teamCounts.B}/3</span>
        </div>
      )}
      <div className="room-seat-list">
        {publicState.seats.map((seat) => {
          const teamLabel = publicState.teams.A.includes(seat.seat)
            ? "Team Alpha"
            : publicState.teams.B.includes(seat.seat)
              ? "Team Beta"
              : isLobby && seat.kind === "human"
                ? "Unassigned"
                : "";
          const metaParts: string[] = [];
          if (publicState.phase !== "LOBBY" && seat.kind !== "empty") {
            metaParts.push(`${publicState.handCounts[String(seat.seat)] ?? 0} cards`);
          }
          if (seat.seat === yourSeat) {
            metaParts.push("you");
          }
          if (teamLabel) {
            metaParts.push(teamLabel);
          }
          let disconnectLabel = "";
          if (seat.kind === "human" && !seat.connected) {
            const lastDisconnect = [...publicState.history]
              .reverse()
              .find((entry) => {
                if (entry.kind !== "SYSTEM") {
                  return false;
                }
                const payload = entry.payload as { message?: string; data?: { seat?: number } };
                return payload?.message?.startsWith("Player left/disconnected") && payload?.data?.seat === seat.seat;
              });
            if (lastDisconnect) {
              const tsMs = Date.parse(lastDisconnect.ts);
              if (!Number.isNaN(tsMs)) {
                const remaining = Math.max(0, 120 - Math.floor((nowMs - tsMs) / 1000));
                disconnectLabel = `disconnected (${remaining}s)`;
              }
            }
            if (!disconnectLabel) {
              disconnectLabel = "disconnected";
            }
          }
          const baseName =
            seat.kind === "empty"
              ? "Empty seat"
              : formatDisplayName(seat.displayName ?? (seat.kind === "bot" ? "Bot" : undefined));
          const name = isLobby && seat.seat === publicState.hostSeat && seat.kind !== "empty" ? `👑 ${baseName}` : baseName;
          const teamClass =
            isLobby && teamLabel === "Team Alpha" ? "team-a" : isLobby && teamLabel === "Team Beta" ? "team-b" : "";
          const seatClass = `room-seat ${seat.kind === "empty" ? "empty" : ""} ${teamClass}`.trim();
          return (
            <div key={seat.seat} className={seatClass}>
              <div>
                <div style={{ fontWeight: seat.seat === yourSeat ? 700 : 500 }}>{name}</div>
                <div className="room-seat-meta">
                  {metaParts.join(" · ")}
                  {disconnectLabel ? ` · ${disconnectLabel}` : ""}
                </div>
              </div>
              {isLobby && seat.seat === yourSeat && seat.kind === "human" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    className="home-btn room-secondary-btn"
                    onClick={() => actions.setTeam(roomCode, "A")}
                    disabled={publicState.teams.A.includes(seat.seat) || teamCounts.A >= 3}
                  >
                    Join A
                  </button>
                  <button
                    className="home-btn room-secondary-btn"
                    onClick={() => actions.setTeam(roomCode, "B")}
                    disabled={publicState.teams.B.includes(seat.seat) || teamCounts.B >= 3}
                  >
                    Join B
                  </button>
                  <button
                    className="home-btn room-secondary-btn"
                    onClick={() => actions.unassignTeam(roomCode)}
                    disabled={!publicState.teams.A.includes(seat.seat) && !publicState.teams.B.includes(seat.seat)}
                  >
                    Unassign
                  </button>
                </div>
              )}
              {isHost && seat.kind === "empty" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    className="home-btn room-secondary-btn"
                    disabled={!canFillSingleBot}
                    onClick={() => actions.fillBotSeat(roomCode, seat.seat)}
                  >
                    Add bot
                  </button>
                </div>
              )}
              {canKick && seat.kind !== "empty" && seat.seat !== publicState.hostSeat && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {seat.kind === "human" && (
                    <button
                      className="home-btn room-secondary-btn"
                      onClick={() => actions.transferHost(roomCode, seat.seat)}
                    >
                      Transfer host
                    </button>
                  )}
                  <button
                    className="home-btn room-secondary-btn"
                    onClick={() => actions.kickSeat(roomCode, seat.seat)}
                  >
                    {seat.kind === "bot" ? "Remove bot" : "Kick"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
