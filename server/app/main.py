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


_registry.set_update_callback(broadcast_room_state)


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
                    await ws.send_json({"type": "room_created", "requestId": request_id, "roomCode": room_code})
                    await broadcast_room_state(room_code)
                elif msg_type == "join_room":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    room = _registry.join_room(player_key, display_name, room_code)
                    _connections.setdefault(room_code, {})[player_key] = ws
                    _player_rooms[player_key] = room_code
                    await broadcast_room_state(room_code)
                elif msg_type == "set_name":
                    if not room_code_opt:
                        raise AssertionError("NOT_IN_ROOM")
                    display_name = msg["displayName"]
                    display_name_opt = display_name
                    _registry.set_name(player_key, display_name, room_code_opt)
                    await broadcast_room_state(room_code_opt)
                elif msg_type == "leave_room":
                    room_code = msg["roomCode"]
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.leave_room(player_key, room_code)
                    await broadcast_room_state(room_code)
                elif msg_type == "reset_room":
                    room_code = msg["roomCode"]
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.reset_room(player_key, room_code)
                    await broadcast_room_state(room_code)
                elif msg_type == "start_game":
                    room_code = msg["roomCode"]
                    room_code_opt = room_code
                    if _connections.get(room_code, {}).get(player_key) != ws:
                        raise AssertionError("NOT_IN_ROOM")
                    _registry.start_game(player_key, room_code)
                    await broadcast_room_state(room_code)
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
                    await broadcast_room_state(room_code)
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
                    await broadcast_room_state(room_code)
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
                    await broadcast_room_state(room_code)
                    room = _registry.get_room(room_code)
                    if room:
                        _registry.schedule_bot_turns(room, broadcast_room_state)
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
            await broadcast_room_state(room_code_opt)
    except Exception as exc:
        if player_key_opt:
            await send_error(ws, "", "BAD_MESSAGE", f"{exc}")
    finally:
        if player_key_opt and room_code_opt:
            _connections.get(room_code_opt, {}).pop(player_key_opt, None)
