from __future__ import annotations

import random
from typing import Any, Dict

from .strategic_bot import KnowledgeState, StrategicBot


class StrategicForgetfulBot(StrategicBot):
    def __init__(self, seat_index: int, rng: random.Random, forget_chance: float) -> None:
        super().__init__(seat_index, rng)
        self._forget_chance = max(0.0, min(0.3, forget_chance))

    def _should_forget_ask(self, entry: Dict[str, Any]) -> bool:
        if entry.get("kind") != "ASK":
            return False
        payload = entry.get("payload", {})
        from_seat = payload.get("fromSeat")
        to_seat = payload.get("toSeat")
        if from_seat == self._seat or to_seat == self._seat:
            return False
        entry_id = entry.get("id")
        if not isinstance(entry_id, str):
            return False
        seed = f"{entry_id}:{self._seat}:{payload.get('cardId', '')}"
        local_rng = random.Random(seed)
        return local_rng.random() < self._forget_chance

    def _build_knowledge(self, public_state: Dict[str, Any], hand: list[str]) -> KnowledgeState:
        return KnowledgeState(public_state, hand, self._seat, self._should_forget_ask)
