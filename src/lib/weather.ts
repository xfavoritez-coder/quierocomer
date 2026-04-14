export interface WeatherData {
  weatherTemp: number;
  weatherCondition: string;
  weatherHumidity: number;
}

const WEATHER_MAP: Record<number, string> = {
  0: "clear",
  1: "cloudy", 2: "cloudy", 3: "cloudy",
  51: "rain", 53: "rain", 55: "rain", 61: "rain", 63: "rain", 65: "rain",
  56: "drizzle", 57: "drizzle", 66: "drizzle", 67: "drizzle",
  71: "snow", 73: "snow", 75: "snow", 77: "snow",
};

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,relativehumidity_2m`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    return {
      weatherTemp: current.temperature_2m ?? 15,
      weatherCondition: WEATHER_MAP[current.weathercode] ?? "cloudy",
      weatherHumidity: current.relativehumidity_2m ?? 50,
    };
  } catch {
    return null;
  }
}
