import { create } from 'zustand';
import type { EvaluateResponse, FieldPayload } from '../lib/mockData';
import { MOCK_FALLBACK_EVALUATION, PRESETS } from '../lib/mockData';
import { evaluateField, fetchPreset } from '../lib/api';

interface FieldState {
  payload: FieldPayload;
  decision: EvaluateResponse;
  isLoading: boolean;
  activePreset: 'crisis' | 'trap' | 'scald' | null;
  debounceTimer: number | null;

  // Specific convenience setters
  setMoisture: (pct: number) => void;
  toggleHeatwave: () => void;
  setFieldParam: <K extends keyof FieldPayload>(key: K, value: FieldPayload[K]) => void;
  applyPreset: (presetId: 'crisis' | 'trap' | 'scald') => Promise<void>;
  triggerEvaluation: () => void;
}

export const useFieldStore = create<FieldState>((set, get) => ({
  payload: { ...PRESETS.crisis.payload },
  decision: MOCK_FALLBACK_EVALUATION,
  isLoading: false,
  activePreset: 'crisis',
  debounceTimer: null,

  setMoisture: (pct: number) => {
    get().setFieldParam('current_moisture_pct', pct);
  },

  toggleHeatwave: () => {
    const isCurrentlyActive = get().payload.simulated_heat_spike > 0;
    get().setFieldParam('simulated_heat_spike', isCurrentlyActive ? 0.0 : 6.0);
  },

  setFieldParam: (key, value) => {
    const nextPayload = { ...get().payload, [key]: value };
    set({ payload: nextPayload, activePreset: null });
    get().triggerEvaluation();
  },

  applyPreset: async (presetId) => {
    set({ isLoading: true, activePreset: presetId });
    const loadedPayload = await fetchPreset(presetId);
    set({ payload: loadedPayload });

    const result = await evaluateField(loadedPayload);
    set({ decision: result, isLoading: false });
  },

  triggerEvaluation: () => {
    const existing = get().debounceTimer;
    if (existing) {
      clearTimeout(existing);
    }

    const timer = window.setTimeout(async () => {
      set({ isLoading: true });
      const currentPayload = get().payload;
      const result = await evaluateField(currentPayload);
      set({ decision: result, isLoading: false, debounceTimer: null });
    }, 150);

    set({ debounceTimer: timer });
  },
}));
