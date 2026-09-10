import { useEffect, useState } from "react";
import { CloudRain, Droplets } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { waterSituation } from "../../services/climate-science";
import { loadWeather, type WeatherSnapshot } from "../../services/weather-service";
import { AudioHelp, useEasyMode } from "../easy-mode/easy-mode";
import "./water-science-card.css";

export function WaterScienceCard({ account }: { account: HydraAccount }) {
  const { enabled: easy } = useEasyMode();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    if (!account.property.municipality || !account.property.state) return;
    void loadWeather(account.property.municipality, account.property.state).then(value => { if (active) setWeather(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [account.property.municipality, account.property.state]);
  const result = weather ? waterSituation(account, weather) : null;
  return <section className="water-science-card">
    <span><Droplets size={23} /></span><div><small>ESTIMATIVA DO HYDRA</small><strong>Situação da água: {result?.status ?? "Sem dados"}</strong><p>{result?.detail ?? "Cadastre a localização para cruzar água e clima."}</p>{weather && !easy && <em><CloudRain size={15} /> 7 dias: {weather.forecastPrecipitation.toFixed(1)} mm de chuva · ET₀ {weather.forecastEt0.toFixed(1)} mm</em>}</div>
    {easy && <AudioHelp text={`Situação da água: ${result?.status ?? "sem dados"}. ${result?.detail ?? "Cadastre a localização para ver esta informação."}`} />}
  </section>;
}
