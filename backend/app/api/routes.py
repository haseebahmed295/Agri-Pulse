"""Endpoint layer. Weather and evaluation use explicit mock providers for phase one."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response

from app.mock_service import evaluate_mock, weather_mock
from app.presets import PRESETS
from app.api.schemas import (
    EvaluateRequest, EvaluateResponse, HealthResponse, PresetResponse, WeatherResponse,
)

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse, tags=["Health"])
def health():
    return {
        "status": "degraded", "version": "1.0.0",
        "local_model_engine": {
            "provider": "ollama", "base_url": "http://localhost:11434",
            "status": "not_configured",
        },
        "weather_pipeline": {"provider": "Open-Meteo", "status": "mock", "cached": False},
        "timestamp": datetime.now(timezone.utc),
    }


@router.get("/weather", response_model=WeatherResponse, tags=["Weather"],
            summary="Get 168 hours of weather (mock provider)")
def weather(
    response: Response,
    latitude: Annotated[float, Query(ge=-90, le=90)] = 33.6844,
    longitude: Annotated[float, Query(ge=-180, le=180)] = 73.0479,
):
    response.headers["X-AgriPulse-Mode"] = "mock"
    return weather_mock(latitude, longitude)


@router.post("/evaluate", response_model=EvaluateResponse, tags=["Evaluation"],
             summary="Validate field input and return the sample decision (mock provider)")
def evaluate(payload: EvaluateRequest, response: Response):
    response.headers["X-AgriPulse-Mode"] = "mock"
    return evaluate_mock(payload)


@router.get("/presets/{preset_id}", response_model=PresetResponse, tags=["Presets"],
            responses={404: {"description": "Unknown preset"}})
def preset(preset_id: str):
    if preset_id not in PRESETS:
        raise HTTPException(status_code=404, detail="Unknown preset. Choose crisis, trap, or scald.")
    return PRESETS[preset_id]
