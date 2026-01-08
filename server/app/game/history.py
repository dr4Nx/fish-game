from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

def new_history_entry(entry_id: int, kind: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": f"e{entry_id}",
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "payload": payload,
    }


def system_payload(message: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return {
        "message": message,
        "data": data or {},
    }
