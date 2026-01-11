from __future__ import annotations

import asyncio
import random
from typing import Any, Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .protocol import ProtocolError, parse_message, validate_action_message, validate_message
from .rooms import RoomRegistry
from .util.rate_limit import RateLimiter

app = FastAPI()
_rng = random.Random()
_registry = RoomRegistry(_rng)
_connections: Dict[str, Dict[str, WebSocket]] = {}
_player_rooms: Dict[str, str] = {}
_lobby_connections: set[WebSocket] = set()


async def send_error(ws: WebSocket, request_id: str, code: str, message: str) -> None:
    await ws.send_json({"type": "error", "requestId": request_id, "code": code, "message": message})


async def send_room_state(ws: WebSocket, room_code: str, public_state: Dict[str, Any], private_state: Dict[str, Any]) -> None:
    await ws.send_json({"type": "room_state", "roomCode": room_code, "public": public_state, "private": private_state})


async def broadcast_room_state(room_code: str) -> None:
    room = _registry.get_room(room_code)
    if not room:
        return
    for player_key, ws in list(_connections.get(room_code, {}).items()):
        try:
            public_state = _registry.build_public_state(room, player_key)
            private_state = _registry.build_private_state(room, player_key)
            await send_room_state(ws, room_code, public_state, private_state)
        except Exception:
            continue


async def send_lobby_list(ws: WebSocket) -> None:
    await ws.send_json({"type": "lobby_list", "lobbies": _registry.list_public_lobbies()})


async def broadcast_lobby_list() -> None:
    if not _lobby_connections:
        return
    payload = {"type": "lobby_list", "lobbies": _registry.list_public_lobbies()}
    for ws in list(_lobby_connections):
        try:
            await ws.send_json(payload)
        except Exception:
            _lobby_connections.discard(ws)


async def handle_room_update(room_code: str) -> None:
    await broadcast_room_state(room_code)
    await broadcast_lobby_list()


