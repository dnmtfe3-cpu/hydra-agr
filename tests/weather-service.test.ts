import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeWeather, loadWeather } from "../src/services/weather-service";

const geocoding = {
  results: [{ name: "Brejões", latitude: -13.1039, longitude: -39.7988, country_code: "BR", admin1: "Bahia" }],
};

const forecast = {
  current: {
    time: "2026-08-16T11:30",
    temperature_2m: 25.4,
    apparent_temperature: 26.1,
    relative_humidity_2m: 71,
    precipitation: 0,
    weather_code: 2,
    wind_speed_10m: 12.4,
    is_day: 1,
  },
  daily: {
    temperature_2m_min: [18.2],
    temperature_2m_max: [27.8],
    precipitation_probability_max: [31],
    sunrise: ["2026-08-16T05:48"],
    sunset: ["2026-08-16T17:34"],
  },
};

function okJson(value: unknown) {
  return { ok: true, status: 200, json: async () => value } as Response;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("clima da propriedade", () => {
  it("localiza município e UF cadastrados e busca condições reais", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(okJson(geocoding))
      .mockResolvedValueOnce(okJson(forecast));
    vi.stubGlobal("fetch", request);

    const weather = await loadWeather("Brejões", "BA", { force: true });

    expect(request.mock.calls[0][0]).toContain("geocoding-api.open-meteo.com");
    expect(request.mock.calls[1][0]).toContain("api.open-meteo.com/v1/forecast");
    expect(request.mock.calls[1][0]).toContain("timezone=auto");
    expect(weather).toMatchObject({ municipality: "Brejões", state: "BA", temperature: 25.4, humidity: 71, rainChance: 31, stale: false });
  });

  it("reutiliza o cache recente por município e UF", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(okJson(geocoding))
      .mockResolvedValueOnce(okJson(forecast));
    vi.stubGlobal("fetch", request);

    await loadWeather("Brejões", "BA", { force: true });
    const cached = await loadWeather("Brejões", "BA");

    expect(request).toHaveBeenCalledTimes(2);
    expect(cached.temperature).toBe(25.4);
    expect(cached.state).toBe("BA");
  });

  it("identifica códigos meteorológicos sem inventar condição", () => {
    expect(describeWeather(0, false)).toEqual({ label: "Noite limpa", icon: "clear" });
    expect(describeWeather(63)).toEqual({ label: "Chuva", icon: "rain" });
    expect(describeWeather(95)).toEqual({ label: "Trovoadas", icon: "storm" });
  });
});
