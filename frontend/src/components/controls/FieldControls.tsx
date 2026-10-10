import React from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import type { CropType, GrowthStage, IrrigationSystem, SoilTexture } from '../../lib/mockData';
import { Thermometer, Droplet, Sprout, Layers, Sliders, Flame, AlertTriangle, CheckCircle2 } from 'lucide-react';

const CROPS: { label: string; value: CropType; urdu: string }[] = [
  { label: 'Wheat (Gandum)', value: 'Wheat', urdu: 'گندم' },
  { label: 'Cotton (Kapas)', value: 'Cotton', urdu: 'کپاس' },
  { label: 'Maize (Makai / Corn)', value: 'Maize', urdu: 'مکئی' },
  { label: 'Tomato (Vegetables)', value: 'Tomato', urdu: 'ٹماٹر' },
];

const STAGES: { label: string; value: GrowthStage }[] = [
  { label: 'Flowering & Pollen Stage (Most sensitive to heat)', value: 'Flowering_Anthesis' },
  { label: 'Young Plant & Leaf Growth (Vegetative)', value: 'Vegetative' },
  { label: 'Grain Filling & Fruit Formation', value: 'Grain_Fill' },
  { label: 'Maturity & Pre-Harvest', value: 'Maturity' },
];

const SOILS: { label: string; value: SoilTexture; wp: number; fc: number }[] = [
  { label: 'Sandy Loam (Dries quickly · Wilts at 9%)', value: 'Sandy Loam', wp: 9.0, fc: 20.0 },
  { label: 'Loam Soil (Rich & balanced · Wilts at 12%)', value: 'Loam', wp: 12.0, fc: 27.0 },
  { label: 'Clay Soil (Holds lots of water · Wilts at 18%)', value: 'Clay', wp: 18.0, fc: 35.0 },
];

const SYSTEMS: { label: string; value: IrrigationSystem }[] = [
  { label: 'Tube-well Flood / Furrow', value: 'Furrow_Flood' },
  { label: 'Drip Irrigation Pipes', value: 'Drip' },
  { label: 'Center Pivot Sprinkler', value: 'Center_Pivot' },
];

