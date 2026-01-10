import { useEffect, useState } from "react";
import { useAppState } from "../state/store";

export function HomeView() {
  const { state, actions } = useAppState();
  const { listLobbies } = actions;
  const [roomInput, setRoomInput] = useState("");
  const [nameInput, setNameInput] = useState(state.displayName);
  const [editingName, setEditingName] = useState(state.displayName === "");

  useEffect(() => {
    if (!editingName) {
      setNameInput(state.displayName);
    }
  }, [editingName, state.displayName]);

  useEffect(() => {
    if (state.status === "connected") {
      listLobbies();
    }
  }, [listLobbies, state.status]);

  useEffect(() => {
    if (state.status !== "connected") {
      return;
    }
    const timer = window.setInterval(() => {
      listLobbies();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [listLobbies, state.status]);

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1>Fish Game</h1>
      <p>Set a name, then create or join a room.</p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Display name</label>
        <input
          value={nameInput}
          maxLength={20}
          disabled={!editingName}
          onChange={(e) => setNameInput(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
        {editingName ? (
          <button
            style={{ marginTop: 8 }}
            onClick={() => {
              const trimmed = nameInput.trim();
              if (!trimmed) {
                const adjectives = ["Blue", "Swift", "Bright", "Happy", "Lucky", "Mighty", "Quiet", "Brave", "Clever", "Sunny"];
                const nouns = ["Unicorn", "Falcon", "Otter", "Tiger", "Comet", "Dolphin", "Panda", "Fox", "Lion", "Whale"];
                const name =
                  adjectives[Math.floor(Math.random() * adjectives.length)] +
                  nouns[Math.floor(Math.random() * nouns.length)] +
                  String(Math.floor(Math.random() * 10));
                setNameInput(name);
                actions.setName(name);
              } else {
                actions.setName(trimmed);
              }
              setEditingName(false);
            }}
          >
            Save name
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setEditingName(true)}>Edit name</button>
            <button
              onClick={() => {
                const adjectives = ["Blue", "Swift", "Bright", "Happy", "Lucky", "Mighty", "Quiet", "Brave", "Clever", "Sunny"];
                const nouns = ["Unicorn", "Falcon", "Otter", "Tiger", "Comet", "Dolphin", "Panda", "Fox", "Lion", "Whale"];
                const name =
                  adjectives[Math.floor(Math.random() * adjectives.length)] +
                  nouns[Math.floor(Math.random() * nouns.length)] +
                  String(Math.floor(Math.random() * 10));
                setNameInput(name);
                actions.setName(name);
              }}
            >
              Random name
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            placeholder="ROOMCODE"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            style={{ flex: 1, padding: 8 }}
          />
          <button
            disabled={!/^[A-Z2-7]{6}$/.test(roomInput.trim())}
            onClick={() => actions.joinRoom(roomInput.trim())}
          >
            Join room
          </button>
        </div>
        <div>
          <button onClick={actions.createRoom}>Create New Room</button>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>Connection: {state.status}</div>
      {state.lastError && (
        <div style={{ marginTop: 12, color: "#b91c1c" }}>
          Error: {state.lastError.code} — {state.lastError.message}
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <h2>Public Lobbies</h2>
        {state.lobbies.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No public lobbies available.</div>
        ) : (
          [...state.lobbies]
            .sort((a, b) => {
              if (b.playerCount !== a.playerCount) {
                return b.playerCount - a.playerCount;
              }
              return a.roomCode.localeCompare(b.roomCode);
            })
            .map((lobby) => (
            <div key={lobby.roomCode} style={{ border: "1px solid #e5e7eb", padding: 12, marginTop: 8 }}>
              <div>
                <strong>{lobby.roomCode}</strong> — {lobby.playerCount}/6 players
              </div>
              {lobby.players.length > 0 && (
                <div style={{ marginTop: 6 }}>Players: {lobby.players.join(", ")}</div>
              )}
              <button
                style={{ marginTop: 8 }}
                onClick={() => actions.joinRoom(lobby.roomCode)}
                disabled={lobby.playerCount >= 6}
              >
                Join room
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
