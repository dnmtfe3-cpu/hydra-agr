"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Beef as Cow,
  Crosshair,
  Droplets,
  Fence,
  LocateFixed,
  MapPinned,
  Pentagon,
  RotateCcw,
  Save,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { ScreenHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { HydraAccount } from "../../lib/hydra-types";
import {
  deletePropertyMapFeature,
  loadPropertyMapData,
  savePropertyMapFeature,
  type AnimalSighting,
  type MapPoint,
  type PropertyMapFeature,
  type PropertyMapFeatureType,
} from "../../services/property-map-service";
import "./property-map.css";

type LatLng = [number, number];
type LeafletEvent = { latlng: { lat: number; lng: number } };
type LeafletLayer = { addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletLayer; bindTooltip?: (text: string, options?: Record<string, unknown>) => LeafletLayer; getBounds?: () => unknown };
type LeafletLayerGroup = LeafletLayer & { clearLayers: () => void; addLayer: (layer: LeafletLayer) => void };
type LeafletMap = {
  setView: (center: LatLng, zoom: number) => LeafletMap;
  flyTo: (center: LatLng, zoom?: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => LeafletMap;
  on: (event: "click", handler: (event: LeafletEvent) => void) => void;
  off: (event: "click", handler: (event: LeafletEvent) => void) => void;
  invalidateSize: () => void;
  remove: () => void;
};
type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
  layerGroup: () => LeafletLayerGroup;
  polygon: (points: LatLng[], options?: Record<string, unknown>) => LeafletLayer;
  polyline: (points: LatLng[], options?: Record<string, unknown>) => LeafletLayer;
  circleMarker: (point: LatLng, options?: Record<string, unknown>) => LeafletLayer;
  latLngBounds: (points: LatLng[]) => unknown;
};

declare global {
  interface Window { L?: LeafletApi }
}

let leafletPromise: Promise<LeafletApi> | null = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    const existingCss = document.querySelector<HTMLLinkElement>('link[data-hydra-leaflet="1"]');
    if (!existingCss) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      css.dataset.hydraLeaflet = "1";
      document.head.appendChild(css);
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-hydra-leaflet="1"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Mapa indisponível.")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Não foi possível carregar o mapa.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.hydraLeaflet = "1";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Mapa indisponível."));
    script.onerror = () => reject(new Error("Não foi possível carregar o mapa."));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

const pointTypes = new Set<PropertyMapFeatureType>(["water", "corral", "gate", "other"]);
const featureLabels: Record<PropertyMapFeatureType, string> = {
  boundary: "Limite da propriedade",
  sector: "Setor / pasto",
  water: "Ponto de água",
  corral: "Curral",
  gate: "Entrada / porteira",
  other: "Outro ponto",
};

function featureId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function pointToLatLng(point: MapPoint): LatLng {
  return [point[1], point[0]];
}

function polygonPoints(feature: PropertyMapFeature) {
  return feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0].map(pointToLatLng) : [];
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "agora";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

