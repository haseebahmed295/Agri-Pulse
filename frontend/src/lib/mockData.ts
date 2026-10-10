export type SufficiencyStatus =
  | 'SUFFICIENT_NO_ACTION'
  | 'MODERATE_DEFICIT'
  | 'CRITICAL_HEAT_DEFICIT';

export type CandidateDecision =
  | 'HOLD_CURRENT_LEVEL'
  | 'PREEMPTIVE_NIGHT_PRECHARGE'
  | 'SPLIT_CYCLE_LIGHT_IRRIGATION'
  | 'EMERGENCY_CANOPY_COOLING';

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

export type CropType = 'Wheat' | 'Maize' | 'Cotton' | 'Tomato';
export type GrowthStage = 'Vegetative' | 'Flowering_Anthesis' | 'Grain_Fill' | 'Maturity';
export type SoilTexture = 'Sandy Loam' | 'Loam' | 'Clay';
export type IrrigationSystem = 'Drip' | 'Center_Pivot' | 'Furrow_Flood';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  local_model_engine: {
    provider: string;
    base_url: string;
    status: 'online' | 'offline';
  };
  weather_pipeline: {
    provider: string;
    status: string;
    cached: boolean;
  };
  timestamp: string;
}

export interface AgriculturalLocation {
  id: string;
  name: string;
  district: string;
  province: string;
  farmingBelt: string;
  latitude: number;
  longitude: number;
}

export const AGRICULTURAL_LOCATIONS: AgriculturalLocation[] = [
  {
    id: 'multan',
    name: 'Multan (Shujabad Agro Belt)',
    district: 'Multan',
    province: 'Punjab',
    farmingBelt: 'Cotton & Wheat Belt',
    latitude: 30.0750,
    longitude: 71.3250,
  },
  {
    id: 'ryk',
    name: 'Rahim Yar Khan (Sadiqabad Canal)',
    district: 'Rahim Yar Khan',
    province: 'Punjab',
    farmingBelt: 'Sugarcane & Cotton Belt',
    latitude: 28.3250,
    longitude: 70.1850,
  },
  {
    id: 'faisalabad',
    name: 'Faisalabad (Samundri Agronomy)',
    district: 'Faisalabad',
    province: 'Punjab',
    farmingBelt: 'Mixed Grain & Agro Hub',
    latitude: 31.0650,
    longitude: 72.9550,
  },
  {
    id: 'sahiwal',
    name: 'Sahiwal (Chichawatni Farm Belt)',
    district: 'Sahiwal',
    province: 'Punjab',
    farmingBelt: 'Maize & Dairy Belt',
    latitude: 30.5350,
    longitude: 72.7050,
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad (Tando Allahyar Valley)',
    district: 'Hyderabad',
    province: 'Sindh',
    farmingBelt: 'Tomato & Vegetable Valley',
    latitude: 25.2650,
    longitude: 68.4650,
  },
  {
    id: 'sukkur',
    name: 'Sukkur (Rohri Canal Basin)',
    district: 'Sukkur',
    province: 'Sindh',
    farmingBelt: 'Indus Rice & Dates Basin',
    latitude: 27.6150,
    longitude: 68.9150,
  },
];

export interface FarmPlot {
  id: string;
  name: string;
  subname: string;
  locationName: string;
  crop: CropType;
  cropDisplay: string;
  stage: GrowthStage;
  soil: SoilTexture;
  irrigation: IrrigationSystem;
  areaHa: number;
  areaAcres: number;
  center: [number, number]; // [lat, lon]
  polygon: [number, number][]; // coordinates for Leaflet polygon
  tempC: number;
  soilMoisturePct: number;
  volumeWaterPct: number;
  nutrientLevelPct: number;
  // Micro-climate sensors matching EarthEye Insights
  precipitationPct: number;
  yieldEstimation: string;
  yieldMunsPerAcre: number;
  totalMunsForecast: number;
  relativeHumidityPct: number;
  leafTempC: number;
  leafWetnessPct: number;
  canopyCoverPct: number;
  // Health sparkline and score
  healthScore: number;
  healthHistory: number[];
  presetKey: 'crisis' | 'trap' | 'scald';
  hazardAlert?: string;
}

