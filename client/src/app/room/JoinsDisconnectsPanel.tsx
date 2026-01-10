import { useMemo, useState } from "react";
import { useAppState } from "../../state/store";
import type { RoomPublicState } from "./types";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  seatName: (seatIndex: number) => string;
};

export function JoinsDisconnectsPanel({ roomCode, publicState, seatName }: Props) {
  const { actions } = useAppState();
  const [chatInput, setChatInput] = useState("");
  const chatEnabled = publicState.phase === "LOBBY" || publicState.phase === "FINISHED";

  const entries = useMemo(() => {
    return publicState.history
      .map((entry) => {
        if (entry.kind === "SYSTEM") {
          const payload = entry.payload as { message?: string; data?: { seat?: number; displayName?: string | null } };
          const message = payload?.message ?? "";
          const seatIndex = payload?.data?.seat;
          const name = payload?.data?.displayName ?? (typeof seatIndex === "number" ? seatName(seatIndex) : "Unknown");
          if (message.startsWith("Player joined") && typeof seatIndex === "number") {
            return { ts: entry.ts, text: `${name} joined.`, color: "#166534" };
          }
          if (message.startsWith("Player left/disconnected") && typeof seatIndex === "number") {
            return { ts: entry.ts, text: `${name} disconnected.`, color: "#b91c1c" };
          }
          if (message.startsWith("Player reconnected and reclaimed seat") && typeof seatIndex === "number") {
            return { ts: entry.ts, text: `${name} reconnected.`, color: "#166534" };
          }
          if (message.startsWith("Player left room voluntarily") && typeof seatIndex === "number") {
            return { ts: entry.ts, text: `${name} left the room.`, color: "#b91c1c" };
          }
        }
        if (entry.kind === "CHAT") {
          const payload = entry.payload as { fromSeat?: number; message?: string; displayName?: string | null };
          const name =
            payload?.displayName ??
            (typeof payload?.fromSeat === "number" ? seatName(payload.fromSeat) : "Unknown");
          const message = payload?.message ?? "";
          return { ts: entry.ts, text: `${name}: ${message}`, color: "#111827" };
        }
        return null;
      })
      .filter((entry): entry is { ts: string; text: string; color: string } => Boolean(entry));
  }, [publicState.history, seatName]);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const sendMessage = () => {
    if (!chatEnabled) {
      return;
    }
    const message = chatInput.trim();
    if (!message) {
      return;
    }
    actions.sendChat(roomCode, message.slice(0, 150));
    setChatInput("");
  };

  return (
    <section style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <h3 style={{ marginTop: 0 }}>Chat</h3>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 6, paddingRight: 4 }}>
        {entries.length === 0 ? (
          <div>No recent activity.</div>
        ) : (
          entries.map((entry, idx) => (
            <div key={`${entry.ts}-${idx}`} style={{ marginTop: 6, color: entry.color }}>
              {formatTime(entry.ts) ? `[${formatTime(entry.ts)}] ` : ""}
              {entry.text}
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          placeholder={chatEnabled ? "Type a message" : "Chat restricted during play"}
          value={chatInput}
          maxLength={150}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={!chatEnabled}
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage} disabled={!chatEnabled}>
          Send
        </button>
      </div>
    </section>
  );
}
