"""Unit tests for the report generator and fallback engine."""

import pytest
from report_generator import generate_vastu_report, generate_fallback_report
from vastu_knowledge import get_relevant_knowledge
from report_cache import ReportCache


@pytest.mark.anyio
async def test_fallback_report_structure():
    sample_analysis = {
        "compliance_percent": 58.0,
        "total_score": 15.0,
        "max_score": 35.0,
        "rows": [
            {
                "room_id": "r1",
                "room_type": "Master Bedroom",
                "actual_zone": "SW",
                "ideal_zone": "SW",
                "score": 10.0,
                "max_score": 10.0,
                "status": "auspicious",
            },
            {
                "room_id": "r2",
                "room_type": "Kitchen",
                "actual_zone": "NE",
                "ideal_zone": "SE",
                "score": -9.0,
                "max_score": 12.0,
                "status": "unfavourable",
            },
        ],
        "optimization": {
            "move": {"type": "swap", "room1_type": "Kitchen", "room2_type": "Master Bedroom"},
            "original_score": 58.0,
            "optimized_score": 82.0,
            "improvement": 24.0,
        },
    }

    report = await generate_vastu_report(sample_analysis)

    assert "report_id" in report
    assert "generated_at" in report
    assert report["compliance_percent"] == 58.0
    assert "executive_summary" in report
    assert "overall_energy_assessment" in report
    assert len(report["room_analyses"]) == 2
    assert len(report["priority_actions"]) >= 1
    assert "improvement" in report["optimization_narrative"].lower() or "swap" in report["optimization_narrative"].lower()


def test_cache_fingerprint_and_retrieval():
    cache = ReportCache(maxsize=5)
    data1 = {"compliance_percent": 60.0, "total_score": 10.0, "rows": [{"room_id": "a", "room_type": "Kitchen", "score": 5.0}]}
    data2 = {"compliance_percent": 60.0, "total_score": 10.0, "rows": [{"room_id": "a", "room_type": "Kitchen", "score": 5.0}]}
    data3 = {"compliance_percent": 70.0, "total_score": 15.0, "rows": [{"room_id": "b", "room_type": "Kitchen", "score": 8.0}]}

    fp1 = cache.compute_fingerprint(data1)
    fp2 = cache.compute_fingerprint(data2)
    fp3 = cache.compute_fingerprint(data3)

    assert fp1 == fp2
    assert fp1 != fp3

    cache.put_report(fp1, {"report_id": "rep-123"})
    cached = cache.get_report(fp1)
    assert cached is not None
    assert cached["report_id"] == "rep-123"


def test_api_report_endpoints():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)

    # Test status endpoint
    status_resp = client.get("/api/report/status")
    assert status_resp.status_code == 200
    assert "llm_configured" in status_resp.json()

    # Test report generate endpoint with valid analysis data
    sample_analysis = {
        "compliance_percent": 75.0,
        "total_score": 30.0,
        "max_score": 40.0,
        "rows": [
            {
                "room_id": "r1",
                "room_type": "Living",
                "actual_zone": "N",
                "ideal_zone": "N",
                "score": 3.0,
                "max_score": 3.0,
                "status": "auspicious",
            }
        ],
    }

    gen_resp = client.post("/api/report/generate", json={"analysis_data": sample_analysis})
    assert gen_resp.status_code == 200
    report_json = gen_resp.json()
    assert "report_id" in report_json
    assert report_json["compliance_percent"] == 75.0
    assert len(report_json["room_analyses"]) == 1
    assert report_json["from_cache"] is False

    # Second call should hit cache
    cached_resp = client.post("/api/report/generate", json={"analysis_data": sample_analysis})
    assert cached_resp.status_code == 200
    assert cached_resp.json()["from_cache"] is True

