import { describe, expect, it } from "vitest";
import { createEmptyAccount } from "../src/lib/hydra-types";
import { animalComfort, calculateThi, climateAlerts, waterSituation, windCardinal } from "../src/services/climate-science";
import type { WeatherSnapshot } from "../src/services/weather-service";

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return { municipality: "Brejões", state: "BA", latitude: -13.1, longitude: -39.8, temperature: 31, apparentTemperature: 34, humidity: 70, precipitation: 0, windSpeed: 12, windDirection: 45, weatherCode: 1, isDay: true, minimumTemperature: 21, maximumTemperature: 36, rainChance: 65, forecast: [{ date: "2026-09-10", minimum: 21, maximum: 36, rainChance: 65, precipitation: 8, et0: 5, windSpeed: 18, windDirection: 45, weatherCode: 1 }], recentPrecipitation: 2, forecastPrecipitation: 8, forecastEt0: 5, daysWithoutRain: 3, observedAt: "2026-09-10T14:00", fetchedAt: "2026-09-10T14:01:00Z", stale: false, ...overrides };
}

describe("indicadores de Clima & Ciência", () => {
  it("calcula THI apenas para contexto com bovinos e explica que é estimativa", () => {
    const account = createEmptyAccount({ id: "a", email: "a@hydra.test" });
    expect(animalComfort(account, snapshot()).status).toBe("Sem dados");
    account.property.mainActivity = "Pecuária";
    const result = animalComfort(account, snapshot());
    expect(calculateThi(31, 70)).toBeCloseTo(result.value!, 5);
    expect(result.status).toBe("Risco elevado");
    expect(result.detail).toContain("Não é diagnóstico");
  });

  it("não inventa situação da água sem registros suficientes", () => {
    const account = createEmptyAccount({ id: "a", email: "a@hydra.test" });
    const result = waterSituation(account, snapshot());
    expect(result.status).toBe("Sem dados");
    expect(result.balance).toBeNull();
  });

  it("identifica fontes dos alertas e direção do vento", () => {
    const account = createEmptyAccount({ id: "a", email: "a@hydra.test" });
    account.property.mainActivity = "Pecuária";
    const alerts = climateAlerts(account, snapshot());
    expect(alerts.some(item => item.source === "PREVISÃO")).toBe(true);
    expect(alerts.some(item => item.source === "ESTIMATIVA DO HYDRA")).toBe(true);
    expect(windCardinal(45)).toBe("NE");
  });
});
