"""RAG Report Generation Engine.

Builds grounded prompts from analysis data and retrieved Vastu knowledge chunks,
invokes Gemini 2.5 Flash for narrative generation, and validates structured output.
Includes a deterministic fallback generator when LLM is unconfigured.
"""

from datetime import datetime, timezone
import json
import logging
import re
from typing import Any, Dict, List, Optional
import uuid

from vastu_knowledge import get_relevant_knowledge, get_compliance_tier
from llm_client import call_gemini, is_llm_configured

logger = logging.getLogger(__name__)


def _clean_json_text(text: str) -> str:
    """Strip markdown code blocks if the LLM wrapped the JSON."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text


def build_system_prompt() -> str:
    """Construct the grounding system prompt for the Vastu Shastra report."""
    return (
        "You are an esteemed, highly knowledgeable Vastu Shastra master and architectural consultant.\n"
        "Your task is to generate a comprehensive, personalized, empathetic, and professional Vastu evaluation report "
        "based STRICTLY on the computational analysis data and curated traditional principles provided below.\n\n"
        "GROUNDING & INTEGRITY RULES:\n"
        "1. GROUNDING FIRST: You must ONLY refer to the rooms, directions, and scores given in the analysis context. "
        "Never hallucinate rooms, directions, or scores that are not present in the data.\n"
        "2. ACCURACY: If a room scored negatively or has an unfavourable status, clearly explain the elemental friction "
        "and provide practical, non-destructive remedies (colors, metals, crystals, plants, habits).\n"
        "3. NO STRUCTURAL DEMOLITION: Never advise breaking walls or moving pillars unless the user explicitly asks. "
        "Emphasize classical non-invasive remedies and energetic balancing.\n"
        "4. TONE: Professional, encouraging, culturally authentic yet scientifically articulated.\n"
        "5. OUTPUT FORMAT: You MUST return a single valid JSON object strictly adhering to the specified schema, "
        "with no commentary outside the JSON.\n"
    )


def build_user_prompt(analysis_data: Dict[str, Any], knowledge: Dict[str, Any]) -> str:
    """Build the contextual user prompt combining computed data and retrieved knowledge."""
    rows = analysis_data.get("rows", [])
    compliance = analysis_data.get("compliance_percent", 0.0)
    total_score = analysis_data.get("total_score", 0.0)
    max_score = analysis_data.get("max_score", 0.0)
    optimization = analysis_data.get("optimization")

    context = {
        "analysis_summary": {
            "compliance_percent": compliance,
            "total_score": total_score,
            "max_score": max_score,
            "tier": knowledge.get("tier", {}).get("rating", "Moderate"),
        },
        "rooms_data": [
            {
                "room_id": r.get("room_id"),
                "room_type": r.get("room_type"),
                "actual_zone": r.get("actual_zone"),
                "ideal_zone": r.get("ideal_zone"),
                "score": r.get("score"),
                "max_score": r.get("max_score"),
                "status": r.get("status"),
            }
            for r in rows
        ],
        "optimization_recommendation": optimization if optimization and optimization.get("move") else None,
        "retrieved_vastu_principles": {
            "unfavourable_rooms_context": knowledge.get("unfavourable_rooms", []),
            "auspicious_rooms_context": knowledge.get("auspicious_rooms", []),
            "direction_meanings": knowledge.get("direction_meanings", {}),
        },
    }

    schema_sample = {
        "overall_rating": "Excellent | Good | Moderate | Critical",
        "executive_summary": "2-3 comprehensive paragraphs summarizing the overall Vastu energy, major strengths, and primary areas needing attention.",
        "overall_energy_assessment": "1-2 paragraphs detailing the cosmic and elemental prana balance across the layout.",
        "positive_highlights": ["List of 2-4 strong Vastu alignments in the layout."],
        "priority_actions": [
            {
                "priority": 1,
                "room_type": "Name of room",
                "direction": "Zone",
                "impact": "High / Critical / Medium",
                "action": "Specific non-destructive remedy or adjustment to undertake first.",
            }
        ],
        "room_analyses": [
            {
                "room_id": "string",
                "room_type": "string",
                "direction": "string",
                "ideal_zone": "string",
                "score": 0.0,
                "max_score": 0.0,
                "status": "auspicious | moderate | unfavourable",
                "narrative": "Detailed narrative explaining how this room's location affects the residents.",
                "traditional_significance": "Classical Vastu explanation (deity, element, ruling energy).",
                "remedies": [
                    {
                        "type": "color | object | plant | orientation | habits",
                        "severity": "immediate | recommended | optional",
                        "title": "Remedy Name",
                        "description": "Clear step-by-step guidance on implementing this remedy.",
                    }
                ],
            }
        ],
        "optimization_narrative": "If optimization was suggested, articulate how the room swap helps. If none, confirm layout suitability.",
    }

    prompt = (
        "Here is the evaluation data for the client's floor plan:\n\n"
        f"```json\n{json.dumps(context, indent=2)}\n```\n\n"
        "Generate the complete Vastu analysis report as a JSON object matching this schema:\n"
        f"```json\n{json.dumps(schema_sample, indent=2)}\n```\n\n"
        "Ensure every room from `rooms_data` is included in `room_analyses`. Return ONLY valid JSON."
    )
    return prompt


def generate_fallback_report(
    analysis_data: Dict[str, Any], knowledge: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate a high-quality deterministic report when Gemini is not configured."""
    compliance = analysis_data.get("compliance_percent", 0.0)
    tier = knowledge.get("tier", get_compliance_tier(compliance))
    rows = analysis_data.get("rows", [])
    optimization = analysis_data.get("optimization")

    room_analyses = []
    priority_actions = []
    positive_highlights = []

    p_idx = 1
    for r in knowledge.get("unfavourable_rooms", []):
        room_type = r["room_type"]
        direction = r["direction"]
        remedies = r.get("remedies", [])

        action_desc = (
            remedies[0]["description"]
            if remedies
            else f"Neutralize elemental clash in {direction} using soft colors and energy pyramids."
        )
        priority_actions.append(
            {
                "priority": p_idx,
                "room_type": room_type,
                "direction": direction,
                "impact": "Critical" if r["score"] < -5 else "High",
                "action": action_desc,
            }
        )
        p_idx += 1

    for r in knowledge.get("auspicious_rooms", []):
        positive_highlights.append(
            f"{r['room_type']} in {r['direction']}: Scored {r['score']:.1f}/{r['max_score']:.1f}. "
            f"Fosters auspicious {r.get('elemental_harmony', 'energy balance')}."
        )

    # Build room analyses from rows + knowledge
    knowledge_by_id = {
        item.get("room_id"): item
        for item in (
            knowledge.get("unfavourable_rooms", [])
            + knowledge.get("auspicious_rooms", [])
            + knowledge.get("moderate_rooms", [])
        )
        if item.get("room_id")
    }

    for row in rows:
        rid = row.get("room_id")
        k_info = knowledge_by_id.get(rid, {})
        room_type = row.get("room_type", "Generic Room")
        direction = row.get("actual_zone", "Center")
        score = float(row.get("score", 0.0))
        max_score = float(row.get("max_score", 1.0))
        status = row.get("status", "unfavourable" if score < 0 else "neutral")

        narrative = (
            f"The {room_type} is currently situated in the {direction} sector with a Vastu compliance score of "
            f"{score:.1f} out of {max_score:.1f}. "
        )
        if status in ("auspicious", "good"):
            narrative += (
                f"This positioning is harmonious with the natural directional elements of {direction}, "
                f"benefiting the occupants with positive energy and equilibrium."
            )
        elif status in ("unfavourable", "critical"):
            narrative += (
                f"This location causes elemental friction with the {direction} quadrant. "
                f"Applying non-destructive energetic remedies will help soften negative influences."
            )
        else:
            narrative += (
                f"This placement is moderately neutral. Minor subtle enhancements can optimize its utility."
            )

        room_analyses.append(
            {
                "room_id": rid,
                "room_type": room_type,
                "direction": direction,
                "ideal_zone": row.get("ideal_zone", "Unknown"),
                "score": score,
                "max_score": max_score,
                "status": status,
                "narrative": narrative,
                "traditional_significance": k_info.get(
                    "significance",
                    f"Traditional placement guidelines for {room_type} in {direction}.",
                ),
                "remedies": k_info.get("remedies", []),
            }
        )

    opt_narrative = "Your current layout is well-balanced; no major room swap is required at this stage."
    if optimization and optimization.get("move") and optimization.get("improvement", 0) > 0:
        move = optimization["move"]
        if move.get("type") == "swap":
            opt_narrative = (
                f"Vastu optimization identifies that swapping {move.get('room1_type')} and "
                f"{move.get('room2_type')} increases overall compliance by +{optimization.get('improvement', 0):.1f}% "
                f"(from {optimization.get('original_score', 0):.1f}% to {optimization.get('optimized_score', 0):.1f}%)."
            )

    return {
        "report_id": str(uuid.uuid4()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "is_fallback": True,
        "compliance_percent": compliance,
        "overall_rating": tier["rating"].split(" ")[0],
        "executive_summary": (
            f"Your home achieves an overall Vastu compliance score of {compliance:.1f}%, placing it in the "
            f"'{tier['rating']}' tier. {tier['summary']} {tier['general_advice']}"
        ),
        "overall_energy_assessment": (
            f"Energy distribution across the {len(rows)} evaluated zones exhibits clear directional polarity. "
            f"The layout retains {len(knowledge.get('auspicious_rooms', []))} auspiciously aligned areas and "
            f"{len(knowledge.get('unfavourable_rooms', []))} sectors requiring remediation."
        ),
        "positive_highlights": positive_highlights or ["Balanced central flow."],
        "priority_actions": priority_actions[:5],
        "room_analyses": room_analyses,
        "optimization_narrative": opt_narrative,
    }


async def generate_vastu_report(analysis_data: Dict[str, Any]) -> Dict[str, Any]:
    """Orchestrate RAG-powered Vastu report generation.

    Retrieves curated knowledge chunks, formats context, calls Gemini 2.5 Flash,
    and returns verified structured JSON. Falls back cleanly if LLM is unconfigured.
    """
    rows = analysis_data.get("rows", [])
    compliance = float(analysis_data.get("compliance_percent", 0.0))
    optimization = analysis_data.get("optimization")

    knowledge = get_relevant_knowledge(rows, compliance, optimization)

    if not is_llm_configured():
        logger.info("GEMINI_API_KEY not configured. Generating deterministic fallback report.")
        return generate_fallback_report(analysis_data, knowledge)

    system_prompt = build_system_prompt()
    user_prompt = build_user_prompt(analysis_data, knowledge)

    try:
        raw_text = await call_gemini(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            response_mime_type="application/json",
        )
        cleaned = _clean_json_text(raw_text)
        report_json = json.loads(cleaned)

        # Enrich and ensure metadata
        report_json["report_id"] = str(uuid.uuid4())
        report_json["generated_at"] = datetime.now(timezone.utc).isoformat()
        report_json["compliance_percent"] = compliance
        report_json["is_fallback"] = False
        return report_json
    except Exception as exc:
        logger.error("Error generating LLM report via Gemini: %s. Falling back to deterministic report.", exc)
        fallback = generate_fallback_report(analysis_data, knowledge)
        fallback["generation_warning"] = f"LLM generation failed: {exc}. Displaying knowledge-grounded report."
        return fallback
