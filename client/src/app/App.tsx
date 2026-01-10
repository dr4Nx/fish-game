import { useEffect, useRef, useState } from "react";
import { AppProvider, useAppState } from "../state/store";
import { HomeView } from "./HomeView";
import { RoomView } from "./RoomView";

function parseRoute() {
  const hash = window.location.hash.replace("#", "");
  if (hash.startsWith("/room/")) {
    return { view: "room" as const, roomCode: hash.replace("/room/", "").toUpperCase() };
  }
  return { view: "home" as const, roomCode: "" };
}

function AppShell() {
  const { state, actions } = useAppState();
  const { connect } = actions;
  const [route, setRoute] = useState(parseRoute());
  const startedRef = useRef(false);

  const isValidRoomCode = (code: string) => /^[A-Z2-7]{6}$/.test(code);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    connect();
  }, [connect]);

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    if (state.roomCode && route.view !== "room") {
      window.location.hash = `#/room/${state.roomCode}`;
    }
  }, [route.view, state.roomCode]);

  useEffect(() => {
    if (!state.roomCode || !state.publicState) {
      return;
    }
    const phase = state.publicState.phase;
    if (route.view === "home" && (phase === "DEAL" || phase === "PLAYING")) {
      window.location.hash = `#/room/${state.roomCode}`;
    }
  }, [route.view, state.publicState, state.roomCode]);

  useEffect(() => {
    if (route.view === "room" && state.lastError?.code === "ROOM_NOT_FOUND") {
      actions.clearError();
      window.location.hash = "#/";
    }
  }, [actions, route.view, state.lastError]);

  useEffect(() => {
    if (state.status !== "connected") {
      return;
    }
    if (route.view === "room" && route.roomCode && state.roomCode !== route.roomCode) {
      if (!isValidRoomCode(route.roomCode)) {
        return;
      }
      if (state.lastExitedRoom && state.lastExitedRoom === route.roomCode) {
        return;
      }
      actions.joinRoom(route.roomCode);
    }
  }, [actions, route.roomCode, route.view, state.lastExitedRoom, state.roomCode, state.status]);

  if (route.view === "room") {
    return <RoomView roomCode={route.roomCode} />;
  }
  return <HomeView />;
}

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
