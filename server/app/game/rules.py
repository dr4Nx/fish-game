from __future__ import annotations

import random
from typing import Dict, List, Tuple

from .models import CardId, SetId, TeamId

SUITS = ["C", "D", "H", "S"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
JOKERS = ["JOKER1", "JOKER2"]

STANDARD_DECK = [f"{rank}{suit}" for suit in SUITS for rank in RANKS]
FULL_DECK = STANDARD_DECK + JOKERS

SET_CARDS: Dict[SetId, List[CardId]] = {
    "LOW_C": ["2C", "3C", "4C", "5C", "6C", "7C"],
    "HIGH_C": ["9C", "10C", "JC", "QC", "KC", "AC"],
    "LOW_D": ["2D", "3D", "4D", "5D", "6D", "7D"],
    "HIGH_D": ["9D", "10D", "JD", "QD", "KD", "AD"],
    "LOW_H": ["2H", "3H", "4H", "5H", "6H", "7H"],
    "HIGH_H": ["9H", "10H", "JH", "QH", "KH", "AH"],
    "LOW_S": ["2S", "3S", "4S", "5S", "6S", "7S"],
    "HIGH_S": ["9S", "10S", "JS", "QS", "KS", "AS"],
    "SPECIALS": ["8C", "8D", "8H", "8S", "JOKER1", "JOKER2"],
}

CARD_TO_SET: Dict[CardId, SetId] = {}
for set_id, cards in SET_CARDS.items():
    for card in cards:
        CARD_TO_SET[card] = set_id


def build_full_deck() -> List[CardId]:
    return list(FULL_DECK)


def build_standard_deck() -> List[CardId]:
    return list(STANDARD_DECK)


def cards_in_set(set_id: SetId) -> List[CardId]:
    return list(SET_CARDS[set_id])


def set_id_for_card(card_id: CardId) -> SetId:
    return CARD_TO_SET[card_id]


def deal_hands(rng: random.Random) -> Dict[int, List[CardId]]:
    deck = build_full_deck()
    rng.shuffle(deck)
    hands: Dict[int, List[CardId]] = {}
    for seat in range(6):
        hands[seat] = deck[seat * 9 : (seat + 1) * 9]
    return hands


def draw_team_cards(rng: random.Random) -> Dict[int, CardId]:
    deck = build_standard_deck()
    rng.shuffle(deck)
    return {seat: deck[seat] for seat in range(6)}


def rank_team_draw(card_id: CardId) -> Tuple[int, int]:
    rank_str = card_id[:-1]
    suit = card_id[-1]
    rank_order = {
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
        "J": 11,
        "Q": 12,
        "K": 13,
        "A": 14,
    }
    suit_order = {"C": 1, "D": 2, "H": 3, "S": 4}
    return (rank_order[rank_str], suit_order[suit])


def assign_teams(team_draw_cards: Dict[int, CardId]) -> Dict[int, TeamId]:
    ordered = sorted(
        team_draw_cards.items(),
        key=lambda item: rank_team_draw(item[1]),
        reverse=True,
    )
    team_of_seat: Dict[int, TeamId] = {}
    for idx, (seat, _card) in enumerate(ordered):
        team_of_seat[seat] = "A" if idx < 3 else "B"
    return team_of_seat
