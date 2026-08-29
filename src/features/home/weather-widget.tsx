import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  LoaderCircle,
  MapPin,
  Moon,
  RefreshCw,
  Snowflake,
  Sun,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { Modal } from "../../components/ui";
import { describeWeather, loadWeather, type WeatherIconName, type WeatherSnapshot } from "../../services/weather-service";

type WeatherState = "idle" | "loading" | "ready" | "error";

function WeatherIcon({ name, isDay, size = 25 }: { name: WeatherIconName; isDay: boolean; size?: number }) {
  const props = { size, "aria-hidden": true };
  if (name === "clear") return isDay ? <Sun {...props} /> : <Moon {...props} />;
  if (name === "partly-cloudy") return <CloudSun {...props} />;
  if (name === "cloudy") return <Cloud {...props} />;
  if (name === "fog") return <CloudFog {...props} />;
  if (name === "rain") return <CloudRain {...props} />;
  if (name === "storm") return <CloudLightning {...props} />;
  return <Snowflake {...props} />;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="weather-metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function timeLabel(value?: string) {
  if (!value) return "—";
  return value.match(/T(\d{2}:\d{2})/)?.[1] ?? "—";
}

export function WeatherWidget({ municipality, state, onCompleteProperty }: { municipality: string; state: string; onCompleteProperty: () => void }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<WeatherState>("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const hasLocation = Boolean(municipality.trim() && state.trim());
  const locationLabel = hasLocation ? `${municipality}, ${state}` : "Localização necessária";

  const refresh = useCallback(async (force = false) => {
    if (!hasLocation) { setStatus("idle"); setWeather(null); setError(""); return; }
    setStatus("loading"); setError("");
    try {
      const result = await loadWeather(municipality, state, { force });
      setWeather(result); setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível consultar o clima.");
      setStatus("error");
    }
  }, [hasLocation, municipality, state]);

  useEffect(() => {
    let active = true;
    if (!hasLocation) { setStatus("idle"); setWeather(null); return; }
    setStatus("loading"); setError("");
    void loadWeather(municipality, state).then((result) => {
      if (!active) return; setWeather(result); setStatus("ready");
    }).catch((caught) => {
      if (!active) return; setError(caught instanceof Error ? caught.message : "Não foi possível consultar o clima."); setStatus("error");
    });
    return () => { active = false; };
  }, [hasLocation, municipality, state]);

  const condition = weather ? describeWeather(weather.weatherCode, weather.isDay) : null;
  const observed = weather ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(weather.fetchedAt)) : "";

  return <>
    <button className={`climate-chip ${status}`} onClick={() => setOpen(true)} aria-label={weather ? `Clima em ${locationLabel}: ${Math.round(weather.temperature)} graus, ${condition?.label}` : "Consultar clima da região"}>
      {status === "loading" ? <LoaderCircle size={25} className="spin" /> : condition ? <WeatherIcon name={condition.icon} isDay={weather?.isDay ?? true} /> : <CloudSun size={25} />}
      <span><strong>{weather ? `${Math.round(weather.temperature)}°` : status === "loading" ? "…" : "—"}</strong>{weather ? condition?.label : hasLocation ? status === "error" ? "Toque para tentar" : "Consultando clima" : "Cadastre a localização"}</span>
    </button>

    <Modal open={open} onClose={() => setOpen(false)} eyebrow="CLIMA DA REGIÃO" title={locationLabel}>
      {!hasLocation ? <div className="weather-empty">
        <span><MapPin size={30} /></span><h3>Cadastre a localização</h3><p>O Hydra Agro usa o município e a UF identificados pelo CEP da propriedade para consultar as condições meteorológicas.</p>
        <button className="primary-button full" onClick={() => { setOpen(false); window.setTimeout(onCompleteProperty, 240); }}>Completar propriedade</button>
      </div> : status === "loading" && !weather ? <div className="weather-loading" role="status"><span className="weather-loader"><CloudSun size={34} /></span><strong>Consultando {locationLabel}…</strong><p>Buscando as condições meteorológicas mais recentes.</p></div>
      : status === "error" && !weather ? <div className="weather-empty error" role="alert"><span><CloudSun size={30} /></span><h3>Clima indisponível agora</h3><p>{error}</p><button className="primary-button full" onClick={() => void refresh(true)}><RefreshCw size={18} /> Tentar novamente</button></div>
      : weather && condition ? <div className="weather-details">
        <section className="weather-current"><div className="weather-current-icon"><WeatherIcon name={condition.icon} isDay={weather.isDay} size={42} /></div><div><span>AGORA</span><strong>{Math.round(weather.temperature)}°C</strong><p>{condition.label}</p></div><small>{weather.stale ? "Último dado salvo" : `Atualizado às ${observed}`}</small></section>
        {weather.stale && <p className="weather-warning">Sem atualização recente. Exibindo o último dado salvo neste aparelho.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="weather-metrics">
          <Metric icon={<ThermometerSun size={20} />} label="Sensação" value={`${Math.round(weather.apparentTemperature)}°C`} />
          <Metric icon={<Droplets size={20} />} label="Umidade" value={`${Math.round(weather.humidity)}%`} />
          <Metric icon={<CloudRain size={20} />} label="Chance de chuva" value={`${Math.round(weather.rainChance)}%`} />
          <Metric icon={<Wind size={20} />} label="Vento" value={`${Math.round(weather.windSpeed)} km/h`} />
        </div>
        <div className="weather-dayline"><div><small>Mínima</small><strong>{Math.round(weather.minimumTemperature)}°</strong></div><div><small>Máxima</small><strong>{Math.round(weather.maximumTemperature)}°</strong></div><div><small>Nascer do sol</small><strong>{timeLabel(weather.sunrise)}</strong></div><div><small>Pôr do sol</small><strong>{timeLabel(weather.sunset)}</strong></div></div>
        <p className="weather-source"><MapPin size={15} /> Estimativa meteorológica para {locationLabel} · dados Open-Meteo.</p>
        <button className="primary-button full" onClick={() => void refresh(true)} disabled={status === "loading"}>{status === "loading" ? <><span className="button-spinner" /> Atualizando…</> : <><RefreshCw size={18} /> Atualizar clima</>}</button>
      </div> : null}
    </Modal>
  </>;
}
