/**
 * Agri-Pulse Data Contracts - TypeScript Type Definitions
 * Auto-generated to match Pydantic schemas in backend/app/schemas.py
 * Contract Reference: contracts/mock_decision_response.json & contracts/mock_weather_hydrology.json
 */

export type SufficiencyStatus =
  | "SUFFICIENT_NO_ACTION"
  | "MODERATE_DEFICIT"
  | "CRITICAL_HEAT_DEFICIT";

export type CandidateDecision =
  | "HOLD_CURRENT_LEVEL"
  | "PREEMPTIVE_NIGHT_PRECHARGE"
  | "SPLIT_CYCLE_LIGHT_IRRIGATION"
  | "EMERGENCY_CANOPY_COOLING";

export interface CropContext {
  crop: string;
  growth_stage: string;
  thermal_threshold_c: number;
  primary_heat_vulnerability: string;
}

export interface SimulatedDepletion {
  crosses_wilting_point: boolean;
  projected_failure_day: number | null;
  hours_until_stress_onset?: number | null;
}

export interface HydrologySummary {
  soil_type: string;
  current_moisture_pct: number;
  field_capacity_pct: number;
  wilting_point_pct: number;
  precomputed_deficit_mm: number;
  simulated_depletion: SimulatedDepletion;
}

export interface HazardProfile {
  is_heatwave_active: boolean;
  peak_temperature_c: number;
  baseline_seasonal_avg_c?: number;
  heatwave_duration_days: number;
  days_until_peak: number;
  total_forecasted_rain_mm?: number;
}

export interface AIDecisionInputPayload {
  crop_context: CropContext;
  hydrology_summary: HydrologySummary;
  hazard_profile: HazardProfile;
  irrigation_system: string;
  candidate_decisions: CandidateDecision[] | string[];
}

export interface ActionPlan {
  water_depth_mm: number;
  execution_window: string;
  biological_rationale: string;
}

export interface DecisionOutput {
  decision_id: string;
  inference_latency_ms: number;
  engine_source: "OPENAI_COMPATIBLE_ENGINE" | "DETERMINISTIC_FALLBACK" | string;
  sufficiency_status: SufficiencyStatus;
  selected_decision: CandidateDecision;
  decision_confidence: number;
  projected_depletion_timestamp?: string | null;
  action_plan: ActionPlan;
}
