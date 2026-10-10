import { create } from 'zustand';
import type { AgriculturalLocation, EvaluateResponse, FieldPayload, HealthResponse, FarmPlot, CropType, GrowthStage, SoilTexture, IrrigationSystem } from '../lib/mockData';
import { MOCK_FALLBACK_EVALUATION, PRESETS, FARM_PLOTS } from '../lib/mockData';
import { evaluateField, fetchHealth, fetchPreset, fetchLiveWeather, evaluateWithLiveWeather } from '../lib/api';

export type AppTab = 'map' | 'irrigation';

export const CROP_BASE_TEMPS: Record<string, number> = {
  Wheat: 35.5,
  Cotton: 33.5,
  Tomato: 34.0,
  Maize: 32.5,
};

interface ValveDispatchState {
  status: 'IDLE' | 'QUEUED' | 'CONFIRMED';
  timestamp?: string;
  command?: string;
}

interface FieldState {
  // Navigation & GIS state
  activeTab: AppTab;
  selectedPlotId: string;
  plots: FarmPlot[];
  isEditModalOpen: boolean;

  payload: FieldPayload;
  decision: EvaluateResponse;
  health: HealthResponse | null;
  isLoading: boolean;
  activePreset: 'crisis' | 'trap' | 'scald' | 'live' | null;
  debounceTimer: number | null;
  valveState: ValveDispatchState;

  // Actions
  setTab: (tab: AppTab) => void;
  selectPlot: (plotId: string) => void;
  openEditModal: () => void;
  closeEditModal: () => void;
  updatePlot: (plotId: string, updates: Partial<FarmPlot>) => void;
  scalePlotPolygon: (plotId: string, factor: number) => void;
  movePlotLocation: (plotId: string, newCenter: [number, number]) => void;
  updatePlotVertex: (plotId: string, vertexIndex: number, newCoord: [number, number]) => void;

  checkHealth: () => Promise<void>;
  dispatchValveCommand: () => void;
  setLocation: (loc: AgriculturalLocation) => void;
  setMoisture: (pct: number) => void;
  toggleHeatwave: () => void;
  setFieldParam: <K extends keyof FieldPayload>(key: K, value: FieldPayload[K]) => void;
  applyPreset: (presetId: 'crisis' | 'trap' | 'scald') => Promise<void>;
  applyLiveWeather: () => Promise<void>;
  triggerEvaluation: () => void;
}

