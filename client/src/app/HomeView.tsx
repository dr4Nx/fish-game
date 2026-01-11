import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../state/store";
import { formatDisplayName, getRandomName } from "./nameUtils";
import "./HomeView.css";

const statusConfig = {
  connected: { label: "Connected", color: "#16a34a" },
  connecting: { label: "Connecting", color: "#f59e0b" },
  disconnected: { label: "Disconnected", color: "#dc2626" },
};

export function HomeView() {
  const { state, actions } = useAppState();
  const { listLobbies } = actions;
  const [roomInput, setRoomInput] = useState("");
  const [nameInput, setNameInput] = useState(state.displayName);
  const [step, setStep] = useState<"name" | "rooms">(() => (state.lastExitedRoom ? "rooms" : "name"));
  const [actionAttempted, setActionAttempted] = useState(false);
  const [ignoreExitAutoflow, setIgnoreExitAutoflow] = useState(false);

  useEffect(() => {
    setNameInput(state.displayName);
  }, [state.displayName]);

  useEffect(() => {
    if (step === "name") {
      setActionAttempted(false);
    }
  }, [step]);

  useEffect(() => {
    if (state.lastExitedRoom && step === "name" && !ignoreExitAutoflow) {
      setStep("rooms");
    }
  }, [ignoreExitAutoflow, state.lastExitedRoom, step]);

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

  const status = statusConfig[state.status];
  const sortedLobbies = useMemo(() => {
    return [...state.lobbies].sort((a, b) => {
      if (b.playerCount !== a.playerCount) {
        return b.playerCount - a.playerCount;
      }
      return a.roomCode.localeCompare(b.roomCode);
    });
  }, [state.lobbies]);

  return (
    <div className="home-root">
      {step === "name" ? (
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            textAlign: "center",
            minHeight: "calc(100vh - 180px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #0f172a, #1d4ed8)",
                WebkitBackgroundClip: "text",
                color: "transparent",
                fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", "Arial", sans-serif',
              }}
            >
              Fish Online
            </div>
            <div style={{ color: "#64748b", marginTop: 8 }}>The best card game in the world.</div>
          </div>
          <div
            style={{
              marginTop: 32,
              width: "90%",
              maxWidth: 720,
              marginLeft: "auto",
              marginRight: "auto",
              padding: 24,
              borderRadius: 16,
              background: "#ffffff",
              border: "1px solid #d7dce2",
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
              boxSizing: "border-box",
            }}
          >
            <label style={{ display: "block", textAlign: "left", color: "#0f172a", fontWeight: 600 }}>
              Display name
            </label>
            <input
              className="home-input"
              value={nameInput}
              maxLength={20}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g., BlueUnicorn5"
              style={{
                marginTop: 8,
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(148, 163, 184, 0.6)",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
              <button
                className="home-btn"
                onClick={() => {
                  const name = getRandomName();
                  setNameInput(name);
                  actions.setName(name);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.6)",
                  background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
                  boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.3)",
                  color: "#0f172a",
                }}
              >
                Random
              </button>
              <button
                className="home-btn"
                onClick={() => {
                  const trimmed = nameInput.trim();
                  const finalName = trimmed || getRandomName();
                  setNameInput(finalName);
                  actions.setName(finalName);
                  actions.clearError();
                  setActionAttempted(false);
                  setIgnoreExitAutoflow(false);
                  setStep("rooms");
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(37, 99, 235, 0.6)",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  boxShadow: "0 0 0 1px rgba(30, 58, 138, 0.5)",
                  color: "#ffffff",
                }}
              >
                Continue
              </button>
            </div>
          </div>
          <div style={{ marginTop: 14, textAlign: "center", display: "flex", gap: 16, justifyContent: "center" }}>
            <a href="#/rules" style={{ color: "#2563eb", fontSize: 15, textDecoration: "underline" }}>
              Rules
            </a>
            <a
              href="https://github.com/dr4Nx/fish-game/tree/main"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#2563eb", fontSize: 15, textDecoration: "underline" }}
            >
              GitHub
            </a>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <button
              className="home-btn"
              onClick={() => {
                actions.clearError();
                setIgnoreExitAutoflow(true);
                setStep("name");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(148, 163, 184, 0.5)",
                background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
                boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.35)",
                color: "#0f172a",
              }}
            >
              Back
            </button>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                background: "linear-gradient(90deg, #0f172a, #1d4ed8)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Fish Online
            </div>
            <div style={{ marginLeft: "auto", color: "#64748b" }}>
              Playing as <span style={{ fontWeight: 600 }}>{formatDisplayName(state.displayName)}</span>
            </div>
          </div>
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              background: "#ffffff",
              border: "1px solid #d7dce2",
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px" }}>
                <label style={{ display: "block", marginBottom: 8, color: "#0f172a", fontWeight: 600 }}>
                  Join a room
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="home-input"
                    placeholder="e.g., A1B2C3"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(148, 163, 184, 0.6)",
                      background: "#f8fafc",
                      color: "#0f172a",
                    }}
                  />
                  <button
                    className="home-btn"
                    disabled={!/^[A-Z2-7]{6}$/.test(roomInput.trim())}
                    onClick={() => {
                      setActionAttempted(true);
                      actions.clearError();
                      actions.joinRoom(roomInput.trim());
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(37, 99, 235, 0.6)",
                      background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                      boxShadow: "0 0 0 1px rgba(30, 58, 138, 0.5)",
                      color: "#ffffff",
                      opacity: /^[A-Z2-7]{6}$/.test(roomInput.trim()) ? 1 : 0.55,
                    }}
                  >
                    Join
                  </button>
                </div>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <label style={{ display: "block", marginBottom: 8, color: "#0f172a", fontWeight: 600 }}>
                  Create a room
                </label>
                <button
                  className="home-btn"
                  onClick={() => {
                    setActionAttempted(true);
                    actions.clearError();
                    actions.createRoom();
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(37, 99, 235, 0.6)",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    boxShadow: "0 0 0 1px rgba(30, 58, 138, 0.5)",
                    color: "#ffffff",
                  }}
                >
                  Create New Room
                </button>
              </div>
            </div>
            {actionAttempted && state.lastError && (
              <div style={{ marginTop: 12, color: "#b91c1c" }}>
                {state.lastError.code === "ROOM_NOT_FOUND"
                  ? "Room does not exist."
                  : `Error: ${state.lastError.code} — ${state.lastError.message}`}
              </div>
            )}
          </div>
          <div style={{ marginTop: 24 }}>
            <h2 style={{ color: "#0f172a" }}>Public Lobbies</h2>
            {sortedLobbies.length === 0 ? (
              <div style={{ color: "#64748b" }}>
                No public lobbies available.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActionAttempted(true);
                    actions.clearError();
                    actions.createRoom();
                  }}
                  style={{
                    marginLeft: 4,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    color: "#2563eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  Create a room.
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, 260px)",
                  justifyContent: "start",
                }}
              >
                {sortedLobbies.map((lobby) => (
                  <div
                    key={lobby.roomCode}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: "#ffffff",
                      border: "1px solid #d7dce2",
                      boxShadow: "0 12px 24px rgba(15, 23, 42, 0.1)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ color: "#0f172a" }}>{lobby.roomCode}</strong>
                        <span style={{ color: "#64748b" }}>{lobby.playerCount}/6</span>
                      </div>
                      {lobby.players.length > 0 && (
                        <div style={{ marginTop: 8, color: "#64748b" }}>
                          {lobby.players.map((name) => formatDisplayName(name)).join(", ")}
                        </div>
                      )}
                    </div>
                    <button
                      className="home-btn"
                      style={{
                        marginTop: 12,
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(37, 99, 235, 0.6)",
                        background:
                          lobby.playerCount >= 6
                            ? "linear-gradient(135deg, #e2e8f0, #cbd5e1)"
                            : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.35)",
                        color: lobby.playerCount >= 6 ? "#64748b" : "#ffffff",
                      }}
                      onClick={() => {
                        setActionAttempted(true);
                        actions.clearError();
                        actions.joinRoom(lobby.roomCode);
                      }}
                      disabled={lobby.playerCount >= 6}
                    >
                      {lobby.playerCount >= 6 ? "Room full" : "Join room"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "10px 20px",
          background: "rgba(248, 250, 252, 0.92)",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          color: "#64748b",
          backdropFilter: "blur(8px)",
        }}
      >
        <div>© Evan Luo 2026</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: status.color,
              boxShadow: `0 0 8px ${status.color}`,
            }}
          />
          {status.label}
        </div>
      </div>
    </div>
  );
}
