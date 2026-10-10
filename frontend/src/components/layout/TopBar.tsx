import React from 'react';
import { useFieldStore, type AppTab } from '../../store/useFieldStore';
import { AGRICULTURAL_LOCATIONS } from '../../lib/mockData';
import { 
  MapPin, 
  Sparkles, 
  Droplets, 
  Layers 
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    activeTab,
    setTab,
    activePreset,
    applyPreset,
    applyLiveWeather,
    isLoading,
    payload,
    setLocation,
  } = useFieldStore();

  const currentLocation =
    AGRICULTURAL_LOCATIONS.find(
      (l) => Math.abs(l.latitude - payload.latitude) < 0.1
    ) || AGRICULTURAL_LOCATIONS[0];

  const tabs: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'map', label: 'Field Map', icon: Layers },
    { id: 'irrigation', label: 'Irrigation & Forecast Graphs', icon: Droplets },
  ];

  return (
    <header className="h-13 px-4 flex items-center justify-between select-none shrink-0 bg-white/95 border-b border-slate-200 backdrop-blur-md w-full shadow-xs z-30">
      {/* 1. Left Section: Brand Logo & 4 Navigation Tabs */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {/* Custom Agricultural Leaf Icon & Brand */}
        <div className="flex items-center gap-2 pr-1 shrink-0">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 drop-shadow-[0_0_4px_rgba(22,163,74,0.3)]">
              <path d="M12 2L13 6L17 7L13 8L12 12L11 8L7 7L11 6L12 2Z" fill="#F59E0B" />
              <path d="M12 22C12 22 7 18 7 12C7 6 12 10 12 10C12 10 17 6 17 12C17 18 12 22 12 22Z" fill="#16A34A" />
              <path d="M12 22C12 22 5 16 5 10C5 4 12 8 12 8" fill="#22C55E" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-[16px] font-extrabold tracking-tight text-slate-900">Agri-</span>
            <span className="text-[16px] font-extrabold tracking-tight text-emerald-600">Pulse</span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        {/* 4 Core Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 2. Center Section: Compact Demo Farm Scenarios */}
      <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Scenarios:</span>
        </span>

        <button
          onClick={() => applyPreset('crisis')}
          disabled={isLoading}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            activePreset === 'crisis'
              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          <span>A: Wheat Heat</span>
        </button>

        <button
          onClick={() => applyPreset('trap')}
          disabled={isLoading}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            activePreset === 'trap'
              ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>B: Wet Clay</span>
        </button>

        <button
          onClick={() => applyPreset('scald')}
          disabled={isLoading}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            activePreset === 'scald'
              ? 'bg-orange-100 text-orange-800 border border-orange-300 font-bold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          <span>C: Tomato Scald</span>
        </button>

        <button
          onClick={() => applyLiveWeather()}
          disabled={isLoading}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            activePreset === 'live'
              ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
          title="Fetch real-time 7-day weather forecast from Open-Meteo API"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${activePreset === 'live' ? 'bg-sky-500 animate-pulse' : 'bg-sky-400'}`}></span>
          <span>Live API (Open-Meteo)</span>
        </button>
      </div>

      {/* 3. Right Section: Farm Location + AI Model Health + Speed */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Farm Location Picker */}
        <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs">
          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <select
            value={currentLocation.id}
            onChange={(e) => {
              const selected = AGRICULTURAL_LOCATIONS.find((l) => l.id === e.target.value);
              if (selected) setLocation(selected);
            }}
            className="bg-transparent text-slate-900 font-semibold text-xs focus:outline-none cursor-pointer max-w-[140px] truncate"
          >
            {AGRICULTURAL_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id} className="bg-white text-slate-900">
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
