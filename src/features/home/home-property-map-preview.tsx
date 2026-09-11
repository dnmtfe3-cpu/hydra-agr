"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Beef as Cow, ChevronRight, Droplets, MapPinned } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { loadPropertyMapData, type AnimalSighting, type PropertyMapFeature } from "../../services/property-map-service";
import "./home-property-map-preview.css";

type Props = {
  account: HydraAccount;
  onOpen: () => void;
};

function pointToLatLng(point: [number, number]): L.LatLngTuple {
  return [point[1], point[0]];
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

function pointColor(type: PropertyMapFeature["featureType"]) {
  if (type === "water") return "#2f8ecf";
  if (type === "corral") return "#8b6847";
  if (type === "gate") return "#e7792b";
  return "#5f786c";
}

export function HomePropertyMapPreview({ account, onOpen }: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [features, setFeatures] = useState<PropertyMapFeature[]>([]);
  const [sightings, setSightings] = useState<AnimalSighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapBaseFailed, setMapBaseFailed] = useState(false);

  const ownerUserId = account.access.ownerUserId;
  const propertyId = account.property.id ?? `property-${ownerUserId}`;

  const latestSightings = useMemo(() => {
    const seen = new Set<string>();
    return sightings.filter((item) => {
      if (seen.has(item.animalId)) return false;
      seen.add(item.animalId);
      return true;
    }).slice(0, 8);
  }, [sightings]);

  const sectorCount = features.filter((feature) => feature.featureType === "sector").length;
  const waterCount = features.filter((feature) => feature.featureType === "water").length;
  const boundaryReady = features.some((feature) => feature.featureType === "boundary");
  const latestSighting = latestSightings[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadPropertyMapData(ownerUserId, propertyId)
      .then((data) => {
        if (!active) return;
        setFeatures(data.features);
        setSightings(data.sightings);
      })
      .catch(() => {
        if (!active) return;
        setFeatures([]);
        setSightings([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [ownerUserId, propertyId]);

  useEffect(() => {
    const node = mapNode.current;
    if (!node || mapRef.current) return;

    const map = L.map(node, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      preferCanvas: true,
    }).setView([-14.235, -51.925], 4);

    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
    });
    tiles.on("tileerror", () => setMapBaseFailed(true));
    tiles.addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const invalidate = () => map.invalidateSize({ pan: false });
    const first = window.setTimeout(invalidate, 80);
    const second = window.setTimeout(invalidate, 350);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : undefined;
    observer?.observe(node);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layerRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    for (const feature of features) {
      if (feature.geometry.type === "Polygon") {
        const points = feature.geometry.coordinates[0].map(pointToLatLng);
        if (points.length < 3) continue;
        bounds.push(...points);
        const boundary = feature.featureType === "boundary";
        L.polygon(points, {
          color: boundary ? "#174c36" : "#e7792b",
          weight: boundary ? 3.5 : 2,
          fillColor: boundary ? "#174c36" : "#e7792b",
          fillOpacity: boundary ? 0.09 : 0.18,
          dashArray: boundary ? undefined : "7 5",
          interactive: false,
        }).addTo(layers);
      } else {
        const point = pointToLatLng(feature.geometry.coordinates);
        bounds.push(point);
        L.circleMarker(point, {
          radius: 6.5,
          color: "#ffffff",
          weight: 2,
          fillColor: pointColor(feature.featureType),
          fillOpacity: 1,
          interactive: false,
        }).addTo(layers);
      }
    }

    latestSightings.forEach((sighting, index) => {
      const point: L.LatLngTuple = [sighting.latitude, sighting.longitude];
      bounds.push(point);
      L.circleMarker(point, {
        radius: index === 0 ? 10 : 8,
        color: "#174c36",
        weight: 1,
        fillColor: "#dff0e7",
        fillOpacity: 0.5,
        interactive: false,
      }).addTo(layers);
      L.circleMarker(point, {
        radius: index === 0 ? 5.5 : 4.5,
        color: "#ffffff",
        weight: 2,
        fillColor: "#174c36",
        fillOpacity: 1,
        interactive: false,
      }).addTo(layers);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20], maxZoom: 16, animate: false });
    } else {
      map.setView([-14.235, -51.925], 4, { animate: false });
    }

    window.setTimeout(() => map.invalidateSize({ pan: false }), 60);
  }, [features, latestSightings]);

  const empty = !loading && features.length === 0 && latestSightings.length === 0;
  const displayedSectorCount = sectorCount || account.sectors.length;

  return <section className="home-property-map-card" aria-label="Mapa da propriedade">
    <button type="button" className="home-property-map-hitarea" onClick={onOpen} aria-label="Abrir mapa da propriedade">
      <div className="home-property-map-stage">
        <div ref={mapNode} className="home-property-map-canvas" aria-hidden="true" />
        <div className="home-property-map-shade" />

        <div className="home-property-map-title">
          <span className="home-property-map-title-icon"><MapPinned size={18} /></span>
          <div className="home-property-map-title-copy">
            <small>MAPA DA PROPRIEDADE</small>
            <strong>{account.property.name || "Minha propriedade"}</strong>
          </div>
        </div>

        {!loading && !empty && <div className="home-property-map-badges" aria-hidden="true">
          <span><i className="sector" /><strong>{displayedSectorCount}</strong> setores</span>
          <span><Droplets size={13} /><strong>{waterCount}</strong> água</span>
          <span><Cow size={13} /><strong>{latestSightings.length}</strong> vistos</span>
        </div>}

        {empty && <div className="home-property-map-empty"><MapPinned size={15} /> Toque para desenhar sua propriedade</div>}
        {loading && <div className="home-property-map-loading"><span /> Carregando mapa</div>}
        {mapBaseFailed && !loading && <div className="home-property-map-offline">Mapa-base indisponível</div>}
      </div>

      <div className="home-property-map-footer">
        <div className="home-property-map-footer-copy">
          <strong>{empty ? "Configure o mapa da fazenda" : boundaryReady ? "Sua propriedade em um toque" : "Complete os limites da propriedade"}</strong>
          <small>{latestSighting ? `Último animal visto ${relativeTime(latestSighting.seenAt)}` : empty ? "Limites, setores, água e pontos importantes" : "Setores, água e pontos importantes reunidos"}</small>
        </div>
        <span className="home-property-map-open" aria-hidden="true"><ChevronRight size={20} /></span>
      </div>
    </button>
  </section>;
}
