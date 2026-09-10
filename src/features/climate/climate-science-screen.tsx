import { useCallback, useEffect, useState } from "react";
import { BookOpen, CloudRain, Droplets, ExternalLink, Gauge, Info, LoaderCircle, RefreshCw, ThermometerSun, TriangleAlert, Wind } from "lucide-react";
import { Modal, ScreenHeader } from "../../components/ui";
import type { HydraAccount } from "../../lib/hydra-types";
import { animalComfort, climateAlerts, easyClimateSummary, waterSituation, windCardinal } from "../../services/climate-science";
import { describeWeather, loadWeather, type WeatherSnapshot } from "../../services/weather-service";
import { AudioHelp, useEasyMode } from "../easy-mode/easy-mode";
import "./climate-science.css";

type Props = { account: HydraAccount; onBack: () => void; navigate: (route: "property" | "water") => void };
const sourceLinks = [
  ["Open-Meteo", "Previsão e condições meteorológicas modeladas", "https://open-meteo.com/en/docs"],
  ["INMET", "Referência meteorológica oficial brasileira", "https://portal.inmet.gov.br/"],
  ["Embrapa", "Referências técnicas para produção e manejo rural", "https://www.embrapa.br/busca-de-publicacoes"],
  ["NRC (1971)", "Referência metodológica do índice de temperatura e umidade", "https://books.google.com/books?id=gzsrAAAAYAAJ"],
  ["IBGE", "Dados territoriais, demográficos e de comunidades tradicionais", "https://www.ibge.gov.br/"],
] as const;

