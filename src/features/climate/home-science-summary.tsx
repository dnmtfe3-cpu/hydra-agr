import { useEffect, useState, type ReactNode } from "react";
import { CloudSun, Droplets, ThermometerSun } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { animalComfort, waterSituation } from "../../services/climate-science";
import { loadWeather, type WeatherSnapshot } from "../../services/weather-service";

export type ScienceSummaryView = "climate" | "animals" | "water";
export const SCIENCE_VIEW_KEY = "hydra-agro.science-view";

function SummaryCard({ icon, label, value, detail, onClick }: { icon: ReactNode; label: string; value: string; detail: string; onClick: () => void }) {
  return <button className="home-science-card" type="button" onClick={onClick}>
    <span className="home-science-card-icon" aria-hidden="true">{icon}</span>
    <span className="home-science-card-copy">
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </span>
  </button>;
}

export function HomeScienceSummary({ account, onOpen }: { account: HydraAccount; onOpen: () => void }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    if (!account.property.municipality || !account.property.state) return;
    void loadWeather(account.property.municipality, account.property.state)
      .then((result) => { if (active) setWeather(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [account.property.municipality, account.property.state]);

  function open(view: ScienceSummaryView) {
    try { window.sessionStorage.setItem(SCIENCE_VIEW_KEY, view); } catch { /* Continue with the default climate view. */ }
    onOpen();
  }

  if (!weather) {
    return <section className="home-science-summary home-science-summary-loading" aria-label="Clima">
      <SummaryCard icon={<CloudSun size={19} />} label="CLIMA" value="Consultar" detail="Ver previsão" onClick={() => open("climate")} />
    </section>;
  }

  const comfort = animalComfort(account, weather);
  const water = waterSituation(account, weather);

  return <section className="home-science-summary" aria-label="Resumo de clima e ciência">
    <SummaryCard icon={<CloudSun size={19} />} label="CLIMA" value={`${Math.round(weather.temperature)} °C`} detail={weather.rainChance >= 60 ? "Pode chover" : "Ver previsão"} onClick={() => open("climate")} />
    <SummaryCard icon={<ThermometerSun size={19} />} label="ANIMAIS" value={comfort.status} detail="Conforto térmico" onClick={() => open("animals")} />
    <SummaryCard icon={<Droplets size={19} />} label="ÁGUA" value={water.status} detail="Situação estimada" onClick={() => open("water")} />
  </section>;
}