export const FARM_PLOTS: FarmPlot[] = [
  {
    id: 'plot-1',
    name: 'Multan Main Estate',
    subname: 'Area 1 · Wheat (Anthesis)',
    locationName: 'Multan, Punjab',
    crop: 'Wheat',
    cropDisplay: 'Wheat (Gandum)',
    stage: 'Flowering_Anthesis',
    soil: 'Sandy Loam',
    irrigation: 'Furrow_Flood',
    areaHa: 30.0,
    areaAcres: 74.1,
    center: [30.0750, 71.3250],
    polygon: [
      [30.0785, 71.3210],
      [30.0792, 71.3295],
      [30.0715, 71.3290],
      [30.0708, 71.3205],
    ],
    tempC: 41.5,
    soilMoisturePct: 14.0,
    volumeWaterPct: 38.2,
    nutrientLevelPct: 82.5,
    precipitationPct: 0,
    yieldEstimation: '38.5 Muns/Acre (من)',
    yieldMunsPerAcre: 38.5,
    totalMunsForecast: 2853,
    relativeHumidityPct: 24,
    leafTempC: 42.1,
    leafWetnessPct: 12,
    canopyCoverPct: 78,
    healthScore: 68,
    healthHistory: [88, 85, 80, 74, 68],
    presetKey: 'crisis',
    hazardAlert: 'Extreme Heatwave Risk (41.5°C) — Pollen Sterility Threat',
  },
  {
    id: 'plot-2',
    name: 'Rahim Yar Khan Canal Estate',
    subname: 'Area 2 · Cotton (Vegetative)',
    locationName: 'Rahim Yar Khan, Punjab',
    crop: 'Cotton',
    cropDisplay: 'Cotton (Kapas)',
    stage: 'Vegetative',
    soil: 'Clay',
    irrigation: 'Drip',
    areaHa: 29.1,
    areaAcres: 72.0,
    center: [28.3250, 70.1850],
    polygon: [
      [28.3285, 70.1805],
      [28.3292, 70.1895],
      [28.3215, 70.1890],
      [28.3208, 70.1800],
    ],
    tempC: 39.5,
    soilMoisturePct: 33.0,
    volumeWaterPct: 91.4,
    nutrientLevelPct: 89.0,
    precipitationPct: 5,
    yieldEstimation: '24.3 Muns/Acre (من)',
    yieldMunsPerAcre: 24.3,
    totalMunsForecast: 1750,
    relativeHumidityPct: 36,
    leafTempC: 38.4,
    leafWetnessPct: 45,
    canopyCoverPct: 62,
    healthScore: 84,
    healthHistory: [82, 83, 85, 84, 84],
    presetKey: 'trap',
    hazardAlert: 'Soil Moisture 33% (Clay) — Hold Irrigation to Avoid Root Hypoxia',
  },
  {
    id: 'plot-3',
    name: 'Hyderabad River Valley',
    subname: 'Area 3 · Tomato & Vegetables',
    locationName: 'Hyderabad, Sindh',
    crop: 'Tomato',
    cropDisplay: 'Tomato (Vegetables)',
    stage: 'Grain_Fill',
    soil: 'Loam',
    irrigation: 'Drip',
    areaHa: 9.8,
    areaAcres: 24.3,
    center: [25.2650, 68.4650],
    polygon: [
      [25.2685, 68.4615],
      [25.2690, 68.4685],
      [25.2615, 68.4680],
      [25.2610, 68.4610],
    ],
    tempC: 40.0,
    soilMoisturePct: 13.0,
    volumeWaterPct: 44.8,
    nutrientLevelPct: 76.0,
    precipitationPct: 0,
    yieldEstimation: '288 Muns/Acre (من)',
    yieldMunsPerAcre: 288.0,
    totalMunsForecast: 7000,
    relativeHumidityPct: 32,
    leafTempC: 39.8,
    leafWetnessPct: 18,
    canopyCoverPct: 85,
    healthScore: 72,
    healthHistory: [85, 82, 79, 75, 72],
    presetKey: 'scald',
    hazardAlert: 'Acute Scald Threat — Light Split-Cycle Pulses Prescribed',
  },
];

export interface MapLayerItem {
  id: string;
  name: string;
  category: string;
  badge: string;
  description: string;
  isPinned: boolean;
  color: string;
}

export const MAP_LAYERS: MapLayerItem[] = [
  {
    id: 'thermal',
    name: 'High Resolution Thermal Heatmap',
    category: 'Radiometric',
    badge: 'Thermal IR',
    description: 'FLIR & Landsat-9 radiometric surface temperature showing crop canopy heat stress.',
    isPinned: true,
    color: '#ef4444',
  },
  {
    id: 'moisture',
    name: 'Root-Zone Soil Moisture Gradient',
    category: 'Hydrology',
    badge: 'SMAP / Micro',
    description: 'Volumetric soil moisture depletion index across the top 60 cm root layer.',
    isPinned: true,
    color: '#06b6d4',
  },
  {
    id: 'ndvi',
    name: 'Canopy Stress & NDVI Index',
    category: 'Vegetation',
    badge: 'Normalized Diff',
    description: 'Chlorophyll reflectance index identifying localized cellular heat shock.',
    isPinned: true,
    color: '#22c55e',
  },
  {
    id: 'canopy_cover',
    name: 'Canopy Cover Heatmap',
    category: 'Biomass',
    badge: 'Biomass Density',
    description: 'Shading density protecting topsoil from direct solar radiation.',
    isPinned: false,
    color: '#a3e635',
  },
  {
    id: 'color_infrared',
    name: 'Color Infrared (CIR Ortho)',
    category: 'Optical',
    badge: 'Near Infrared',
    description: 'False-color near-infrared imagery separating active vegetation from bare ground.',
    isPinned: false,
    color: '#ec4899',
  },
  {
    id: 'disease_risk',
    name: 'Disease & Sunscald Vulnerability',
    category: 'Pathology',
    badge: 'Pathology',
    description: 'Micro-climate fungal and solar scalding risk index.',
    isPinned: false,
    color: '#f59e0b',
  },
];

