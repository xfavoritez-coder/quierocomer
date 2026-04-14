"use client";

interface Props {
  condition: string; // "clear" | "night" | "cloudy" | "rain" | "drizzle" | "snow"
}

export default function WeatherAmbience({ condition }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {condition === "clear" && <ClearEffect />}
      {condition === "night" && <NightEffect />}
      {condition === "cloudy" && <CloudyEffect />}
      {condition === "rain" && <RainEffect count={12} speed={1.5} opacity={0.07} />}
      {condition === "drizzle" && <RainEffect count={6} speed={2.5} opacity={0.04} />}
      {condition === "snow" && <SnowEffect />}

      <style>{`
        @keyframes qc-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        @keyframes qc-fall { 0% { transform: translateY(-20px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes qc-snow { 0% { transform: translateY(-10px) translateX(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(100vh) translateX(20px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          [data-weather-anim] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function ClearEffect() {
  return (
    <div style={{
      position: "absolute", top: -60, right: -60,
      width: 300, height: 300, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,214,0,0.06) 0%, transparent 70%)",
    }} />
  );
}

function NightEffect() {
  const stars = [
    { top: "8%", left: "15%", delay: 0 },
    { top: "12%", left: "72%", delay: 0.8 },
    { top: "5%", left: "45%", delay: 1.6 },
    { top: "18%", left: "88%", delay: 2.4 },
    { top: "10%", left: "32%", delay: 0.4 },
  ];
  return (
    <>
      {stars.map((s, i) => (
        <div key={i} data-weather-anim style={{
          position: "absolute", top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: "50%",
          background: "#fff", opacity: 0.5,
          animation: `qc-pulse ${3 + (i % 2)}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </>
  );
}

function CloudyEffect() {
  return (
    <>
      <div style={{
        position: "absolute", top: "5%", left: "10%",
        width: 300, height: 80, borderRadius: "50%",
        background: "rgba(255,255,255,0.02)", filter: "blur(40px)",
      }} />
      <div style={{
        position: "absolute", top: "12%", right: "5%",
        width: 250, height: 60, borderRadius: "50%",
        background: "rgba(255,255,255,0.02)", filter: "blur(40px)",
      }} />
    </>
  );
}

function RainEffect({ count, speed, opacity }: { count: number; speed: number; opacity: number }) {
  const drops = Array.from({ length: count }, (_, i) => ({
    left: `${(i / count) * 100 + Math.random() * 8}%`,
    delay: Math.random() * speed,
    height: 15 + Math.random() * 10,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, background: count > 8 ? "#0A0A0F" : undefined }}>
      {drops.map((d, i) => (
        <div key={i} data-weather-anim style={{
          position: "absolute", top: -20, left: d.left,
          width: 1, height: d.height,
          background: `rgba(102,153,255,${opacity})`,
          transform: "rotate(12deg)",
          animation: `qc-fall ${speed}s linear ${d.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SnowEffect() {
  const flakes = Array.from({ length: 8 }, (_, i) => ({
    left: `${(i / 8) * 100 + Math.random() * 10}%`,
    delay: Math.random() * 4,
    size: 2 + Math.random() * 2,
  }));
  return (
    <>
      {flakes.map((f, i) => (
        <div key={i} data-weather-anim style={{
          position: "absolute", top: -10, left: f.left,
          width: f.size, height: f.size, borderRadius: "50%",
          background: "rgba(255,255,255,0.5)",
          animation: `qc-snow 4s linear ${f.delay}s infinite`,
        }} />
      ))}
    </>
  );
}
