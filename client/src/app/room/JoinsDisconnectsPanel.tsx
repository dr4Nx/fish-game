import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../../state/store";
import type { RoomPublicState } from "./types";
import { formatDisplayName } from "../nameUtils";

type Props = {
  roomCode: string;
  publicState: RoomPublicState;
  seatName: (seatIndex: number) => string;
};

export function JoinsDisconnectsPanel({ roomCode, publicState, seatName }: Props) {
  const { actions } = useAppState();
  const [chatInput, setChatInput] = useState("");
  const chatEnabled = true;
  const listRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo(() => {
    return publicState.history
      .map((entry) => {
        if (entry.kind === "SYSTEM") {
          const payload = entry.payload as { message?: string; data?: { seat?: number; displayName?: string | null } };
          const message = payload?.message ?? "";
          const seatIndex = payload?.data?.seat;
          const name = formatDisplayName(
            payload?.data?.displayName ?? (typeof seatIndex === "number" ? seatName(seatIndex) : "Unknown")
          );
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
          if (message.startsWith("Seat kicked by host") && typeof seatIndex === "number") {
            return { ts: entry.ts, text: `${name} was removed from the room.`, color: "#b91c1c" };
          }
          if (message.startsWith("The host filled empty seats with bots")) {
            return { ts: entry.ts, text: "Empty seats were filled with bots.", color: "#166534" };
          }
          if (message.startsWith("The host added a bot to seat")) {
            return { ts: entry.ts, text: "A bot joined the lobby.", color: "#166534" };
          }
          if (message.startsWith("The host made the lobby")) {
            const text = message.replace("The host made the lobby", "Lobby set to");
            return { ts: entry.ts, text, color: "#111827" };
          }
          if (message.startsWith("The host changed the amount of visible turns")) {
            const text = message.replace("The host changed the amount of visible turns to", "Visible turns set to");
            return { ts: entry.ts, text, color: "#111827" };
          }
          if (message.startsWith("The host set bot speed to")) {
            const text = message.replace("The host set bot speed to", "Bot speed set to");
            return { ts: entry.ts, text, color: "#111827" };
          }
          if (message.startsWith("The host set bot forgetfulness to")) {
            const text = message.replace("The host set bot forgetfulness to", "Bot forgetfulness set to");
            return { ts: entry.ts, text, color: "#111827" };
          }
          if (message.startsWith("The host randomized teams")) {
            return { ts: entry.ts, text: "Teams randomized.", color: "#111827" };
          }
          if (message.startsWith("Host transferred") && typeof seatIndex === "number") {
            return { ts: entry.ts, text: `Crown passed to ${name}.`, color: "#111827" };
          }
        }
        if (entry.kind === "CHAT") {
          const payload = entry.payload as { fromSeat?: number; message?: string; displayName?: string | null };
          const name = formatDisplayName(
            payload?.displayName ?? (typeof payload?.fromSeat === "number" ? seatName(payload.fromSeat) : "Unknown")
          );
          const message = payload?.message ?? "";
          return { ts: entry.ts, text: `${name}: ${message}`, color: "#111827" };
        }
        return null;
      })
      .filter((entry): entry is { ts: string; text: string; color: string } => Boolean(entry));
  }, [publicState.history, seatName]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    <section className="room-sidebar-panel">
      <h3 style={{ marginTop: 0 }}>Chat</h3>
      <div className="room-chat-list" ref={listRef}>
        {entries.length === 0 ? (
          <div>No recent activity.</div>
        ) : (
          entries.map((entry, idx) => {
            const time = formatTime(entry.ts);
            return (
              <div key={`${entry.ts}-${idx}`} style={{ marginTop: 6, color: entry.color }}>
                {time && <span className="room-chat-time">[{time}]</span>}
                <span>{entry.text}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="room-chat-compose">
        <input
          className="home-input room-chat-input"
          placeholder="Type a message"
          value={chatInput}
          maxLength={150}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button className="home-btn room-secondary-btn room-chat-send" onClick={sendMessage}>
          Send
        </button>
      </div>
    </section>
  );
}
