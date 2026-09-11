import { useEffect, useState } from "react";
import { CloudSun, Droplets, ThermometerSun } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { animalComfort, waterSituation } from "../../services/climate-science";
import { loadWeather, type WeatherSnapshot } from "../../services/weather-service";

export function HomeScienceSummary({ account, onOpen }: { account: HydraAccount; onOpen: () => void }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    if (!account.property.municipality || !account.property.state) return;
    void loadWeather(account.property.municipality, account.property.state).then(result => { if (active) setWeather(result); }).catch(() => undefined);
    return () => { active = false; };
  }, [account.property.municipality, account.property.state]);
  if (!weather) return <section className="home-science-summary" aria-label="Clima"><button onClick={onOpen}><CloudSun size={21} /><span><small>CLIMA</small><strong>Consultar</strong><em>Abrir clima e informações da região</em></span></button></section>;
  const comfort = animalComfort(account, weather);
  const water = waterSituation(account, weather);
  return <section className="home-science-summary" aria-label="Resumo de clima e ciência">
    <button onClick={onOpen}><CloudSun size={21} /><span><small>CLIMA</small><strong>{Math.round(weather.temperature)} °C</strong><em>{weather.rainChance >= 60 ? "Pode chover hoje" : "Ver previsão"}</em></span></button>
    <button onClick={onOpen}><ThermometerSun size={21} /><span><small>ANIMAIS</small><strong>{comfort.status}</strong><em>Conforto térmico</em></span></button>
    <button onClick={onOpen}><Droplets size={21} /><span><small>ÁGUA</small><strong>{water.status}</strong><em>Situação estimada</em></span></button>
  </section>;
}
