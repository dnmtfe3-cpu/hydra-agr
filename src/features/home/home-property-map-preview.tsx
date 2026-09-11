"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Beef as Cow, ChevronRight, MapPinned } from "lucide-react";
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

export function HomePropertyMapPreview({ account, onOpen }: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [features, setFeatures] = useState<PropertyMapFeature[]>([]);
  const [sightings, setSightings] = useState<AnimalSighting[]>([]);
  const [loading, setLoading] = useState(true);

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

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

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
          weight: boundary ? 3 : 2,
          fillColor: boundary ? "#174c36" : "#e7792b",
          fillOpacity: boundary ? 0.08 : 0.15,
          dashArray: boundary ? undefined : "6 5",
          interactive: false,
        }).addTo(layers);
      } else {
        const point = pointToLatLng(feature.geometry.coordinates);
        bounds.push(point);
        L.circleMarker(point, {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: feature.featureType === "water" ? "#2f8ecf" : "#e7792b",
          fillOpacity: 1,
          interactive: false,
        }).addTo(layers);
      }
    }

    for (const sighting of latestSightings) {
      const point: L.LatLngTuple = [sighting.latitude, sighting.longitude];
      bounds.push(point);
      L.circleMarker(point, {
        radius: 5,
        color: "#174c36",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1,
        interactive: false,
      }).addTo(layers);
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [18, 18], maxZoom: 16, animate: false });
    } else {
      map.setView([-14.235, -51.925], 4, { animate: false });
    }

    window.setTimeout(() => map.invalidateSize({ pan: false }), 60);
  }, [features, latestSightings]);

  const empty = !loading && features.length === 0 && latestSightings.length === 0;

  return <section className="home-property-map-card" aria-label="Mapa da propriedade">
    <button type="button" className="home-property-map-hitarea" onClick={onOpen} aria-label="Abrir mapa da propriedade">
      <div className="home-property-map-stage">
        <div ref={mapNode} className="home-property-map-canvas" aria-hidden="true" />
        <div className="home-property-map-shade" />
        <div className="home-property-map-title"><span><MapPinned size={18} /></span><div><small>MAPA DA PROPRIEDADE</small><strong>{account.property.name || "Minha propriedade"}</strong></div></div>
        {empty && <div className="home-property-map-empty">Desenhe os limites da propriedade</div>}
        {loading && <div className="home-property-map-loading">Carregando mapa…</div>}
      </div>
      <div className="home-property-map-footer">
        <div className="home-property-map-stats">
          <span><strong>{sectorCount || account.sectors.length}</strong><small>setores</small></span>
          <span><strong>{waterCount}</strong><small>água</small></span>
          <span><Cow size={15} /><strong>{latestSightings.length}</strong><small>vistos</small></span>
        </div>
        <span className="home-property-map-open">Abrir mapa <ChevronRight size={18} /></span>
      </div>
    </button>
  </section>;
}
