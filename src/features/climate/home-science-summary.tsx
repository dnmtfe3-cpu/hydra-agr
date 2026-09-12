import { useEffect, useState, type ReactNode } from "react";
import { CloudSun, Droplets, ThermometerSun } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { animalComfort, waterSituation } from "../../services/climate-science";
import { loadWeather, type WeatherSnapshot } from "../../services/weather-service";

export type ScienceSummaryView = "climate" | "animals" | "water";
export const SCIENCE_VIEW_KEY = "hydra-agro.science-view";

type ShortcutProps = {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick: () => void;
  variant?: "climate";
};

function ScienceShortcut({ icon, label, value, detail, onClick, variant }: ShortcutProps) {
  return (
    <button
      className={`home-science-shortcut${variant === "climate" ? " home-science-shortcut--climate" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${detail}`}
    >
      <span className="home-science-shortcut-top">
        <span className="home-science-shortcut-icon" aria-hidden="true">{icon}</span>
        <span className="home-science-shortcut-label">{label}</span>
      </span>
      <strong className="home-science-shortcut-value">{value}</strong>
      <span className="home-science-shortcut-detail">{detail}</span>
    </button>
  );
}

export function HomeScienceSummary({ account, onOpen }: { account: HydraAccount; onOpen: () => void }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    if (!account.property.municipality || !account.property.state) {
      setWeather(null);
      return () => { active = false; };
    }

    void loadWeather(account.property.municipality, account.property.state)
      .then((result) => { if (active) setWeather(result); })
      .catch(() => { if (active) setWeather(null); });

    return () => { active = false; };
  }, [account.property.municipality, account.property.state]);

  function open(view: ScienceSummaryView) {
    try { window.sessionStorage.setItem(SCIENCE_VIEW_KEY, view); } catch { /* Continue with the default climate view. */ }
    onOpen();
  }

  const comfort = weather ? animalComfort(account, weather) : null;
  const water = weather ? waterSituation(account, weather) : null;

  return (
    <section className="home-science-summary" aria-label="Atalhos de clima, animais e água">
      <ScienceShortcut
        variant="climate"
        icon={<CloudSun size={18} />}
        label="CLIMA"
        value={weather ? `${Math.round(weather.temperature)} °C` : "Consultar"}
        detail={weather ? (weather.rainChance >= 60 ? "Pode chover" : "Ver previsão") : "Ver previsão"}
        onClick={() => open("climate")}
      />
      <ScienceShortcut
        icon={<ThermometerSun size={18} />}
        label="ANIMAIS"
        value={comfort?.status ?? "Rebanho"}
        detail="Conforto térmico"
        onClick={() => open("animals")}
      />
      <ScienceShortcut
        icon={<Droplets size={18} />}
        label="ÁGUA"
        value={water?.status ?? "Situação"}
        detail="Acompanhar água"
        onClick={() => open("water")}
      />
    </section>
  );
}