export function PropertyMapScreen({ account, onBack }: { account: HydraAccount; onBack: () => void }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const featureLayerRef = useRef<LeafletLayerGroup | null>(null);
  const draftLayerRef = useRef<LeafletLayerGroup | null>(null);
  const initialFitDone = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [features, setFeatures] = useState<PropertyMapFeature[]>([]);
  const [sightings, setSightings] = useState<AnimalSighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawMode, setDrawMode] = useState<PropertyMapFeatureType | null>(null);
  const [draftPoints, setDraftPoints] = useState<MapPoint[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState(account.sectors[0]?.id ?? "");
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const propertyId = account.property.id ?? `property-${account.access.ownerUserId}`;
  const ownerUserId = account.access.ownerUserId;

  const latestSightings = useMemo(() => {
    const seen = new Set<string>();
    return sightings.filter((item) => {
      if (seen.has(item.animalId)) return false;
      seen.add(item.animalId);
      return true;
    }).slice(0, 12);
  }, [sightings]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await loadPropertyMapData(ownerUserId, propertyId);
      setFeatures(data.features);
      setSightings(data.sightings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o mapa da propriedade.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [ownerUserId, propertyId]);

  useEffect(() => {
    let active = true;
    void loadLeaflet().then((L) => {
      if (!active || !mapNode.current || mapRef.current) return;
      const map = L.map(mapNode.current, { zoomControl: true, attributionControl: true }).setView([-14.235, -51.925], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      featureLayerRef.current = L.layerGroup();
      draftLayerRef.current = L.layerGroup();
      featureLayerRef.current.addTo(map);
      draftLayerRef.current.addTo(map);
      mapRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Não foi possível abrir o mapa.");
    });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      featureLayerRef.current = null;
      draftLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !drawMode) return;
    const handleClick = (event: LeafletEvent) => {
      const next: MapPoint = [event.latlng.lng, event.latlng.lat];
      setDraftPoints((current) => pointTypes.has(drawMode) ? [next] : [...current, next]);
    };
    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [drawMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !window.L || !featureLayerRef.current || !draftLayerRef.current || !mapRef.current) return;
    const L = window.L;
    const layers = featureLayerRef.current;
    const draft = draftLayerRef.current;
    layers.clearLayers();
    draft.clearLayers();

    for (const feature of features) {
      if (feature.geometry.type === "Polygon") {
        const points = polygonPoints(feature);
        if (points.length < 3) continue;
        const isBoundary = feature.featureType === "boundary";
        const layer = L.polygon(points, {
          color: isBoundary ? "#174c36" : "#e7792b",
          weight: isBoundary ? 4 : 2,
          fillColor: isBoundary ? "#174c36" : "#e7792b",
          fillOpacity: isBoundary ? 0.08 : 0.16,
          dashArray: isBoundary ? undefined : "7 5",
        });
        layer.bindTooltip?.(feature.name || featureLabels[feature.featureType], { sticky: true });
        layers.addLayer(layer);
      } else {
        const point = pointToLatLng(feature.geometry.coordinates);
        const layer = L.circleMarker(point, {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: feature.featureType === "water" ? "#1d8dd8" : "#e7792b",
          fillOpacity: 1,
        });
        layer.bindTooltip?.(feature.name || featureLabels[feature.featureType], { direction: "top" });
        layers.addLayer(layer);
      }
    }

    for (const sighting of latestSightings) {
      const animal = account.animals.find((item) => item.id === sighting.animalId);
      const layer = L.circleMarker([sighting.latitude, sighting.longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#f1a23b",
        fillOpacity: 1,
      });
      layer.bindTooltip?.(`${animal?.name || animal?.identification || "Animal"} · ${relativeTime(sighting.seenAt)}`, { direction: "top" });
      layers.addLayer(layer);
    }

    if (draftPoints.length > 0) {
      const points = draftPoints.map(pointToLatLng);
      if (pointTypes.has(drawMode ?? "other")) {
        draft.addLayer(L.circleMarker(points[0], { radius: 9, color: "#174c36", weight: 3, fillColor: "#e7792b", fillOpacity: 1 }));
      } else {
        draft.addLayer(L.polyline(points, { color: "#e7792b", weight: 4, dashArray: "8 6" }));
        points.forEach((point) => draft.addLayer(L.circleMarker(point, { radius: 5, color: "#174c36", weight: 2, fillColor: "#ffffff", fillOpacity: 1 })));
      }
    }

    if (!initialFitDone.current) {
      const boundary = features.find((item) => item.featureType === "boundary" && item.geometry.type === "Polygon");
      if (boundary) {
        const points = polygonPoints(boundary);
        if (points.length > 2) mapRef.current.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
        initialFitDone.current = true;
      } else if (latestSightings[0]) {
        mapRef.current.setView([latestSightings[0].latitude, latestSightings[0].longitude], 15);
        initialFitDone.current = true;
      }
    }
  }, [account.animals, draftPoints, drawMode, features, latestSightings, mapReady]);

  function beginDrawing(type: PropertyMapFeatureType) {
    if (type === "sector" && account.sectors.length === 0) {
      setError("Cadastre pelo menos um setor antes de desenhá-lo no mapa.");
      return;
    }
    setError("");
    setDrawMode(type);
    setDraftPoints([]);
    if (type === "boundary") setDraftName(account.property.name || "Limite da propriedade");
    else if (type === "sector") setDraftName(account.sectors.find((item) => item.id === selectedSectorId)?.name || "Setor");
    else if (type === "water") setDraftName(account.waterSources[0]?.name || "Ponto de água");
    else setDraftName(featureLabels[type]);
  }

  function cancelDrawing() {
    setDrawMode(null);
    setDraftPoints([]);
    setDraftName("");
  }

  async function saveDrawing() {
    if (!drawMode) return;
    if (pointTypes.has(drawMode) && draftPoints.length < 1) { setError("Toque no mapa para marcar o ponto."); return; }
    if (!pointTypes.has(drawMode) && draftPoints.length < 3) { setError("Marque pelo menos 3 pontos no mapa."); return; }
    if (drawMode === "sector" && !selectedSectorId) { setError("Selecione o setor que será desenhado."); return; }

    setSaving(true);
    setError("");
    try {
      const isPoint = pointTypes.has(drawMode);
      const closedPolygon = !isPoint ? [...draftPoints, draftPoints[0]] : [];
      const id = drawMode === "boundary"
        ? `map-boundary-${propertyId}`
        : drawMode === "sector"
          ? `map-sector-${selectedSectorId}`
          : featureId(`map-${drawMode}`);
      const selectedSector = account.sectors.find((item) => item.id === selectedSectorId);
      await savePropertyMapFeature({
        id,
        ownerUserId,
        propertyId,
        featureType: drawMode,
        name: drawMode === "sector" ? (selectedSector?.name || draftName || "Setor") : (draftName.trim() || featureLabels[drawMode]),
        sectorId: drawMode === "sector" ? selectedSectorId : undefined,
        geometry: isPoint
          ? { type: "Point", coordinates: draftPoints[0] }
          : { type: "Polygon", coordinates: [closedPolygon] },
      });
      cancelDrawing();
      await refresh();
      showAppToast("Mapa da propriedade atualizado");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar esta marcação.");
    } finally {
      setSaving(false);
    }
  }

  async function removeFeature(feature: PropertyMapFeature) {
    if (!window.confirm(`Remover ${feature.name || featureLabels[feature.featureType]} do mapa?`)) return;
    try {
      await deletePropertyMapFeature(feature.id);
      setFeatures((current) => current.filter((item) => item.id !== feature.id));
      showAppToast("Marcação removida do mapa");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível remover a marcação.");
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setError("Este aparelho não oferece localização pelo navegador."); return; }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      mapRef.current?.flyTo([position.coords.latitude, position.coords.longitude], 17);
    }, () => {
      setLocating(false);
      setError("Não foi possível acessar sua localização. Libere a permissão do GPS para o Hydra Agro.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  function centerOnSighting(sighting: AnimalSighting) {
    mapRef.current?.flyTo([sighting.latitude, sighting.longitude], 17);
  }

  return <div className="screen page-enter extra-screen property-map-screen">
    <ScreenHeader eyebrow="PROPRIEDADE" title="Mapa da propriedade" subtitle="Desenhe áreas e veja onde seus animais foram vistos por último." onBack={onBack} />

    <section className="property-map-hero">
      <div><span><MapPinned size={21} /></span><div><strong>{account.property.name || "Sua propriedade"}</strong><small>Mapa rural com OpenStreetMap</small></div></div>
      <button className="property-map-location" onClick={useMyLocation} disabled={locating}><LocateFixed size={18} /> {locating ? "Localizando…" : "Minha localização"}</button>
    </section>

    <section className="property-map-card property-map-main-card">
      <div className="property-map-toolbar" aria-label="Ferramentas do mapa">
        <button className={drawMode === "boundary" ? "active" : ""} onClick={() => beginDrawing("boundary")}><Pentagon size={18} /><span>Limite</span></button>
        <button className={drawMode === "sector" ? "active" : ""} onClick={() => beginDrawing("sector")}><Fence size={18} /><span>Setor</span></button>
        <button className={drawMode === "water" ? "active" : ""} onClick={() => beginDrawing("water")}><Droplets size={18} /><span>Água</span></button>
        <button className={drawMode === "corral" ? "active" : ""} onClick={() => beginDrawing("corral")}><Warehouse size={18} /><span>Curral</span></button>
        <button className={drawMode === "gate" ? "active" : ""} onClick={() => beginDrawing("gate")}><MapPinned size={18} /><span>Entrada</span></button>
      </div>

      {drawMode && <div className="property-map-draw-panel">
        <div className="property-map-draw-copy"><strong>{featureLabels[drawMode]}</strong><small>{pointTypes.has(drawMode) ? "Toque uma vez no local correto do mapa." : "Toque nos cantos da área até formar o contorno."}</small></div>
        {drawMode === "sector" && <select value={selectedSectorId} onChange={(event) => { setSelectedSectorId(event.target.value); setDraftName(account.sectors.find((item) => item.id === event.target.value)?.name || "Setor"); }}>
          {account.sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
        </select>}
        {pointTypes.has(drawMode) && <input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={60} placeholder="Nome do ponto" />}
        <div className="property-map-draw-actions">
          {!pointTypes.has(drawMode) && <button onClick={() => setDraftPoints((current) => current.slice(0, -1))} disabled={draftPoints.length === 0}><RotateCcw size={17} /> Desfazer</button>}
          <button onClick={cancelDrawing}><X size={17} /> Cancelar</button>
          <button className="save" onClick={() => void saveDrawing()} disabled={saving}><Save size={17} /> {saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>}

      <div className={`property-map-canvas-shell ${drawMode ? "is-drawing" : ""}`}>
        <div ref={mapNode} className="property-map-canvas" aria-label="Mapa interativo da propriedade" />
        {loading && <div className="property-map-loading">Carregando mapa da propriedade…</div>}
      </div>
      <p className="property-map-map-note">Para desenhar com precisão, aproxime o mapa e marque os limites caminhando ou usando a imagem do terreno como referência.</p>
      {error && <p className="form-error property-map-error" role="alert">{error}</p>}
    </section>

    <section className="property-map-card">
      <div className="property-map-section-title"><div><strong>Marcações da propriedade</strong><small>{features.length} no mapa</small></div></div>
      {features.length === 0 ? <div className="property-map-empty"><MapPinned size={25} /><div><strong>Mapa ainda vazio</strong><p>Comece por “Limite” e marque os cantos da propriedade.</p></div></div> : <div className="property-map-feature-list">
        {features.map((feature) => <div className="property-map-feature-row" key={feature.id}>
          <span className={`property-map-feature-icon type-${feature.featureType}`}>{feature.featureType === "water" ? <Droplets size={18} /> : feature.featureType === "sector" ? <Fence size={18} /> : feature.featureType === "corral" ? <Warehouse size={18} /> : <MapPinned size={18} />}</span>
          <div><strong>{feature.name || featureLabels[feature.featureType]}</strong><small>{featureLabels[feature.featureType]}</small></div>
          <button onClick={() => void removeFeature(feature)} aria-label={`Remover ${feature.name}`}><Trash2 size={17} /></button>
        </div>)}
      </div>}
    </section>

    <section className="property-map-card last-section">
      <div className="property-map-section-title"><div><strong>Animais vistos por último</strong><small>Hydra Tag · localização compartilhada com permissão</small></div><Cow size={20} /></div>
      {latestSightings.length === 0 ? <div className="property-map-empty compact"><Crosshair size={23} /><div><strong>Nenhuma localização recebida</strong><p>Quando alguém compartilhar a localização ao ler uma Hydra Tag, o ponto aparecerá aqui.</p></div></div> : <div className="property-map-sighting-list">
        {latestSightings.map((sighting) => {
          const animal = account.animals.find((item) => item.id === sighting.animalId);
          return <button key={sighting.id} onClick={() => centerOnSighting(sighting)}>
            <span><Cow size={18} /></span>
            <div><strong>{animal?.name || animal?.identification || "Animal identificado"}</strong><small>{relativeTime(sighting.seenAt)}{sighting.accuracyM ? ` · precisão ~${Math.round(sighting.accuracyM)} m` : ""}</small></div>
            <Crosshair size={18} />
          </button>;
        })}
      </div>}
    </section>
  </div>;
}
