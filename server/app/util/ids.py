from __future__ import annotations

import random
import string

BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
ROOM_CODE_LEN = 6


def generate_room_code(rng: random.Random) -> str:
    return "".join(rng.choice(BASE32_ALPHABET) for _ in range(ROOM_CODE_LEN))


def is_valid_room_code(code: str) -> bool:
    if len(code) != ROOM_CODE_LEN:
        return False
    return all(ch in BASE32_ALPHABET for ch in code)


def normalize_display_name(name: str) -> str:
    return name.strip()


def is_valid_display_name(name: str) -> bool:
    if not isinstance(name, str):
        return False
    name = normalize_display_name(name)
    return 1 <= len(name) <= 20
