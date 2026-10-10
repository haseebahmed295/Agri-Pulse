import type { CandidateDecision, SufficiencyStatus } from '../../../contracts/decision_types';

export interface ChartDataPoint {
  day: number;
  date: string;
  forecast_temp_c: number;
  baseline_moisture_pct: number;
  protected_moisture_pct: number;
  wilting_point_pct: number;
  field_capacity_pct: number;
  is_critical_heat: boolean;
}

export interface EvaluateResponse {
  decision_id: string;
  timestamp: string;
  engine_source: string;
  inference_latency_ms: number;
  total_latency_ms: number;
  sufficiency_status: SufficiencyStatus;
  selected_decision: CandidateDecision;
  decision_confidence: number;
  projected_depletion_timestamp?: string | null;
  action_plan: {
    water_depth_mm: number;
    execution_window: string;
    biological_rationale: string;
  };
  hydrology_summary: {
    field_capacity_pct: number;
    wilting_point_pct: number;
    current_moisture_pct: number;
    precomputed_deficit_mm: number;
    root_depth_cm: number;
  };
  chart_series: ChartDataPoint[];
}

export interface FieldPayload {
  crop_type: string;
  growth_stage: string;
  soil_texture: string;
  current_moisture_pct: number;
  irrigation_system: string;
  simulated_heat_spike: number;
  peak_temperature_override: number;
  latitude?: number;
  longitude?: number;
}

export const PRESETS: Record<string, { label: string; payload: FieldPayload }> = {
  crisis: {
    label: 'Scenario A: Anthesis Thermal Crisis',
    payload: {
      crop_type: 'Wheat',
      growth_stage: 'Flowering_Anthesis',
      soil_texture: 'Sandy Loam',
      current_moisture_pct: 14.0,
      irrigation_system: 'Furrow_Flood',
      simulated_heat_spike: 6.0,
      peak_temperature_override: 41.5,
    },
  },
  trap: {
    label: 'Scenario B: False Security Trap (Hypoxia)',
    payload: {
      crop_type: 'Cotton',
      growth_stage: 'Vegetative',
      soil_texture: 'Clay',
      current_moisture_pct: 33.0,
      irrigation_system: 'Furrow_Flood',
      simulated_heat_spike: 0.0,
      peak_temperature_override: 39.5,
    },
  },
  scald: {
    label: 'Scenario C: Imminent Scald Pulse',
    payload: {
      crop_type: 'Tomato',
      growth_stage: 'Fruit Set',
      soil_texture: 'Loam',
      current_moisture_pct: 12.0,
      irrigation_system: 'Drip',
      simulated_heat_spike: 6.0,
      peak_temperature_override: 40.0,
    },
  },
};

export const MOCK_CHART_SERIES: ChartDataPoint[] = [
  { day: 1, date: 'Oct 10', forecast_temp_c: 36.5, baseline_moisture_pct: 14.0, protected_moisture_pct: 18.0, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: false },
  { day: 2, date: 'Oct 11', forecast_temp_c: 41.5, baseline_moisture_pct: 8.5, protected_moisture_pct: 14.8, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: true },
  { day: 3, date: 'Oct 12', forecast_temp_c: 40.0, baseline_moisture_pct: 5.2, protected_moisture_pct: 11.4, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: true },
  { day: 4, date: 'Oct 13', forecast_temp_c: 37.0, baseline_moisture_pct: 5.0, protected_moisture_pct: 9.6, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: false },
  { day: 5, date: 'Oct 14', forecast_temp_c: 34.0, baseline_moisture_pct: 5.0, protected_moisture_pct: 9.0, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: false },
  { day: 6, date: 'Oct 15', forecast_temp_c: 33.5, baseline_moisture_pct: 5.0, protected_moisture_pct: 8.5, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: false },
  { day: 7, date: 'Oct 16', forecast_temp_c: 32.0, baseline_moisture_pct: 5.0, protected_moisture_pct: 8.0, wilting_point_pct: 9.0, field_capacity_pct: 20.0, is_critical_heat: false },
];

export const MOCK_FALLBACK_EVALUATION: EvaluateResponse = {
  decision_id: '7b8e1a2f-5b6d-4d2b-9a1c-3e4f5a6b7c8d',
  timestamp: new Date().toISOString(),
  engine_source: 'LOCAL_MODEL_ENGINE',
  inference_latency_ms: 24.5,
  total_latency_ms: 28.4,
  sufficiency_status: 'CRITICAL_HEAT_DEFICIT',
  selected_decision: 'PREEMPTIVE_NIGHT_PRECHARGE',
  decision_confidence: 0.96,
  projected_depletion_timestamp: 'Day 2 at 14:00',
  action_plan: {
    water_depth_mm: 24.0,
    execution_window: 'Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)',
    biological_rationale:
      'Wheat in anthesis faces irreversible pollen sterility if root-zone moisture drops below critical holding thresholds at 41.5°C. Deep night pre-charge establishes a transpirational cooling buffer without evaporative loss.',
  },
  hydrology_summary: {
    field_capacity_pct: 20.0,
    wilting_point_pct: 9.0,
    current_moisture_pct: 14.0,
    precomputed_deficit_mm: 24.0,
    root_depth_cm: 60,
  },
  chart_series: MOCK_CHART_SERIES,
};
