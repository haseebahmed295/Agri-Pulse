import React, { useState, useRef, useEffect } from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import { Thermometer, Droplet, Sprout, Layers, Sliders, ChevronDown, Wifi, Leaf } from 'lucide-react';

const CROPS = ['Wheat', 'Maize', 'Cotton', 'Tomato'];
const STAGES = ['Vegetative', 'Flowering Anthesis', 'Grain Fill', 'Maturity'];
const SOILS = ['Sandy Loam', 'Loam', 'Clay'];
const SYSTEMS = ['Furrow Flood', 'Drip', 'Center Pivot'];

// Helper for custom dropdown (div-based to avoid native browser styling)
const CustomSelect = ({ value, onChange, options, label, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col gap-1.5 relative ${isOpen ? 'z-[100]' : 'z-10'}`} ref={dropdownRef}>
      <label className="text-[13px] text-[#9cb5a6] flex items-center gap-1.5 font-medium tracking-wide">
        {Icon && <Icon className="w-4 h-4" />} {label}
      </label>
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2.5 text-[15px] text-[#e2eee6] flex items-center justify-between cursor-pointer backdrop-blur-sm"
        >
          <span>{value}</span>
          <ChevronDown className={`w-4 h-4 text-[#e2eee6] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {isOpen && (
          <div className="absolute top-full left-0 z-[999] w-full mt-1.5 bg-[#0c2415] border border-[#2d553b] rounded-xl overflow-hidden shadow-2xl">
            {options.map((opt) => (
              <div
                key={opt}
                onClick={() => {
                  onChange({ target: { value: opt } });
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-[15px] cursor-pointer transition-colors ${
                  value === opt 
                    ? 'bg-[#183a24] text-white font-medium' 
                    : 'text-[#e2eee6] hover:bg-[#183a24]/50'
                }`}
              >
                {opt}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const FieldControls: React.FC = () => {
  const { payload, setFieldParam } = useFieldStore();
  const isHeatActive = payload.simulated_heat_spike > 0;

  return (
    <div className="h-full p-4">
      <aside className="h-full flex flex-col bg-[#0c2415]/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 select-none overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-5 shrink-0">
          <Leaf className="w-7 h-7 text-[#86efac]" strokeWidth={1.5} />
          <h2 className="text-[22px] tracking-wide">
            <span className="font-semibold text-white">Field Telemetry</span>
            <span className="font-light text-[#9cb5a6]"> & Simulator</span>
          </h2>
        </div>

        <div className="flex-1 flex flex-col justify-start space-y-5 overflow-y-auto pr-1 custom-scrollbar">
          
          {/* Form Fields */}
          <div className="space-y-4">
            <CustomSelect
              label="Crop Type"
              icon={Sprout}
              value={payload.crop_type}
              onChange={(e) => setFieldParam('crop_type', e.target.value)}
              options={CROPS}
            />

            <CustomSelect
              label="Growth Stage"
              icon={Sprout}
              value={payload.growth_stage}
              onChange={(e) => setFieldParam('growth_stage', e.target.value)}
              options={STAGES}
            />

            <div className="grid grid-cols-2 gap-4">
              <CustomSelect
                label="Soil Type"
                icon={Layers}
                value={payload.soil_texture}
                onChange={(e) => setFieldParam('soil_texture', e.target.value)}
                options={SOILS}
              />

              <CustomSelect
                label="Irrigation"
                icon={Droplet}
                value={payload.irrigation_system}
                onChange={(e) => setFieldParam('irrigation_system', e.target.value)}
                options={SYSTEMS}
              />
            </div>
          </div>

          {/* Moisture Slider Card */}
          <div className="p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-white flex items-center gap-2">
                <Droplet className="w-5 h-5 text-cyan-400" fill="currentColor" fillOpacity={0.2} />
                Soil Moisture (θ)
              </span>
              <span className="text-[13px] font-semibold tracking-wide text-white">
                {payload.current_moisture_pct.toFixed(1)}%
              </span>
            </div>

            <input
              type="range"
              min="5.0"
              max="45.0"
              step="0.5"
              value={payload.current_moisture_pct}
              onChange={(e) => setFieldParam('current_moisture_pct', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
            />

            <div className="flex justify-between text-[11px] text-white/60 font-medium tracking-wide">
              <span>5% (Wilting)</span>
              <span>20% (FC)</span>
              <span>45% (Saturation)</span>
            </div>
          </div>

          {/* Heatwave Simulation Card */}
          <div className="p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-white flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-rose-400" />
                Simulated Heatwave Spike
              </span>
              <button
                onClick={() => setFieldParam('simulated_heat_spike', isHeatActive ? 0.0 : 6.0)}
                className={`text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                  isHeatActive
                    ? 'text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {isHeatActive ? '+6°C ACTIVE' : 'OFF'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#9cb5a6]">Peak Temp Override</span>
                <span className="text-[15px] font-semibold text-rose-400">
                  {payload.peak_temperature_override.toFixed(1)}°C
                </span>
              </div>
              <input
                type="range"
                min="30.0"
                max="48.0"
                step="0.5"
                value={payload.peak_temperature_override}
                onChange={(e) =>
                  setFieldParam('peak_temperature_override', parseFloat(e.target.value))
                }
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-gray-500/50 rounded-lg"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