export const FieldControls: React.FC = () => {
  const { payload, setFieldParam, decision, toggleHeatwave } = useFieldStore();
  const isHeatActive = payload.simulated_heat_spike > 0;

  const currentSoil = SOILS.find((s) => s.value === payload.soil_texture) || SOILS[0];
  const wp = decision.hydrology_summary?.wilting_point_pct ?? currentSoil.wp;
  const fc = decision.hydrology_summary?.field_capacity_pct ?? currentSoil.fc;
  const moist = payload.current_moisture_pct;

  // Exact percentage positions along 5% - 50% scale
  const minRange = 5;
  const maxRange = 50;
  const rangeSpan = maxRange - minRange;
  const wpPos = Math.min(95, Math.max(5, ((wp - minRange) / rangeSpan) * 100));
  const fcPos = Math.min(95, Math.max(5, ((fc - minRange) / rangeSpan) * 100));
  const currentPos = Math.min(100, Math.max(0, ((moist - minRange) / rangeSpan) * 100));

  const getMoistureStatus = () => {
    if (moist <= wp) {
      return {
        text: 'DANGEROUSLY DRY (WILTING RISK)',
        color: 'text-rose-800 bg-rose-50/90 border-rose-300',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
      };
    }
    if (moist < fc) {
      return {
        text: 'WATER BUFFER DRYING (WATER SOON)',
        color: 'text-amber-800 bg-amber-50/90 border-amber-300',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    }
    return {
      text: 'OPTIMAL MOISTURE BUFFER (SAFE)',
      color: 'text-emerald-800 bg-emerald-50/90 border-emerald-300',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  };

  const moistStatus = getMoistureStatus();

  return (
    <div className="h-full p-1.5">
      <aside className="h-full flex flex-col bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 select-none overflow-hidden shadow-sm">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Field Setup & Soil Water
              </span>
              <p className="text-[10px] text-slate-500 font-medium">Configure crop parameters & test heat risks</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold">
            Parameters
          </span>
        </div>

        {/* Controls Body */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-2.5 pr-0.5 custom-scrollbar min-h-0">
          
          {/* Selectors */}
          <div className="space-y-2">
            {/* Crop Type */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                <span>Crop Selection</span>
              </label>
              <select
                value={payload.crop_type}
                onChange={(e) => setFieldParam('crop_type', e.target.value as CropType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors cursor-pointer"
              >
                {CROPS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Growth Stage */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                <span>Crop Growth Stage</span>
              </label>
              <select
                value={payload.growth_stage}
                onChange={(e) => setFieldParam('growth_stage', e.target.value as GrowthStage)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white transition-colors cursor-pointer"
              >
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Soil Texture & Irrigation System Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>Soil Type</span>
                </label>
                <select
                  value={payload.soil_texture}
                  onChange={(e) => setFieldParam('soil_texture', e.target.value as SoilTexture)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-600 focus:bg-white transition-colors cursor-pointer"
                >
                  {SOILS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Water System</span>
                </label>
                <select
                  value={payload.irrigation_system}
                  onChange={(e) => setFieldParam('irrigation_system', e.target.value as IrrigationSystem)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white transition-colors cursor-pointer"
                >
                  {SYSTEMS.map((sys) => (
                    <option key={sys.value} value={sys.value}>
                      {sys.label.split(' ')[0]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Precision Moisture Slider Card */}
          <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5 shadow-2xs">
            {/* Header: Label + Live Readout Badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-cyan-600" />
                <span>Soil Moisture Level</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono border ${moistStatus.badge}`}>
                  {moist.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Custom Visual Track + Range Slider */}
            <div className="relative pt-1 pb-1">
              {/* Colored Zone Background Track */}
              <div className="relative h-2.5 w-full rounded-full bg-slate-200 overflow-hidden border border-slate-300/80">
                {/* Wilting zone underlay */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-rose-200/80 border-r border-rose-300"
                  style={{ width: `${wpPos}%` }}
                  title={`Danger Wilting Zone (< ${wp}%)`}
                />
                {/* Drying buffer zone underlay */}
                <div
                  className="absolute top-0 bottom-0 bg-amber-200/80 border-r border-amber-300"
                  style={{ left: `${wpPos}%`, width: `${Math.max(0, fcPos - wpPos)}%` }}
                  title={`Drying Zone (${wp}% – ${fc}%)`}
                />
                {/* Optimal buffer zone underlay */}
                <div
                  className="absolute top-0 bottom-0 bg-emerald-200/80"
                  style={{ left: `${fcPos}%`, right: 0 }}
                  title={`Optimal Safe Zone (> ${fc}%)`}
                />

                {/* Dynamic Active Fill Bar */}
                <div
                  className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-75 ${
                    moist <= wp
                      ? 'bg-rose-500'
                      : moist < fc
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                  }`}
                  style={{ width: `${currentPos}%` }}
                />

                {/* Wilting threshold notch indicator on track */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-600/90 z-10 pointer-events-none"
                  style={{ left: `${wpPos}%` }}
                  title={`Wilting Threshold: ${wp}%`}
                />

                {/* Target threshold notch indicator on track */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-700/90 z-10 pointer-events-none"
                  style={{ left: `${fcPos}%` }}
                  title={`Field Capacity Target: ${fc}%`}
                />
              </div>

              {/* Native Transparent Slider with Custom Thumb */}
              <div className="absolute inset-x-0 top-0 bottom-0 flex items-center">
                <input
                  type="range"
                  min={minRange}
                  max={maxRange}
                  step="0.5"
                  value={moist}
                  onChange={(e) => setFieldParam('current_moisture_pct', parseFloat(e.target.value))}
                  className="agri-slider relative z-10 w-full"
                />
              </div>
            </div>

            {/* Clean Non-Colliding Scale Legend */}
            <div className="flex items-center justify-between text-[10px] select-none px-0.5">
              <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>Wilts: {wp}%</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                <span>Target: {fc}%</span>
              </span>
              <span className="font-mono text-slate-400">Scale: 5–50%</span>
            </div>

            {/* Quick Simulation Presets */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => setFieldParam('current_moisture_pct', wp)}
                className="flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-bold bg-white text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors shadow-2xs cursor-pointer truncate"
                title={`Set to Wilting Point (${wp}%)`}
              >
                Wilts ({wp}%)
              </button>
              <button
                type="button"
                onClick={() => setFieldParam('current_moisture_pct', fc)}
                className="flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-bold bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors shadow-2xs cursor-pointer truncate"
                title={`Set to Field Capacity Target (${fc}%)`}
              >
                Target ({fc}%)
              </button>
              <button
                type="button"
                onClick={() => setFieldParam('current_moisture_pct', Math.min(50, fc + 10))}
                className="flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-bold bg-white text-cyan-700 hover:bg-cyan-50 border border-cyan-200 transition-colors shadow-2xs cursor-pointer truncate"
                title={`Set to Saturated Soil (${Math.min(50, fc + 10)}%)`}
              >
                Wet ({Math.min(50, fc + 10)}%)
              </button>
            </div>

            {/* Status Indicator */}
            <div className={`py-1 px-2.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1.5 text-center ${moistStatus.color}`}>
              {moist <= wp ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : moist < fc ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span className="truncate">{moistStatus.text}</span>
            </div>
          </div>

          {/* Heatwave Simulation Toggle */}
          <div className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className={`w-4 h-4 ${isHeatActive ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Test Heatwave Spurt</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {isHeatActive ? '+6°C heatwave active' : 'Normal season forecast'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleHeatwave}
                className={`py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isHeatActive
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                {isHeatActive ? 'ON (Heat)' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
              <span className="text-slate-600 text-[11px] font-semibold flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-600" />
                Peak Afternoon Temp
              </span>
              <span className={`font-bold font-mono ${isHeatActive ? 'text-rose-700 text-sm' : 'text-slate-800'}`}>
                {payload.peak_temperature_override.toFixed(1)}°C
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

