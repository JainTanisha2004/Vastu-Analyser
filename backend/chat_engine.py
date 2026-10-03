"""Conversational Vastu Q&A Chat Engine.

Provides context-grounded conversational chat via Server-Sent Events (SSE),
maintaining per-session history and enforcing strict grounding rules.
"""

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

from vastu_knowledge import DIRECTION_SIGNIFICANCE, ROOM_SIGNIFICANCE, VASTU_KNOWLEDGE, get_relevant_knowledge
from llm_client import is_llm_configured, stream_gemini
from report_cache import GLOBAL_CACHE, ChatSession

logger = logging.getLogger(__name__)


def build_chat_system_prompt(analysis_data: Dict[str, Any], report_data: Optional[Dict[str, Any]]) -> str:
    """Build a comprehensive grounding system prompt for conversational Q&A."""
    rows = analysis_data.get("rows", [])
    compliance = analysis_data.get("compliance_percent", 0.0)
    optimization = analysis_data.get("optimization")

    knowledge = get_relevant_knowledge(rows, compliance, optimization)

    prompt = (
        "You are the Vastu Analyser AI Assistant, an empathetic, highly knowledgeable Vastu Shastra consultant.\n"
        "You are answering questions about the user's specific floor plan analysis.\n\n"
        "=== CRITICAL GROUNDING RULES ===\n"
        "1. STRICT FACTUAL GROUNDING: Base all answers exclusively on the floor plan data and Vastu principles below.\n"
        "2. ACCURACY OF ROOMS & SCORES: Only discuss rooms that exist in the floor plan. If the user asks about a room "
        "not in their floor plan (e.g., 'What about my swimming pool?'), clearly explain that their floor plan does not "
        "include that room, and list what rooms are evaluated.\n"
        "3. NEVER INVENT NUMBERS: Always quote the exact score, maximum score, and actual zone computed for each room.\n"
        "4. NON-DESTRUCTIVE REMEDIES: Prioritize non-invasive remedies (colors, elements, metals, crystals, plants, "
        "reorientation of furniture/activities). Never recommend demolition unless specifically asked about structural changes.\n"
        "5. RELEVANCE & BOUNDARIES: If the user asks general Vastu questions, answer within authentic Vastu Shastra principles. "
        "If the user asks questions completely unrelated to Vastu, architecture, or their home, politely guide them back "
        "to discussing their Vastu evaluation.\n\n"
        "=== FLOOR PLAN EVALUATION CONTEXT ===\n"
        f"- Overall Compliance Score: {compliance:.1f}%\n"
        f"- Total Score: {analysis_data.get('total_score', 0):.1f} / {analysis_data.get('max_score', 0):.1f}\n"
        f"- Evaluation Tier: {knowledge.get('tier', {}).get('rating', 'Moderate')}\n\n"
        "Rooms in this Floor Plan:\n"
    )

    for r in rows:
        prompt += (
            f"- {r.get('room_type')}: Located in {r.get('actual_zone')} zone | Ideal: {r.get('ideal_zone')} | "
            f"Score: {r.get('score', 0):.1f}/{r.get('max_score', 0):.1f} | Status: {r.get('status')}\n"
        )

    if optimization and optimization.get("move"):
        move = optimization["move"]
        prompt += (
            f"\nRecommended Optimization:\n"
            f"- Suggestion: Swap {move.get('room1_type')} and {move.get('room2_type')}\n"
            f"- Expected Improvement: +{optimization.get('improvement', 0):.1f}% (from "
            f"{optimization.get('original_score', 0):.1f}% to {optimization.get('optimized_score', 0):.1f}%)\n"
        )

    unfavourable = knowledge.get("unfavourable_rooms", [])
    if unfavourable:
        prompt += "\nSpecific Remedies for Suboptimal Rooms in this Plan:\n"
        for u in unfavourable:
            prompt += f"- {u['room_type']} in {u['direction']} (Score: {u['score']}):\n"
            for rem in u.get("remedies", []):
                prompt += f"  * [{rem.get('severity', 'recommended').upper()}] {rem.get('title')}: {rem.get('description')}\n"

    return prompt


