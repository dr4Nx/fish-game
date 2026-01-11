from __future__ import annotations

import random
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

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


def _history_start_index(history: List[Dict[str, Any]]) -> int:
    for idx in range(len(history) - 1, -1, -1):
        entry = history[idx]
        if entry.get("kind") != "SYSTEM":
            continue
        payload = entry.get("payload", {})
        message = payload.get("message", "")
        if isinstance(message, str) and message.startswith("Game started"):
            return idx
    return 0


class KnowledgeState:
    def __init__(
        self,
        public_state: Dict[str, Any],
        hand: List[str],
        seat_index: int,
        forget_ask: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ) -> None:
        self._public_state = public_state
        self._hand = set(hand)
        self._seat = seat_index
        self._history = public_state.get("history", [])
        self._forget_ask = forget_ask
        self._hand_counts = {
            int(seat): int(count) for seat, count in public_state.get("handCounts", {}).items()
        }
        self._captured_sets = set(public_state.get("capturedSets", {}).get("A", [])) | set(
            public_state.get("capturedSets", {}).get("B", [])
        )
        self._seat_sets: Dict[int, Set[str]] = {seat: set() for seat in range(6)}
        self._possible_holders: Dict[str, Set[int]] = {
            card: set(range(6)) for card in rules.FULL_DECK
        }
        self._known_holder: Dict[str, int] = {}
        self._build()

    def possible_holders(self) -> Dict[str, Set[int]]:
        return self._possible_holders

    def known_holder(self) -> Dict[str, int]:
        return self._known_holder

    def seat_sets(self) -> Dict[int, Set[str]]:
        return self._seat_sets

    def _build(self) -> None:
        # Remove captured cards from all possible holders.
        for set_id in self._captured_sets:
            for card in rules.cards_in_set(set_id):
                self._possible_holders[card] = set()

        # Seats with no cards cannot hold any cards.
        for seat in range(6):
            if self._hand_counts.get(seat, 0) <= 0:
                for card in self._possible_holders:
                    self._possible_holders[card].discard(seat)

        # Our own hand is fully known.
        for card in rules.FULL_DECK:
            if card in self._hand:
                self._possible_holders[card] = {self._seat}
            else:
                self._possible_holders[card].discard(self._seat)

        start_index = _history_start_index(self._history)
        for entry in self._history[start_index:]:
            kind = entry.get("kind")
            payload = entry.get("payload", {})
            if kind == "ASK":
                if self._forget_ask and self._forget_ask(entry):
                    continue
                card_id = payload.get("cardId")
                from_seat = payload.get("fromSeat")
                to_seat = payload.get("toSeat")
                result = payload.get("result")
                if not isinstance(card_id, str) or card_id not in rules.CARD_TO_SET:
                    continue
                if not isinstance(from_seat, int) or not isinstance(to_seat, int):
                    continue
                set_id = rules.set_id_for_card(card_id)
                self._seat_sets[from_seat].add(set_id)
                if result == "HIT":
                    self._possible_holders[card_id] = {from_seat}
                elif result == "MISS":
                    self._possible_holders[card_id].discard(from_seat)
                    self._possible_holders[card_id].discard(to_seat)
            elif kind == "DISJOINT":
                transferred_sets = payload.get("transferredSets", [])
                if not isinstance(transferred_sets, list):
                    continue
                for set_id in transferred_sets:
                    if set_id in rules.SET_CARDS:
                        for card in rules.cards_in_set(set_id):
                            self._possible_holders[card] = set()
            elif kind == "CLAIM":
                set_id = payload.get("setId")
                if isinstance(set_id, str) and set_id in rules.SET_CARDS:
                    for card in rules.cards_in_set(set_id):
                        self._possible_holders[card] = set()

        self._propagate()

    def _propagate(self) -> None:
        changed = True
        while changed:
            changed = False
            for card, holders in self._possible_holders.items():
                if len(holders) == 1:
                    seat = next(iter(holders))
                    if self._known_holder.get(card) != seat:
                        self._known_holder[card] = seat
                        changed = True

            for card, seat in self._known_holder.items():
                self._possible_holders[card] = {seat}
                self._seat_sets[seat].add(rules.set_id_for_card(card))

            for seat in range(6):
                count = self._hand_counts.get(seat, 0)
                possible_cards = [card for card, holders in self._possible_holders.items() if seat in holders]
                known_cards = [card for card, holder in self._known_holder.items() if holder == seat]
                if count > 0 and len(possible_cards) == count:
                    for card in possible_cards:
                        if self._known_holder.get(card) != seat:
                            self._known_holder[card] = seat
                            self._possible_holders[card] = {seat}
                            changed = True
                if count == len(known_cards):
                    for card, holders in self._possible_holders.items():
                        if card in self._known_holder:
                            continue
                        if seat in holders:
                            holders.discard(seat)
                            changed = True


