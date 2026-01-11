from __future__ import annotations

import random
from typing import Dict, List

from . import history as history_mod
from .models import CardId, Room, SeatKind, SetId, TeamId
from . import rules

def _append_history(room: Room, kind: str, payload: Dict[str, object]) -> None:
    entry = history_mod.new_history_entry(room.next_history_id, kind, payload)
    room.next_history_id += 1
    room.history.append(entry)
    if len(room.history) > 1000:
        room.history[:] = room.history[-1000:]


def _system(room: Room, message: str, data: Dict[str, object] | None = None) -> None:
    _append_history(room, "SYSTEM", history_mod.system_payload(message, data))


def _team_for_seat(room: Room, seat: int) -> TeamId:
    return room.team_of_seat[seat]


def _set_award_team(room: Room, claimant: int, correct: bool) -> TeamId:
    claimant_team = _team_for_seat(room, claimant)
    return claimant_team if correct else ("B" if claimant_team == "A" else "A")


class GameEngine:
    def __init__(self, rng: random.Random) -> None:
        self._rng = rng

    def start_game(self, room: Room) -> None:
        room.phase = room.phase.DEAL
        room.team_draw_cards = {}
        room.hands = rules.deal_hands(self._rng)
        _system(room, "Deal completed", {})

        room.phase = room.phase.PLAYING
        starters = [seat.index for seat in room.seats if seat.kind != SeatKind.EMPTY]
        if not starters:
            raise AssertionError("PHASE_INVALID")
        room.current_asker = self._rng.choice(starters)
        _system(room, "Game started", {"startingSeat": room.current_asker})

        self.assert_invariants(room)

    def legal_ask(self, room: Room, asker: int, target: int, card_id: CardId) -> bool:
        if room.phase != room.phase.PLAYING:
            return False
        if asker != room.current_asker:
            return False
        if target == asker:
            return False
        if target not in range(6):
            return False
        if card_id not in rules.CARD_TO_SET:
            return False
        if room.seats[target].kind == SeatKind.EMPTY:
            return False
        if not room.hands.get(target):
            return False
        pair = (min(asker, target), max(asker, target))
        if pair in room.disjoint_pairs:
            return False
        if _team_for_seat(room, asker) == _team_for_seat(room, target):
            return False
        if card_id in room.hands.get(asker, []):
            return False
        set_id = rules.set_id_for_card(card_id)
        return any(rules.set_id_for_card(card) == set_id for card in room.hands.get(asker, []))

    def perform_ask(self, room: Room, asker: int, target: int, card_id: CardId) -> str:
        if not self.legal_ask(room, asker, target, card_id):
            raise AssertionError("Illegal ask")
        target_hand = room.hands.get(target, [])
        result = "MISS"
        if card_id in target_hand:
            target_hand.remove(card_id)
            room.hands.setdefault(asker, []).append(card_id)
            result = "HIT"
        else:
            room.current_asker = target
        payload: Dict[str, object] = {
            "fromSeat": asker,
            "toSeat": target,
            "cardId": card_id,
            "result": result,
        }
        if result == "HIT":
            payload["transferred"] = [card_id]
        _append_history(room, "ASK", payload)
        self.assert_invariants(room)
        return result

    def perform_claim(self, room: Room, asker: int, set_id: SetId, assignments: Dict[CardId, int]) -> Dict[str, str]:
        if room.phase != room.phase.PLAYING:
            raise AssertionError("PHASE_INVALID")
        if set_id in room.captured_sets["A"] or set_id in room.captured_sets["B"]:
            raise AssertionError("CLAIM_SET_ALREADY_CAPTURED")
        required_cards = rules.cards_in_set(set_id)
        if set(assignments.keys()) != set(required_cards):
            raise AssertionError("INVALID_CLAIM_ASSIGNMENT")
        claimant_team = _team_for_seat(room, asker)
        for card, seat in assignments.items():
            if seat not in range(6):
                raise AssertionError("INVALID_CLAIM_ASSIGNMENT")
            if _team_for_seat(room, seat) != claimant_team:
                raise AssertionError("INVALID_CLAIM_ASSIGNMENT")
            if card not in rules.CARD_TO_SET:
                raise AssertionError("INVALID_CLAIM_ASSIGNMENT")
        correct = True
        holders: List[Dict[str, object]] = []
        for seat in range(6):
            cards = [card for card in required_cards if card in room.hands.get(seat, [])]
            if cards:
                holders.append({"seat": seat, "cards": list(cards)})
        for card in required_cards:
            true_holder = None
            for seat, hand in room.hands.items():
                if card in hand:
                    true_holder = seat
                    break
            if true_holder is None:
                correct = False
                break
            if assignments.get(card) != true_holder:
                correct = False
                break
        awarded = _set_award_team(room, asker, correct)
        room.captured_sets[awarded].append(set_id)
        for card in required_cards:
            for seat, hand in room.hands.items():
                if card in hand:
                    hand.remove(card)
        result_str = "CORRECT" if correct else "INCORRECT"
        payload: Dict[str, object] = {
            "fromSeat": asker,
            "setId": set_id,
            "result": result_str,
            "awardedToTeam": awarded,
            "holders": holders,
        }
        _append_history(room, "CLAIM", payload)
        if len(room.captured_sets["A"]) + len(room.captured_sets["B"]) == 9:
            room.phase = room.phase.FINISHED
            winning = "A" if len(room.captured_sets["A"]) > len(room.captured_sets["B"]) else "B"
            _system(room, "Game finished and winning team announced", {"winner": winning})
        self.assert_invariants(room)
        return {"result": result_str, "awardedToTeam": awarded}

    def assert_invariants(self, room: Room) -> None:
        all_cards: List[CardId] = []
        for hand in room.hands.values():
            all_cards.extend(hand)
        for team_sets in room.captured_sets.values():
            for set_id in team_sets:
                all_cards.extend(rules.cards_in_set(set_id))
        if len(all_cards) != len(set(all_cards)):
            raise AssertionError("Card ownership violated")
        if len(all_cards) != 54:
            raise AssertionError("Card conservation violated")
        if room.phase == room.phase.PLAYING and room.current_asker not in range(6):
            raise AssertionError("Invalid current asker")
        for seat, team in room.team_of_seat.items():
            if seat not in range(6):
                raise AssertionError("Invalid team assignment")
            if team not in ("A", "B"):
                raise AssertionError("Invalid team id")
