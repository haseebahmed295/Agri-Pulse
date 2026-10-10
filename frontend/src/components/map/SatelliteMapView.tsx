import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFieldStore } from '../../store/useFieldStore';
import { FARMER_ACTIONS, type CropType, type GrowthStage, type SoilTexture } from '../../lib/mockData';
import { 
  Droplets, 
  Thermometer, 
  Sparkles, 
  Activity, 
  MapPin, 
  ArrowRight,
  AlertTriangle,
  Compass,
  Edit3,
  X,
  Check,
  Maximize2,
  Minimize2,
  TrendingUp,
  Trees,
  Crosshair,
  Move,
} from 'lucide-react';

const CROPS: { label: string; value: CropType }[] = [
  { label: 'Wheat (Gandum)', value: 'Wheat' },
  { label: 'Cotton (Kapas)', value: 'Cotton' },
  { label: 'Maize (Corn)', value: 'Maize' },
  { label: 'Tomato (Vegetables)', value: 'Tomato' },
];

const SOILS: { label: string; value: SoilTexture }[] = [
  { label: 'Sandy Loam', value: 'Sandy Loam' },
  { label: 'Loam Soil', value: 'Loam' },
  { label: 'Clay Soil', value: 'Clay' },
];

const STAGES: { label: string; value: GrowthStage }[] = [
  { label: 'Flowering & Pollen (Anthesis)', value: 'Flowering_Anthesis' },
  { label: 'Vegetative Growth', value: 'Vegetative' },
  { label: 'Grain Filling', value: 'Grain_Fill' },
  { label: 'Maturity', value: 'Maturity' },
];

const MAP_API_KEY: string =
  (import.meta.env.VITE_MAP_API_KEY as string | undefined) ||
  (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined) ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfOTYxbThwNDciLCJqdGkiOiJiNGE3ZjRmNWU2ODZmNDNjZmQzZmVkYmQzY2IxYmY4NCIsImV4cCI6MTc5NDMyNDAwMH0.HYtunKwyyb-e0KJineIcHwQ-PPNxoZGrVewLVv60CeA';

