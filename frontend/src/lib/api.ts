import type { EvaluateResponse, FieldPayload } from './mockData';
import { MOCK_FALLBACK_EVALUATION, PRESETS } from './mockData';

const API_BASE_URL = 'http://localhost:8000';

export async function evaluateField(payload: FieldPayload): Promise<EvaluateResponse> {
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Evaluation failed with status: ${response.status}`);
    }

    const data: EvaluateResponse = await response.json();
    return data;
  } catch {
    // Graceful offline fallback with local dynamic adjustment
    const elapsed = Math.round(performance.now() - startTime);
    return getOfflineSimulation(payload, elapsed);
  }
}

export async function fetchPreset(presetId: 'crisis' | 'trap' | 'scald'): Promise<FieldPayload> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/presets/${presetId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.payload) return data.payload;
    }
  } catch {
    // fallback to local preset
  }
  return PRESETS[presetId]?.payload || PRESETS.crisis.payload;
}

function getOfflineSimulation(payload: FieldPayload, latency: number): EvaluateResponse {
  const tempOffset = payload.simulated_heat_spike || 0;
  const isHeatwave = tempOffset > 0 || payload.peak_temperature_override >= 38.0;

  let sufficiencyStatus: EvaluateResponse['sufficiency_status'] = 'SUFFICIENT_NO_ACTION';
  let decision: EvaluateResponse['selected_decision'] = 'HOLD_CURRENT_LEVEL';
  let depth = 0;
  let rationale = 'Soil moisture is optimal and no thermal damage risk detected within forecast horizon.';

  if (payload.current_moisture_pct < 16.0 && isHeatwave) {
    sufficiencyStatus = 'CRITICAL_HEAT_DEFICIT';
    decision = 'PREEMPTIVE_NIGHT_PRECHARGE';
    depth = 24.0;
    rationale = `${payload.crop_type} at ${payload.growth_stage} faces acute thermal pollen/cell damage under ${payload.peak_temperature_override}°C. Urgent night pre-charge recommended before peak window.`;
  } else if (payload.current_moisture_pct < 20.0) {
    sufficiencyStatus = 'MODERATE_DEFICIT';
    decision = 'SPLIT_CYCLE_LIGHT_IRRIGATION';
    depth = 12.0;
    rationale = `Moderate root-zone moisture deficit detected. Split-cycle irrigation prevents waterlogging while preserving canopy transpiration.`;
  } else if (payload.current_moisture_pct > 30.0 && payload.soil_texture === 'Clay') {
    sufficiencyStatus = 'SUFFICIENT_NO_ACTION';
    decision = 'HOLD_CURRENT_LEVEL';
    depth = 0;
    rationale = `High moisture in clay soil carries severe root hypoxia risk if irrigated further. Hold irrigation despite high heat.`;
  }

  const updatedChart = MOCK_FALLBACK_EVALUATION.chart_series.map((point) => {
    const adjustedTemp = point.forecast_temp_c + (point.day === 2 ? tempOffset : tempOffset * 0.5);
    const baseline = Math.max(4.0, point.baseline_moisture_pct - (isHeatwave ? 2.5 : 1.0));
    return {
      ...point,
      forecast_temp_c: Number(adjustedTemp.toFixed(1)),
      baseline_moisture_pct: Number(baseline.toFixed(1)),
      is_critical_heat: adjustedTemp >= 38.0,
    };
  });

  return {
    ...MOCK_FALLBACK_EVALUATION,
    inference_latency_ms: 1.2,
    total_latency_ms: Math.max(latency, 2),
    engine_source: 'DETERMINISTIC_FALLBACK',
    sufficiency_status: sufficiencyStatus,
    selected_decision: decision,
    action_plan: {
      water_depth_mm: depth,
      execution_window: depth > 0 ? 'Tonight 22:00 - 04:30 PKT' : 'No Window Needed',
      biological_rationale: rationale,
    },
    hydrology_summary: {
      ...MOCK_FALLBACK_EVALUATION.hydrology_summary,
      current_moisture_pct: payload.current_moisture_pct,
      precomputed_deficit_mm: depth,
    },
    chart_series: updatedChart,
  };
}
