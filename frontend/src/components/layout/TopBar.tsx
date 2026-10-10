import React from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import { Bell, ChevronRight, Plus } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { activePreset, applyPreset, decision } = useFieldStore();

  return (
    <header className="h-16 px-6 flex items-center justify-between select-none shrink-0 bg-black/10 backdrop-blur-sm border-b border-white/10 w-full">
      {/* Left Section: Logo & Brand */}
      <div className="flex-1 flex items-center justify-start">
        <div className="flex items-center gap-2">
          {/* Custom Plant Icon */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
              <path d="M12 2L13 6L17 7L13 8L12 12L11 8L7 7L11 6L12 2Z" fill="#FCD34D" />
              <path d="M12 22C12 22 7 18 7 12C7 6 12 10 12 10C12 10 17 6 17 12C17 18 12 22 12 22Z" fill="#84CC16" />
              <path d="M12 22C12 22 5 16 5 10C5 4 12 8 12 8" fill="#A3E635" />
            </svg>
          </div>
          <div className="text-[22px] font-light tracking-wide">
            <span className="text-white">Agri-</span>
            <span className="text-[#A3E635]">Pulse</span>
          </div>
        </div>
        <div className="w-px h-6 bg-white/20 mx-8" />
      </div>

      {/* Middle Section: Demos & Latency */}
      <div className="flex-1 flex items-center justify-center gap-6 whitespace-nowrap">
        <span className="text-[15px] text-white/70 font-light tracking-wider uppercase mr-2">
          Golden Demos:
        </span>

        <button
          onClick={() => applyPreset('crisis')}
          className={`text-[15px] transition-colors cursor-pointer ${
            activePreset === 'crisis' ? 'text-white font-normal drop-shadow-md' : 'text-white/80 hover:text-white font-light'
          }`}
        >
          Preset A: Heat Crisis
        </button>

        <button
          onClick={() => applyPreset('trap')}
          className={`text-[15px] transition-colors cursor-pointer ${
            activePreset === 'trap' ? 'text-white font-normal drop-shadow-md' : 'text-white/80 hover:text-white font-light'
          }`}
        >
          Preset B: False Security
        </button>

        <button
          onClick={() => applyPreset('scald')}
          className={`text-[15px] transition-colors cursor-pointer ${
            activePreset === 'scald' ? 'text-white font-normal drop-shadow-md' : 'text-white/80 hover:text-white font-light'
          }`}
        >
          Preset C: Imminent Scald
        </button>
      </div>

      {/* Right Section: Latency, Actions, Profile */}
      <div className="flex-1 flex items-center justify-end gap-6 whitespace-nowrap">
        <div className="text-[13px] text-white/90 font-light">
          Latency: {decision.total_latency_ms.toFixed(1)} ms
        </div>

        <button className="w-9 h-9 rounded-xl border border-[#FCD34D]/40 bg-[#FCD34D]/10 flex items-center justify-center text-[#FDE68A] shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:bg-[#FCD34D]/20 transition-all cursor-pointer">
          <Plus className="w-5 h-5" />
        </button>

        <button className="text-white/80 hover:text-white transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-2" />

        <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-colors">
          <div className="w-9 h-9 rounded-full bg-[#E8C39E] flex items-center justify-center overflow-hidden border border-white/20">
            <span className="text-xl">🧑‍🌾</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[13px] font-light text-white leading-tight">My Farm</span>
            <span className="text-[10px] text-white/60 font-light leading-tight">Farm manager</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/60 ml-1" />
        </div>
      </div>
    </header>
  );
};