function statusClass(status: string) { return status === "Normal" || status === "Boa" ? "good" : status === "Atenção" ? "attention" : status === "Sem dados" ? "neutral" : "risk"; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit" }).format(new Date(`${value}T12:00:00`)); }

export function ClimateScienceScreen({ account, onBack, navigate }: Props) {
  const { enabled: easy } = useEasyMode();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"comfort" | "water" | "sources" | null>(null);
  const hasLocation = Boolean(account.property.municipality && account.property.state);
  const refresh = useCallback(async (force = false) => {
    if (!hasLocation) { setLoading(false); return; }
    setLoading(true); setError("");
    try { setWeather(await loadWeather(account.property.municipality, account.property.state, { force })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar o clima."); }
    finally { setLoading(false); }
  }, [account.property.municipality, account.property.state, hasLocation]);
  useEffect(() => { void refresh(); }, [refresh]);

  const comfort = weather ? animalComfort(account, weather) : null;
  const water = weather ? waterSituation(account, weather) : null;
  const alerts = weather ? climateAlerts(account, weather) : [];
  const condition = weather ? describeWeather(weather.weatherCode, weather.isDay) : null;
  const updated = weather ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(weather.fetchedAt)) : "";
  const spoken = weather && comfort ? easyClimateSummary(weather, comfort) : "";

  return <div className="screen page-enter extra-screen climate-science-screen">
    <ScreenHeader eyebrow="INFORMAÇÃO RURAL" title="Clima & Ciência" subtitle="Dados da região traduzidos para apoiar decisões." onBack={onBack} action={<button className="icon-button accent" onClick={() => void refresh(true)} disabled={loading} aria-label="Atualizar clima">{loading ? <LoaderCircle size={19} className="spin" /> : <RefreshCw size={19} />}</button>} />
    {!hasLocation ? <section className="science-empty"><CloudRain size={34} /><h2>Localização necessária</h2><p>Usamos a localização cadastrada da propriedade para buscar informações meteorológicas da região. Não fazemos rastreamento contínuo.</p><button className="primary-button" onClick={() => navigate("property")}>Completar propriedade</button></section>
    : loading && !weather ? <section className="science-empty" role="status"><LoaderCircle size={32} className="spin" /><h2>Buscando o clima…</h2><p>{account.property.municipality}, {account.property.state}</p></section>
    : error && !weather ? <section className="science-empty" role="alert"><CloudRain size={34} /><h2>Clima indisponível</h2><p>{error}</p><button className="primary-button" onClick={() => void refresh(true)}>Tentar novamente</button></section>
    : weather && comfort && water && condition ? <>
      {easy && <section className="easy-climate-message"><div><strong>{spoken}</strong><small>Toque no áudio para ouvir.</small></div><AudioHelp text={`${spoken} Dados meteorológicos para ${account.property.municipality}.`} /></section>}
      <section className="science-current"><div><span className="science-source-tag current">DADO ATUAL DO MODELO</span><strong>{Math.round(weather.temperature)} °C</strong><p>{condition.label} · sensação de {Math.round(weather.apparentTemperature)} °C</p></div><small>{weather.stale ? "Último dado salvo" : `Atualizado em ${updated}`}</small></section>
      {!easy && <div className="science-metrics">
        <article><Droplets size={20} /><span>Umidade</span><strong>{Math.round(weather.humidity)}%</strong></article>
        <article><CloudRain size={20} /><span>Chuva agora</span><strong>{weather.precipitation.toFixed(1)} mm</strong></article>
        <article><CloudRain size={20} /><span>Chance hoje</span><strong>{Math.round(weather.rainChance)}%</strong></article>
        <article><Wind size={20} /><span>Vento</span><strong>{Math.round(weather.windSpeed)} km/h · {windCardinal(weather.windDirection)}</strong></article>
      </div>}
      <div className="science-summary-grid">
        <button className="science-indicator" onClick={() => setMethod("comfort")}><span><ThermometerSun size={22} /> CONFORTO DOS ANIMAIS</span><strong className={statusClass(comfort.status)}>{comfort.status}</strong><small>{comfort.detail}</small><em><Info size={15} /> Como calculamos?</em></button>
        <button className="science-indicator" onClick={() => setMethod("water")}><span><Droplets size={22} /> SITUAÇÃO DA ÁGUA</span><strong className={statusClass(water.status)}>{water.status}</strong><small>{water.detail}</small><em><Info size={15} /> Como calculamos?</em></button>
      </div>
      {alerts.length > 0 && <section className="science-section"><header><TriangleAlert size={21} /><div><span>ALERTAS</span><strong>O que merece atenção</strong></div></header><div className="science-alerts">{alerts.map(alert => <article key={alert.title}><span className="science-source-tag">{alert.source}</span><strong>{alert.title}</strong><p>{alert.detail}</p></article>)}</div></section>}
      <section className="science-section"><header><CloudRain size={21} /><div><span>PREVISÃO</span><strong>Próximos dias</strong></div></header><div className="science-forecast">{weather.forecast.map(day => <article key={day.date}><strong>{dateLabel(day.date)}</strong><span>{Math.round(day.minimum)}° / {Math.round(day.maximum)}°</span><small>{Math.round(day.rainChance)}% · {day.precipitation.toFixed(1)} mm</small></article>)}</div></section>
      <button className="science-basis-link" onClick={() => setMethod("sources")}><BookOpen size={22} /><div><strong>Base científica</strong><small>Fontes dos dados e referências</small></div><ExternalLink size={17} /></button>
      <p className="science-disclaimer">Os dados meteorológicos representam a região e vêm de modelos. Os indicadores do Hydra são estimativas de apoio, não medições dentro da propriedade nem diagnóstico veterinário.</p>
    </> : null}

    <Modal open={method !== null} onClose={() => setMethod(null)} eyebrow="TRANSPARÊNCIA" title={method === "comfort" ? "Como calculamos o conforto" : method === "water" ? "Como calculamos a água" : "Base científica"} wide>
      {method === "comfort" && weather && comfort && <div className="science-method"><Gauge size={28} /><p>Usamos a temperatura atual do modelo ({weather.temperature.toFixed(1)} °C) e a umidade ({Math.round(weather.humidity)}%) no Índice de Temperatura e Umidade para bovinos.</p><strong>{comfort.value === null ? "Sem cálculo" : `THI ${comfort.value.toFixed(1)} · ${comfort.status}`}</strong><p>Fórmula: (1,8 × T + 32) − (0,55 − 0,0055 × UR) × (1,8 × T − 26). Referência metodológica: NRC (1971), índice usado em estudos de conforto térmico animal. Os limites são indicativos e não substituem avaliação veterinária.</p></div>}
      {method === "water" && weather && water && <div className="science-method"><Droplets size={28} /><p>Somamos a chuva prevista e subtraímos a evapotranspiração de referência (ET₀) prevista para 7 dias.</p><strong>{water.balance === null ? "Não há dados suficientes" : `${weather.forecastPrecipitation.toFixed(1)} mm de chuva − ${weather.forecastEt0.toFixed(1)} mm de ET₀ = ${water.balance.toFixed(1)} mm`}</strong><p>É uma tendência regional. O cálculo só aparece quando existem fontes e registros de água no Hydra Agro. Vazão, armazenamento e condição do solo ainda precisam ser conferidos na propriedade.</p></div>}
      {method === "sources" && <div className="science-sources">{sourceLinks.map(([name, detail, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{detail}</span><ExternalLink size={16} /></a>)}</div>}
    </Modal>
  </div>;
}
