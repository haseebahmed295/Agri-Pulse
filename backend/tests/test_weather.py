"""Unit tests for Open-Meteo Weather Service (Test BE-01).

Validates keyless async API ingestion, 168-hour vector alignment, heatwave hazard analysis,
and offline caching fallback.
"""

import pytest
from unittest.mock import patch, AsyncMock
import httpx

from app.api.schemas import WeatherResponse
from app.services.weather_service import (
    analyze_weather_hazard,
    fetch_weather,
)


@pytest.mark.asyncio
async def test_be_01_live_or_cached_open_meteo_ingestion():
    """Test BE-01: Ingests 168-hour weather forecast asynchronously."""
    response = await fetch_weather(latitude=33.6844, longitude=73.0479)

    assert isinstance(response, WeatherResponse)
    assert response.location.latitude == 33.6844
    assert response.location.longitude == 73.0479

    # Assert exactly 168 hours of data
    assert len(response.hourly_series.timestamps) == 168
    assert len(response.hourly_series.temperature_2m) == 168
    assert len(response.hourly_series.relative_humidity_2m) == 168
    assert len(response.hourly_series.precipitation) == 168

    assert response.cache_status in ("live", "cached", "fallback")


def test_be_01_hazard_analysis_detects_heatwave():
    """Test BE-01: Correctly flags heatwave on 2+ consecutive days >= 38.0C."""
    # Day 1: normal, Days 2,3,4: peak 41.5C, Days 5,6,7: normal
    temps = (
        [32.0] * 24  # Day 1
        + [41.5] * 24  # Day 2
        + [40.0] * 24  # Day 3
        + [39.0] * 24  # Day 4
        + [34.0] * 24  # Day 5
        + [33.0] * 24  # Day 6
        + [31.0] * 24  # Day 7
    )
    rain = [0.0] * 168

    hazard = analyze_weather_hazard(temps, rain)
    assert hazard.is_heatwave_active is True
    assert hazard.peak_temperature_c == 41.5
    assert hazard.heatwave_duration_days == 3
    assert hazard.days_until_peak == 1  # Peak occurs on Day 2 (index 1)


def test_be_01_hazard_analysis_normal_weather():
    """Test BE-01: Does not flag heatwave when max temp stays below 38.0C."""
    temps = [30.0] * 168
    rain = [5.0] * 168

    hazard = analyze_weather_hazard(temps, rain)
    assert hazard.is_heatwave_active is False
    assert hazard.peak_temperature_c == 30.0
    assert hazard.heatwave_duration_days == 0
    assert hazard.total_forecasted_rain_mm == round(5.0 * 168, 1)


@pytest.mark.asyncio
async def test_be_01_offline_graceful_fallback(monkeypatch):
    """Test BE-01: When Open-Meteo times out or fails, falls back gracefully."""
    # Force httpx to raise a ConnectError
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("Network is down")):
        response = await fetch_weather(latitude=33.6844, longitude=73.0479)

        assert isinstance(response, WeatherResponse)
        assert len(response.hourly_series.timestamps) == 168
        assert response.cache_status in ("cached", "fallback")
