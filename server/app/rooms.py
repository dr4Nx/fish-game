from __future__ import annotations

import asyncio
import os
import random
from typing import Any, Awaitable, Callable, Dict, List, Optional

from .bots.memory_bot import MemoryBot
from .bots.random_bot import RandomBot
from .bots.strategic_bot import StrategicBot
from .game.engine import GameEngine
from .game.models import CardId, Phase, Room, Seat, SeatKind, SetId
from .game import rules
from .game import history as history_mod
from .util.ids import generate_room_code

_BOT_NOUNS = ["Unicorn", "Falcon", "Otter", "Tiger", "Comet", "Dolphin", "Panda", "Fox", "Lion", "Whale"]

class RoomRegistry:
    def __init__(self, rng: random.Random) -> None:
        self._rng = rng
        self._rooms: Dict[str, Room] = {}
        self._engine = GameEngine(rng)
        self._reclaim_tasks: Dict[str, Dict[int, asyncio.Task[None]]] = {}
        self._bot_tasks: Dict[str, asyncio.Task[None]] = {}
        self._on_update: Optional[Callable[[str], Awaitable[None]]] = None

    def set_update_callback(self, callback: Callable[[str], Awaitable[None]]) -> None:
        self._on_update = callback

    def schedule_bot_turns(self, room: Room, on_update: Callable[[str], Awaitable[None]]) -> None:
        task = self._bot_tasks.get(room.code)
        if task and not task.done():
            return
        self._bot_tasks[room.code] = asyncio.create_task(self.handle_bot_turns(room, on_update))

    def create_room(self, player_key: str, display_name: str) -> Room:
        room_code = generate_room_code(self._rng)
        while room_code in self._rooms:
            room_code = generate_room_code(self._rng)
        seats = [Seat(index=i, kind=SeatKind.EMPTY, display_name=None, connected=False, player_key=None, bot_id=None) for i in range(6)]
        host_seat = 0
        unique_name = self._unique_display_name(None, display_name)
        seats[host_seat] = Seat(
            index=host_seat,
            kind=SeatKind.HUMAN,
            display_name=unique_name,
            connected=True,
            player_key=player_key,
            bot_id=None,
            reserved_player_key=player_key,
        )
        room = Room(
            code=room_code,
            phase=Phase.LOBBY,
            seats=seats,
            host_seat=host_seat,
            host_player_key=player_key,
        )
        self._append_history(room, "SYSTEM", history_mod.system_payload("Room created", {}))
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload("Player joined", {"seat": host_seat, "displayName": unique_name}),
        )
        self._rooms[room_code] = room
        self._reclaim_tasks[room_code] = {}
        return room

    def update_settings(self, player_key: str, room_code: str, is_public: bool, history_length: int) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        if not isinstance(history_length, int) or history_length < 1 or history_length > 20:
            raise AssertionError("BAD_MESSAGE")
        prev_public = room.is_public
        prev_length = room.history_length
        room.is_public = bool(is_public)
        room.history_length = history_length
        if prev_public != room.is_public:
            status = "public" if room.is_public else "private"
            self._append_history(room, "SYSTEM", history_mod.system_payload(f"The host made the lobby {status}.", {}))
        if prev_length != room.history_length:
            self._append_history(
                room,
                "SYSTEM",
                history_mod.system_payload(
                    f"The host changed the amount of visible turns to {room.history_length}.",
                    {},
                ),
            )

    def get_room(self, room_code: str) -> Optional[Room]:
        return self._rooms.get(room_code)

    def join_room(self, player_key: str, display_name: str, room_code: str) -> Room:
        room = self._rooms.get(room_code)
        if not room:
            raise AssertionError("ROOM_NOT_FOUND")
        if not display_name:
            raise AssertionError("NAME_INVALID")
        seat_idx = self._find_seat_for_player(room, player_key)
        if seat_idx is not None:
            seat = room.seats[seat_idx]
            if seat.player_key == player_key and seat.connected:
                return room
            was_bot = seat.kind == SeatKind.BOT
            seat.kind = SeatKind.HUMAN
            seat.connected = True
            seat.player_key = player_key
            seat.display_name = self._unique_display_name(room, display_name, seat_idx)
            seat.bot_id = None
            seat.reserved_player_key = player_key
            self._cancel_reclaim(room_code, seat_idx)
            self._append_history(
                room,
                "SYSTEM",
                history_mod.system_payload(
                    "Player reconnected and reclaimed seat",
                    {"seat": seat_idx, "displayName": seat.display_name},
                ),
            )
            if was_bot:
                self._append_history(
                    room,
                    "SYSTEM",
                    history_mod.system_payload(
                        "Human reclaimed seat from bot",
                        {"seat": seat_idx, "displayName": seat.display_name},
                    ),
                )
            if room.host_seat is None:
                room.host_seat = seat_idx
                room.host_player_key = player_key
            return room
        if room.phase != Phase.LOBBY:
            raise AssertionError("GAME_IN_PROGRESS")
        empty = next((s for s in room.seats if s.kind == SeatKind.EMPTY), None)
        if not empty:
            empty = next((s for s in room.seats if s.kind == SeatKind.BOT), None)
        if not empty:
            raise AssertionError("ROOM_FULL")
        room.team_of_seat.pop(empty.index, None)
        unique_name = self._unique_display_name(room, display_name)
        empty.kind = SeatKind.HUMAN
        empty.connected = True
        empty.player_key = player_key
        empty.display_name = unique_name
        empty.bot_id = None
        empty.reserved_player_key = player_key
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload("Player joined", {"seat": empty.index, "displayName": unique_name}),
        )
        if room.host_seat is None:
            room.host_seat = empty.index
            room.host_player_key = player_key
        return room

    def set_name(self, player_key: str, display_name: str, room_code: str) -> None:
        room = self._require_room(room_code)
        seat_idx = self._find_seat_for_player(room, player_key)
        if seat_idx is None:
            raise AssertionError("NOT_IN_ROOM")
        room.seats[seat_idx].display_name = self._unique_display_name(room, display_name, seat_idx)

    def set_team(self, player_key: str, room_code: str, team_id: str) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        seat_idx = self._require_seat(room, player_key)
        if team_id not in ("A", "B"):
            raise AssertionError("BAD_MESSAGE")
        counts = {"A": 0, "B": 0}
        for seat, team in room.team_of_seat.items():
            if team in counts:
                counts[team] += 1
        current = room.team_of_seat.get(seat_idx)
        if current == team_id:
            return
        if counts[team_id] >= 3:
            raise AssertionError("ROOM_FULL")
        room.team_of_seat[seat_idx] = team_id

    def randomize_teams(self, player_key: str, room_code: str) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        human_seats = [seat.index for seat in room.seats if seat.kind == SeatKind.HUMAN]
        self._rng.shuffle(human_seats)
        room.team_of_seat.clear()
        total = min(len(human_seats), 6)
        if total == 0:
            return
        team_counts = {"A": 0, "B": 0}
        for seat_idx in human_seats[:total]:
            options = []
            if team_counts["A"] < 3:
                options.append("A")
            if team_counts["B"] < 3:
                options.append("B")
            if not options:
                break
            team_id = self._rng.choice(options)
            team_counts[team_id] += 1
            room.team_of_seat[seat_idx] = team_id
        bot_seats = [seat.index for seat in room.seats if seat.kind == SeatKind.BOT]
        if bot_seats:
            needed = {"A": 3 - team_counts["A"], "B": 3 - team_counts["B"]}
            assignments = ["A"] * max(0, needed["A"]) + ["B"] * max(0, needed["B"])
            self._rng.shuffle(assignments)
            assignments = assignments[: len(bot_seats)]
            self._rng.shuffle(bot_seats)
            for seat_idx, team_id in zip(bot_seats, assignments):
                room.team_of_seat[seat_idx] = team_id

    def unassign_team(self, player_key: str, room_code: str) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        seat_idx = self._require_seat(room, player_key)
        room.team_of_seat.pop(seat_idx, None)

    def fill_bots(self, player_key: str, room_code: str) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        human_seats = [seat for seat in room.seats if seat.kind == SeatKind.HUMAN]
        if not human_seats:
            raise AssertionError("PHASE_INVALID")
        team_counts = {"A": 0, "B": 0}
        for team_id in room.team_of_seat.values():
            if team_id in team_counts:
                team_counts[team_id] += 1
        empty_seats = [seat for seat in room.seats if seat.kind == SeatKind.EMPTY]
        if not empty_seats:
            return
        for seat in empty_seats:
            choices = []
            if team_counts["A"] < 3:
                choices.append("A")
            if team_counts["B"] < 3:
                choices.append("B")
            if not choices:
                raise AssertionError("PHASE_INVALID")
            team_id = self._rng.choice(choices)
            team_counts[team_id] += 1
            seat.kind = SeatKind.BOT
            seat.bot_id = os.getenv("BOT_DEFAULT", "strategic_bot")
            seat.display_name = self._bot_display_name(room)
            seat.connected = False
            seat.player_key = None
            seat.reserved_player_key = None
            room.team_of_seat[seat.index] = team_id
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload("The host filled empty seats with bots.", {}),
        )

    def fill_bot_seat(self, player_key: str, room_code: str, seat_idx: int) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        if seat_idx not in range(6):
            raise AssertionError("INVALID_TARGET")
        seat = room.seats[seat_idx]
        if seat.kind != SeatKind.EMPTY:
            raise AssertionError("INVALID_TARGET")
        human_seats = [seat for seat in room.seats if seat.kind == SeatKind.HUMAN]
        if not human_seats:
            raise AssertionError("PHASE_INVALID")
        team_counts = {"A": 0, "B": 0}
        for team_id in room.team_of_seat.values():
            if team_id in team_counts:
                team_counts[team_id] += 1
        if team_counts["A"] >= 3 and team_counts["B"] >= 3:
            raise AssertionError("PHASE_INVALID")
        if team_counts["A"] >= 3:
            team_id = "B"
        elif team_counts["B"] >= 3:
            team_id = "A"
        else:
            team_id = self._rng.choice(["A", "B"])
        seat.kind = SeatKind.BOT
        seat.bot_id = os.getenv("BOT_DEFAULT", "strategic_bot")
        seat.display_name = self._bot_display_name(room)
        seat.connected = False
        seat.player_key = None
        seat.reserved_player_key = None
        room.team_of_seat[seat.index] = team_id
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload(
                f"The host added a bot to seat {seat.index}.",
                {"seat": seat.index, "displayName": seat.display_name},
            ),
        )

    def kick_seat(self, player_key: str, room_code: str, seat_idx: int) -> Optional[str]:
        room = self._require_room(room_code)
        if room.phase not in (Phase.LOBBY, Phase.FINISHED):
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        if seat_idx not in range(6):
            raise AssertionError("INVALID_TARGET")
        if room.host_seat == seat_idx:
            raise AssertionError("INVALID_TARGET")
        seat = room.seats[seat_idx]
        if seat.kind == SeatKind.EMPTY:
            raise AssertionError("INVALID_TARGET")
        kicked_player_key = seat.player_key or seat.reserved_player_key
        display_name = seat.display_name
        seat.kind = SeatKind.EMPTY
        seat.connected = False
        seat.player_key = None
        seat.display_name = None
        seat.bot_id = None
        seat.reserved_player_key = None
        room.team_of_seat.pop(seat_idx, None)
        self._cancel_reclaim(room_code, seat_idx)
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload(
                "Seat kicked by host",
                {"seat": seat_idx, "displayName": display_name},
            ),
        )
        if kicked_player_key == room.host_player_key:
            self._transfer_host(room)
        if not self._room_has_humans(room):
            self._delete_room(room_code)
        return kicked_player_key

    def transfer_host(self, player_key: str, room_code: str, seat_idx: int) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        if seat_idx not in range(6):
            raise AssertionError("INVALID_TARGET")
        if room.host_seat == seat_idx:
            return
        seat = room.seats[seat_idx]
        if seat.kind != SeatKind.HUMAN or not seat.player_key:
            raise AssertionError("INVALID_TARGET")
        room.host_seat = seat_idx
        room.host_player_key = seat.player_key
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload(
                "Host transferred",
                {"seat": seat_idx, "displayName": seat.display_name},
            ),
        )

    def start_game(self, player_key: str, room_code: str) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.LOBBY:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        if any(seat.kind == SeatKind.EMPTY for seat in room.seats):
            raise AssertionError("PHASE_INVALID")
        team_counts = {"A": 0, "B": 0}
        for seat in room.seats:
            team_id = room.team_of_seat.get(seat.index)
            if team_id not in ("A", "B"):
                raise AssertionError("PHASE_INVALID")
            team_counts[team_id] += 1
        if team_counts["A"] != 3 or team_counts["B"] != 3:
            raise AssertionError("PHASE_INVALID")
        self._engine.start_game(room)

    def leave_room(self, player_key: str, room_code: str) -> None:
        room = self._require_room(room_code)
        if room.phase not in (Phase.LOBBY, Phase.FINISHED):
            raise AssertionError("PHASE_INVALID")
        seat_idx = self._require_seat(room, player_key)
        seat = room.seats[seat_idx]
        display_name = seat.display_name
        seat.kind = SeatKind.EMPTY
        seat.connected = False
        seat.player_key = None
        seat.display_name = None
        seat.bot_id = None
        seat.reserved_player_key = None
        room.team_of_seat.pop(seat_idx, None)
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload(
                "Player left room voluntarily",
                {"seat": seat_idx, "displayName": display_name},
            ),
        )
        if room.host_player_key == player_key:
            self._transfer_host(room)
        if not self._room_has_humans(room):
            self._delete_room(room_code)

    def reset_room(self, player_key: str, room_code: str) -> None:
        room = self._require_room(room_code)
        if room.phase != Phase.FINISHED:
            raise AssertionError("PHASE_INVALID")
        if room.host_player_key != player_key:
            raise AssertionError("NOT_YOUR_TURN")
        for seat in room.seats:
            if seat.kind == SeatKind.BOT:
                seat.kind = SeatKind.EMPTY
                seat.bot_id = None
                seat.display_name = None
                seat.player_key = None
                seat.connected = False
                seat.reserved_player_key = None
        room.phase = Phase.LOBBY
        room.team_of_seat = {}
        room.team_draw_cards = {}
        room.hands = {}
        room.current_asker = -1
        room.disjoint_pairs = set()
        room.captured_sets = {"A": [], "B": []}
        self._append_history(room, "SYSTEM", history_mod.system_payload("Room reset to lobby", {}))

    def perform_ask(self, player_key: str, room_code: str, target: int, card_id: CardId) -> str:
        room = self._require_room(room_code)
        seat_idx = self._require_seat(room, player_key)
        if room.phase != Phase.PLAYING:
            raise AssertionError("PHASE_INVALID")
        if seat_idx != room.current_asker:
            raise AssertionError("NOT_YOUR_TURN")
        if target not in range(6) or room.seats[target].kind == SeatKind.EMPTY:
            raise AssertionError("INVALID_TARGET")
        if card_id not in rules.CARD_TO_SET:
            raise AssertionError("INVALID_CARD")
        if not self._engine.legal_ask(room, seat_idx, target, card_id):
            raise AssertionError("ILLEGAL_ASK")
        result = self._engine.perform_ask(room, seat_idx, target, card_id)
        self._advance_if_no_cards(room)
        self._advance_if_no_asks(room)
        return result

    def perform_claim(self, player_key: str, room_code: str, set_id: SetId, assignments: Dict[CardId, int]) -> Dict[str, str]:
        room = self._require_room(room_code)
        seat_idx = self._require_seat(room, player_key)
        if room.phase != Phase.PLAYING:
            raise AssertionError("PHASE_INVALID")
        if set_id in room.captured_sets["A"] or set_id in room.captured_sets["B"]:
            raise AssertionError("CLAIM_SET_ALREADY_CAPTURED")
        result = self._engine.perform_claim(room, seat_idx, set_id, assignments)
        self._advance_if_no_cards(room)
        self._advance_if_no_asks(room)
        return result

    def perform_disjoint(self, player_key: str, room_code: str, target: int) -> Dict[str, object]:
        room = self._require_room(room_code)
        seat_idx = self._require_seat(room, player_key)
        if room.phase != Phase.PLAYING:
            raise AssertionError("PHASE_INVALID")
        if target not in range(6) or room.seats[target].kind == SeatKind.EMPTY:
            raise AssertionError("INVALID_TARGET")
        if seat_idx == target:
            raise AssertionError("INVALID_DISJOINT")
        if self._team_for_seat(room, seat_idx) == self._team_for_seat(room, target):
            raise AssertionError("INVALID_DISJOINT")
        pair = tuple(sorted((seat_idx, target)))
        if pair in room.disjoint_pairs:
            raise AssertionError("INVALID_DISJOINT")
        payload = self._perform_disjoint_by_seat(room, seat_idx, target)
        self._advance_if_no_cards(room)
        self._advance_if_no_asks(room)
        return payload

    def perform_chat(self, player_key: str, room_code: str, message: str) -> None:
        room = self._require_room(room_code)
        seat_idx = self._require_seat(room, player_key)
        if room.phase not in (Phase.LOBBY, Phase.FINISHED):
            raise AssertionError("PHASE_INVALID")
        cleaned = self._sanitize_chat_message(message)
        if not cleaned or len(cleaned) > 150:
            raise AssertionError("BAD_MESSAGE")
        payload: Dict[str, object] = {
            "fromSeat": seat_idx,
            "displayName": room.seats[seat_idx].display_name,
            "message": cleaned,
        }
        self._append_history(room, "CHAT", payload)

    def _perform_disjoint_by_seat(self, room: Room, asker: int, target: int) -> Dict[str, object]:
        asker_hand = room.hands.get(asker, [])
        target_hand = room.hands.get(target, [])
        asker_sets = {rules.set_id_for_card(card) for card in asker_hand}
        target_sets = {rules.set_id_for_card(card) for card in target_hand}
        overlap = asker_sets.intersection(target_sets)
        correct = len(overlap) == 0
        transferred: List[CardId] = []
        if not correct:
            remaining: List[CardId] = []
            for card in asker_hand:
                if rules.set_id_for_card(card) in target_sets:
                    transferred.append(card)
                else:
                    remaining.append(card)
            if transferred:
                room.hands[asker] = remaining
                room.hands.setdefault(target, []).extend(transferred)
        pair = (min(asker, target), max(asker, target))
        room.disjoint_pairs.add(pair)
        payload: Dict[str, object] = {
            "fromSeat": asker,
            "toSeat": target,
            "result": "CORRECT" if correct else "INCORRECT",
            "transferred": list(transferred),
        }
        self._append_history(room, "DISJOINT", payload)
        self._engine.assert_invariants(room)
        return payload

    def _advance_if_no_cards(self, room: Room) -> None:
        current = room.current_asker
        if current not in range(6):
            return
        if room.hands.get(current):
            return
        team = self._team_for_seat(room, current)
        seats = sorted([seat for seat, seat_team in room.team_of_seat.items() if seat_team == team])
        if not seats:
            return
        if current not in seats:
            room.current_asker = seats[0]
            return
        start_idx = seats.index(current)
        for offset in range(1, len(seats) + 1):
            next_seat = seats[(start_idx + offset) % len(seats)]
            if room.hands.get(next_seat):
                room.current_asker = next_seat
                return
        # If no teammate has cards, keep current asker.

    def _advance_if_no_asks(self, room: Room) -> None:
        if room.phase != Phase.PLAYING:
            return
        current = room.current_asker
        if current not in range(6):
            return
        if not room.hands.get(current):
            return
        team = self._team_for_seat(room, current)
        opponents = [
            seat
            for seat, seat_team in room.team_of_seat.items()
            if seat_team != team and room.seats[seat].kind != SeatKind.EMPTY
        ]
        eligible = []
        for seat in opponents:
            if not room.hands.get(seat):
                continue
            pair = (min(current, seat), max(current, seat))
            if pair in room.disjoint_pairs:
                continue
            eligible.append(seat)
        if eligible:
            return
        seats = sorted([seat for seat, seat_team in room.team_of_seat.items() if seat_team == team])
        if not seats:
            return
        if current not in seats:
            room.current_asker = seats[0]
            return
        start_idx = seats.index(current)
        for offset in range(1, len(seats) + 1):
            next_seat = seats[(start_idx + offset) % len(seats)]
            if room.hands.get(next_seat):
                room.current_asker = next_seat
                return

    def disconnect(self, player_key: str, room_code: str) -> None:
        room = self._rooms.get(room_code)
        if not room:
            return
        seat_idx = self._find_seat_for_player(room, player_key)
        if seat_idx is None:
            return
        seat = room.seats[seat_idx]
        seat.connected = False
        self._append_history(
            room,
            "SYSTEM",
            history_mod.system_payload(
                "Player left/disconnected",
                {"seat": seat_idx, "displayName": seat.display_name},
            ),
        )
        task = asyncio.create_task(self._reclaim_timeout(room, seat_idx, player_key))
        self._reclaim_tasks[room_code][seat_idx] = task

    async def handle_bot_turns(self, room: Room, on_update) -> None:
        while room.phase == Phase.PLAYING:
            if self._perform_auto_bot_claim(room):
                await on_update(room.code)
                if room.phase != Phase.PLAYING:
                    return
                continue
            if self._perform_auto_bot_disjoint(room):
                await on_update(room.code)
                if room.phase != Phase.PLAYING:
                    return
                continue
            current = room.current_asker
            seat = room.seats[current]
            if seat.kind != SeatKind.BOT:
                return
            await asyncio.sleep(5.0)
            bot = self._build_bot(seat, room)
            public = self.build_public_state(room, "")
            hand = list(room.hands.get(current, []))
            action = bot.select_action(public, hand)
            if action.get("type") == "action_ask":
                if self._engine.legal_ask(room, current, action["targetSeat"], action["cardId"]):
                    self._engine.perform_ask(room, current, action["targetSeat"], action["cardId"])
                    self._advance_if_no_cards(room)
                    self._advance_if_no_asks(room)
                else:
                    return
            else:
                team_id = room.team_of_seat.get(current)
                if team_id and self._force_guess_claim(room, public, team_id):
                    await on_update(room.code)
                    if room.phase != Phase.PLAYING:
                        return
                    continue
                return
            await on_update(room.code)
            if room.phase != Phase.PLAYING:
                return

    def build_public_state(self, room: Room, viewer_key: str) -> Dict[str, Any]:
        teams = {"A": [], "B": []}
        if room.team_of_seat:
            for seat_idx, team in room.team_of_seat.items():
                teams[team].append(seat_idx)
            teams["A"].sort()
            teams["B"].sort()
        public_seats: List[Dict[str, Any]] = []
        for seat in room.seats:
            show_key = viewer_key and seat.player_key == viewer_key
            public_seats.append(
                {
                    "seat": seat.index,
                    "kind": seat.kind.value,
                    "displayName": seat.display_name,
                    "connected": seat.connected if seat.kind == SeatKind.HUMAN else False,
                    "playerKey": seat.player_key if show_key else None,
                    "botId": seat.bot_id,
                }
            )
        captured = {"A": list(room.captured_sets["A"]), "B": list(room.captured_sets["B"])}
        hand_counts = {str(seat): len(room.hands.get(seat, [])) for seat in range(6)}
        disjoint_pairs = [{"a": pair[0], "b": pair[1]} for pair in sorted(room.disjoint_pairs)]
        return {
            "phase": room.phase.value,
            "seats": public_seats,
            "teams": teams,
            "hostSeat": room.host_seat if room.host_seat is not None else -1,
            "currentAskerSeat": room.current_asker if room.phase in (Phase.PLAYING, Phase.FINISHED) else -1,
            "disjointPairs": disjoint_pairs,
            "handCounts": hand_counts,
            "capturedSets": captured,
            "history": list(room.history),
            "settings": {"isPublic": room.is_public, "historyLength": room.history_length},
        }

    def list_public_lobbies(self) -> List[Dict[str, Any]]:
        lobbies: List[Dict[str, Any]] = []
        for room in self._rooms.values():
            if room.phase != Phase.LOBBY or not room.is_public:
                continue
            players = [
                seat.display_name
                for seat in room.seats
                if seat.kind == SeatKind.HUMAN and seat.display_name
            ]
            lobbies.append(
                {
                    "roomCode": room.code,
                    "playerCount": len(players),
                    "players": players,
                }
            )
        lobbies.sort(key=lambda entry: entry["roomCode"])
        return lobbies

    def build_private_state(self, room: Room, viewer_key: str) -> Dict[str, Any]:
        seat_idx = self._find_seat_for_player(room, viewer_key)
        if seat_idx is None:
            raise AssertionError("NOT_IN_ROOM")
        hand = sorted(room.hands.get(seat_idx, []))
        team = room.team_of_seat.get(seat_idx, "")
        return {"yourSeat": seat_idx, "hand": hand, "yourTeam": team}

    def _fill_bots(self, room: Room, needed: Dict[str, int]) -> None:
        default_bot = os.getenv("BOT_DEFAULT", "strategic_bot")
        empty_seats = [seat for seat in room.seats if seat.kind == SeatKind.EMPTY]
        assignments = ["A"] * needed["A"] + ["B"] * needed["B"]
        if len(assignments) != len(empty_seats):
            raise AssertionError("PHASE_INVALID")
        self._rng.shuffle(assignments)
        self._rng.shuffle(empty_seats)
        for seat, team_id in zip(empty_seats, assignments):
            seat.kind = SeatKind.BOT
            seat.bot_id = default_bot
            seat.display_name = self._bot_display_name(room)
            seat.connected = False
            seat.player_key = None
            seat.reserved_player_key = None
            room.team_of_seat[seat.index] = team_id

    def _build_bot(self, seat: Seat, room: Room):
        bot_id = seat.bot_id or "strategic_bot"
        if bot_id == "memory_bot":
            bot = MemoryBot(seat.index, self._rng)
            bot.observe_history(room.history)
            return bot
        if bot_id == "strategic_bot":
            return StrategicBot(seat.index, self._rng)
        return RandomBot(seat.index, self._rng)

    def _bot_display_name(self, room: Room) -> str:
        noun = self._rng.choice(_BOT_NOUNS)
        digit = str(self._rng.randint(0, 9))
        return self._unique_display_name(room, f"Bot-{noun}{digit}")

    async def _reclaim_timeout(self, room: Room, seat_idx: int, player_key: str) -> None:
        await asyncio.sleep(120)
        if room.code not in self._rooms:
            return
        seat = room.seats[seat_idx]
        if seat.connected:
            return
        if seat.reserved_player_key != player_key:
            return
        display_name = seat.display_name
        if room.phase == Phase.LOBBY:
            seat.kind = SeatKind.EMPTY
            seat.bot_id = None
            seat.connected = False
            seat.player_key = None
            seat.display_name = None
            seat.reserved_player_key = None
            room.team_of_seat.pop(seat_idx, None)
            self._append_history(
                room,
                "SYSTEM",
                history_mod.system_payload(
                    "Seat cleared after timeout in lobby",
                    {"seat": seat_idx, "displayName": display_name},
                ),
            )
        else:
            seat.kind = SeatKind.BOT
            seat.bot_id = os.getenv("BOT_DEFAULT", "strategic_bot")
            seat.connected = False
            seat.player_key = None
            seat.display_name = self._bot_display_name(room)
            self._append_history(
                room,
                "SYSTEM",
                history_mod.system_payload(
                    "Seat converted to bot after timeout",
                    {"seat": seat_idx, "displayName": display_name},
                ),
            )
        if room.host_player_key == player_key:
            self._transfer_host(room)
        if self._on_update:
            await self._on_update(room.code)
            self.schedule_bot_turns(room, self._on_update)
        if not self._room_has_humans(room):
            self._delete_room(room.code)

    def _transfer_host(self, room: Room) -> None:
        candidates = [seat for seat in room.seats if seat.kind == SeatKind.HUMAN]
        if not candidates:
            room.host_seat = None
            room.host_player_key = None
            return
        choice = self._rng.choice(candidates)
        room.host_seat = choice.index
        room.host_player_key = choice.player_key

    def _sanitize_chat_message(self, message: str) -> str:
        message = message.replace("\r", " ").replace("\n", " ").replace("\t", " ")
        message = "".join(ch for ch in message if ch >= " " and ch != "\x7f")
        return message.strip()

    def _perform_auto_bot_claim(self, room: Room) -> bool:
        public_state = self.build_public_state(room, "")
        team_card_counts = {
            "A": sum(len(room.hands.get(seat, [])) for seat, team in room.team_of_seat.items() if team == "A"),
            "B": sum(len(room.hands.get(seat, [])) for seat, team in room.team_of_seat.items() if team == "B"),
        }
        forced_team: Optional[str] = None
        if team_card_counts["A"] == 0 and team_card_counts["B"] > 0:
            forced_team = "B"
        elif team_card_counts["B"] == 0 and team_card_counts["A"] > 0:
            forced_team = "A"

        for seat in room.seats:
            if seat.kind != SeatKind.BOT:
                continue
            if forced_team and room.team_of_seat.get(seat.index) != forced_team:
                continue
            hand = list(room.hands.get(seat.index, []))
            bot = self._build_bot(seat, room)
            if isinstance(bot, StrategicBot):
                choice = bot.select_claim(public_state, hand)
                if choice:
                    set_id, assignments = choice
                    self._engine.perform_claim(room, seat.index, set_id, assignments)
                    self._advance_if_no_cards(room)
                    self._advance_if_no_asks(room)
                    return True
        captured = room.captured_sets["A"] + room.captured_sets["B"]
        for seat in room.seats:
            if seat.kind != SeatKind.BOT:
                continue
            if forced_team and room.team_of_seat.get(seat.index) != forced_team:
                continue
            hand = room.hands.get(seat.index, [])
            for set_id, cards in rules.SET_CARDS.items():
                if set_id in captured:
                    continue
                if all(card in hand for card in cards):
                    assignments = {card: seat.index for card in cards}
                    self._engine.perform_claim(room, seat.index, set_id, assignments)
                    self._advance_if_no_cards(room)
                    self._advance_if_no_asks(room)
                    return True
        if forced_team and self._force_guess_claim(room, public_state, forced_team):
            return True
        return False

    def _force_guess_claim(
        self, room: Room, public_state: Dict[str, Any], team_id: str
    ) -> bool:
        team_seats = [
            seat for seat in room.seats if room.team_of_seat.get(seat.index) == team_id
        ]
        if not team_seats:
            return False
        has_human = any(seat.kind == SeatKind.HUMAN for seat in team_seats)
        all_strategic = all(
            seat.kind == SeatKind.BOT and (seat.bot_id or "strategic_bot") == "strategic_bot"
            for seat in team_seats
        )
        if has_human or not all_strategic:
            return False
        last_seat = max(team_seats, key=lambda seat: seat.index)
        bot = self._build_bot(last_seat, room)
        if not isinstance(bot, StrategicBot):
            return False
        guess = bot.select_best_guess_claim(
            public_state,
            list(room.hands.get(last_seat.index, [])),
        )
        if not guess:
            return False
        set_id, assignments = guess
        self._engine.perform_claim(room, last_seat.index, set_id, assignments)
        self._advance_if_no_cards(room)
        self._advance_if_no_asks(room)
        return True

    def _perform_auto_bot_disjoint(self, room: Room) -> bool:
        public_state = self.build_public_state(room, "")
        for seat in room.seats:
            if seat.kind != SeatKind.BOT:
                continue
            hand = list(room.hands.get(seat.index, []))
            bot = self._build_bot(seat, room)
            if isinstance(bot, StrategicBot):
                target = bot.select_disjoint_target(public_state, hand)
                if target is None:
                    continue
                try:
                    if target not in range(6) or room.seats[target].kind == SeatKind.EMPTY:
                        continue
                    if target == seat.index:
                        continue
                    if self._team_for_seat(room, seat.index) == self._team_for_seat(room, target):
                        continue
                    pair = (min(seat.index, target), max(seat.index, target))
                    if pair in room.disjoint_pairs:
                        continue
                    self._perform_disjoint_by_seat(room, seat.index, target)
                    self._advance_if_no_cards(room)
                    self._advance_if_no_asks(room)
                    return True
                except AssertionError:
                    continue
        return False

    def _require_room(self, room_code: str) -> Room:
        room = self._rooms.get(room_code)
        if not room:
            raise AssertionError("ROOM_NOT_FOUND")
        return room

    def _require_seat(self, room: Room, player_key: str) -> int:
        seat_idx = self._find_seat_for_player(room, player_key)
        if seat_idx is None:
            raise AssertionError("NOT_IN_ROOM")
        return seat_idx

    def _team_for_seat(self, room: Room, seat_idx: int) -> str:
        team = room.team_of_seat.get(seat_idx)
        if not team:
            raise AssertionError("PHASE_INVALID")
        return team

    def _find_seat_for_player(self, room: Room, player_key: str) -> Optional[int]:
        for seat in room.seats:
            if seat.player_key == player_key:
                return seat.index
            if seat.reserved_player_key == player_key:
                return seat.index
        return None

    def _cancel_reclaim(self, room_code: str, seat_idx: int) -> None:
        task = self._reclaim_tasks.get(room_code, {}).pop(seat_idx, None)
        if task:
            task.cancel()

    def _unique_display_name(self, room: Optional[Room], display_name: str, exclude_seat: Optional[int] = None) -> str:
        if room is None:
            return display_name
        used = {
            seat.display_name
            for seat in room.seats
            if seat.display_name and seat.index != exclude_seat and seat.kind != SeatKind.EMPTY
        }
        if display_name not in used:
            return display_name
        suffix = 1
        while True:
            candidate = f"{display_name}{suffix}"
            if candidate not in used:
                return candidate
            suffix += 1

    def _append_history(self, room: Room, kind: str, payload: Dict[str, object]) -> None:
        room.history.append(history_mod.new_history_entry(room.next_history_id, kind, payload))
        room.next_history_id += 1
        if len(room.history) > 1000:
            room.history[:] = room.history[-1000:]

    def _room_has_humans(self, room: Room) -> bool:
        for seat in room.seats:
            if seat.kind == SeatKind.HUMAN and seat.connected:
                return True
        return False

    def _delete_room(self, room_code: str) -> None:
        room = self._rooms.pop(room_code, None)
        if not room:
            return
        reclaim_tasks = self._reclaim_tasks.pop(room_code, {})
        for task in reclaim_tasks.values():
            task.cancel()
        bot_task = self._bot_tasks.pop(room_code, None)
        if bot_task:
            bot_task.cancel()
