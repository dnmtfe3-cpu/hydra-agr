import type { HydraAccount } from "../lib/hydra-types";
import type { WeatherSnapshot } from "./weather-service";

export type ScienceStatus = "Normal" | "Atenção" | "Risco elevado" | "Boa" | "Crítica" | "Sem dados";
export type ScienceAlert = { title: string; detail: string; source: "PREVISÃO" | "DADO ATUAL" | "ESTIMATIVA DO HYDRA" };

export function windCardinal(degrees: number) {
  return ["N", "NE", "L", "SE", "S", "SO", "O", "NO"][Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}

// NRC (1971): THI = (1.8T + 32) - (0.55 - 0.0055UR) × (1.8T - 26).
export function calculateThi(temperature: number, humidity: number) {
  return (1.8 * temperature + 32) - (0.55 - 0.0055 * humidity) * (1.8 * temperature - 26);
}

export function animalComfort(account: HydraAccount, weather: WeatherSnapshot) {
  const hasCattle = account.animals.some(animal => /bovin/i.test(animal.species)) || /pecu[aá]ria/i.test(account.property.mainActivity);
  if (!hasCattle) return { status: "Sem dados" as ScienceStatus, value: null, detail: "O cálculo THI desta versão é mostrado apenas quando há bovinos cadastrados." };
  const value = calculateThi(weather.temperature, weather.humidity);
  const status: ScienceStatus = value < 72 ? "Normal" : value < 79 ? "Atenção" : "Risco elevado";
  return { status, value, detail: "Estimativa de conforto térmico para bovinos. Não é diagnóstico veterinário." };
}

export function waterSituation(account: HydraAccount, weather: WeatherSnapshot) {
  if (!account.waterSources.length || !account.waterRecords.length) return { status: "Sem dados" as ScienceStatus, balance: null, detail: "Não há dados suficientes para calcular este indicador." };
  const balance = weather.forecastPrecipitation - weather.forecastEt0;
  const status: ScienceStatus = balance >= 5 ? "Boa" : balance > -15 ? "Atenção" : "Crítica";
  return { status, balance, detail: "Tendência regional de 7 dias: chuva prevista menos evapotranspiração de referência (ET₀)." };
}

export function climateAlerts(account: HydraAccount, weather: WeatherSnapshot): ScienceAlert[] {
  const alerts: ScienceAlert[] = [];
  const comfort = animalComfort(account, weather);
  if (weather.maximumTemperature >= 35) alerts.push({ title: "Calor elevado previsto", detail: `Máxima prevista de ${Math.round(weather.maximumTemperature)} °C hoje.`, source: "PREVISÃO" });
  if (comfort.status === "Atenção" || comfort.status === "Risco elevado") alerts.push({ title: "Possível desconforto térmico", detail: "Temperatura e umidade indicam atenção para bovinos. Confira sombra e água e observe os animais.", source: "ESTIMATIVA DO HYDRA" });
  if ((weather.forecast[0]?.precipitation ?? 0) >= 30) alerts.push({ title: "Chuva forte prevista", detail: `${weather.forecast[0].precipitation.toFixed(1)} mm previstos para hoje.`, source: "PREVISÃO" });
  if ((weather.daysWithoutRain ?? 0) >= 7) alerts.push({ title: "Período sem chuva", detail: "O modelo meteorológico indica pelo menos 7 dias recentes com menos de 1 mm por dia.", source: "DADO ATUAL" });
  const water = waterSituation(account, weather);
  if (water.status === "Crítica") alerts.push({ title: "Baixa disponibilidade hídrica estimada", detail: "A tendência regional de chuva e ET₀ pede atenção. Confira suas fontes de água.", source: "ESTIMATIVA DO HYDRA" });
  return alerts;
}

export function easyClimateSummary(weather: WeatherSnapshot, comfort: ReturnType<typeof animalComfort>) {
  const messages = [weather.apparentTemperature >= 35 ? "Calor forte. Atenção aos animais." : weather.temperature >= 29 ? "Hoje está quente." : weather.temperature <= 18 ? "Hoje está fresco." : "Temperatura agradável."];
  messages.push(weather.rainChance >= 60 ? "Pode chover hoje." : weather.rainChance <= 20 ? "Pouca chance de chuva." : "Pode chover em alguns momentos.");
  if (comfort.status === "Atenção" || comfort.status === "Risco elevado") messages.push("Conforto dos animais pede atenção.");
  return messages.join(" ");
}
