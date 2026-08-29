import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadWeatherMock } = vi.hoisted(() => ({ loadWeatherMock: vi.fn() }));

vi.mock("../src/services/weather-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/services/weather-service")>();
  return { ...original, loadWeather: loadWeatherMock };
});

import { WeatherWidget } from "../src/features/home/weather-widget";

beforeEach(() => {
  loadWeatherMock.mockReset();
  loadWeatherMock.mockResolvedValue({
    municipality: "Brejões",
    state: "BA",
    latitude: -13.1,
    longitude: -39.8,
    temperature: 25.4,
    apparentTemperature: 26.1,
    humidity: 71,
    precipitation: 0,
    windSpeed: 12.4,
    weatherCode: 2,
    isDay: true,
    minimumTemperature: 18.2,
    maximumTemperature: 27.8,
    rainChance: 31,
    sunrise: "2026-08-16T05:48",
    sunset: "2026-08-16T17:34",
    observedAt: "2026-08-16T11:30",
    fetchedAt: "2026-08-16T11:31:00.000Z",
    stale: false,
  });
});

describe("componente de clima", () => {
  it("carrega município e UF da propriedade e abre os detalhes reais", async () => {
    render(<WeatherWidget municipality="Brejões" state="BA" onCompleteProperty={vi.fn()} />);

    const button = await screen.findByRole("button", { name: /clima em brejões: 25 graus/i });
    fireEvent.click(button);

    expect(screen.getByRole("dialog", { name: "Brejões" })).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    expect(screen.getByText("31%")).toBeInTheDocument();
    expect(screen.getByText(/dados Open-Meteo/i)).toBeInTheDocument();
    expect(loadWeatherMock).toHaveBeenCalledWith("Brejões", "BA");
  });
});