export const useFieldStore = create<FieldState>((set, get) => ({
  activeTab: 'map',
  selectedPlotId: 'plot-1',
  plots: [...FARM_PLOTS],
  isEditModalOpen: false,

  payload: { ...PRESETS.crisis.payload },
  decision: MOCK_FALLBACK_EVALUATION,
  health: null,
  isLoading: false,
  activePreset: 'crisis',
  debounceTimer: null,
  valveState: { status: 'IDLE' },

  setTab: (tab) => set({ activeTab: tab }),

  openEditModal: () => set({ isEditModalOpen: true }),
  closeEditModal: () => set({ isEditModalOpen: false }),

  updatePlot: (plotId, updates) => {
    const updatedPlots = get().plots.map((p) => {
      if (p.id !== plotId) return p;
      return { ...p, ...updates };
    });
    set({ plots: updatedPlots });

    // Sync with payload if current plot is edited
    if (get().selectedPlotId === plotId) {
      const active = updatedPlots.find((p) => p.id === plotId);
      if (active) {
        const nextPayload: FieldPayload = {
          ...get().payload,
          crop_type: active.crop,
          growth_stage: active.stage,
          soil_texture: active.soil,
          current_moisture_pct: active.soilMoisturePct,
          irrigation_system: active.irrigation,
          simulated_heat_spike: active.tempC >= 41 ? 6.0 : 0.0,
          peak_temperature_override: active.tempC,
          location_name: `${active.name} (${active.locationName})`,
          latitude: active.center[0],
          longitude: active.center[1],
        };
        set({ payload: nextPayload });
        get().triggerEvaluation();
      }
    }
  },

  movePlotLocation: (plotId, newCenter) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot) return;
    const [oldLat, oldLng] = plot.center;
    const dLat = newCenter[0] - oldLat;
    const dLng = newCenter[1] - oldLng;
    const newPolygon = plot.polygon.map(([lat, lng]) => [
      Number((lat + dLat).toFixed(6)),
      Number((lng + dLng).toFixed(6)),
    ]) as [number, number][];

    get().updatePlot(plotId, {
      center: [Number(newCenter[0].toFixed(6)), Number(newCenter[1].toFixed(6))],
      polygon: newPolygon,
    });
  },

  updatePlotVertex: (plotId, vertexIndex, newCoord) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot || !plot.polygon[vertexIndex]) return;

    const newPolygon = plot.polygon.map((pt, idx) => (
      idx === vertexIndex
        ? [Number(newCoord[0].toFixed(6)), Number(newCoord[1].toFixed(6))] as [number, number]
        : pt
    ));

    // Recalculate centroid center
    const sumLat = newPolygon.reduce((acc, p) => acc + p[0], 0);
    const sumLng = newPolygon.reduce((acc, p) => acc + p[1], 0);
    const newCenter: [number, number] = [
      Number((sumLat / newPolygon.length).toFixed(6)),
      Number((sumLng / newPolygon.length).toFixed(6)),
    ];

    // Compute approximate real-world polygon area (Shoelace formula converted to Hectares)
    // 1 deg lat ~ 111,000m, 1 deg lng ~ 111,000m * cos(lat)
    const midLatRad = (newCenter[0] * Math.PI) / 180;
    const metersPerLat = 111320;
    const metersPerLng = 111320 * Math.cos(midLatRad);

    let areaM2 = 0;
    const n = newPolygon.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = (newPolygon[i][1] - newCenter[1]) * metersPerLng;
      const yi = (newPolygon[i][0] - newCenter[0]) * metersPerLat;
      const xj = (newPolygon[j][1] - newCenter[1]) * metersPerLng;
      const yj = (newPolygon[j][0] - newCenter[0]) * metersPerLat;
      areaM2 += xi * yj - xj * yi;
    }
    areaM2 = Math.abs(areaM2) / 2;
    const computedHa = Math.max(0.5, Math.round((areaM2 / 10000) * 10) / 10);
    const computedAcres = Math.max(1, Math.round(computedHa * 2.471 * 10) / 10);
    const totalMunsForecast = Math.round(computedAcres * (plot.yieldMunsPerAcre || 38.5));

    get().updatePlot(plotId, {
      polygon: newPolygon,
      center: newCenter,
      areaHa: computedHa,
      areaAcres: computedAcres,
      totalMunsForecast,
    });
  },

  scalePlotPolygon: (plotId, factor) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot) return;
    const [cLat, cLng] = plot.center;
    const newPolygon = plot.polygon.map(([lat, lng]) => [
      cLat + (lat - cLat) * factor,
      cLng + (lng - cLng) * factor,
    ]) as [number, number][];
    const newAreaHa = Math.max(1, Math.round(plot.areaHa * (factor * factor) * 10) / 10);
    const newAreaAcres = Math.max(1, Math.round(newAreaHa * 2.471 * 10) / 10);
    const totalMunsForecast = Math.round(newAreaAcres * (plot.yieldMunsPerAcre || 38.5));
    get().updatePlot(plotId, {
      polygon: newPolygon,
      areaHa: newAreaHa,
      areaAcres: newAreaAcres,
      totalMunsForecast,
    });
  },

  selectPlot: (plotId) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot) return;

    set({ selectedPlotId: plotId, activePreset: plot.presetKey });
    const nextPayload: FieldPayload = {
      crop_type: plot.crop,
      growth_stage: plot.stage,
      soil_texture: plot.soil,
      current_moisture_pct: plot.soilMoisturePct,
      irrigation_system: plot.irrigation,
      simulated_heat_spike: plot.tempC >= 41 ? 6.0 : 0.0,
      peak_temperature_override: plot.tempC,
      location_name: `${plot.name} (${plot.locationName})`,
      latitude: plot.center[0],
      longitude: plot.center[1],
    };
    set({ payload: nextPayload });
    get().triggerEvaluation();
  },

  setLocation: (loc: AgriculturalLocation) => {
    const nextPayload = {
      ...get().payload,
      location_name: `${loc.name} (${loc.farmingBelt})`,
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
    set({ payload: nextPayload });

    // Move current plot to selected agricultural location
    const selectedPlotId = get().selectedPlotId;
    if (selectedPlotId) {
      get().movePlotLocation(selectedPlotId, [loc.latitude, loc.longitude]);
      get().updatePlot(selectedPlotId, {
        locationName: `${loc.name}, ${loc.province}`,
      });
    }

    if (get().activePreset === 'live') {
      get().applyLiveWeather();
    } else {
      get().triggerEvaluation();
    }
  },

  checkHealth: async () => {
    const health = await fetchHealth();
    set({ health });
  },

  dispatchValveCommand: () => {
    const currentDecision = get().decision.selected_decision;
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    set({
      valveState: {
        status: 'QUEUED',
        timestamp: now,
        command: currentDecision,
      },
    });

    setTimeout(() => {
      set({
        valveState: {
          status: 'CONFIRMED',
          timestamp: now,
          command: currentDecision,
        },
      });
    }, 600);
  },

  setMoisture: (pct: number) => {
    get().setFieldParam('current_moisture_pct', pct);
  },

  toggleHeatwave: () => {
    const isCurrentlyActive = get().payload.simulated_heat_spike > 0;
    const nextSpike = isCurrentlyActive ? 0.0 : 6.0;
    const base = CROP_BASE_TEMPS[get().payload.crop_type] || 35.5;
    const nextPeak = Number((base + nextSpike).toFixed(1));
    const nextPayload = {
      ...get().payload,
      simulated_heat_spike: nextSpike,
      peak_temperature_override: nextPeak,
    };

    const selectedPlotId = get().selectedPlotId;
    const plots = get().plots.map((p) => {
      if (p.id !== selectedPlotId) return p;
      return { ...p, tempC: nextPeak };
    });

    set({ payload: nextPayload, plots, activePreset: null });
    get().triggerEvaluation();
  },

  setFieldParam: (key, value) => {
    const base = key === 'crop_type' ? (CROP_BASE_TEMPS[value as string] || 35.5) : undefined;
    const currentPayload = get().payload;
    const nextPayload = {
      ...currentPayload,
      [key]: value,
      ...(base !== undefined
        ? { peak_temperature_override: Number((base + currentPayload.simulated_heat_spike).toFixed(1)) }
        : {}),
    };

    const selectedPlotId = get().selectedPlotId;
    const plots = get().plots.map((p) => {
      if (p.id !== selectedPlotId) return p;
      const plotUpdates: Partial<FarmPlot> = {};
      if (key === 'crop_type') plotUpdates.crop = value as CropType;
      if (key === 'growth_stage') plotUpdates.stage = value as GrowthStage;
      if (key === 'soil_texture') plotUpdates.soil = value as SoilTexture;
      if (key === 'irrigation_system') plotUpdates.irrigation = value as IrrigationSystem;
      if (key === 'current_moisture_pct') plotUpdates.soilMoisturePct = value as number;
      if (key === 'crop_type') plotUpdates.tempC = nextPayload.peak_temperature_override;
      return { ...p, ...plotUpdates };
    });

    set({ payload: nextPayload, plots, activePreset: null });
    get().triggerEvaluation();
  },

  applyPreset: async (presetId) => {
    set({ isLoading: true, activePreset: presetId });
    const targetPlot = get().plots.find((p) => p.presetKey === presetId);
    if (targetPlot) {
      set({ selectedPlotId: targetPlot.id });
    }
    const loadedPayload = await fetchPreset(presetId);
    // Keep plot coordinates if available
    if (targetPlot) {
      loadedPayload.latitude = targetPlot.center[0];
      loadedPayload.longitude = targetPlot.center[1];
    }
    set({ payload: loadedPayload });

    const result = await evaluateField(loadedPayload);
    set({ decision: result, isLoading: false });
  },

  applyLiveWeather: async () => {
    set({ isLoading: true, activePreset: 'live' });
    const { latitude, longitude } = get().payload;
    const liveData = await fetchLiveWeather(latitude, longitude);

    const tomorrowPeak = liveData.dailyForecast[1]?.maxTempC ?? liveData.currentTempC;
    const nextPayload = {
      ...get().payload,
      simulated_heat_spike: 0.0,
      peak_temperature_override: tomorrowPeak,
    };

    const selectedPlotId = get().selectedPlotId;
    const plots = get().plots.map((p) => {
      if (p.id !== selectedPlotId) return p;
      return { ...p, tempC: tomorrowPeak };
    });

    const evaluated = evaluateWithLiveWeather(nextPayload, liveData);
    set({
      payload: nextPayload,
      plots,
      decision: evaluated,
      isLoading: false,
    });
  },

  triggerEvaluation: () => {
    const existing = get().debounceTimer;
    if (existing) {
      clearTimeout(existing);
    }

    set({ isLoading: true });

    const timer = window.setTimeout(async () => {
      const currentPayload = get().payload;
      const startTime = Date.now();
      const result = await evaluateField(currentPayload);
      const elapsed = Date.now() - startTime;
      const minDisplayDuration = 300;
      if (elapsed < minDisplayDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayDuration - elapsed));
      }
      set({ decision: result, isLoading: false, debounceTimer: null });
    }, 120);

    set({ debounceTimer: timer });
  },
}));