export const FARMER_ACTIONS: Record<
  CandidateDecision,
  { farmerTitle: string; farmerBadge: string; farmerInstruction: string; urgency: string }
> = {
  PREEMPTIVE_NIGHT_PRECHARGE: {
    farmerTitle: 'Deep Night Watering Needed',
    farmerBadge: 'Night Pre-Charge',
    farmerInstruction: 'Water deeply tonight before extreme midday heat arrives tomorrow. Cool night air prevents water from evaporating away.',
    urgency: 'HIGH',
  },
  HOLD_CURRENT_LEVEL: {
    farmerTitle: 'Do Not Water — Soil is Safe',
    farmerBadge: 'Hold Watering',
    farmerInstruction: 'Soil already holds enough water. Adding more water now will waterlog the soil and rot the roots (root drowning).',
    urgency: 'NONE',
  },
  SPLIT_CYCLE_LIGHT_IRRIGATION: {
    farmerTitle: 'Light Morning & Evening Watering',
    farmerBadge: 'Split Cycle Watering',
    farmerInstruction: 'Give a light morning pulse and a light evening pulse to protect tender crops from heat scalding without flooding.',
    urgency: 'MEDIUM',
  },
  EMERGENCY_CANOPY_COOLING: {
    farmerTitle: 'Emergency Leaf Sprinkler Spray',
    farmerBadge: 'Canopy Mist',
    farmerInstruction: 'Run a short misting burst to cool the plant canopy and keep leaves from scorching in the intense sun.',
    urgency: 'HIGH',
  },
};

export const FARMER_STATUS: Record<
  SufficiencyStatus,
  { label: string; sublabel: string; color: string }
> = {
  CRITICAL_HEAT_DEFICIT: {
    label: 'URGENT WATERING NEEDED',
    sublabel: 'Extreme Heat Stress Expected',
    color: 'text-rose-400',
  },
  MODERATE_DEFICIT: {
    label: 'SOIL GETTING DRY',
    sublabel: 'Water Soon to Prevent Crop Loss',
    color: 'text-amber-400',
  },
  SUFFICIENT_NO_ACTION: {
    label: 'MOISTURE IS HEALTHY',
    sublabel: 'No Watering Needed — Roots are Safe',
    color: 'text-emerald-400',
  },
};

export interface FieldPayload {
  crop_type: CropType;
  growth_stage: GrowthStage;
  soil_texture: SoilTexture;
  current_moisture_pct: number;
  irrigation_system: IrrigationSystem;
  simulated_heat_spike: number;
  peak_temperature_override: number;
  location_name?: string;
  latitude: number;
  longitude: number;
}

export const PRESETS: Record<'crisis' | 'trap' | 'scald', { label: string; payload: FieldPayload }> = {
  crisis: {
    label: 'Scenario A: Wheat in Heatwave (Anthesis)',
    payload: {
      crop_type: 'Wheat',
      growth_stage: 'Flowering_Anthesis',
      soil_texture: 'Sandy Loam',
      current_moisture_pct: 14.0,
      irrigation_system: 'Furrow_Flood',
      simulated_heat_spike: 6.0,
      peak_temperature_override: 41.5,
      location_name: 'Multan (Cotton & Wheat Belt)',
      latitude: 30.0750,
      longitude: 71.3250,
    },
  },
  trap: {
    label: 'Scenario B: Cotton on Wet Heavy Soil (Hypoxia)',
    payload: {
      crop_type: 'Cotton',
      growth_stage: 'Vegetative',
      soil_texture: 'Clay',
      current_moisture_pct: 33.0,
      irrigation_system: 'Drip',
      simulated_heat_spike: 0.0,
      peak_temperature_override: 39.5,
      location_name: 'Rahim Yar Khan (Cotton Belt)',
      latitude: 28.3250,
      longitude: 70.1850,
    },
  },
  scald: {
    label: 'Scenario C: Tomato Heat Protection (Delicate Veg)',
    payload: {
      crop_type: 'Tomato',
      growth_stage: 'Grain_Fill',
      soil_texture: 'Loam',
      current_moisture_pct: 13.0,
      irrigation_system: 'Drip',
      simulated_heat_spike: 6.0,
      peak_temperature_override: 40.0,
      location_name: 'Hyderabad (Vegetable Valley)',
      latitude: 25.2650,
      longitude: 68.4650,
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
