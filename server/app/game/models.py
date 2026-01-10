from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple, TypeAlias


class Phase(str, Enum):
    LOBBY = "LOBBY"
    DEAL = "DEAL"
    PLAYING = "PLAYING"
    FINISHED = "FINISHED"


class SeatKind(str, Enum):
    HUMAN = "human"
    BOT = "bot"
    EMPTY = "empty"


CardId: TypeAlias = str
SetId: TypeAlias = str
TeamId: TypeAlias = str


@dataclass
class Seat:
    index: int
    kind: SeatKind
    display_name: Optional[str]
    connected: bool
    player_key: Optional[str]
    bot_id: Optional[str]
    reserved_player_key: Optional[str] = None


@dataclass
class Room:
    code: str
    phase: Phase
    seats: List[Seat]
    host_seat: Optional[int]
    host_player_key: Optional[str]
    is_public: bool = False
    history_length: int = 3
    team_of_seat: Dict[int, TeamId] = field(default_factory=dict)
    team_draw_cards: Dict[int, CardId] = field(default_factory=dict)
    hands: Dict[int, List[CardId]] = field(default_factory=dict)
    current_asker: int = -1
    disjoint_pairs: Set[Tuple[int, int]] = field(default_factory=set)
    captured_sets: Dict[TeamId, List[SetId]] = field(default_factory=lambda: {"A": [], "B": []})
    history: List[dict] = field(default_factory=list)
    next_history_id: int = 1
