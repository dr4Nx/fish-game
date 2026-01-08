from __future__ import annotations

import json
from typing import Any, Dict

from .util.ids import is_valid_room_code, is_valid_display_name

class ProtocolError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


CLIENT_SCHEMAS: Dict[str, Dict[str, str]] = {
    "hello": {
        "requestId": "string",
        "playerKey": "string",
        "displayName": "string",
    },
    "create_room": {
        "requestId": "string",
    },
    "join_room": {
        "requestId": "string",
        "roomCode": "string",
    },
    "set_name": {
        "requestId": "string",
        "displayName": "string",
    },
    "leave_room": {
        "requestId": "string",
        "roomCode": "string",
    },
    "reset_room": {
        "requestId": "string",
        "roomCode": "string",
    },
    "start_game": {
        "requestId": "string",
        "roomCode": "string",
    },
    "action_ask": {
        "requestId": "string",
        "roomCode": "string",
        "targetSeat": "int",
        "cardId": "string",
    },
    "action_claim": {
        "requestId": "string",
        "roomCode": "string",
        "setId": "string",
        "assignments": "dict",
    },
    "action_disjoint": {
        "requestId": "string",
        "roomCode": "string",
        "targetSeat": "int",
    },
}


def parse_message(raw: str) -> Dict[str, Any]:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ProtocolError("BAD_MESSAGE", f"Invalid JSON: {exc}")
    if not isinstance(msg, dict):
        raise ProtocolError("BAD_MESSAGE", "Message must be a JSON object")
    return msg


def validate_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    msg_type = msg.get("type")
    if not isinstance(msg_type, str):
        raise ProtocolError("BAD_MESSAGE", "Missing type")
    if msg_type not in CLIENT_SCHEMAS:
        raise ProtocolError("BAD_MESSAGE", "Unknown message type")
    schema = CLIENT_SCHEMAS[msg_type]
    allowed_keys = {"type", *schema.keys()}
    if any(key not in allowed_keys for key in msg.keys()):
        raise ProtocolError("BAD_MESSAGE", "Unexpected field")
    for key, expected in schema.items():
        if key not in msg:
            raise ProtocolError("BAD_MESSAGE", f"Missing field: {key}")
        value = msg[key]
        if expected == "string" and not isinstance(value, str):
            raise ProtocolError("BAD_MESSAGE", f"Field {key} must be string")
        if expected == "int" and not isinstance(value, int):
            raise ProtocolError("BAD_MESSAGE", f"Field {key} must be int")
        if expected == "dict" and not isinstance(value, dict):
            raise ProtocolError("BAD_MESSAGE", f"Field {key} must be object")
    if not isinstance(msg.get("requestId"), str):
        raise ProtocolError("BAD_MESSAGE", "requestId required")
    if "roomCode" in msg and not is_valid_room_code(msg["roomCode"]):
        raise ProtocolError("ROOM_NOT_FOUND", "Invalid room code")
    if msg_type in ("hello", "set_name") and not is_valid_display_name(msg["displayName"]):
        raise ProtocolError("NAME_INVALID", "Invalid display name")
    return msg


def validate_action_message(msg: Dict[str, Any]) -> None:
    msg_type = msg["type"]
    if msg_type == "action_ask":
        if msg["targetSeat"] not in range(6):
            raise ProtocolError("INVALID_TARGET", "Invalid target seat")
        if not isinstance(msg["cardId"], str):
            raise ProtocolError("INVALID_CARD", "Invalid card")
    if msg_type == "action_claim":
        assignments = msg.get("assignments", {})
        if not isinstance(assignments, dict):
            raise ProtocolError("INVALID_CLAIM_ASSIGNMENT", "Assignments must be an object")
        for card, seat in assignments.items():
            if not isinstance(card, str) or not isinstance(seat, int):
                raise ProtocolError("INVALID_CLAIM_ASSIGNMENT", "Assignments must map cardId to seat index")
    if msg_type == "action_disjoint":
        if msg["targetSeat"] not in range(6):
            raise ProtocolError("INVALID_TARGET", "Invalid target seat")