_registry.set_update_callback(handle_room_update)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    limiter = RateLimiter(10)
    player_key_opt: Optional[str] = None
    display_name_opt: Optional[str] = None
    room_code_opt: Optional[str] = None
    try:
        raw = await ws.receive_text()
        try:
            msg = validate_message(parse_message(raw))
        except ProtocolError as exc:
            await send_error(ws, "", exc.code, exc.message)
            return
        if msg["type"] != "hello":
            await send_error(ws, msg.get("requestId", ""), "BAD_MESSAGE", "First message must be hello")
            return
        player_key = msg["playerKey"]
        display_name = msg["displayName"]
        player_key_opt = player_key
        display_name_opt = display_name
        _lobby_connections.add(ws)
        await send_lobby_list(ws)
        while True:
            raw = await ws.receive_text()
            try:
                msg = validate_message(parse_message(raw))
            except ProtocolError as exc:
                await send_error(ws, "", exc.code, exc.message)
                continue
            if not limiter.allow():
                await send_error(ws, msg.get("requestId", ""), "RATE_LIMITED", "Rate limit exceeded")
                continue
            msg_type = msg["type"]
            request_id = msg["requestId"]
            try:
                if msg_type == "create_room":
                    room = _registry.create_room(player_key, display_name)
                    room_code = room.code
                    room_code_opt = room_code
                    _connections.setdefault(room_code, {})[player_key] = ws
                    _player_rooms[player_key] = room_code
                    _lobby_connections.discard(ws)
                    await ws.send_json({"type": "room_created", "requestId": request_id, "roomCode": room_code})
                    await handle_room_update(room_code)
                elif msg_type == "join_room":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    room = _registry.join_room(player_key, display_name, room_code)
                    _connections.setdefault(room_code, {})[player_key] = ws
                    _player_rooms[player_key] = room_code
                    _lobby_connections.discard(ws)
                    await handle_room_update(room_code)
                elif msg_type == "set_name":
                    display_name = msg["displayName"]
                    display_name_opt = display_name
                    if room_code_opt:
                        _registry.set_name(player_key, display_name, room_code_opt)
                        await handle_room_update(room_code_opt)
                elif msg_type == "leave_room":
                    room_code = msg["roomCode"]
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.leave_room(player_key, room_code)
                    _lobby_connections.add(ws)
                    await handle_room_update(room_code)
                    _connections.get(room_code, {}).pop(player_key, None)
                    _player_rooms.pop(player_key, None)
                    if room_code_opt == room_code:
                        room_code_opt = None
                elif msg_type == "reset_room":
                    room_code = msg["roomCode"]
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.reset_room(player_key, room_code)
                    await handle_room_update(room_code)
                elif msg_type == "start_game":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.start_game(player_key, room_code)
                    await handle_room_update(room_code)
                    room = _registry.get_room(room_code)
                    if room:
                        _registry.schedule_bot_turns(room, broadcast_room_state)
                elif msg_type == "action_ask":
                    validate_action_message(msg)
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.perform_ask(player_key, room_code, msg["targetSeat"], msg["cardId"])
                    await handle_room_update(room_code)
                    room = _registry.get_room(room_code)
                    if room:
                        _registry.schedule_bot_turns(room, broadcast_room_state)
                elif msg_type == "action_claim":
                    validate_action_message(msg)
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.perform_claim(player_key, room_code, msg["setId"], msg["assignments"])
                    await handle_room_update(room_code)
                    room = _registry.get_room(room_code)
                    if room:
                        _registry.schedule_bot_turns(room, broadcast_room_state)
                elif msg_type == "action_disjoint":
                    validate_action_message(msg)
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.perform_disjoint(player_key, room_code, msg["targetSeat"])
                    await handle_room_update(room_code)
                    room = _registry.get_room(room_code)
                    if room:
                        _registry.schedule_bot_turns(room, broadcast_room_state)
                elif msg_type == "chat":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.perform_chat(player_key, room_code, msg["message"])
                    await handle_room_update(room_code)
                elif msg_type == "list_lobbies":
                    await send_lobby_list(ws)
                elif msg_type == "update_settings":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.update_settings(
                        player_key,
                        room_code,
                        msg["isPublic"],
                        msg["historyLength"],
                        msg["botDelayMs"],
                        msg["botForgetfulness"],
                    )
                    await handle_room_update(room_code)
                elif msg_type == "set_team":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.set_team(player_key, room_code, msg["teamId"])
                    await handle_room_update(room_code)
                elif msg_type == "randomize_teams":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.randomize_teams(player_key, room_code)
                    await handle_room_update(room_code)
                elif msg_type == "unassign_team":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.unassign_team(player_key, room_code)
                    await handle_room_update(room_code)
                elif msg_type == "fill_bots":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.fill_bots(player_key, room_code)
                    await handle_room_update(room_code)
                elif msg_type == "fill_bot_seat":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.fill_bot_seat(player_key, room_code, msg["seat"])
                    await handle_room_update(room_code)
                elif msg_type == "kick_seat":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    kicked_key = _registry.kick_seat(player_key, room_code, msg["seat"])
                    await handle_room_update(room_code)
                    if kicked_key:
                        kicked_ws = _connections.get(room_code, {}).get(kicked_key)
                        if kicked_ws:
                            await send_error(kicked_ws, "", "KICKED", "You were removed from the room")
                            _lobby_connections.add(kicked_ws)
                        _connections.get(room_code, {}).pop(kicked_key, None)
                        _player_rooms.pop(kicked_key, None)
                elif msg_type == "transfer_host":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.transfer_host(player_key, room_code, msg["seat"])
                    await handle_room_update(room_code)
                elif msg_type == "hello":
                    await send_error(ws, request_id, "BAD_MESSAGE", "Hello already received")
            except AssertionError as exc:
                code = str(exc)
                await send_error(ws, request_id, code, "Request rejected")
            except ProtocolError as exc:
                await send_error(ws, request_id, exc.code, exc.message)
    except WebSocketDisconnect:
        if player_key_opt and room_code_opt:
            _registry.disconnect(player_key_opt, room_code_opt)
            await handle_room_update(room_code_opt)
    except Exception as exc:
        if player_key_opt:
            await send_error(ws, "", "BAD_MESSAGE", f"{exc}")
    finally:
        _lobby_connections.discard(ws)
        if player_key_opt and room_code_opt:
            _connections.get(room_code_opt, {}).pop(player_key_opt, None)
