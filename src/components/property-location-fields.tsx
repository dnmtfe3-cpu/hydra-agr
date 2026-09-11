import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CheckCircle2, LoaderCircle, LocateFixed, MapPin, RefreshCw } from "lucide-react";
import type { Property } from "../lib/hydra-types";
import {
  brazilStates,
  cepStateMismatch,
  formatCep,
  isValidCep,
  lookupBrazilianCep,
  type BrazilAddress,
} from "../lib/brazil-location";
import { Field } from "./ui";
import "./property-signup-map.css";

type Props = {
  property: Property;
  onChange: (property: Property) => void;
  onError?: (message: string) => void;
  namePlaceholder?: string;
};

type LookupState = "idle" | "loading" | "ready" | "error";
type MapSelection = { latitude: number; longitude: number };

const BRAZIL_CENTER: L.LatLngTuple = [-14.235, -51.925];

function parseMapSelection(value?: string): MapSelection | null {
  const match = value?.trim().match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function formatMapSelection(latitude: number, longitude: number) {
  return `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function mergeAddress(property: Property, address: BrazilAddress): Property {
  return {
    ...property,
    postalCode: address.postalCode,
    municipality: address.municipality,
    municipalityIbgeCode: address.municipalityIbgeCode,
    stateName: address.stateName,
    region: address.region,
    street: address.street,
    district: address.district,
    addressComplement: address.addressComplement,
    ddd: address.ddd,
  };
}

export function PropertyLocationFields({ property, onChange, onError, namePlaceholder = "Fazenda Boa Vista" }: Props) {
  const [lookupState, setLookupState] = useState<LookupState>(property.municipality ? "ready" : "idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [mapMessage, setMapMessage] = useState("");
  const lastLookup = useRef("");
  const lookupVersion = useRef(0);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const propertyRef = useRef(property);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const signupMode = !property.id;
  const mapSelection = parseMapSelection(property.locationDetails);

  propertyRef.current = property;
  onChangeRef.current = onChange;
  onErrorRef.current = onError;

  function chooseMapPoint(latitude: number, longitude: number) {
    const next = {
      ...propertyRef.current,
      locationDetails: formatMapSelection(latitude, longitude),
    };
    setMapMessage("Localização marcada. Você pode tocar em outro ponto para ajustar.");
    onErrorRef.current?.("");
    onChangeRef.current(next);
  }

  async function lookup(force = false) {
    const cep = property.postalCode;
    if (!isValidCep(cep)) {
      setLookupState("idle");
      setLookupMessage("");
      return;
    }
    if (!property.state) {
      const message = "Selecione a UF antes de consultar o CEP.";
      setLookupState("error");
      setLookupMessage(message);
      onError?.(message);
      return;
    }
    const key = `${cep}|${property.state}`;
    if (!force && lastLookup.current === key && property.municipality) return;
    const version = ++lookupVersion.current;
    setLookupState("loading");
    setLookupMessage("");
    try {
      const address = await lookupBrazilianCep(cep);
      if (version !== lookupVersion.current) return;
      const mismatch = cepStateMismatch(property.state, address);
      if (mismatch) {
        setLookupState("error");
        setLookupMessage(mismatch);
        onChange({ ...property, municipality: "", municipalityIbgeCode: undefined });
        onError?.(mismatch);
        return;
      }
      lastLookup.current = key;
      setLookupState("ready");
      setLookupMessage(`${address.municipality}, ${address.state} identificado pelo CEP.`);
      onError?.("");
      onChange(mergeAddress(property, address));
    } catch (error) {
      if (version !== lookupVersion.current) return;
      const message = error instanceof Error ? error.message : "Não foi possível consultar o CEP agora. Tente novamente.";
      setLookupState("error");
      setLookupMessage(message);
      onError?.(message);
    }
  }

  useEffect(() => {
    if (!isValidCep(property.postalCode)) return;
    const timer = window.setTimeout(() => { void lookup(); }, 320);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.postalCode, property.state]);

  useEffect(() => {
    if (!signupMode || !mapNode.current || mapRef.current) return;
    const selected = parseMapSelection(propertyRef.current.locationDetails);
    const map = L.map(mapNode.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      preferCanvas: true,
    }).setView(selected ? [selected.latitude, selected.longitude] : BRAZIL_CENTER, selected ? 15 : 4);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      chooseMapPoint(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    const invalidate = () => map.invalidateSize({ pan: false });
    const first = window.setTimeout(invalidate, 80);
    const second = window.setTimeout(invalidate, 320);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : undefined;
    observer?.observe(mapNode.current);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // signupMode is stable for the lifetime of this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupMode]);

  useEffect(() => {
    if (!signupMode || !mapRef.current) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!mapSelection) return;
    markerRef.current = L.circleMarker([mapSelection.latitude, mapSelection.longitude], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#0b5136",
      fillOpacity: 1,
    }).addTo(mapRef.current);
  }, [mapSelection?.latitude, mapSelection?.longitude, signupMode]);

  function changeUf(uf: string) {
    lastLookup.current = "";
    setLookupState("idle");
    setLookupMessage("");
    onError?.("");
    onChange({
      ...property,
      state: uf,
      stateName: brazilStates.find((item) => item.uf === uf)?.name,
      municipality: "",
      municipalityIbgeCode: undefined,
    });
  }

  function changeCep(value: string) {
    lastLookup.current = "";
    const formatted = formatCep(value);
    setLookupState("idle");
    setLookupMessage("");
    onError?.("");
    onChange({
      ...property,
      postalCode: formatted,
      municipality: "",
      municipalityIbgeCode: undefined,
      region: undefined,
      street: undefined,
      district: undefined,
      addressComplement: undefined,
      ddd: undefined,
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMapMessage("Este aparelho não oferece localização. Toque diretamente no mapa para marcar a propriedade.");
      return;
    }
    setLocating(true);
    setMapMessage("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        chooseMapPoint(latitude, longitude);
        mapRef.current?.flyTo([latitude, longitude], 16, { animate: true, duration: 0.55 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setMapMessage("Não foi possível usar sua localização. Toque no mapa para marcar a propriedade manualmente.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  return (
    <div className="property-location-fields">
      <Field label="UF">
        <select value={property.state} onChange={(event) => changeUf(event.target.value)} aria-label="UF da propriedade">
          <option value="">Selecione a UF</option>
          {brazilStates.map((state) => <option key={state.uf} value={state.uf}>{state.uf} — {state.name}</option>)}
        </select>
      </Field>

      <Field label="CEP" hint="A cidade será identificada automaticamente.">
        <div className="input-with-action property-cep-input">
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            value={property.postalCode}
            onChange={(event) => changeCep(event.target.value)}
            onBlur={() => void lookup()}
            placeholder="00000-000"
            maxLength={9}
            aria-describedby="property-cep-status"
          />
          {lookupState === "loading" && <span className="property-cep-indicator" aria-label="Consultando CEP"><LoaderCircle size={18} className="spin" /></span>}
          {lookupState === "error" && isValidCep(property.postalCode) && <button type="button" onClick={() => void lookup(true)} aria-label="Tentar consultar CEP novamente"><RefreshCw size={18} /></button>}
          {lookupState === "ready" && <span className="property-cep-indicator is-ready" aria-label="CEP localizado"><CheckCircle2 size={18} /></span>}
        </div>
      </Field>

      {lookupMessage && <p id="property-cep-status" className={lookupState === "error" ? "form-error property-location-message" : "form-notice property-location-message"} role={lookupState === "error" ? "alert" : "status"}>{lookupMessage}</p>}

      <Field label="Nome da propriedade">
        <input
          value={property.name}
          onChange={(event) => { onError?.(""); onChange({ ...property, name: event.target.value }); }}
          placeholder={namePlaceholder}
          autoComplete="organization"
        />
      </Field>

      {signupMode && <>
        <Field label="Tamanho da propriedade" hint="Informe a área aproximada em hectares.">
          <div className="property-signup-area">
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={property.area}
              onChange={(event) => {
                onError?.("");
                onChange({ ...property, area: event.target.value, areaUnit: "hectares" });
              }}
              onInvalid={() => onError?.("Informe o tamanho da propriedade em hectares, maior que zero.")}
              placeholder="Ex.: 25"
              aria-label="Tamanho da propriedade em hectares"
            />
            <span>ha</span>
          </div>
        </Field>

        <section className="property-signup-map" aria-label="Localização da propriedade no mapa">
          <div className="property-signup-map-heading">
            <span className="property-signup-map-icon"><MapPin size={18} /></span>
            <div><strong>Marque a propriedade no mapa</strong><small>Toque no ponto onde ela fica. Você poderá desenhar os limites completos depois.</small></div>
          </div>
          <div ref={mapNode} className="property-signup-map-canvas" />
          <div className="property-signup-map-actions">
            <button type="button" className="property-signup-locate" onClick={useCurrentLocation} disabled={locating}>
              {locating ? <LoaderCircle size={17} className="spin" /> : <LocateFixed size={17} />}
              {locating ? "Localizando…" : "Usar minha localização"}
            </button>
            <span className={mapSelection ? "is-selected" : ""}>{mapSelection ? <><CheckCircle2 size={15} /> Local marcado</> : "Toque no mapa para marcar"}</span>
          </div>
          {mapMessage && <p className="property-signup-map-message" role="status">{mapMessage}</p>}
          <input
            className="property-signup-map-required"
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            required
            value={mapSelection ? "local-marcado" : ""}
            onChange={() => undefined}
            onInvalid={(event) => {
              event.preventDefault();
              onError?.("Marque no mapa onde fica sua propriedade antes de continuar.");
              mapNode.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        </section>
      </>}
    </div>
  );
}