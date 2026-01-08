import { useEffect, useState } from "react";
import { useAppState } from "../state/store";

export function HomeView() {
  const { state, actions } = useAppState();
  const [roomInput, setRoomInput] = useState("");
  const [nameInput, setNameInput] = useState(state.displayName);
  const [editingName, setEditingName] = useState(state.displayName === "");

  useEffect(() => {
    if (!editingName) {
      setNameInput(state.displayName);
    }
  }, [editingName, state.displayName]);

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
              actions.setName(nameInput.trim());
              setEditingName(false);
            }}
          >
            Save name
          </button>
        ) : (
          <button style={{ marginTop: 8 }} onClick={() => setEditingName(true)}>
            Edit name
          </button>
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
    </div>
  );
}
