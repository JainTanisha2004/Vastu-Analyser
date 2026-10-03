"""LLM Client Abstraction for Google Gemini.

Supports Gemini 2.5 Flash with structured responses and SSE streaming.
Loads GEMINI_API_KEY from environment variables or .env.
Provides retry logic and graceful error handling.
"""

import asyncio
import logging
import os
from typing import AsyncIterator, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"


def get_api_key() -> Optional[str]:
    """Retrieve the Gemini API key from environment."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    return key if key else None


def is_llm_configured() -> bool:
    """Check if the Gemini API key is configured."""
    key = get_api_key()
    return bool(key and key != "your_gemini_api_key_here")


def _get_genai_client():
    """Create and return a Google GenAI Client instance."""
    from google import genai

    key = get_api_key()
    if not key or key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your .env "
            "file or environment variables to enable AI report generation and chat."
        )
    return genai.Client(api_key=key)


async def call_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    response_mime_type: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    max_retries: int = 3,
) -> str:
    """Call Google Gemini asynchronously with retry logic.

    Args:
        system_prompt: Instructions and grounding rules for the model.
        user_prompt: Specific user message or data payload.
        temperature: Sampling temperature (0.0 to 1.0).
        response_mime_type: Optional MIME type (e.g. 'application/json').
        model: Model identifier (default: gemini-2.5-flash).
        max_retries: Number of retry attempts for transient errors.

    Returns:
        The generated text response.
    """
    from google.genai import types

    client = _get_genai_client()

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=temperature,
        response_mime_type=response_mime_type,
    )

    last_error = None
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=user_prompt,
                config=config,
            )
            if response.text is not None:
                return response.text
            return ""
        except Exception as exc:
            last_error = exc
            logger.warning(
                "Gemini API call failed on attempt %d/%d: %s",
                attempt + 1,
                max_retries,
                exc,
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(1.5 * (2**attempt))

    raise RuntimeError(f"Gemini API call failed after {max_retries} attempts: {last_error}") from last_error


async def stream_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    model: str = DEFAULT_MODEL,
) -> AsyncIterator[str]:
    """Stream response tokens from Gemini using async generator.

    Args:
        system_prompt: System instruction and grounding context.
        user_prompt: The user query.
        temperature: Sampling temperature.
        model: Model identifier.

    Yields:
        String chunks as they are generated.
    """
    from google.genai import types

    client = _get_genai_client()

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=temperature,
    )

    stream = await client.aio.models.generate_content_stream(
        model=model,
        contents=user_prompt,
        config=config,
    )

    async for chunk in stream:
        if chunk.text:
            yield chunk.text
