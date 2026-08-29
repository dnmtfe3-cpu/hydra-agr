import { brazilStateName } from "../lib/brazil-location";

export type WeatherIconName = "clear" | "partly-cloudy" | "cloudy" | "fog" | "rain" | "storm" | "snow";

export type WeatherSnapshot = {
  municipality: string;
  state: string;
  latitude: number;
  longitude: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  minimumTemperature: number;
  maximumTemperature: number;
  rainChance: number;
  sunrise?: string;
  sunset?: string;
  observedAt: string;
  fetchedAt: string;
  stale: boolean;
};

export type WeatherDescription = { label: string; icon: WeatherIconName };

type GeocodingResponse = { results?: Array<{ name?: string; latitude?: number; longitude?: number; country_code?: string; admin1?: string }> };
type ForecastResponse = {
  current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number; is_day?: number };
  daily?: { temperature_2m_min?: number[]; temperature_2m_max?: number[]; precipitation_probability_max?: number[]; sunrise?: string[]; sunset?: string[] };
};
type CachedWeather = { savedAt: number; snapshot: WeatherSnapshot };

const CACHE_DURATION = 20 * 60 * 1000;
const STALE_CACHE_LIMIT = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT = 12_000;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function cacheKey(municipality: string, state: string) {
  return `hydra.weather.${normalize(state)}.${normalize(municipality).replace(/\s+/g, "-")}`;
}

function readCache(municipality: string, state: string): CachedWeather | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(municipality, state));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    return parsed.snapshot && Number.isFinite(parsed.savedAt) ? parsed : null;
  } catch { return null; }
}

function writeCache(municipality: string, state: string, snapshot: WeatherSnapshot) {
  try { window.localStorage.setItem(cacheKey(municipality, state), JSON.stringify({ savedAt: Date.now(), snapshot } satisfies CachedWeather)); } catch { /* cache opcional */ }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error("O serviço de clima está indisponível agora. Tente novamente em instantes.");
    return await response.json() as T;
  } finally { window.clearTimeout(timer); }
}

function finite(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Não foi possível obter ${field} do clima agora.`);
  return number;
}

async function locateMunicipality(municipality: string, state: string) {
  const params = new URLSearchParams({ name: municipality, count: "20", language: "pt", countryCode: "BR", format: "json" });
  const data = await fetchJson<GeocodingResponse>(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  const targetCity = normalize(municipality);
  const targetState = normalize(brazilStateName(state));
  const matches = (data.results ?? []).filter((item) => item.country_code === "BR");
  const location = matches.find((item) => normalize(item.name ?? "") === targetCity && (!targetState || normalize(item.admin1 ?? "") === targetState))
    ?? matches.find((item) => normalize(item.name ?? "") === targetCity)
    ?? matches[0];
  if (!location) throw new Error(`Não foi possível localizar ${municipality}${state ? `, ${state}` : ""} para consultar o clima.`);
  return { latitude: finite(location.latitude, "a latitude"), longitude: finite(location.longitude, "a longitude") };
}

async function requestForecast(municipality: string, state: string): Promise<WeatherSnapshot> {
  const location = await locateMunicipality(municipality, state);
  const params = new URLSearchParams({
    latitude: String(location.latitude), longitude: String(location.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
    daily: "temperature_2m_min,temperature_2m_max,precipitation_probability_max,sunrise,sunset",
    timezone: "auto", forecast_days: "1",
  });
  const data = await fetchJson<ForecastResponse>(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!data.current || !data.daily) throw new Error("O serviço de clima não retornou as condições atuais.");
  const now = new Date().toISOString();
  return {
    municipality, state, latitude: location.latitude, longitude: location.longitude,
    temperature: finite(data.current.temperature_2m, "a temperatura"),
    apparentTemperature: finite(data.current.apparent_temperature, "a sensação térmica"),
    humidity: finite(data.current.relative_humidity_2m, "a umidade"),
    precipitation: finite(data.current.precipitation, "a precipitação"),
    windSpeed: finite(data.current.wind_speed_10m, "o vento"),
    weatherCode: finite(data.current.weather_code, "a condição"),
    isDay: finite(data.current.is_day, "o período") === 1,
    minimumTemperature: finite(data.daily.temperature_2m_min?.[0], "a mínima"),
    maximumTemperature: finite(data.daily.temperature_2m_max?.[0], "a máxima"),
    rainChance: finite(data.daily.precipitation_probability_max?.[0] ?? 0, "a chance de chuva"),
    sunrise: data.daily.sunrise?.[0], sunset: data.daily.sunset?.[0], observedAt: data.current.time ?? now, fetchedAt: now, stale: false,
  };
}

export function describeWeather(code: number, isDay = true): WeatherDescription {
  if (code === 0) return { label: isDay ? "Céu limpo" : "Noite limpa", icon: "clear" };
  if (code === 1 || code === 2) return { label: "Parcialmente nublado", icon: "partly-cloudy" };
  if (code === 3) return { label: "Nublado", icon: "cloudy" };
  if (code === 45 || code === 48) return { label: "Neblina", icon: "fog" };
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return { label: "Chuva", icon: "rain" };
  if ([71,73,75,77,85,86].includes(code)) return { label: "Neve", icon: "snow" };
  if ([95,96,99].includes(code)) return { label: "Trovoadas", icon: "storm" };
  return { label: "Condição variável", icon: "partly-cloudy" };
}

export async function loadWeather(municipality: string, state: string, options: { force?: boolean } = {}) {
  const city = municipality.trim();
  const uf = state.trim().toUpperCase();
  if (!city || !uf) throw new Error("Cadastre a localização da propriedade para consultar o clima.");
  const cached = readCache(city, uf);
  if (!options.force && cached && Date.now() - cached.savedAt < CACHE_DURATION) return { ...cached.snapshot, stale: false };
  try {
    const snapshot = await requestForecast(city, uf);
    writeCache(city, uf, snapshot);
    return snapshot;
  } catch (error) {
    if (cached && Date.now() - cached.savedAt < STALE_CACHE_LIMIT) return { ...cached.snapshot, stale: true };
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("A consulta de clima demorou demais. Tente novamente.");
    if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("Sem internet para atualizar o clima desta região.");
    throw error instanceof Error ? error : new Error("Não foi possível consultar o clima agora.");
  }
}
