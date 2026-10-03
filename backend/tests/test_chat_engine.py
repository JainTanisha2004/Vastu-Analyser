"""Unit tests for chat engine streaming and session management."""

import json
import pytest
from chat_engine import stream_chat_response, generate_offline_answer
from report_cache import GLOBAL_CACHE


@pytest.mark.anyio
async def test_chat_streaming_offline():
    file_id = "test-session-1"
    analysis_data = {
        "compliance_percent": 62.0,
        "total_score": 18.0,
        "max_score": 30.0,
        "rows": [
            {
                "room_id": "r1",
                "room_type": "Kitchen",
                "actual_zone": "SE",
                "ideal_zone": "SE",
                "score": 12.0,
                "max_score": 12.0,
                "status": "auspicious",
            }
        ],
    }

    chunks = []
    async for packet in stream_chat_response(
        file_id=file_id,
        message="Tell me about my kitchen",
        analysis_data=analysis_data,
    ):
        assert packet.startswith("data: ")
        data_str = packet.replace("data: ", "").strip()
        data = json.loads(data_str)
        chunks.append(data)

    assert len(chunks) > 1
    assert any("delta" in c for c in chunks)
    assert any(c.get("done") is True for c in chunks)

    session = GLOBAL_CACHE.get_session(file_id)
    assert session is not None
    assert len(session.history) == 2  # user + assistant
    assert session.history[0]["role"] == "user"
    assert session.history[1]["role"] == "assistant"
