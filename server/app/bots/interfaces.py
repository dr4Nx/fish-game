from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List

class Bot(ABC):
    @abstractmethod
    def select_action(self, public_state: Dict[str, Any], hand: List[str]) -> Dict[str, Any]:
        raise NotImplementedError
