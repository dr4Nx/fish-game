from __future__ import annotations

import random
from typing import Any, Dict, List, Optional

from .interfaces import Bot
from ..game import rules

def _team_for_seat(public_state: Dict[str, Any], seat_index: int) -> Optional[str]:
    teams = public_state.get("teams", {"A": [], "B": []})
    if seat_index in teams.get("A", []):
        return "A"
    if seat_index in teams.get("B", []):
        return "B"
    return None


def _opposing_seats(public_state: Dict[str, Any], seat_index: int) -> List[int]:
    teams = public_state.get("teams", {"A": [], "B": []})
    team = _team_for_seat(public_state, seat_index)
    if not team:
        return []
    opponents = teams["B" if team == "A" else "A"]
    hand_counts = public_state.get("handCounts", {})
    disjoint_pairs = {
        f"{min(pair['a'], pair['b'])}-{max(pair['a'], pair['b'])}"
        for pair in public_state.get("disjointPairs", [])
        if "a" in pair and "b" in pair
    }
    filtered: List[int] = []
    for seat in opponents:
        if int(hand_counts.get(str(seat), 0)) <= 0:
            continue
        key = f"{min(seat, seat_index)}-{max(seat, seat_index)}"
        if key in disjoint_pairs:
            continue
        filtered.append(seat)
    return filtered


class MemoryBot(Bot):
    def __init__(self, seat_index: int, rng: random.Random) -> None:
        self._seat = seat_index
        self._rng = rng
        self._known_cards: Dict[str, int] = {}

    def observe_history(self, history: List[Dict[str, Any]]) -> None:
        for entry in history:
            if entry.get("kind") != "ASK":
                continue
            payload = entry.get("payload", {})
            if payload.get("result") == "HIT":
                transferred = payload.get("transferred", [])
                if transferred:
                    self._known_cards[transferred[0]] = payload.get("fromSeat")

    def select_action(self, public_state: Dict[str, Any], hand: List[str]) -> Dict[str, Any]:
        opponents = _opposing_seats(public_state, self._seat)
        if opponents:
            for card, seat in list(self._known_cards.items()):
                if card in hand or seat not in opponents:
                    continue
                set_id = rules.set_id_for_card(card)
                if any(rules.set_id_for_card(h) == set_id for h in hand):
                    return {"type": "action_ask", "targetSeat": seat, "cardId": card}
        # Fallback to a random legal ask.
        cards_by_set: Dict[str, List[str]] = {}
        for card in hand:
            set_id = rules.set_id_for_card(card)
            cards_by_set.setdefault(set_id, []).append(card)
        legal_asks: List[Dict[str, Any]] = []
        for set_id in cards_by_set:
            for card in rules.cards_in_set(set_id):
                if card in hand:
                    continue
                for target in opponents:
                    legal_asks.append({"targetSeat": target, "cardId": card})
        if legal_asks:
            choice = self._rng.choice(legal_asks)
            return {"type": "action_ask", "targetSeat": choice["targetSeat"], "cardId": choice["cardId"]}
        for set_id, cards in rules.SET_CARDS.items():
            if all(card in hand for card in cards):
                assignments = {card: self._seat for card in cards}
                return {"type": "action_claim", "setId": set_id, "assignments": assignments}
        captured = public_state.get("capturedSets", {"A": [], "B": []})
        teams = public_state.get("teams", {"A": [], "B": []})
        team_id = "A" if self._seat in teams.get("A", []) else "B"
        team_seats = teams.get(team_id, [])
        available_sets = [set_id for set_id in rules.SET_CARDS if set_id not in captured.get("A", []) + captured.get("B", [])]
        if available_sets and team_seats:
            set_id = self._rng.choice(available_sets)
            assignments = {card: self._rng.choice(team_seats) for card in rules.cards_in_set(set_id)}
            return {"type": "action_claim", "setId": set_id, "assignments": assignments}
        return {"type": "action_claim", "setId": "LOW_C", "assignments": {card: self._seat for card in rules.cards_in_set("LOW_C")}}
