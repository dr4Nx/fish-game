from __future__ import annotations

import random
from typing import Any, Dict, List, Optional

from .interfaces import Bot
from ..game import rules

def _list_legal_asks(public_state: Dict[str, Any], hand: List[str], seat_index: int) -> List[Dict[str, Any]]:
    team_map = public_state.get("teams", {"A": [], "B": []})
    my_team: Optional[str] = None
    for team_id, seats in team_map.items():
        if seat_index in seats:
            my_team = team_id
            break
    if not my_team:
        return []
    opposing = team_map["B" if my_team == "A" else "A"]
    hand_counts = public_state.get("handCounts", {})
    disjoint_pairs = {
        f"{min(pair['a'], pair['b'])}-{max(pair['a'], pair['b'])}"
        for pair in public_state.get("disjointPairs", [])
        if "a" in pair and "b" in pair
    }
    cards_by_set: Dict[str, List[str]] = {}
    for card in hand:
        set_id = rules.set_id_for_card(card)
        cards_by_set.setdefault(set_id, []).append(card)
    legal_actions: List[Dict[str, Any]] = []
    for set_id, cards in cards_by_set.items():
        for card in rules.cards_in_set(set_id):
            if card in hand:
                continue
            for target in opposing:
                if int(hand_counts.get(str(target), 0)) <= 0:
                    continue
                pair_key = f"{min(target, seat_index)}-{max(target, seat_index)}"
                if pair_key in disjoint_pairs:
                    continue
                legal_actions.append({"targetSeat": target, "cardId": card})
    return legal_actions


class RandomBot(Bot):
    def __init__(self, seat_index: int, rng: random.Random) -> None:
        self._seat = seat_index
        self._rng = rng

    def select_action(self, public_state: Dict[str, Any], hand: List[str]) -> Dict[str, Any]:
        legal_asks = _list_legal_asks(public_state, hand, self._seat)
        if legal_asks:
            choice = self._rng.choice(legal_asks)
            return {
                "type": "action_ask",
                "targetSeat": choice["targetSeat"],
                "cardId": choice["cardId"],
            }
        for set_id, cards in rules.SET_CARDS.items():
            if all(card in hand for card in cards):
                assignments = {card: self._seat for card in cards}
                return {
                    "type": "action_claim",
                    "setId": set_id,
                    "assignments": assignments,
                }
        teams = public_state.get("teams", {"A": [], "B": []})
        captured = public_state.get("capturedSets", {"A": [], "B": []})
        team_id = "A" if self._seat in teams.get("A", []) else "B"
        team_seats = teams.get(team_id, [])
        available_sets = [set_id for set_id in rules.SET_CARDS if set_id not in captured.get("A", []) + captured.get("B", [])]
        if available_sets and team_seats:
            set_id = self._rng.choice(available_sets)
            assignments = {card: self._rng.choice(team_seats) for card in rules.cards_in_set(set_id)}
            return {"type": "action_claim", "setId": set_id, "assignments": assignments}
        return {"type": "action_claim", "setId": "LOW_C", "assignments": {card: self._seat for card in rules.cards_in_set("LOW_C")}}
