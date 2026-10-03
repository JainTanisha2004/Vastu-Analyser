"""In-memory LRU Cache for AI Reports and Chat Sessions."""

from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, List, Optional

MAX_CACHE_ENTRIES = 50


@dataclass
class ChatSession:
    """Represents an active conversational session tied to a floor plan analysis."""

    file_id: str
    created_at: str
    analysis_data: Dict[str, Any]
    report_data: Optional[Dict[str, Any]] = None
    history: List[Dict[str, str]] = field(default_factory=list)


class ReportCache:
    """Thread-safe LRU cache storing generated reports and chat sessions."""

    def __init__(self, maxsize: int = MAX_CACHE_ENTRIES):
        self.maxsize = maxsize
        self._reports: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._sessions: OrderedDict[str, ChatSession] = OrderedDict()

    @staticmethod
    def compute_fingerprint(analysis_data: Dict[str, Any]) -> str:
        """Create a deterministic hash fingerprint from analysis data."""
        payload = {
            "compliance": round(float(analysis_data.get("compliance_percent", 0.0)), 2),
            "rows": [
                {
                    "id": r.get("room_id"),
                    "type": r.get("room_type"),
                    "zone": r.get("actual_zone"),
                    "score": round(float(r.get("score", 0.0)), 2),
                }
                for r in sorted(analysis_data.get("rows", []), key=lambda x: str(x.get("room_id")))
            ],
            "total_score": round(float(analysis_data.get("total_score", 0.0)), 2),
        }
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def get_report(self, fingerprint: str) -> Optional[Dict[str, Any]]:
        """Retrieve a cached report by fingerprint."""
        if fingerprint in self._reports:
            self._reports.move_to_end(fingerprint)
            return dict(self._reports[fingerprint])
        return None

    def put_report(self, fingerprint: str, report: Dict[str, Any]) -> None:
        """Store a generated report in cache."""
        if fingerprint in self._reports:
            self._reports.move_to_end(fingerprint)
        self._reports[fingerprint] = dict(report)
        if len(self._reports) > self.maxsize:
            self._reports.popitem(last=False)

    def get_or_create_session(
        self,
        file_id: str,
        analysis_data: Dict[str, Any],
        report_data: Optional[Dict[str, Any]] = None,
    ) -> ChatSession:
        """Retrieve or initialize a chat session for a file_id."""
        if file_id in self._sessions:
            self._sessions.move_to_end(file_id)
            session = self._sessions[file_id]
            if report_data and not session.report_data:
                session.report_data = report_data
            return session

        session = ChatSession(
            file_id=file_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            analysis_data=analysis_data,
            report_data=report_data,
            history=[],
        )
        self._sessions[file_id] = session
        if len(self._sessions) > self.maxsize:
            self._sessions.popitem(last=False)
        return session

    def get_session(self, file_id: str) -> Optional[ChatSession]:
        """Retrieve an existing session if present."""
        if file_id in self._sessions:
            self._sessions.move_to_end(file_id)
            return self._sessions[file_id]
        return None


GLOBAL_CACHE = ReportCache()
