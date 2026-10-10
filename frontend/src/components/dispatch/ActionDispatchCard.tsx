import React from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import { Clock, ShieldAlert, Send, Leaf, Droplet, CheckCircle2, AlertTriangle } from 'lucide-react';

const RationaleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-white">
    {/* Waves */}
    <path d="M3 18c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
    <path d="M3 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
    {/* Droplet */}
    <path d="M7 14c-1.6 0-3-1.4-3-3 0-1.5 1.5-3.5 3-5 1.5 1.5 3 3.5 3 5 0 1.6-1.4 3-3 3z" />
    {/* Plant/Leaf */}
    <path d="M14 15v-6" />
    <path d="M14 11c3 0 5-2 5-4 0-1.5-1.5-2-3-2-2 0-3 1.5-3 3" />
    <path d="M14 12c-2 0-4-1-4-3 0-1-1-1.5-2-1.5-1 0-1.5.5-1.5 1.5" />
  </svg>
);

export const ActionDispatchCard: React.FC = () => {
  const { decision, isLoading } = useFieldStore();
  const { sufficiency_status, selected_decision, action_plan, decision_confidence } = decision;

  const getStatusBadge = () => {
    switch (sufficiency_status) {
      case 'CRITICAL_HEAT_DEFICIT':
        return {
          icon: <ShieldAlert className="w-8 h-8 text-white" strokeWidth={1.5} />,
          label: 'CRITICAL HEAT DEFICIT',
          color: 'text-rose-400',
        };
      case 'MODERATE_DEFICIT':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-white" strokeWidth={1.5} />,
          label: 'MODERATE DEFICIT',
          color: 'text-amber-400',
        };
      case 'SUFFICIENT_NO_ACTION':
      default:
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={1.5} />,
          label: 'SUFFICIENT - NO ACTION',
          color: 'text-emerald-400',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="h-full p-4 flex flex-col justify-start space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-2 mb-1">
        <Leaf className="w-6 h-6 text-white" strokeWidth={1.5} />
        <h2 className="text-[17px] font-medium tracking-widest uppercase text-white">
          Action Dispatch Card
        </h2>
      </div>

      {/* Main Alert Card */}
      <div className="bg-[#122e1b]/40 backdrop-blur-md border border-white/10 rounded-[20px] p-5 shadow-2xl flex flex-col gap-5">
        <div className="flex items-start gap-4">
          {badge.icon}
          <div className="flex flex-col gap-0.5">
            <span className={`text-[17px] font-bold uppercase tracking-wider ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-[14px] text-[#9cb5a6]">
              {(decision_confidence * 100).toFixed(0)}% Conf
            </span>
          </div>
        </div>
        
        <div className="h-px w-full bg-white/10"></div>
        
        <div className="flex items-start gap-4">
          <Send className="w-7 h-7 text-white" strokeWidth={1.5} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wider text-[#9cb5a6]">
              Dispatched Action
            </span>
            <span className="text-[16px] font-medium text-white tracking-wide">
              {selected_decision}
            </span>
          </div>
        </div>
      </div>

      {/* Target Grid */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Target Depth */}
        <div className="bg-[#122e1b]/40 backdrop-blur-md border border-white/10 rounded-[20px] p-5 flex flex-col justify-center gap-1.5 shadow-2xl">
          <div className="flex items-center gap-3">
            <Droplet className="w-6 h-6 text-white" strokeWidth={1.5} />
            <span className="text-[13px] text-[#9cb5a6]">Target Depth</span>
          </div>
          <div className="text-[20px] font-medium text-white ml-9">
            {action_plan.water_depth_mm.toFixed(1)} mm
          </div>
        </div>

        {/* Target Window */}
        <div className="bg-[#122e1b]/40 backdrop-blur-md border border-white/10 rounded-[20px] p-5 flex flex-col justify-center gap-1.5 shadow-2xl">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-white shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="flex flex-col">
              <span className="text-[13px] text-[#9cb5a6]">Target Window</span>
              <div className="flex flex-col mt-0.5">
                <span className="text-[16px] font-medium text-white leading-tight">Tonight</span>
                <span className="text-[14px] text-white/80 leading-tight mt-0.5">{action_plan.execution_window}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Biological Rationale */}
      <div className="bg-[#122e1b]/40 backdrop-blur-md border border-white/10 rounded-[20px] p-5 shadow-2xl space-y-3">
        <div className="flex items-center gap-3">
          <RationaleIcon />
          <span className="text-[12px] uppercase tracking-wider text-[#9cb5a6]">
            Biological Rationale
          </span>
        </div>
        <p className="text-[14px] text-white/95 leading-relaxed pl-10">
          {action_plan.biological_rationale}
        </p>
      </div>

      <div className="flex-grow"></div>

      {/* Dispatch Button */}
      <div className="pt-2">
        <button
          disabled={isLoading}
          onClick={() => alert(`Irrigation command ${selected_decision} queued for field controller.`)}
          className="w-full bg-[#20402b]/70 hover:bg-[#255737]/80 border border-white/10 backdrop-blur-xl rounded-[16px] p-4 flex items-center justify-center gap-3 transition-all shadow-2xl disabled:opacity-50 cursor-pointer text-white"
        >
          <Send className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-[15px] font-medium tracking-wide">
            Dispatch Command to Telemetry Valve
          </span>
        </button>
      </div>
    </div>
  );
};
