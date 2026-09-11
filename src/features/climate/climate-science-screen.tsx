import { useCallback, useEffect, useState } from "react";
import { BookOpen, CloudRain, CloudSun, Droplets, ExternalLink, Gauge, Info, LoaderCircle, RefreshCw, ThermometerSun, TriangleAlert, Wind } from "lucide-react";
import { Modal, ScreenHeader } from "../../components/ui";
import type { HydraAccount } from "../../lib/hydra-types";
import { animalComfort, climateAlerts, easyClimateSummary, waterSituation, windCardinal } from "../../services/climate-science";
import { describeWeather, loadWeather, type WeatherSnapshot } from "../../services/weather-service";
import { AudioHelp, useEasyMode } from "../easy-mode/easy-mode";
import { SCIENCE_VIEW_KEY, type ScienceSummaryView } from "./home-science-summary";
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
function initialView(): ScienceSummaryView {
  try {
    const saved = window.sessionStorage.getItem(SCIENCE_VIEW_KEY);
    window.sessionStorage.removeItem(SCIENCE_VIEW_KEY);
    if (saved === "animals" || saved === "water" || saved === "climate") return saved;
  } catch { /* Use the default view when storage is unavailable. */ }
  return "climate";
}

export function ClimateScienceScreen({ account, onBack, navigate }: Props) {
  const { enabled: easy } = useEasyMode();
  const [view, setView] = useState<ScienceSummaryView>(initialView);
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
  const viewTitle = view === "animals" ? "Animais & Conforto" : view === "water" ? "Água & Chuva" : "Clima & Ciência";
  const viewSubtitle = view === "animals"
    ? "Condições térmicas que podem afetar o rebanho."
    : view === "water"
      ? "Chuva, evapotranspiração e situação hídrica estimada."
      : "Tempo atual, previsão e alertas da região.";

  return <div className="screen page-enter extra-screen climate-science-screen">
    <ScreenHeader eyebrow="INFORMAÇÃO RURAL" title={viewTitle} subtitle={viewSubtitle} onBack={onBack} action={<button className="icon-button accent" onClick={() => void refresh(true)} disabled={loading} aria-label="Atualizar informações">{loading ? <LoaderCircle size={19} className="spin" /> : <RefreshCw size={19} />}</button>} />

    <nav className="science-view-tabs" aria-label="Informações de clima, animais e água">
      <button className={view === "climate" ? "active" : ""} onClick={() => setView("climate")} aria-current={view === "climate" ? "page" : undefined}><CloudSun size={18} /><span>Clima</span></button>
      <button className={view === "animals" ? "active" : ""} onClick={() => setView("animals")} aria-current={view === "animals" ? "page" : undefined}><ThermometerSun size={18} /><span>Animais</span></button>
      <button className={view === "water" ? "active" : ""} onClick={() => setView("water")} aria-current={view === "water" ? "page" : undefined}><Droplets size={18} /><span>Água</span></button>
    </nav>

    {!hasLocation ? <section className="science-empty"><CloudRain size={34} /><h2>Localização necessária</h2><p>Usamos a localização cadastrada da propriedade para buscar informações meteorológicas da região. Não fazemos rastreamento contínuo.</p><button className="primary-button" onClick={() => navigate("property")}>Completar propriedade</button></section>
    : loading && !weather ? <section className="science-empty" role="status"><LoaderCircle size={32} className="spin" /><h2>Buscando informações…</h2><p>{account.property.municipality}, {account.property.state}</p></section>
    : error && !weather ? <section className="science-empty" role="alert"><CloudRain size={34} /><h2>Informações indisponíveis</h2><p>{error}</p><button className="primary-button" onClick={() => void refresh(true)}>Tentar novamente</button></section>
    : weather && comfort && water && condition ? <>
      {easy && <section className="easy-climate-message"><div><strong>{view === "animals" ? comfort.detail : view === "water" ? water.detail : spoken}</strong><small>Toque no áudio para ouvir.</small></div><AudioHelp text={`${view === "animals" ? comfort.detail : view === "water" ? water.detail : spoken} Dados para ${account.property.municipality}.`} /></section>}

      {view === "climate" && <>
        <section className="science-current"><div><span className="science-source-tag current">DADO ATUAL DO MODELO</span><strong>{Math.round(weather.temperature)} °C</strong><p>{condition.label} · sensação de {Math.round(weather.apparentTemperature)} °C</p></div><small>{weather.stale ? "Último dado salvo" : `Atualizado em ${updated}`}</small></section>
        {!easy && <div className="science-metrics">
          <article><Droplets size={20} /><span>Umidade</span><strong>{Math.round(weather.humidity)}%</strong></article>
          <article><CloudRain size={20} /><span>Chuva agora</span><strong>{weather.precipitation.toFixed(1)} mm</strong></article>
          <article><CloudRain size={20} /><span>Chance hoje</span><strong>{Math.round(weather.rainChance)}%</strong></article>
          <article><Wind size={20} /><span>Vento</span><strong>{Math.round(weather.windSpeed)} km/h · {windCardinal(weather.windDirection)}</strong></article>
        </div>}
        {alerts.length > 0 && <section className="science-section"><header><TriangleAlert size={21} /><div><span>ALERTAS</span><strong>O que merece atenção</strong></div></header><div className="science-alerts">{alerts.map(alert => <article key={alert.title}><span className="science-source-tag">{alert.source}</span><strong>{alert.title}</strong><p>{alert.detail}</p></article>)}</div></section>}
        <section className="science-section"><header><CloudRain size={21} /><div><span>PREVISÃO</span><strong>Próximos dias</strong></div></header><div className="science-forecast">{weather.forecast.map(day => <article key={day.date}><strong>{dateLabel(day.date)}</strong><span>{Math.round(day.minimum)}° / {Math.round(day.maximum)}°</span><small>{Math.round(day.rainChance)}% · {day.precipitation.toFixed(1)} mm</small></article>)}</div></section>
        <button className="science-basis-link" onClick={() => setMethod("sources")}><BookOpen size={22} /><div><strong>Base científica</strong><small>Fontes dos dados e referências</small></div><ExternalLink size={17} /></button>
        <p className="science-disclaimer">Os dados meteorológicos representam a região e vêm de modelos. Eles não são uma medição feita dentro da propriedade.</p>
      </>}

      {view === "animals" && <>
        <section className="science-focus-hero animals"><ThermometerSun size={28} /><div><span>CONFORTO TÉRMICO</span><strong className={statusClass(comfort.status)}>{comfort.status}</strong><p>{comfort.detail}</p></div></section>
        <div className="science-metrics science-focus-metrics">
          <article><ThermometerSun size={20} /><span>Temperatura</span><strong>{Math.round(weather.temperature)} °C</strong></article>
          <article><Droplets size={20} /><span>Umidade</span><strong>{Math.round(weather.humidity)}%</strong></article>
          <article><Gauge size={20} /><span>Índice THI</span><strong>{comfort.value === null ? "Sem dado" : comfort.value.toFixed(1)}</strong></article>
          <article><Wind size={20} /><span>Vento</span><strong>{Math.round(weather.windSpeed)} km/h</strong></article>
        </div>
        <section className="science-section science-explanation"><header><Info size={21} /><div><span>ANIMAIS</span><strong>O que este indicador mostra</strong></div></header><p>O Hydra combina temperatura e umidade para estimar o conforto térmico dos bovinos. O resultado serve como sinal de atenção para o manejo e não como diagnóstico veterinário.</p><button className="science-inline-action" onClick={() => setMethod("comfort")}>Ver cálculo e referência <ExternalLink size={16} /></button></section>
        <p className="science-disclaimer">Observe os animais e as condições reais da propriedade. O indicador usa dados meteorológicos regionais.</p>
      </>}

      {view === "water" && <>
        <section className="science-focus-hero water"><Droplets size={28} /><div><span>SITUAÇÃO DA ÁGUA</span><strong className={statusClass(water.status)}>{water.status}</strong><p>{water.detail}</p></div></section>
        <div className="science-metrics science-focus-metrics">
          <article><CloudRain size={20} /><span>Chuva prevista · 7 dias</span><strong>{weather.forecastPrecipitation.toFixed(1)} mm</strong></article>
          <article><CloudSun size={20} /><span>ET₀ prevista · 7 dias</span><strong>{weather.forecastEt0.toFixed(1)} mm</strong></article>
          <article><Gauge size={20} /><span>Balanço estimado</span><strong>{water.balance === null ? "Sem dado" : `${water.balance.toFixed(1)} mm`}</strong></article>
          <article><Droplets size={20} /><span>Registros no Hydra</span><strong>{account.waterRecords.length}</strong></article>
        </div>
        <section className="science-section science-explanation"><header><Info size={21} /><div><span>ÁGUA</span><strong>Como interpretar</strong></div></header><p>Comparamos a chuva prevista com a evapotranspiração de referência. Isso indica uma tendência regional; volume armazenado, vazão e condição das fontes precisam ser conferidos na propriedade.</p><div className="science-water-actions"><button className="science-inline-action" onClick={() => setMethod("water")}>Ver cálculo <ExternalLink size={16} /></button><button className="science-inline-action secondary" onClick={() => navigate("water")}>Abrir registros de água</button></div></section>
        <p className="science-disclaimer">A situação hídrica é uma estimativa de apoio baseada em previsão e nos registros existentes no Hydra Agro.</p>
      </>}
    </> : null}

    <Modal open={method !== null} onClose={() => setMethod(null)} eyebrow="TRANSPARÊNCIA" title={method === "comfort" ? "Como calculamos o conforto" : method === "water" ? "Como calculamos a água" : "Base científica"} wide>
      {method === "comfort" && weather && comfort && <div className="science-method"><Gauge size={28} /><p>Usamos a temperatura atual do modelo ({weather.temperature.toFixed(1)} °C) e a umidade ({Math.round(weather.humidity)}%) no Índice de Temperatura e Umidade para bovinos.</p><strong>{comfort.value === null ? "Sem cálculo" : `THI ${comfort.value.toFixed(1)} · ${comfort.status}`}</strong><p>Fórmula: (1,8 × T + 32) − (0,55 − 0,0055 × UR) × (1,8 × T − 26). Referência metodológica: NRC (1971), índice usado em estudos de conforto térmico animal. Os limites são indicativos e não substituem avaliação veterinária.</p></div>}
      {method === "water" && weather && water && <div className="science-method"><Droplets size={28} /><p>Somamos a chuva prevista e subtraímos a evapotranspiração de referência (ET₀) prevista para 7 dias.</p><strong>{water.balance === null ? "Não há dados suficientes" : `${weather.forecastPrecipitation.toFixed(1)} mm de chuva − ${weather.forecastEt0.toFixed(1)} mm de ET₀ = ${water.balance.toFixed(1)} mm`}</strong><p>É uma tendência regional. O cálculo só aparece quando existem fontes e registros de água no Hydra Agro. Vazão, armazenamento e condição do solo ainda precisam ser conferidos na propriedade.</p></div>}
      {method === "sources" && <div className="science-sources">{sourceLinks.map(([name, detail, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{detail}</span><ExternalLink size={16} /></a>)}</div>}
    </Modal>
  </div>;
}