class StrategicBot(Bot):
    def __init__(self, seat_index: int, rng: random.Random) -> None:
        self._seat = seat_index
        self._rng = rng

    def _build_knowledge(self, public_state: Dict[str, Any], hand: List[str]) -> KnowledgeState:
        return KnowledgeState(public_state, hand, self._seat)

    def select_action(self, public_state: Dict[str, Any], hand: List[str]) -> Dict[str, Any]:
        if public_state.get("phase") != "PLAYING":
            return {"type": "action_none"}
        knowledge = self._build_knowledge(public_state, hand)
        team = _team_for_seat(public_state, self._seat)
        if not team:
            return {"type": "action_none"}
        opponents = _opposing_seats(public_state, self._seat)
        if not opponents:
            return {"type": "action_none"}
        hand_sets = {rules.set_id_for_card(card) for card in hand}
        askable_cards: List[str] = []
        for set_id in hand_sets:
            for card in rules.cards_in_set(set_id):
                if card not in hand and card not in askable_cards:
                    askable_cards.append(card)

        possible_holders = knowledge.possible_holders()
        known_holder = knowledge.known_holder()
        seat_sets = knowledge.seat_sets()
        team_seats = set(public_state.get("teams", {}).get(team, []))
        hand_counts = {
            int(seat): int(count) for seat, count in public_state.get("handCounts", {}).items()
        }
        seat_possible: Dict[int, Set[str]] = {seat: set() for seat in range(6)}
        for card, holders in possible_holders.items():
            for seat in holders:
                seat_possible[seat].add(card)
        known_counts: Dict[int, int] = {seat: 0 for seat in range(6)}
        for seat in known_holder.values():
            known_counts[seat] = known_counts.get(seat, 0) + 1

        candidates: List[Tuple[float, Dict[str, Any]]] = []
        for card in askable_cards:
            holders = possible_holders.get(card, set())
            if not holders:
                continue
            set_id = rules.set_id_for_card(card)
            for target in opponents:
                if target not in holders:
                    continue
                score = 0.0
                if len(holders) == 1:
                    score += 1000.0
                base_prob = 1.0 / max(1, len(holders))
                score += 200.0 * base_prob
                remaining = max(0, hand_counts.get(target, 0) - known_counts.get(target, 0))
                possible_count = len(seat_possible.get(target, set()))
                if possible_count > 0:
                    seat_factor = remaining / possible_count
                    score += 75.0 * base_prob * max(0.25, seat_factor)
                if set_id in seat_sets.get(target, set()):
                    score += 15.0
                own_count = sum(1 for c in rules.cards_in_set(set_id) if c in hand)
                team_known = sum(
                    1
                    for c in rules.cards_in_set(set_id)
                    if known_holder.get(c) in team_seats
                )
                score += 6.0 * float(own_count + team_known)
                if own_count + team_known >= 4:
                    score += 15.0
                score += 0.35 * float(hand_counts.get(target, 0))
                if all(seat in opponents for seat in holders):
                    score += 5.0
                candidates.append((score, {"targetSeat": target, "cardId": card}))

        if candidates:
            best_score = max(score for score, _ in candidates)
            best_choices = [choice for score, choice in candidates if score == best_score]
            pick = self._rng.choice(best_choices)
            return {"type": "action_ask", "targetSeat": pick["targetSeat"], "cardId": pick["cardId"]}
        return {"type": "action_none"}

    def select_disjoint_target(self, public_state: Dict[str, Any], hand: List[str]) -> Optional[int]:
        if public_state.get("phase") != "PLAYING":
            return None
        knowledge = self._build_knowledge(public_state, hand)
        opponents = _opposing_seats(public_state, self._seat)
        if not opponents:
            return None
        hand_sets = {rules.set_id_for_card(card) for card in hand}
        possible_holders = knowledge.possible_holders()
        for opponent in opponents:
            overlap = False
            for set_id in hand_sets:
                if any(opponent in possible_holders.get(card, set()) for card in rules.cards_in_set(set_id)):
                    overlap = True
                    break
            if not overlap:
                return opponent
        return None

    def select_claim(self, public_state: Dict[str, Any], hand: List[str]) -> Optional[Tuple[str, Dict[str, int]]]:
        if public_state.get("phase") != "PLAYING":
            return None
        knowledge = self._build_knowledge(public_state, hand)
        known_holder = knowledge.known_holder()
        captured = set(public_state.get("capturedSets", {}).get("A", [])) | set(
            public_state.get("capturedSets", {}).get("B", [])
        )
        team = _team_for_seat(public_state, self._seat)
        if not team:
            return None
        team_seats = set(public_state.get("teams", {}).get(team, []))
        for set_id, cards in rules.SET_CARDS.items():
            if set_id in captured:
                continue
            assignments: Dict[str, int] = {}
            known_all = True
            for card in cards:
                holder = known_holder.get(card)
                if holder is None or holder not in team_seats:
                    known_all = False
                    break
                assignments[card] = holder
            if known_all:
                return set_id, assignments
        return None

    def select_best_guess_claim(
        self, public_state: Dict[str, Any], hand: List[str]
    ) -> Optional[Tuple[str, Dict[str, int]]]:
        if public_state.get("phase") != "PLAYING":
            return None
        knowledge = self._build_knowledge(public_state, hand)
        team = _team_for_seat(public_state, self._seat)
        if not team:
            return None
        team_seats = set(public_state.get("teams", {}).get(team, []))
        if not team_seats:
            return None
        captured = set(public_state.get("capturedSets", {}).get("A", [])) | set(
            public_state.get("capturedSets", {}).get("B", [])
        )
        hand_counts = {
            int(seat): int(count) for seat, count in public_state.get("handCounts", {}).items()
        }
        known_holder = knowledge.known_holder()
        possible_holders = knowledge.possible_holders()

        best_score: Optional[float] = None
        best_choice: Optional[Tuple[str, Dict[str, int]]] = None
        for set_id, cards in rules.SET_CARDS.items():
            if set_id in captured:
                continue
            assignments: Dict[str, int] = {}
            score = 0.0
            for card in cards:
                holder = known_holder.get(card)
                if holder is not None and holder in team_seats:
                    assignments[card] = holder
                    continue
                candidates = list(possible_holders.get(card, set()) & team_seats)
                if candidates:
                    max_count = max(hand_counts.get(seat, 0) for seat in candidates)
                    best_candidates = [
                        seat for seat in candidates if hand_counts.get(seat, 0) == max_count
                    ]
                    chosen = self._rng.choice(best_candidates)
                    assignments[card] = chosen
                    score += -1.0 * float(len(candidates))
                else:
                    max_count = max(hand_counts.get(seat, 0) for seat in team_seats)
                    best_candidates = [
                        seat for seat in team_seats if hand_counts.get(seat, 0) == max_count
                    ]
                    chosen = self._rng.choice(best_candidates)
                    assignments[card] = chosen
                    score += -10.0
            if best_score is None or score > best_score:
                best_score = score
                best_choice = (set_id, assignments)
        return best_choice
