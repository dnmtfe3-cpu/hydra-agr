"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
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
import { showAppToast } from "../../components/modal-system";
import { ScreenHeader } from "../../components/ui";
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
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function pointToLatLng(point: MapPoint): L.LatLngTuple {
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
  const mapRef = useRef<L.Map | null>(null);
  const featureLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const locationLayerRef = useRef<L.LayerGroup | null>(null);
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
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados do mapa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [ownerUserId, propertyId]);

  useEffect(() => {
    const node = mapNode.current;
    if (!node || mapRef.current) return;

    let active = true;
    const timers: number[] = [];
    let resizeObserver: ResizeObserver | undefined;

    try {
      const map = L.map(node, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      }).setView([-14.235, -51.925], 4);

      const featuresLayer = L.layerGroup().addTo(map);
      const draftLayer = L.layerGroup().addTo(map);
      const locationLayer = L.layerGroup().addTo(map);
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
        crossOrigin: true,
      });

      tiles.on("tileerror", () => {
        if (active) setError("O mapa-base não carregou direito. Verifique a internet e tente novamente.");
      });
      tiles.addTo(map);

      mapRef.current = map;
      featureLayerRef.current = featuresLayer;
      draftLayerRef.current = draftLayer;
      locationLayerRef.current = locationLayer;
      setMapReady(true);

      const invalidate = () => {
        if (!active) return;
        map.invalidateSize({ pan: false });
      };
      timers.push(window.setTimeout(invalidate, 80));
      timers.push(window.setTimeout(invalidate, 350));
      timers.push(window.setTimeout(invalidate, 900));

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(invalidate);
        resizeObserver.observe(node);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir o mapa.");
    }

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      featureLayerRef.current = null;
      draftLayerRef.current = null;
      locationLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !drawMode) return;
    const handleClick = (event: L.LeafletMouseEvent) => {
      const next: MapPoint = [event.latlng.lng, event.latlng.lat];
      setDraftPoints((current) => pointTypes.has(drawMode) ? [next] : [...current, next]);
    };
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [drawMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = featureLayerRef.current;
    const draft = draftLayerRef.current;
    if (!mapReady || !map || !layers || !draft) return;

    layers.clearLayers();
    draft.clearLayers();

    for (const feature of features) {
      if (feature.geometry.type === "Polygon") {
        const points = polygonPoints(feature);
        if (points.length < 3) continue;
        const isBoundary = feature.featureType === "boundary";
        L.polygon(points, {
          color: isBoundary ? "#174c36" : "#e7792b",
          weight: isBoundary ? 4 : 2,
          fillColor: isBoundary ? "#174c36" : "#e7792b",
          fillOpacity: isBoundary ? 0.08 : 0.16,
          dashArray: isBoundary ? undefined : "7 5",
        }).bindTooltip(feature.name || featureLabels[feature.featureType], { sticky: true }).addTo(layers);
      } else {
        const point = pointToLatLng(feature.geometry.coordinates);
        L.circleMarker(point, {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: feature.featureType === "water" ? "#1d8dd8" : "#e7792b",
          fillOpacity: 1,
        }).bindTooltip(feature.name || featureLabels[feature.featureType], { direction: "top" }).addTo(layers);
      }
    }

    for (const sighting of latestSightings) {
      const animal = account.animals.find((item) => item.id === sighting.animalId);
      L.circleMarker([sighting.latitude, sighting.longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#f1a23b",
        fillOpacity: 1,
      }).bindTooltip(`${animal?.name || animal?.identification || "Animal"} · ${relativeTime(sighting.seenAt)}`, { direction: "top" }).addTo(layers);
    }

    if (draftPoints.length > 0) {
      const points = draftPoints.map(pointToLatLng);
      if (pointTypes.has(drawMode ?? "other")) {
        L.circleMarker(points[0], { radius: 9, color: "#174c36", weight: 3, fillColor: "#e7792b", fillOpacity: 1 }).addTo(draft);
      } else {
        L.polyline(points, { color: "#e7792b", weight: 4, dashArray: "8 6" }).addTo(draft);
        points.forEach((point) => L.circleMarker(point, { radius: 5, color: "#174c36", weight: 2, fillColor: "#ffffff", fillOpacity: 1 }).addTo(draft));
      }
    }

    if (!initialFitDone.current) {
      const boundary = features.find((item) => item.featureType === "boundary" && item.geometry.type === "Polygon");
      if (boundary) {
        const points = polygonPoints(boundary);
        if (points.length > 2) map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
        initialFitDone.current = true;
      } else if (latestSightings[0]) {
        map.setView([latestSightings[0].latitude, latestSightings[0].longitude], 15);
        initialFitDone.current = true;
      }
    }
  }, [account.animals, draftPoints, drawMode, features, latestSightings, mapReady]);

  function beginDrawing(type: PropertyMapFeatureType) {
    if (!mapReady) {
      setError("O mapa ainda está abrindo. Tente novamente em um instante.");
      return;
    }
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
      initialFitDone.current = false;
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
    if (!mapReady) { setError("O mapa ainda está abrindo."); return; }
    if (!navigator.geolocation) { setError("Este aparelho não oferece localização pelo navegador."); return; }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      const point: L.LatLngTuple = [position.coords.latitude, position.coords.longitude];
      const locationLayer = locationLayerRef.current;
      if (locationLayer) {
        locationLayer.clearLayers();
        L.circleMarker(point, { radius: 9, color: "#ffffff", weight: 3, fillColor: "#174c36", fillOpacity: 1 })
          .bindTooltip("Sua localização", { direction: "top" })
          .addTo(locationLayer);
        if (Number.isFinite(position.coords.accuracy) && position.coords.accuracy > 0) {
          L.circle(point, { radius: Math.min(position.coords.accuracy, 500), color: "#174c36", weight: 1, fillColor: "#174c36", fillOpacity: 0.08 }).addTo(locationLayer);
        }
      }
      mapRef.current?.flyTo(point, 17, { duration: 0.7 });
    }, (geoError) => {
      setLocating(false);
      if (geoError.code === geoError.PERMISSION_DENIED) setError("A localização está bloqueada. Libere a permissão de localização para o Hydra Agro e tente novamente.");
      else if (geoError.code === geoError.TIMEOUT) setError("O GPS demorou para responder. Tente novamente em um local com melhor sinal.");
      else setError("Não foi possível acessar sua localização agora.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
  }

  function centerOnSighting(sighting: AnimalSighting) {
    mapRef.current?.flyTo([sighting.latitude, sighting.longitude], 17, { duration: 0.7 });
  }

  return <div className="screen page-enter extra-screen property-map-screen">
    <ScreenHeader eyebrow="PROPRIEDADE" title="Mapa da propriedade" subtitle="Desenhe áreas e veja onde seus animais foram vistos por último." onBack={onBack} />

    <section className="property-map-hero">
      <div><span><MapPinned size={21} /></span><div><strong>{account.property.name || "Sua propriedade"}</strong><small>Mapa rural com OpenStreetMap</small></div></div>
      <button className="property-map-location" onClick={useMyLocation} disabled={locating || !mapReady}><LocateFixed size={18} /> {locating ? "Localizando…" : "Minha localização"}</button>
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
        {(loading || !mapReady) && <div className="property-map-loading">{!mapReady ? "Abrindo mapa…" : "Carregando dados da propriedade…"}</div>}
      </div>
      <p className="property-map-map-note">Aproxime o mapa para marcar os pontos com mais precisão. Use “Minha localização” para ir direto à sua posição atual.</p>
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
