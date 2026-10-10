"""Endpoint layer for Agri-Pulse.

Supports live AI model evaluation via local inference server (http://127.0.0.1:8080)
with fast single-pass logit scoring, post-inference guardrails, and deterministic fallback.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response
import httpx

from app.config import settings
from app.mock_service import evaluate_mock, weather_mock
from app.presets import PRESETS
from app.api.schemas import (
    EvaluateRequest, EvaluateResponse, HealthResponse, PresetResponse, WeatherResponse,
)
from app.services.evaluation_service import evaluate_live
from app.services.weather_service import fetch_weather

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health():
    """Reports system health, detecting connectivity to AI decision engine."""
    model_status = "offline"
    provider = "llama-server"
    base_url = settings.LOCAL_MODEL_BASE_URL

    if settings.USE_TYPESAFE_API and settings.TYPESAFE_API_KEY:
        provider = "TypeSafe AI (Cloud)"
        base_url = settings.TYPESAFE_BASE_URL
        model_status = "online"
    else:
        try:
            async with httpx.AsyncClient(timeout=0.3) as client:
                res = await client.get(f"{settings.LOCAL_MODEL_BASE_URL.rstrip('/')}/health")
                if res.status_code == 200:
                    model_status = "online"
        except Exception:
            model_status = "offline"

    overall_status = "ok" if model_status == "online" else "degraded"

    return {
        "status": overall_status,
        "version": "1.0.0",
        "local_model_engine": {
            "provider": provider,
            "base_url": base_url,
            "status": model_status,
        },
        "weather_pipeline": {"provider": "Open-Meteo", "status": "online", "cached": False},
        "timestamp": datetime.now(timezone.utc),
    }


@router.get("/weather", response_model=WeatherResponse, tags=["Weather"],
            summary="Get 168 hours of weather (Open-Meteo live or cached)")
async def weather(
    response: Response,
    latitude: Annotated[float, Query(ge=-90, le=90)] = 33.6844,
    longitude: Annotated[float, Query(ge=-180, le=180)] = 73.0479,
    mode: Annotated[str | None, Query(description="Explicit mode: 'live' or 'mock'")] = None,
):
    if mode == "mock":
        response.headers["X-AgriPulse-Mode"] = "mock"
        return weather_mock(latitude, longitude)

    result = await fetch_weather(latitude, longitude)
    response.headers["X-AgriPulse-Mode"] = result.cache_status
    return result


@router.post("/evaluate", response_model=EvaluateResponse, tags=["Evaluation"],
             summary="Evaluate field telemetry and dispatch agronomic decision")
async def evaluate(
    payload: EvaluateRequest,
    response: Response,
    mode: Annotated[str | None, Query(description="Explicit mode override: 'live' or 'mock'")] = None,
):
    """Evaluates field input using the local AI decision engine.

    Returns the tactical directive, execution window, depth in mm, and 7-day projected curves.
    """
    if mode == "mock":
        response.headers["X-AgriPulse-Mode"] = "mock"
        return evaluate_mock(payload)

    result = await evaluate_live(payload)
    mode_header = "live" if "FALLBACK" not in result.engine_source else "fallback"
    response.headers["X-AgriPulse-Mode"] = mode_header
    return result


@router.get("/presets/{preset_id}", response_model=PresetResponse, tags=["Presets"],
            responses={404: {"description": "Unknown preset"}})
def preset(preset_id: str):
    if preset_id not in PRESETS:
        raise HTTPException(status_code=404, detail="Unknown preset. Choose crisis, trap, or scald.")
    return PRESETS[preset_id]
