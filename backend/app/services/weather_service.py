"""Open-Meteo async weather ingestion client with local persistence and offline resilience.

Fetches keyless 168-hour hourly weather forecast from Open-Meteo REST API,
analyzes heatwave hazard parameters, and caches responses locally.
Conforms to SPEC-AGRI-BE-001 and TEST_PLAN.md (Test BE-01).
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Tuple
import httpx

from app.api.schemas import (
    HazardSummary,
    HourlySeries,
    Location,
    WeatherResponse,
)
from app.mock_service import weather_mock

CACHE_FILE = Path(__file__).parent.parent / "fixtures" / "weather_cache.json"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HEATWAVE_THRESHOLD_C = 38.0


def analyze_weather_hazard(
    temperature_2m: List[float],
    precipitation: List[float],
) -> HazardSummary:
    """Analyzes 168-hour weather vectors to calculate heatwave hazard metrics."""
    peak_temp = max(temperature_2m)
    total_rain = round(sum(precipitation), 1)
    seasonal_avg = round(sum(temperature_2m) / len(temperature_2m), 1)

    # Group into 7 days (24 hours per day)
    daily_peaks: List[float] = []
    for day_idx in range(7):
        day_slice = temperature_2m[day_idx * 24 : (day_idx + 1) * 24]
        daily_peaks.append(max(day_slice) if day_slice else 0.0)

    # Find days until peak temperature occurs
    peak_idx = temperature_2m.index(peak_temp)
    days_until_peak = peak_idx // 24

    # Check for consecutive hot days (>= 38.0°C)
    current_run = 0
    max_consecutive = 0
    for day_max in daily_peaks:
        if day_max >= HEATWAVE_THRESHOLD_C:
            current_run += 1
            max_consecutive = max(max_consecutive, current_run)
        else:
            current_run = 0

    is_heatwave = max_consecutive >= 2

    return HazardSummary(
        is_heatwave_active=is_heatwave,
        peak_temperature_c=round(peak_temp, 1),
        baseline_seasonal_avg_c=seasonal_avg,
        heatwave_duration_days=max_consecutive,
        days_until_peak=days_until_peak,
        total_forecasted_rain_mm=total_rain,
    )


def _load_cache(latitude: float, longitude: float) -> WeatherResponse | None:
    """Loads cached weather data from local disk if available."""
    if not CACHE_FILE.exists():
        return None
    try:
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        data["location"]["latitude"] = latitude
        data["location"]["longitude"] = longitude
        data["cache_status"] = "cached"
        return WeatherResponse.model_validate(data)
    except Exception:
        return None


def _save_cache(response_data: dict) -> None:
    """Persists weather response to disk for offline resilience."""
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(response_data, indent=2), encoding="utf-8")
    except Exception:
        pass


async def fetch_weather(
    latitude: float = 33.6844,
    longitude: float = 73.0479,
    timeout_seconds: float = 4.0,
) -> WeatherResponse:
    """Asynchronously retrieves 168-hour forecast from Open-Meteo REST API.

    Gracefully falls back to local cached JSON if offline or on timeout.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": "Asia/Karachi",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        hourly = data.get("hourly", {})
        timestamps = hourly.get("time", [])
        temperatures = hourly.get("temperature_2m", [])
        relative_humidity = hourly.get("relative_humidity_2m", [])
        precipitation = hourly.get("precipitation", [])

        # Ensure we have exactly 168 hours
        if len(timestamps) >= 168 and len(temperatures) >= 168:
            timestamps = timestamps[:168]
            temperatures = temperatures[:168]
            relative_humidity = relative_humidity[:168]
            precipitation = precipitation[:168]

            hazard = analyze_weather_hazard(temperatures, precipitation)

            weather_obj = WeatherResponse(
                location=Location(
                    latitude=latitude,
                    longitude=longitude,
                    timezone=data.get("timezone", "Asia/Karachi"),
                ),
                hazard_summary=hazard,
                hourly_series=HourlySeries(
                    timestamps=timestamps,
                    temperature_2m=temperatures,
                    relative_humidity_2m=relative_humidity,
                    precipitation=precipitation,
                ),
                cache_status="live",
            )

            # Update local disk cache
            _save_cache(weather_obj.model_dump(mode="json"))
            return weather_obj

    except Exception:
        # Network or timeout failure - activate offline resilience
        pass

    # Fallback to local cache if available
    cached = _load_cache(latitude, longitude)
    if cached is not None:
        return cached

    # If cache also missing, use deterministic mock provider
    fallback = weather_mock(latitude, longitude)
    fallback.cache_status = "fallback"
    return fallback
