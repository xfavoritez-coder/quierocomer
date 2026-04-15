"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import WeatherAmbience from "@/components/WeatherAmbience";

const WEATHER_MAP: Record<number, string> = {
  0: "clear", 1: "cloudy", 2: "cloudy", 3: "cloudy",
  51: "rain", 53: "rain", 55: "rain", 61: "rain", 63: "rain", 65: "rain",
  56: "drizzle", 57: "drizzle", 66: "drizzle", 67: "drizzle",
  71: "snow", 73: "snow", 75: "snow", 77: "snow",
};

const NAV = [
  { icon: "🧞", label: "Descubrir", href: "/" },
  { icon: "👥", label: "Grupo", href: "/grupo" },
  { icon: "👤", label: "Perfil", href: "/perfil" },
];

export default function GenieShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [weather, setWeather] = useState("clear");
  const pathname = usePathname();

  // Don't render shell for admin or auth pages
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/registro");

  useEffect(() => {
    if (isAdmin || isAuth) { setReady(true); return; }

    // Init session
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("genie_session_id")) {
        localStorage.setItem("genie_session_id", crypto.randomUUID());
      }
      if (!sessionStorage.getItem("genieVisitId")) {
        sessionStorage.setItem("genieVisitId", crypto.randomUUID());
      }
    }
    setReady(true);

    // Fetch weather
    const fetchWeather = async () => {
      try {
        const raw = sessionStorage.getItem("userCoords");
        const coords = raw ? JSON.parse(raw) : { lat: -33.4569, lng: -70.6483 };
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weathercode`);
        if (res.ok) {
          const data = await res.json();
          const code = data.current?.weathercode ?? 0;
          let condition = WEATHER_MAP[code] ?? "cloudy";
          const hour = new Date().getHours();
          if ((hour >= 20 || hour < 7) && condition === "clear") condition = "night";
          setWeather(condition);
          sessionStorage.setItem("genieWeatherCondition", condition);
        }
      } catch {}
    };

    // URL override for testing: ?weather=rain
    const urlWeather = new URLSearchParams(window.location.search).get("weather");
    if (urlWeather) { setWeather(urlWeather); return; }

    const cached = sessionStorage.getItem("genieWeatherCondition");
    if (cached) setWeather(cached);
    else fetchWeather();
  }, [isAdmin, isAuth]);

  // Debug log
  if (typeof window !== "undefined" && weather !== "clear") {
    console.log("Weather condition:", weather);
  }

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p className="font-display" style={{ fontSize: "1.2rem", color: "#0D0D0D" }}>🧞</p>
    </div>
  );

  // Admin and auth pages render without shell
  if (isAdmin || isAuth) return <>{children}</>;

  const hideNav = false; // Nav always visible

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", paddingBottom: hideNav ? 0 : 72, position: "relative" }}>
      <WeatherAmbience condition={weather} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>

      {!hideNav && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #E0E0E0", display: "flex", justifyContent: "center", zIndex: 50, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
          {NAV.map(n => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} style={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 6px", textDecoration: "none", color: active ? "#FFD600" : "#999999", background: active ? "#0D0D0D" : "transparent", borderRadius: active ? 20 : 0, margin: "4px 4px" }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <span className="font-display" style={{ fontSize: "0.58rem", letterSpacing: "0.06em" }}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