export const SatelliteMapView: React.FC = () => {
  const {
    selectedPlotId,
    selectPlot,
    plots,
    updatePlot,
    scalePlotPolygon,
    movePlotLocation,
    updatePlotVertex,
    isEditModalOpen,
    openEditModal,
    closeEditModal,
    setTab,
    decision,
  } = useFieldStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const currentPlot = plots.find((p) => p.id === selectedPlotId) || plots[0];

  // Edit form state (Acres is primary unit for farmer usability)
  const [prevPlotId, setPrevPlotId] = useState(currentPlot.id);
  const [editName, setEditName] = useState(currentPlot.name);
  const [editAreaAcres, setEditAreaAcres] = useState(currentPlot.areaAcres || currentPlot.areaHa * 2.471);
  const [editCrop, setEditCrop] = useState<CropType>(currentPlot.crop);
  const [editStage, setEditStage] = useState<GrowthStage>(currentPlot.stage);
  const [editSoil, setEditSoil] = useState<SoilTexture>(currentPlot.soil);
  const [editLat, setEditLat] = useState(currentPlot.center[0]);
  const [editLng, setEditLng] = useState(currentPlot.center[1]);

  // Sync edit form when plot changes without triggering cascading effect renders
  if (currentPlot.id !== prevPlotId) {
    setPrevPlotId(currentPlot.id);
    setEditName(currentPlot.name);
    setEditAreaAcres(currentPlot.areaAcres || currentPlot.areaHa * 2.471);
    setEditCrop(currentPlot.crop);
    setEditStage(currentPlot.stage);
    setEditSoil(currentPlot.soil);
    setEditLat(currentPlot.center[0]);
    setEditLng(currentPlot.center[1]);
  }

  // Initialize Leaflet Map (Satellite Imagery only, no useless clutter)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: currentPlot.center,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // Photorealistic Esri World Imagery (authenticated with API key / token)
      const esriTileUrl = MAP_API_KEY
        ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(MAP_API_KEY)}`
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

      L.tileLayer(
        esriTileUrl,
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        }
      ).addTo(map);

      // Geographical boundary labels
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
          opacity: 0.85,
        }
      ).addTo(map);

      // Custom Zoom Control placed in bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const polygonsGroup = L.layerGroup().addTo(map);
      polygonLayerGroupRef.current = polygonsGroup;
      mapRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan to plot center on selection
  useEffect(() => {
    if (mapRef.current && currentPlot?.center) {
      mapRef.current.flyTo(currentPlot.center, 15, {
        duration: 0.9,
        easeLinearity: 0.25,
      });
    }
  }, [selectedPlotId, currentPlot.center]);

  // Render Field Boundary Polygons
  useEffect(() => {
    if (!mapRef.current || !polygonLayerGroupRef.current) return;

    const group = polygonLayerGroupRef.current;
    group.clearLayers();

    plots.forEach((plot) => {
      const isSelected = plot.id === selectedPlotId;

      let strokeColor = '#16a34a';
      let fillColor = '#22c55e';
      const fillOpacity = isSelected ? 0.35 : 0.18;

      if (plot.tempC >= 41) {
        strokeColor = '#e11d48';
        fillColor = '#f43f5e';
      } else if (plot.soilMoisturePct > 30) {
        strokeColor = '#0284c7';
        fillColor = '#38bdf8';
      }

      if (isSelected) {
        strokeColor = '#15803d'; // Rich green
      }

      const polygon = L.polygon(plot.polygon as L.LatLngExpression[], {
        color: strokeColor,
        weight: isSelected ? 3.5 : 2,
        dashArray: isSelected ? undefined : '5, 5',
        fillColor: fillColor,
        fillOpacity: fillOpacity,
      });

      polygon.on('click', () => {
        selectPlot(plot.id);
      });

      // Daylight Light-Theme Pin Marker (Draggable for active plot to re-position away from residential areas)
      const iconHtml = `
        <div class="transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-105">
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md border backdrop-blur-md ${
            isSelected
              ? 'bg-white border-emerald-500 text-slate-900 shadow-emerald-200'
              : 'bg-white/90 border-slate-300 text-slate-700'
          }">
            <span class="w-2 h-2 rounded-full ${plot.tempC >= 41 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}"></span>
            <span class="text-xs font-bold tracking-tight">${plot.name.split(' ')[0]} ${plot.subname.split('·')[0].trim()}</span>
            <span class="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-emerald-700 font-bold border border-slate-200">${plot.areaHa} Ha</span>
            ${isSelected ? '<span class="text-[9px] bg-emerald-50 text-emerald-800 font-extrabold px-1 rounded ml-0.5 border border-emerald-300">DRAG</span>' : ''}
          </div>
        </div>
      `;

      const marker = L.marker(plot.center as L.LatLngExpression, {
        draggable: isSelected,
        icon: L.divIcon({
          html: iconHtml,
          className: 'custom-field-pin',
          iconSize: [160, 30],
        }),
      });

      marker.on('click', () => {
        selectPlot(plot.id);
      });

      if (isSelected) {
        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          const newCenter: [number, number] = [
            Number(latlng.lat.toFixed(6)),
            Number(latlng.lng.toFixed(6)),
          ];
          movePlotLocation(plot.id, newCenter);
          setEditLat(newCenter[0]);
          setEditLng(newCenter[1]);
        });

        // Interactive Draggable Boundary Vertex Points
        plot.polygon.forEach((pt, vertexIdx) => {
          const vertexHtml = `
            <div class="w-4 h-4 rounded-full bg-white border-2 border-emerald-600 shadow-lg cursor-crosshair transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
            </div>
          `;

          const vertexMarker = L.marker(pt as L.LatLngExpression, {
            draggable: true,
            icon: L.divIcon({
              html: vertexHtml,
              className: 'custom-boundary-vertex',
              iconSize: [16, 16],
            }),
            zIndexOffset: 1000,
          });

          vertexMarker.on('drag', (e) => {
            const pos = (e.target as L.Marker).getLatLng();
            const tempCoords = plot.polygon.map((c, i) =>
              i === vertexIdx ? [pos.lat, pos.lng] : c
            );
            polygon.setLatLngs(tempCoords as L.LatLngExpression[]);
          });

          vertexMarker.on('dragend', (e) => {
            const pos = (e.target as L.Marker).getLatLng();
            updatePlotVertex(plot.id, vertexIdx, [
              Number(pos.lat.toFixed(6)),
              Number(pos.lng.toFixed(6)),
            ]);
          });

          group.addLayer(vertexMarker);
        });
      }

      group.addLayer(polygon);
      group.addLayer(marker);
    });
  }, [selectedPlotId, selectPlot, plots, movePlotLocation, updatePlotVertex]);

  const handleSavePlotEdits = () => {
    const areaHa = Math.round((editAreaAcres / 2.471) * 10) / 10;
    const totalMunsForecast = Math.round(editAreaAcres * currentPlot.yieldMunsPerAcre);
    
    // Check if coordinates changed
    if (Math.abs(editLat - currentPlot.center[0]) > 0.0001 || Math.abs(editLng - currentPlot.center[1]) > 0.0001) {
      movePlotLocation(currentPlot.id, [editLat, editLng]);
    }

    updatePlot(currentPlot.id, {
      name: editName,
      areaAcres: editAreaAcres,
      areaHa,
      crop: editCrop,
      stage: editStage,
      soil: editSoil,
      totalMunsForecast,
    });
    closeEditModal();
  };

  const handleAreaSliderChange = (newAcres: number) => {
    setEditAreaAcres(newAcres);
    const currentAcres = currentPlot.areaAcres || currentPlot.areaHa * 2.471;
    if (currentAcres > 0) {
      const scaleFactor = Math.sqrt(newAcres / currentAcres);
      scalePlotPolygon(currentPlot.id, scaleFactor);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex bg-slate-100">
      {/* 1. Photorealistic Satellite Map Canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* 2. Top-Center GIS Navigation HUD Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-white/95 border border-slate-200/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
          <Compass className="w-3.5 h-3.5 text-emerald-600" />
          <span>Esri 0.5m Satellite Field View</span>
        </div>
        <span className="text-slate-300">|</span>
        <span className="text-slate-600 font-mono text-xs">
          {currentPlot.center[0].toFixed(4)}°N, {currentPlot.center[1].toFixed(4)}°E
        </span>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
          <span>Active Field: {currentPlot.subname.split('·')[0].trim()}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
          <Move className="w-3 h-3 text-emerald-600" />
          <span>Drag white corner dots to shape boundary</span>
        </div>
      </div>

      {/* 3. Left Floating Daylight-Clear Multi-Plot Inspector */}
      <div className="absolute top-3 left-3 bottom-3 w-82 z-20 flex flex-col bg-white/95 border border-slate-200/90 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        {/* Inspector Header */}
        <div className="p-2.5 border-b border-slate-200/80 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Field Inspector
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                {currentPlot.areaAcres.toFixed(1)} Acres
              </span>
              <button
                onClick={openEditModal}
                className="p-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:text-emerald-700 transition-colors cursor-pointer"
                title="Edit Field Area & Boundaries"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Plot Quick Switcher */}
          <div className="grid grid-cols-3 gap-1 mb-1.5">
            {plots.map((plot) => (
              <button
                key={plot.id}
                onClick={() => selectPlot(plot.id)}
                className={`py-1 px-1.5 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                  plot.id === selectedPlotId
                    ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {plot.subname.split('·')[0].trim()}
              </button>
            ))}
          </div>

          <div>
            <div className="text-sm font-black text-slate-950 tracking-tight leading-snug">
              {currentPlot.name}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5 font-medium">
              <span className="font-bold text-emerald-700">{currentPlot.cropDisplay}</span>
              <span>•</span>
              <span className="text-slate-500">{currentPlot.stage.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Hazard Alert Banner (if any) */}
        {currentPlot.hazardAlert && (
          <div className="mx-2.5 mt-1.5 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-1.5 leading-snug shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{currentPlot.hazardAlert}</span>
          </div>
        )}

        {/* Scrollable Micro-Climate Sensor Matrix */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar text-xs">
          {/* Health Score & Trajectory */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Crop Health Score
              </span>
              <span className="text-sm font-bold font-mono text-emerald-700">
                {currentPlot.healthScore} / 100
              </span>
            </div>
            {/* Sparkline trajectory */}
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1 pt-1 border-t border-slate-200">
              <span>5-Day Trend:</span>
              <div className="flex items-end gap-1 h-3.5">
                {currentPlot.healthHistory.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-2.5 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                    style={{ height: `${(val / 100) * 14}px` }}
                    title={`Day ${idx + 1}: ${val}%`}
                  />
                ))}
              </div>
              <span className="text-emerald-700 font-bold">Stable</span>
            </div>
          </div>

          {/* Primary Hydrology Matrix */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Soil Moisture */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                Soil Moisture
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-bold font-mono text-cyan-700">
                  {currentPlot.soilMoisturePct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">vol</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${currentPlot.soilMoisturePct < 15 ? 'bg-amber-500' : 'bg-cyan-600'}`}
                  style={{ width: `${Math.min(100, (currentPlot.soilMoisturePct / 40) * 100)}%` }}
                />
              </div>
            </div>

            {/* Volume of Water */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-blue-600" />
                Water Volume
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-bold font-mono text-blue-700">
                  {currentPlot.volumeWaterPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">root</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${currentPlot.volumeWaterPct}%` }}
                />
              </div>
            </div>

            {/* Leaf Temperature vs Air */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-600" />
                Leaf Temp (IR)
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className={`text-sm font-bold font-mono ${currentPlot.leafTempC >= 40 ? 'text-rose-700' : 'text-amber-700'}`}>
                  {currentPlot.leafTempC.toFixed(1)}°C
                </span>
                <span className="text-[10px] text-slate-500">Air: {currentPlot.tempC}°</span>
              </div>
              <span className="text-[9px] text-slate-500">Thermal FLIR</span>
            </div>

            {/* Nutrient Index */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Nutrients (NPK)
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-bold font-mono text-amber-700">
                  {currentPlot.nutrientLevelPct.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500">opt</span>
              </div>
              <span className="text-[9px] text-emerald-700 font-semibold">Optimal</span>
            </div>

            {/* Yield Estimation */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] text-slate-700 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Yield Forecast</span>
              </span>
              <div className="mt-0.5">
                <span className="text-xs font-black font-mono text-emerald-800">
                  {currentPlot.yieldEstimation}
                </span>
              </div>
              <span className="text-[9px] text-slate-600 font-medium">
                ~{Math.round(currentPlot.areaAcres * currentPlot.yieldMunsPerAcre).toLocaleString()} Muns Total
              </span>
            </div>

            {/* Canopy Cover */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                <Trees className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Canopy Density</span>
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-bold font-mono text-emerald-700">
                  {currentPlot.canopyCoverPct}%
                </span>
                <span className="text-[10px] text-slate-500">shade</span>
              </div>
              <span className="text-[9px] text-slate-500">Sentinel-2 Cover</span>
            </div>
          </div>

          {/* AI Tactical Recommendation Card */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-1 gap-1">
              <span className="text-[11px] font-bold text-slate-700 shrink-0">
                AI Recommendation
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 truncate max-w-[135px] shrink-0">
                {FARMER_ACTIONS[decision.selected_decision]?.farmerBadge || 'Night Pre-Charge'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {decision.action_plan.execution_window}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug line-clamp-2">
              {decision.action_plan.biological_rationale}
            </p>
          </div>
        </div>

        {/* Tactical Footer Action Buttons */}
        <div className="p-2 border-t border-slate-200/80 bg-slate-50/70 flex gap-2 shrink-0">
          <button
            onClick={() => setTab('irrigation')}
            className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>Run Irrigation Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openEditModal}
            className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Edit Plot Size & Area"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
            <span>Edit Area</span>
          </button>
        </div>
      </div>

      {/* 4. Interactive Field Area & Boundary Editor Dialog */}
      {isEditModalOpen && (
        <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Field Area & Boundaries</h3>
                  <p className="text-xs text-slate-500">Update acreage and agronomic parameters</p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Parcel Name */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Parcel Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Geographic Coordinates & Location Selection */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
                    Plot Location & GIS Coordinates
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Real Rural Farmland</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-600">Latitude (°N)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={editLat}
                      onChange={(e) => setEditLat(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-600">Longitude (°E)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={editLng}
                      onChange={(e) => setEditLng(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Move className="w-3 h-3 text-emerald-600" />
                    <span>Or drag the active map pin directly to any field</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (mapRef.current) {
                        const center = mapRef.current.getCenter();
                        setEditLat(Number(center.lat.toFixed(6)));
                        setEditLng(Number(center.lng.toFixed(6)));
                      }
                    }}
                    className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                  >
                    Use Map Center
                  </button>
                </div>
              </div>

              {/* Area (Acres & Muns) with Slider and Quick Buttons */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">Total Cultivated Area (ایکڑ رقبہ)</span>
                    <p className="text-[10px] text-slate-500">1 Acre = 8 Kanals · 1 Ha = 2.471 Acres</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min="1"
                      max="500"
                      step="0.5"
                      value={Math.round(editAreaAcres * 10) / 10}
                      onChange={(e) => {
                        const val = Math.max(1, parseFloat(e.target.value) || 1);
                        handleAreaSliderChange(val);
                      }}
                      className="w-18 px-1.5 py-0.5 rounded border border-slate-300 font-mono font-bold text-emerald-800 text-xs bg-white text-right"
                    />
                    <span className="font-bold text-slate-800 text-xs">Acres</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      ({(editAreaAcres / 2.471).toFixed(1)} Ha)
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="5"
                  max="250"
                  step="1"
                  value={editAreaAcres}
                  onChange={(e) => handleAreaSliderChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />

                {/* Real-time Crop Yield Forecast in Maunds (من / 40kg) */}
                <div className="p-2 rounded-lg bg-emerald-50/90 border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-emerald-900 font-semibold text-[11px] flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Projected Harvest (40kg من):</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-black text-emerald-800 text-xs">
                      {Math.round(editAreaAcres * currentPlot.yieldMunsPerAcre).toLocaleString()}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 ml-1">Maunds</span>
                    <span className="text-[10px] text-slate-500 block">
                      (@ {currentPlot.yieldMunsPerAcre} Muns/Acre)
                    </span>
                  </div>
                </div>

                {/* Quick Area Boundary Scale Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <span className="text-[11px] text-slate-500 font-medium">Map Polygon Boundary:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        scalePlotPolygon(currentPlot.id, 0.9);
                        setEditAreaAcres((prev) => Math.max(1, Math.round(prev * 0.81 * 10) / 10));
                      }}
                      className="px-2 py-0.8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Minimize2 className="w-3 h-3 text-slate-500" />
                      <span>−10% Boundary</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        scalePlotPolygon(currentPlot.id, 1.1);
                        setEditAreaAcres((prev) => Math.round(prev * 1.21 * 10) / 10);
                      }}
                      className="px-2 py-0.8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Maximize2 className="w-3 h-3 text-slate-500" />
                      <span>+10% Boundary</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Crop & Growth Stage */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Crop</label>
                  <select
                    value={editCrop}
                    onChange={(e) => setEditCrop(e.target.value as CropType)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                  >
                    {CROPS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Growth Stage</label>
                  <select
                    value={editStage}
                    onChange={(e) => setEditStage(e.target.value as GrowthStage)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Soil Type */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Soil Texture</label>
                <select
                  value={editSoil}
                  onChange={(e) => setEditSoil(e.target.value as SoilTexture)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                >
                  {SOILS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={closeEditModal}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlotEdits}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Recalculate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