def generate_offline_answer(message: str, analysis_data: Dict[str, Any]) -> str:
    """Generate a helpful, grounded response when Gemini is not configured."""
    msg_lower = message.lower()
    rows = analysis_data.get("rows", [])
    compliance = analysis_data.get("compliance_percent", 0.0)
    optimization = analysis_data.get("optimization")

    # Check for room-specific query
    for r in rows:
        rtype = r.get("room_type", "").lower()
        if rtype and rtype in msg_lower:
            room_name = r.get("room_type")
            zone = r.get("actual_zone")
            ideal = r.get("ideal_zone")
            score = r.get("score")
            max_s = r.get("max_score")
            status = r.get("status")

            knowledge_entry = VASTU_KNOWLEDGE.get(room_name, {}).get(zone, {})
            sig = knowledge_entry.get(
                "significance",
                f"In traditional Vastu, {room_name} should ideally be in {ideal}, while currently in {zone}."
            )
            remedies = knowledge_entry.get("impact", "")

            resp = (
                f"### Analysis for **{room_name}**\n\n"
                f"- **Current Zone:** {zone}\n"
                f"- **Ideal Zone:** {ideal}\n"
                f"- **Score:** {score:.1f} / {max_s:.1f} ({status})\n\n"
                f"**Vastu Insight:** {sig}\n\n"
            )
            if score <= 0:
                resp += (
                    "**Recommended Non-Destructive Remedies:**\n"
                    "- Use soft harmonizing colors (cream/light green for NE, earthy tones for SW).\n"
                    "- Place energetic stabilizers such as rock salt bowls or copper/zinc helix pyramids.\n"
                    "- Maintain absolute cleanliness and avoid clutter in this quadrant.\n"
                )
            else:
                resp += "This placement is beneficial and actively supports positive household prana.\n"
            return resp

    # Check for optimization query
    if any(k in msg_lower for k in ["swap", "optimize", "optimization", "improve", "better"]):
        if optimization and optimization.get("move") and optimization.get("improvement", 0) > 0:
            move = optimization["move"]
            return (
                f"### Layout Optimization Recommendation\n\n"
                f"The optimizer suggests swapping **{move.get('room1_type')}** and **{move.get('room2_type')}**.\n\n"
                f"- **Current Overall Score:** {optimization.get('original_score', 0):.1f}%\n"
                f"- **Projected Score After Swap:** {optimization.get('optimized_score', 0):.1f}%\n"
                f"- **Net Gain:** **+{optimization.get('improvement', 0):.1f}%**\n\n"
                f"This realignment resolves elemental friction by moving fire and water activities closer "
                f"to their natural cardinal quadrants."
            )
        return f"Your layout is currently well-balanced at {compliance:.1f}% compliance; no major room swap is recommended."

    # General overview / default
    room_list_str = ", ".join([f"{r.get('room_type')} ({r.get('actual_zone')})" for r in rows])
    return (
        f"### Your Home's Vastu Overview\n\n"
        f"- **Overall Compliance:** **{compliance:.1f}%**\n"
        f"- **Evaluated Rooms:** {room_list_str}\n\n"
        f"You can ask me specific questions about any of these rooms (e.g., *'Why is my kitchen score good?'*, "
        f"*'What remedies help the toilet?'*, or *'How can I improve my overall layout?'*).\n\n"
        f"*(Tip: Set `GEMINI_API_KEY` in `backend/.env` to unlock live conversational LLM streaming.)*"
    )


async def stream_chat_response(
    file_id: str,
    message: str,
    analysis_data: Dict[str, Any],
    report_data: Optional[Dict[str, Any]] = None,
) -> AsyncIterator[str]:
    """Process a user message and stream the response as Server-Sent Events (SSE).

    Yields SSE packets in format: `data: {"delta": "..."}\n\n`
    Ends with: `data: {"done": true}\n\n`
    """
    session = GLOBAL_CACHE.get_or_create_session(file_id, analysis_data, report_data)
    session.history.append({"role": "user", "content": message})

    if not is_llm_configured():
        # Offline streaming simulation
        offline_text = generate_offline_answer(message, analysis_data)
        session.history.append({"role": "assistant", "content": offline_text})

        # Yield in realistic word-sized chunks
        words = offline_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            payload = json.dumps({"delta": chunk})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.02)

        yield f"data: {json.dumps({'done': True})}\n\n"
        return

    # Online Gemini LLM Streaming
    system_prompt = build_chat_system_prompt(analysis_data, report_data)

    # Build conversation context (last 6 turns)
    recent_history = session.history[-6:]
    history_context = ""
    for item in recent_history[:-1]:
        prefix = "User" if item["role"] == "user" else "Assistant"
        history_context += f"{prefix}: {item['content']}\n\n"

    full_user_prompt = f"{history_context}User: {message}\nAssistant:"

    accumulated_response = []
    try:
        async for token in stream_gemini(
            system_prompt=system_prompt,
            user_prompt=full_user_prompt,
            temperature=0.3,
        ):
            accumulated_response.append(token)
            payload = json.dumps({"delta": token})
            yield f"data: {payload}\n\n"

        full_reply = "".join(accumulated_response)
        session.history.append({"role": "assistant", "content": full_reply})
        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as exc:
        logger.error("Chat streaming error: %s", exc)
        err_msg = f"\n\n*(An error occurred while streaming response: {exc})*"
        session.history.append({"role": "assistant", "content": "".join(accumulated_response) + err_msg})
        yield f"data: {json.dumps({'delta': err_msg})}\n\n"
        yield f"data: {json.dumps({'done': True, 'error': str(exc)})}\n\n"
