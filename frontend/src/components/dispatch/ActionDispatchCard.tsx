import React from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import { FARMER_ACTIONS, FARMER_STATUS } from '../../lib/mockData';
import { Clock, ShieldAlert, ShieldCheck, Droplet, CheckCircle2, AlertTriangle, Moon, Check, Layers, Sparkles, Send, Wind, Loader2 } from 'lucide-react';

export const ActionDispatchCard: React.FC = () => {
  const { decision, isLoading, valveState, dispatchValveCommand, plots, selectedPlotId } = useFieldStore();
  const currentPlot = plots.find((p) => p.id === selectedPlotId) || plots[0];
  const { sufficiency_status, selected_decision, action_plan, decision_confidence, hydrology_summary } = decision;

  const isNightWindow =
    action_plan.execution_window.toLowerCase().includes('tonight') ||
    action_plan.execution_window.includes('22:') ||
    action_plan.execution_window.includes('04:');

  const farmerAction = FARMER_ACTIONS[selected_decision] || {
    farmerTitle: selected_decision,
    farmerBadge: selected_decision,
    farmerInstruction: action_plan.biological_rationale,
    urgency: 'MEDIUM',
  };

  const farmerStatus = FARMER_STATUS[sufficiency_status] || {
    label: sufficiency_status,
    sublabel: '',
    color: 'text-emerald-800',
  };

  const getStatusBorder = () => {
    switch (sufficiency_status) {
      case 'CRITICAL_HEAT_DEFICIT':
        return 'border-rose-300 bg-rose-50 text-rose-900 shadow-2xs';
      case 'MODERATE_DEFICIT':
        return 'border-amber-300 bg-amber-50 text-amber-900 shadow-2xs';
      case 'SUFFICIENT_NO_ACTION':
      default:
        return 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-2xs';
    }
  };

  return (
    <div className="h-full p-1.5">
      <div className="h-full flex flex-col justify-between bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 select-none shadow-sm overflow-hidden relative">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs transition-colors ${
              isLoading ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Farmer Action Plan
              </span>
              <p className="text-[10px] text-slate-500 font-medium">AI irrigation advice for your field</p>
            </div>
          </div>
          {isLoading ? (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1.5 shadow-2xs animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              <span>Calculating...</span>
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Action</span>
            </span>
          )}
        </div>

        {/* Dynamic Calculation Progress & Banner */}
        {isLoading && (
          <div className="mb-2 shrink-0 space-y-1">
            <div className="h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-indeterminate w-1/2 rounded-full" />
            </div>
            <div className="py-1 px-2.5 rounded-lg bg-emerald-50/90 border border-emerald-200/90 text-[10px] text-emerald-900 font-semibold flex items-center justify-between shadow-2xs">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />
                <span>Simulating soil water balance & heat stress...</span>
              </span>
              <span className="font-mono text-[9px] bg-white px-1.5 py-0.2 rounded border border-emerald-200 text-emerald-700 font-bold">
                Computing
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className={`flex-1 flex flex-col justify-between space-y-2.5 overflow-y-auto pr-0.5 custom-scrollbar min-h-0 transition-opacity duration-200 ${
          isLoading ? 'opacity-75' : 'opacity-100'
        }`}>
          
          {/* Main Status & Action Directive Banner */}
          <div className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-300 relative overflow-hidden ${getStatusBorder()}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sufficiency_status === 'CRITICAL_HEAT_DEFICIT' && (
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                {sufficiency_status === 'MODERATE_DEFICIT' && (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                {sufficiency_status === 'SUFFICIENT_NO_ACTION' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-wide">
                    {farmerStatus.label}
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium">
                    {farmerStatus.sublabel}
                  </span>
                </div>
              </div>
              {isLoading ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/90 text-slate-700 border border-slate-300 shadow-2xs flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-600" />
                  <span>Updating...</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-300 shadow-2xs">
                  {(decision_confidence * 100).toFixed(0)}% Conf
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex flex-col">
              <div className="flex items-center gap-1.5">
                {selected_decision === 'PREEMPTIVE_NIGHT_PRECHARGE' && (
                  <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                )}
                {selected_decision === 'HOLD_CURRENT_LEVEL' && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                {selected_decision === 'SPLIT_CYCLE_LIGHT_IRRIGATION' && (
                  <Droplet className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                )}
                {selected_decision === 'EMERGENCY_CANOPY_COOLING' && (
                  <Wind className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                )}
                <span className="text-xs font-bold text-slate-900 tracking-wide">
                  {farmerAction.farmerTitle}
                </span>
              </div>
              <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed font-medium">
                {farmerAction.farmerInstruction}
              </p>
            </div>
          </div>

          {/* Water Depth & Schedule Window Cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* Water Needed */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl flex flex-col justify-between shadow-2xs relative">
              <div className="flex items-center justify-between text-slate-700 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Water Needed (پانی)</span>
                </div>
                {isLoading && (
                  <span className="text-[9px] font-bold text-cyan-700 bg-cyan-100/80 px-1 py-0.2 rounded animate-pulse">
                    Computing...
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                {isLoading ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-mono font-black text-slate-400 animate-pulse">
                      {action_plan.water_depth_mm.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">mm</span>
                    <Loader2 className="w-3 h-3 text-cyan-600 animate-spin ml-1" />
                  </div>
                ) : (
                  <>
                    <span className="text-xl font-mono font-black text-slate-900">
                      {action_plan.water_depth_mm.toFixed(1)}
                    </span>
                    <span className="text-xs text-emerald-700 font-bold">mm</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      (~{(action_plan.water_depth_mm / 25.4).toFixed(1)} In / انچ)
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                {action_plan.water_depth_mm > 0
                  ? `~${Math.round((action_plan.water_depth_mm / 25.4) * (currentPlot.areaAcres || 74.1))} Acre-Inches for ${currentPlot.areaAcres.toFixed(0)} Acres`
                  : 'Hold — Soil moisture safe'}
              </span>
            </div>

            {/* Best Window */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl flex flex-col justify-between shadow-2xs relative">
              <div className="flex items-center justify-between text-slate-700 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  {isNightWindow ? (
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>Best Watering Time</span>
                </div>
                {isLoading && (
                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/80 px-1 py-0.2 rounded animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                {action_plan.execution_window}
              </div>
              <span className="text-[10px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                {isNightWindow ? (
                  <>
                    <Moon className="w-3 h-3 text-indigo-600" />
                    <span>Night avoids evaporation</span>
                  </>
                ) : (
                  <span>Standard schedule</span>
                )}
              </span>
            </div>
          </div>

          {/* Root-Zone & Soil Moisture Check */}
          <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-700">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-emerald-600" />
                <span>Root & Soil Moisture Check</span>
              </div>
              {isLoading && (
                <span className="text-[9px] font-semibold text-emerald-700 lowercase animate-pulse">
                  recalculating
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-slate-500 text-[8px] font-bold">ROOT DEPTH</div>
                <div className="text-slate-900 font-bold">{hydrology_summary?.root_depth_cm ?? 60} cm</div>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-slate-500 text-[8px] font-bold">DEFICIT</div>
                <div className="text-cyan-700 font-bold">{hydrology_summary?.precomputed_deficit_mm?.toFixed(1) ?? '0.0'} mm</div>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-slate-500 text-[8px] font-bold">WILTING</div>
                <div className="text-rose-700 font-bold">{hydrology_summary?.wilting_point_pct ?? 9}%</div>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-slate-500 text-[8px] font-bold">TARGET</div>
                <div className="text-emerald-700 font-bold">{hydrology_summary?.field_capacity_pct ?? 20}%</div>
              </div>
            </div>
          </div>

          {/* Plant Science Explanation */}
          <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Why the AI recommends this:</span>
              </span>
              {isLoading && (
                <span className="text-[9px] font-mono text-emerald-700 animate-pulse font-semibold">
                  Scoring logits...
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed font-sans font-medium">
              {action_plan.biological_rationale}
            </p>
          </div>
        </div>

        {/* Action Confirmation Button */}
        <div className="pt-2 mt-2 border-t border-slate-200 shrink-0">
          {valveState.status === 'CONFIRMED' ? (
            <div className="w-full bg-emerald-100 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-emerald-800 shadow-2xs">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Watering Plan Confirmed & Queued</span>
              </div>
              <span className="text-[10px] text-emerald-800 font-mono">{valveState.timestamp}</span>
            </div>
          ) : valveState.status === 'QUEUED' ? (
            <div className="w-full bg-cyan-100 border border-cyan-300 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-bold text-cyan-800 animate-pulse">
              <Droplet className="w-4 h-4 animate-bounce text-cyan-600" />
              <span>Sending plan to smart tube-well / valve...</span>
            </div>
          ) : isLoading ? (
            <button
              disabled={true}
              className="w-full bg-slate-100 border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-center gap-2 text-slate-500 font-bold text-xs shadow-2xs cursor-wait"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Calculating Optimal Plan...</span>
            </button>
          ) : (
            <button
              onClick={dispatchValveCommand}
              className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl p-2.5 flex items-center justify-center gap-2 transition-all cursor-pointer text-white font-bold text-xs shadow-sm"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              <span>Confirm & Send to Smart Pump / Valve</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
