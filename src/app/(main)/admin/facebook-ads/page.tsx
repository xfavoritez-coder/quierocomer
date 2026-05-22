"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface Stats {
  totalVisits: number;
  adVisits: number;
  fbVisits: number;
  fbPctOfTotal: number;
  ghostSessions: number;
  totalSessions: number;
  visitedSubircarta: number;
  visitedSubircartaRate: number;
  bounced: number;
  bounceRate: number;
  converted: number;
  conversionRate: number;
  avgDuration: number;
  avgScroll: number;
  avgInteractions: number;
  mobile: number;
  desktop: number;
}

interface Session {
  id: string;
  sessionId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  device: string | null;
  userAgent: string | null;
  ip: string | null;
  referrer: string | null;
  landingPage: string | null;
  duration: number;
  maxScroll: number;
  pageViews: number;
  interactions: number;
  sectionsViewed: string[];
  converted: boolean;
  bounced: boolean;
  exitPage: string | null;
  leadId: string | null;
  events: any[];
  visitedSubircarta: boolean;
  createdAt: string;
  updatedAt: string;
}

function parseUA(ua: string | null): { browser: string; os: string; deviceName: string } {
  if (!ua) return { browser: "?", os: "?", deviceName: "?" };
  let browser = "Otro";
  if (/CriOS/i.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS/i.test(ua)) browser = "Firefox (iOS)";
  else if (/EdgiOS|EdgA|Edg\//i.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) browser = "Facebook App";
  else if (/Instagram/i.test(ua)) browser = "Instagram App";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  let os = "Otro";
  const iosMatch = ua.match(/iPhone OS (\d+[_\d]*)/i) || ua.match(/iPad.*OS (\d+[_\d]*)/i);
  const androidMatch = ua.match(/Android (\d+[\.\d]*)/i);
  if (iosMatch) os = `iOS ${iosMatch[1].replace(/_/g, ".")}`;
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (androidMatch) os = `Android ${androidMatch[1]}`;
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";
  let deviceName = "";
  const iphoneModel = ua.match(/iPhone/i);
  const ipadModel = ua.match(/iPad/i);
  const samsungModel = ua.match(/SM-[A-Z0-9]+/i);
  const xiaomiModel = ua.match(/(Redmi|POCO|Mi \d)[^;)]*/i);
  const huaweiModel = ua.match(/(HUAWEI|VOG|ELS|MAR|STK)[^;)]*/i);
  if (samsungModel) deviceName = samsungModel[0];
  else if (xiaomiModel) deviceName = xiaomiModel[0].trim();
  else if (huaweiModel) deviceName = huaweiModel[0].trim();
  else if (ipadModel) deviceName = "iPad";
  else if (iphoneModel) deviceName = "iPhone";
  return { browser, os, deviceName };
}

interface Data {
  stats: Stats;
  logoClicks: Record<string, number>;
  totalLogoClicks: number;
  sourceBreakdown: Record<string, number>;
  byLanding: Record<string, number>;
  byCampaign: Record<string, { visits: number; bounced: number; converted: number; avgDuration: number; avgScroll: number; subircarta: number; landedSubircarta: number; landedLanding: number }>;
  byContent: Record<string, { visits: number; bounced: number; converted: number }>;
  sectionCounts: Record<string, number>;
  clickCounts: Record<string, number>;
  hourly: Record<number, { visits: number; bounced: number; converted: number }>;
  daily: Record<string, { visits: number; converted: number; bounced: number }>;
  sessions: Session[];
}

const CSS = `
  .fb-dash { max-width: 1100px; margin: 0 auto; padding: 0 12px 40px; position: relative; -webkit-text-size-adjust: 100%; }

  /* Header - stack on mobile */
  .fb-header { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  @media (min-width: 480px) { .fb-header { flex-direction: row; align-items: center; justify-content: space-between; } }
  .fb-title { font-size: 18px; font-weight: 800; color: #3b82f6; margin: 0; display: flex; align-items: center; gap: 8px; }
  .fb-title-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: fbPulse 2s ease-in-out infinite; flex-shrink: 0; }
  .fb-period-pills { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .fb-period-pills::-webkit-scrollbar { display: none; }
  .fb-pill { padding: 8px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s; -webkit-tap-highlight-color: transparent; flex-shrink: 0; }
  .fb-pill-active { background: #3b82f6; color: #fff; box-shadow: 0 2px 12px rgba(59,130,246,.3); }
  .fb-pill-inactive { background: #161616; color: #666; }

  /* Source filter - horizontal scroll */
  .fb-sources { display: flex; gap: 5px; margin-bottom: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; scrollbar-width: none; }
  .fb-sources::-webkit-scrollbar { display: none; }
  .fb-src-btn { padding: 7px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all .2s; flex-shrink: 0; }

  /* Stats grid - 2 col mobile */
  .fb-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
  @media (min-width: 640px) { .fb-stats { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 900px) { .fb-stats { grid-template-columns: repeat(5, 1fr); } }

  .fb-card { background: #111; border-radius: 14px; padding: 14px 14px; border: 1px solid #1e1e1e; position: relative; overflow: hidden; }
  .fb-card-val { font-size: 22px; font-weight: 800; line-height: 1.1; transition: color .5s; }
  @media (min-width: 480px) { .fb-card-val { font-size: 26px; } }
  .fb-card-suffix { font-size: 12px; font-weight: 700; color: #bbb; margin-left: 3px; }
  .fb-card-label { font-size: 10px; color: #666; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }

  /* Hourly chart - scrollable on mobile with bigger bars */
  .fb-hourly-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; margin: 0 -4px; }
  .fb-hourly-wrap::-webkit-scrollbar { display: none; }
  .fb-hourly { display: flex; align-items: flex-end; gap: 4px; height: 150px; padding: 0 4px; min-width: 500px; }
  .fb-hour-col { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; }
  .fb-hour-bar { width: 100%; max-width: 32px; min-width: 14px; border-radius: 5px; transition: height 1.5s cubic-bezier(.16,1,.3,1), background .5s; }
  .fb-hour-count { font-size: 9px; color: #999; font-weight: 700; }
  .fb-hour-label { font-size: 10px; font-weight: 500; }

  /* Campaign bars - card style on mobile */
  .fb-campaigns { display: flex; flex-direction: column; gap: 10px; }
  .fb-camp-row { display: flex; flex-direction: column; gap: 6px; }
  @media (min-width: 640px) { .fb-camp-row { flex-direction: row; align-items: center; gap: 10px; } }
  .fb-camp-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 1.5s; }
  @media (min-width: 640px) { .fb-camp-name { min-width: 120px; max-width: 160px; text-align: right; flex-shrink: 0; } }
  .fb-camp-bar-wrap { position: relative; height: 38px; border-radius: 10px; background: #161616; overflow: hidden; min-width: 0; width: 100%; }
  @media (min-width: 640px) { .fb-camp-bar-wrap { flex: 1; } }
  .fb-camp-bar { height: 100%; border-radius: 10px; transition: width 1.5s cubic-bezier(.16,1,.3,1), background 1.5s; }
  .fb-camp-overlay { position: absolute; left: 0; top: 0; height: 100%; border-radius: 10px; transition: width 1.5s cubic-bezier(.16,1,.3,1); }
  .fb-camp-left { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; font-weight: 800; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.5); }
  .fb-camp-right { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; display: flex; gap: 8px; align-items: center; text-shadow: 0 1px 4px rgba(0,0,0,.8); }

  /* Two-col grid - stacked on mobile */
  .fb-two-col { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 16px; }
  @media (min-width: 700px) { .fb-two-col { grid-template-columns: 1fr 1fr; } }

  /* Section */
  .fb-section { background: #111; border-radius: 14px; padding: 14px 14px; border: 1px solid #1e1e1e; margin-bottom: 12px; }
  .fb-section-title { font-size: 12px; font-weight: 700; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .05em; }

  /* Campaign table - badges wrap on mobile */
  .fb-camp-table-row { padding: 10px 0; border-bottom: 1px solid #1a1a1a; }
  .fb-camp-table-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .fb-camp-table-name { color: #ccc; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .fb-camp-table-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
  .fb-badge { font-size: 11px; padding: 3px 10px; border-radius: 6px; font-weight: 600; white-space: nowrap; }

  /* Sessions */
  .fb-sess { border-bottom: 1px solid #1a1a1a; padding: 12px 0; transition: background 1.5s, border-color 1.5s; }
  .fb-sess-new { background: rgba(110,231,183,.05); border-left: 3px solid #6ee7b7; padding-left: 8px; }
  .fb-sess-header { display: flex; flex-direction: column; gap: 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  @media (min-width: 640px) { .fb-sess-header { flex-direction: row; justify-content: space-between; align-items: center; } }
  .fb-sess-top { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .fb-sess-metrics { display: flex; gap: 12px; font-size: 12px; color: #666; flex-shrink: 0; padding: 4px 0 0; }
  @media (min-width: 640px) { .fb-sess-metrics { padding: 0; } }
  .fb-sess-detail { margin-top: 10px; padding: 14px; background: #0d0d0d; border-radius: 12px; border: 1px solid #1a1a1a; }
  .fb-sess-grid { display: grid; grid-template-columns: 1fr; gap: 8px; font-size: 12px; margin-bottom: 12px; padding: 12px; background: #141414; border-radius: 10px; }
  @media (min-width: 500px) { .fb-sess-grid { grid-template-columns: 1fr 1fr; gap: 6px 16px; } }
  .fb-detail-row { display: flex; justify-content: space-between; gap: 8px; }
  .fb-detail-label { color: #aaa; flex-shrink: 0; font-weight: 600; }
  .fb-detail-val { color: #ccc; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }

  .fb-utm-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
  .fb-tag { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }

  .fb-sections-viewed { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; margin-bottom: 12px; }

  /* Timeline - scrollable horizontally on mobile */
  .fb-timeline { font-size: 11px; font-family: monospace; max-height: 280px; overflow: auto; background: #141414; border-radius: 8px; padding: 8px; scrollbar-width: thin; scrollbar-color: #333 transparent; }
  .fb-timeline-row { padding: 4px 0; border-bottom: 1px solid #111; display: flex; gap: 6px; min-width: 0; }
  .fb-timeline-ts { color: #888; min-width: 36px; text-align: right; flex-shrink: 0; font-size: 10px; }
  .fb-timeline-type { font-weight: 700; min-width: 70px; flex-shrink: 0; font-size: 10px; }
  @media (min-width: 480px) { .fb-timeline-type { min-width: 90px; } }
  .fb-timeline-data { color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; font-size: 10px; }

  /* Bar charts - full width bars */
  .fb-bar-row { display: flex; flex-direction: column; gap: 4px; padding: 6px 0; border-bottom: 1px solid #141414; }
  @media (min-width: 480px) { .fb-bar-row { flex-direction: row; justify-content: space-between; align-items: center; gap: 8px; } }
  .fb-bar-name { color: #bbb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; min-width: 0; }
  @media (min-width: 480px) { .fb-bar-name { flex: 1; } }
  .fb-bar-right { display: flex; align-items: center; gap: 8px; width: 100%; }
  @media (min-width: 480px) { .fb-bar-right { width: auto; flex-shrink: 0; } }
  .fb-bar-visual { height: 10px; border-radius: 5px; min-width: 4px; flex-shrink: 0; }
  .fb-bar-fill { height: 10px; border-radius: 5px; flex: 1; background: #161616; overflow: hidden; }
  .fb-bar-fill-inner { height: 100%; border-radius: 5px; transition: width .5s ease; }

  /* Logo clicks */
  .fb-logos { display: flex; flex-wrap: wrap; gap: 6px; }
  .fb-logo-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #161616; border-radius: 10px; border: 1px solid #222; }

  /* Confetti */
  .fb-confetti { position: fixed; inset: 0; pointer-events: none; z-index: 9999; overflow: hidden; }
  .fb-confetti-piece { position: absolute; top: -20px; }
  @keyframes fbConfettiFall { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  @keyframes fbPulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
  @keyframes fbSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .fb-empty { font-size: 13px; color: #555; padding: 16px 0; text-align: center; }
  .fb-loading { padding: 60px 20px; text-align: center; color: #555; font-size: 14px; }

  /* Loading overlay */
  .fb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fbFadeIn .15s ease; }
  .fb-overlay-spinner { width: 36px; height: 36px; border: 3px solid #333; border-top-color: #3b82f6; border-radius: 50%; animation: fbSpin .6s linear infinite; }

  /* Skeleton */
  .fb-skel { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  .fb-skel-row { display: flex; gap: 8px; margin-bottom: 12px; }
  .fb-skel-block { background: #161616; border-radius: 14px; height: 80px; flex: 1; animation: fbShimmer 1.2s ease-in-out infinite alternate; }
  .fb-skel-bar { background: #161616; border-radius: 14px; height: 180px; width: 100%; margin-bottom: 12px; animation: fbShimmer 1.2s ease-in-out infinite alternate; animation-delay: .2s; }
  .fb-skel-line { background: #131313; border-radius: 8px; height: 40px; width: 100%; margin-bottom: 8px; animation: fbShimmer 1.2s ease-in-out infinite alternate; }
  @keyframes fbShimmer { from { opacity: .4; } to { opacity: .8; } }
  @keyframes fbSpin { to { transform: rotate(360deg); } }
  @keyframes fbFadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* Scroll hint for hourly chart */
  .fb-scroll-hint { font-size: 10px; color: #444; text-align: right; margin-top: 4px; }
  @media (min-width: 600px) { .fb-scroll-hint { display: none; } }
`;

export default function FacebookAdsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const period = searchParams.get("period") || "today";  // default siempre "today"
  const source = searchParams.get("source") || null;

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessFilter, setSessFilter] = useState("");
  const [sessPage, setSessPage] = useState(0);
  const SESS_PER_PAGE = 10;
  const [flashCampaigns, setFlashCampaigns] = useState<Set<string>>(new Set());
  const [conversionCampaigns, setConversionCampaigns] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [newSessionIds, setNewSessionIds] = useState<Set<string>>(new Set());
  const prevVisitsRef = useRef<Record<string, number>>({});
  const prevConversionsRef = useRef<Record<string, number>>({});
  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  const currentFilterRef = useRef<string>("");

  const setPeriod = useCallback((p: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.replace(`?${params.toString()}`);
  }, [searchParams, router]);

  const setSource = useCallback((src: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (src) params.set("source", src); else params.delete("source");
    router.replace(`?${params.toString()}`);
  }, [searchParams, router]);

  const resetRefs = useCallback(() => {
    prevVisitsRef.current = {};
    prevConversionsRef.current = {};
    prevSessionIdsRef.current = new Set();
  }, []);

  const fetchData = useCallback((p: string, src: string | null, isFilterChange: boolean) => {
    if (isFilterChange) {
      resetRefs();
      setLoading(true);
    } else if (Object.keys(prevVisitsRef.current).length === 0) {
      setLoading(true);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    let params = "";
    if (p === "today") {
      params = `since=${todayStart.toISOString()}`;
    } else if (p === "yesterday") {
      params = `since=${yesterdayStart.toISOString()}&until=${todayStart.toISOString()}`;
    } else {
      params = `days=${p}`;
    }
    if (src) params += `&source=${encodeURIComponent(src)}`;
    fetch(`/api/admin/facebook-ads?${params}`)
      .then((r) => r.json())
      .then((newData: Data) => {
        // Solo animar si NO es cambio de filtro (es auto-refresh)
        if (!isFilterChange) {
          const prev = prevVisitsRef.current;
          if (Object.keys(prev).length > 0) {
            const changed = new Set<string>();
            for (const [name, c] of Object.entries(newData.byCampaign)) {
              if (c.visits > (prev[name] || 0)) changed.add(name);
            }
            if (changed.size > 0) {
              setFlashCampaigns(changed);
              setTimeout(() => setFlashCampaigns(new Set()), 4000);
            }
          }
          const prevConv = prevConversionsRef.current;
          const newConv = new Set<string>();
          for (const [name, c] of Object.entries(newData.byCampaign)) {
            if (Object.keys(prevConv).length > 0 && c.converted > (prevConv[name] || 0)) newConv.add(name);
          }
          if (newConv.size > 0) {
            setConversionCampaigns(newConv);
            setShowConfetti(true);
            setTimeout(() => { setConversionCampaigns(new Set()); setShowConfetti(false); }, 5000);
          }
          if (prevSessionIdsRef.current.size > 0) {
            const newIds = new Set<string>();
            for (const s of newData.sessions) {
              if (!prevSessionIdsRef.current.has(s.id)) newIds.add(s.id);
            }
            if (newIds.size > 0) {
              setNewSessionIds(newIds);
              setTimeout(() => setNewSessionIds(new Set()), 3000);
            }
          }
        }

        // Actualizar refs
        const visits: Record<string, number> = {};
        const convs: Record<string, number> = {};
        for (const [name, c] of Object.entries(newData.byCampaign)) {
          visits[name] = c.visits;
          convs[name] = c.converted;
        }
        prevVisitsRef.current = visits;
        prevConversionsRef.current = convs;
        prevSessionIdsRef.current = new Set(newData.sessions.map((s: any) => s.id));
        setData(newData);
      })
      .finally(() => setLoading(false));
  }, [resetRefs]);

  // Detectar cambio de filtro vs auto-refresh
  useEffect(() => {
    const filterKey = `${period}|${source}`;
    const isFilterChange = currentFilterRef.current !== "" && currentFilterRef.current !== filterKey;
    currentFilterRef.current = filterKey;
    fetchData(period, source, isFilterChange || currentFilterRef.current === filterKey && !data);
  }, [period, source]);

  // Auto-refresh cada 30s + on tab focus
  useEffect(() => {
    const interval = setInterval(() => fetchData(period, source, false), 30000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(period, source, false); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [period, source, fetchData]);

  if (!data && loading) return <><style>{CSS}</style><Skeleton /></>;
  if (!data) return <><style>{CSS}</style><div className="fb-loading" style={{ color: "#e85d5d" }}>Error al cargar datos.</div></>;

  const { stats, logoClicks, totalLogoClicks, sourceBreakdown, byCampaign, sectionCounts, clickCounts, hourly, daily, sessions } = data;
  const sortedSources = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]);
  const sortedClicks = Object.entries(clickCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const sortedSections = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1]);
  const sortedCampaigns = Object.entries(byCampaign).sort((a, b) => b[1].visits - a[1].visits);
  const sortedDaily = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));

  const fmtDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const confettiColors = ["#22c55e", "#4ade80", "#86efac", "#fbbf24", "#f59e0b", "#3b82f6", "#a855f7"];

  return (
    <>
      <style>{CSS}</style>
      <div className="fb-dash">
        {/* Loading overlay on filter change */}
        {loading && data && (
          <div className="fb-overlay">
            <div className="fb-overlay-spinner" />
          </div>
        )}
        {/* Confetti */}
        {showConfetti && (
          <div className="fb-confetti">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="fb-confetti-piece" style={{
                left: `${Math.random() * 100}%`,
                width: Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                background: confettiColors[Math.floor(Math.random() * 7)],
                animation: `fbConfettiFall ${2 + Math.random() * 3}s ease-in forwards`,
                animationDelay: `${Math.random() * 1}s`,
              }} />
            ))}
          </div>
        )}

        {/* Header */}
        <div className="fb-header">
          <h1 className="fb-title">
            <span className="fb-title-dot" />
            FB Ads
          </h1>
          <div className="fb-period-pills">
            {[
              { key: "today", label: "Hoy" },
              { key: "yesterday", label: "Ayer" },
              { key: "7", label: "7d" },
              { key: "14", label: "14d" },
              { key: "30", label: "30d" },
              { key: "90", label: "90d" },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setPeriod(d.key)}
                className={`fb-pill ${period === d.key ? "fb-pill-active" : "fb-pill-inactive"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Source filter */}
        {sortedSources.length > 0 && (
          <div className="fb-sources">
            <button
              onClick={() => setSource(null)}
              className="fb-src-btn"
              style={{ background: source === null ? "#6366f1" : "#161616", color: source === null ? "#fff" : "#666" }}
            >
              Todas ({Object.values(sourceBreakdown).reduce((a, b) => a + b, 0)})
            </button>
            {sortedSources.map(([src, count]) => (
              <button
                key={src}
                onClick={() => setSource(src)}
                className="fb-src-btn"
                style={{ background: source === src ? "#6366f1" : "#161616", color: source === src ? "#fff" : "#666" }}
              >
                {src} ({count})
              </button>
            ))}
          </div>
        )}

        {stats.totalSessions === 0 && (
          <div className="fb-empty" style={{ padding: "48px 20px", fontSize: 15 }}>
            Sin datos para este periodo.
          </div>
        )}

        {stats.totalSessions > 0 && <>
          {/* Stats */}
          <div className="fb-stats">
            <StatCard label="Sesiones" value={stats.totalSessions} color="#3b82f6" />
            <StatCard label="/subircarta" value={stats.visitedSubircarta} color="#F4A623" suffix={`${stats.visitedSubircartaRate}%`} />
            <StatCard label="Convertidos" value={stats.converted} color="#22c55e" suffix={`${stats.conversionRate}%`} />
            <StatCard label="Tiempo" value={fmtDuration(stats.avgDuration)} color="#eab308" />
            <StatCard label="Scroll" value={`${stats.avgScroll}%`} color="#14b8a6" />
            <StatCard label="Mobile" value={stats.mobile} color="#8b5cf6" />
            <StatCard label="Desktop" value={stats.desktop} color="#64748b" />
            {totalLogoClicks > 0 && <StatCard label="Vieron carta" value={totalLogoClicks} color="#a855f7" suffix={`${stats.totalSessions > 0 ? Math.round((totalLogoClicks / stats.totalSessions) * 100) : 0}%`} />}
            {stats.ghostSessions > 0 && <StatCard label="Fantasmas" value={stats.ghostSessions} color="#444" suffix="filtradas" />}
          </div>

          {/* Hourly */}
          {(() => {
            const hours = Object.entries(hourly || {}).map(([h, d]) => [parseInt(h), d] as [number, { visits: number; bounced: number; converted: number; subircarta: number }]).sort((a, b) => a[0] - b[0]);
            const totalToday = hours.reduce((s, [, d]) => s + d.visits, 0);
            if (totalToday === 0) return null;
            const maxH = Math.max(...hours.map(([, d]) => d.visits), 1);
            const currentHour = new Date().getHours();
            return (
              <div className="fb-section">
                <div className="fb-section-title" style={{ marginBottom: 20 }}>Sesiones por hora ({totalToday})</div>
                <div className="fb-hourly-wrap">
                  <div className="fb-hourly">
                    {hours.map(([h, d]) => {
                      const barH = Math.max((d.visits / maxH) * 90, d.visits > 0 ? 8 : 3);
                      const solo = d.visits - (d.subircarta || 0);
                      const sc = (d.subircarta || 0) - d.converted;
                      const conv = d.converted;
                      const total = d.visits || 1;
                      return (
                        <div key={h} className="fb-hour-col">
                          {conv > 0 && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 800 }}>{conv}</span>}
                          {d.visits > 0 && !conv && <span style={{ fontSize: 11, color: "#999", fontWeight: 700 }}>{d.visits}</span>}
                          <div className="fb-hour-bar" style={{
                            height: barH,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            border: h === currentHour ? "2px solid #F4A623" : "none",
                            boxShadow: h === currentHour ? "0 0 8px rgba(244,166,35,.3)" : "none",
                            background: d.visits === 0 ? "#1a1a1a" : undefined,
                            overflow: "hidden", position: "relative",
                          }}>
                            {d.visits > 0 && <>
                              {conv > 0 && <div style={{ flex: conv, background: "#22c55e", width: "100%" }} />}
                              <div style={{ flex: solo + sc, background: "#3b82f6", width: "100%" }} />
                            </>}
                            {d.visits > 0 && barH >= 18 && <span style={{ position: "absolute", fontSize: 11, fontWeight: 700, color: "#fff" }}>{d.visits}</span>}
                          </div>
                          {(d.subircarta || 0) > 0 ? (
                            <div style={{ width: "100%", maxWidth: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                              <div style={{ width: "60%", height: Math.max(((d.subircarta || 0) / (d.visits || 1)) * 8, 3), background: "#F4A623", borderRadius: 2 }} />
                              <span style={{ fontSize: 8, color: "#F4A623", fontWeight: 700 }}>{d.subircarta}</span>
                            </div>
                          ) : <div style={{ height: 12 }} />}
                          <span className="fb-hour-label" style={{ color: h === currentHour ? "#F4A623" : "#555", fontWeight: h === currentHour ? 800 : 400 }}>{h}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="fb-scroll-hint">desliza para ver todas las horas →</div>
              </div>
            );
          })()}

          {/* Campaign bars */}
          {sortedCampaigns.length > 0 && (() => {
            const maxVis = Math.max(...sortedCampaigns.map(([, c]) => c.visits), 1);
            return (
              <div className="fb-section">
                <div className="fb-section-title">Sesiones por campana</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sortedCampaigns.map(([name, c]) => {
                    const pct = Math.round((c.visits / maxVis) * 100);
                    const isFlashing = flashCampaigns.has(name);
                    const isNewConversion = conversionCampaigns.has(name);
                    return (
                      <div key={name}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: isNewConversion ? "#22c55e" : isFlashing ? "#6ee7b7" : "#ccc", transition: "color 1.5s" }}>{name}</span>
                          <span style={{ fontSize: 13, color: "#888" }}>{c.visits}</span>
                          {c.subircarta > 0 && <span style={{ fontSize: 13, color: "#F4A623" }}>{c.subircarta} /sc</span>}
                          {c.converted > 0 && <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>{c.converted} conv ({Math.round((c.converted / c.visits) * 100)}%)</span>}
                          <span style={{ fontSize: 13, color: "#555" }}>{fmtDuration(c.avgDuration)}</span>
                        </div>
                        {(() => {
                          const solo = c.visits - c.subircarta;
                          const sc = c.subircarta - c.converted;
                          const conv = c.converted;
                          const total = c.visits || 1;
                          return (
                            <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "#1a1a1a", width: `${pct}%`, transition: "width 1.5s cubic-bezier(.16,1,.3,1)" }}>
                              {solo > 0 && <div style={{ width: `${(solo / total) * 100}%`, background: isFlashing ? "#6ee7b7" : "#3b82f6", transition: "width 1s" }} />}
                              {sc > 0 && <div style={{ width: `${(sc / total) * 100}%`, background: "#F4A623", transition: "width 1s" }} />}
                              {conv > 0 && <div style={{ width: `${(conv / total) * 100}%`, background: isNewConversion ? "#4ade80" : "#22c55e", transition: "width 1s" }} />}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}


          {/* Sessions */}
          <div className="fb-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div className="fb-section-title" style={{ marginBottom: 0 }}>Sesiones ({sessions.length})</div>
              <div style={{ flex: 1, minWidth: 180, maxWidth: 340, position: "relative" }}>
                <input
                  type="text"
                  placeholder="Filtrar: campaña, IP, convertido, subircarta..."
                  value={sessFilter}
                  onChange={(e) => { setSessFilter(e.target.value); setSessPage(0); }}
                  style={{ width: "100%", padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #222", background: "#0a0a0a", color: "#ccc", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
                {sessFilter && (
                  <button onClick={() => { setSessFilter(""); setSessPage(0); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                )}
              </div>
            </div>
            {(() => {
              const q = sessFilter.toLowerCase().trim();
              const filtered = q ? sessions.filter((s) => {
                const ua = parseUA(s.userAgent);
                const haystack = [
                  s.utmCampaign, s.utmSource, s.utmContent, s.utmMedium,
                  s.ip, s.device, ua.browser, ua.os, ua.deviceName,
                  s.landingPage, s.exitPage, s.referrer,
                  s.bounced ? "rebote" : "", s.converted ? "convertido conversion" : "",
                  s.visitedSubircarta ? "subircarta" : "",
                  ...s.sectionsViewed,
                ].filter(Boolean).join(" ").toLowerCase();
                return haystack.includes(q);
              }) : sessions;
              const totalPages = Math.ceil(filtered.length / SESS_PER_PAGE);
              const page = Math.min(sessPage, Math.max(totalPages - 1, 0));
              const paged = filtered.slice(page * SESS_PER_PAGE, (page + 1) * SESS_PER_PAGE);

              return (<>
            {filtered.length === 0 && <div className="fb-empty">{q ? "Sin resultados para ese filtro." : "Sin datos todavia."}</div>}
            {q && filtered.length > 0 && <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</div>}
            {paged.map((s) => {
              const isExpanded = expandedSession === s.id;
              const date = new Date(s.createdAt);
              const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
              const ua = parseUA(s.userAgent);
              const isNew = newSessionIds.has(s.id);

              return (
                <div key={s.id} className={`fb-sess ${isNew ? "fb-sess-new" : ""}`}>
                  <div className="fb-sess-header" onClick={() => setExpandedSession(isExpanded ? null : s.id)}>
                    <div className="fb-sess-top">
                      <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>{dateStr}</span>
                      <span className="fb-badge" style={{
                        background: s.bounced ? "#ef44441a" : s.converted ? "#22c55e1a" : "#3b82f61a",
                        color: s.bounced ? "#ef4444" : s.converted ? "#22c55e" : "#3b82f6",
                      }}>
                        {s.bounced ? "Rebote" : s.converted ? "Convertido" : "Exploro"}
                      </span>
                      {s.visitedSubircarta && (
                        <span className="fb-badge" style={{ background: "rgba(168,85,247,.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,.2)" }}>
                          /subircarta
                        </span>
                      )}
                      <span className="fb-badge" style={{ background: "#ffffff06", color: "#888" }}>
                        {ua.os}{ua.deviceName ? ` · ${ua.deviceName}` : ""}
                      </span>
                      <span style={{ fontSize: 10, color: "#555" }}>{ua.browser}</span>
                      {s.utmCampaign && <span style={{ fontSize: 10, color: "#eab308", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{s.utmCampaign}</span>}
                      {!source && s.utmSource && <span style={{ fontSize: 10, color: "#6366f1" }}>{s.utmSource}</span>}
                    </div>
                    <div className="fb-sess-metrics">
                      <span>{fmtDuration(s.duration)}</span>
                      <span>{s.maxScroll}%</span>
                      <span>{s.interactions} int</span>
                      <span style={{ color: "#444", fontSize: 10 }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="fb-sess-detail" style={{ animation: "fbSlideIn .2s ease" }}>
                      <div className="fb-sess-grid">
                        <DetailRow label="Dispositivo" value={`${ua.deviceName || s.device || "?"} · ${ua.os}`} />
                        <DetailRow label="Navegador" value={ua.browser} />
                        <DetailRow label="IP" value={s.ip} />
                        <DetailRow label="Referrer" value={s.referrer ? (s.referrer.length > 40 ? s.referrer.slice(0, 40) + "..." : s.referrer) : "directo"} />
                        <DetailRow label="Entrada" value={s.landingPage?.split("?")[0] || "/"} />
                        {s.exitPage && <DetailRow label="Salida" value={s.exitPage} />}
                        <DetailRow label="Duracion" value={fmtDuration(s.duration)} color="#eab308" />
                        <DetailRow label="Scroll max" value={`${s.maxScroll}%`} color="#14b8a6" />
                        <DetailRow label="Interacciones" value={String(s.interactions)} color="#8b5cf6" />
                        <DetailRow label="Paginas" value={String(s.pageViews)} />
                      </div>

                      {s.sectionsViewed.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: ".05em" }}>Secciones vistas</span>
                          <div className="fb-sections-viewed">
                            {s.sectionsViewed.map((sec, i) => (
                              <span key={i} className="fb-badge" style={{ background: "#14b8a612", color: "#14b8a6", border: "1px solid #14b8a625" }}>{sec}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {s.leadId && (
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>Lead: <span style={{ color: "#22c55e", fontWeight: 700 }}>{s.leadId}</span></div>
                      )}

                      {(() => {
                        const flatEvents = (s.events as any[]).flat();
                        return (<>
                          <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Timeline ({flatEvents.length})</div>
                          <div className="fb-timeline">
                            {flatEvents.map((ev: any, i: number) => (
                              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1a1a1a", display: "flex", gap: 6, minWidth: 0 }}>
                                <span style={{ color: "#999", minWidth: 36, textAlign: "right", flexShrink: 0, fontSize: 10 }}>{typeof ev.ts === "number" ? `+${Math.round(ev.ts / 1000)}s` : ""}</span>
                                <span style={{ fontWeight: 700, minWidth: 70, flexShrink: 0, fontSize: 10,
                                  color: ev.type === "click" ? "#8b5cf6" :
                                    ev.type === "scroll_milestone" ? "#14b8a6" :
                                    ev.type === "section_view" ? "#22c55e" :
                                    ev.type === "page_load" ? "#3b82f6" :
                                    ev.type === "input_focus" ? "#eab308" :
                                    ev.type === "tab_hidden" ? "#ef4444" :
                                    ev.type === "tab_visible" ? "#84cc16" : "#666"
                                }}>
                                  {ev.type}
                                </span>
                                <span style={{ color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, fontSize: 10 }}>
                                  {ev.data ? (
                                    ev.type === "click" ? (ev.data.label || "") :
                                    ev.type === "scroll_milestone" ? `${ev.data.pct}%` :
                                    ev.type === "section_view" ? ev.data.section :
                                    ev.type === "page_load" ? ev.data.page :
                                    ev.type === "input_focus" ? `${ev.data.type || ""} ${ev.data.placeholder || ""}` :
                                    JSON.stringify(ev.data).slice(0, 80)
                                  ) : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                            {s.utmSource && <span className="fb-tag" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#777" }}>source: {s.utmSource}</span>}
                            {s.utmMedium && <span className="fb-tag" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#777" }}>medium: {s.utmMedium}</span>}
                            {s.utmCampaign && <span className="fb-tag" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#777" }}>campaign: {s.utmCampaign}</span>}
                            {s.utmContent && <span className="fb-tag" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#777" }}>content: {s.utmContent}</span>}
                          </div>
                        </>);
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Paginador */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "12px 0 4px" }}>
                <button onClick={() => setSessPage(Math.max(0, page - 1))} disabled={page === 0}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: page === 0 ? "#111" : "#222", color: page === 0 ? "#444" : "#ccc", fontSize: 12, fontWeight: 600, cursor: page === 0 ? "default" : "pointer" }}>
                  ← Ant
                </button>
                <span style={{ fontSize: 12, color: "#666" }}>{page + 1} / {totalPages}</span>
                <button onClick={() => setSessPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: page >= totalPages - 1 ? "#111" : "#222", color: page >= totalPages - 1 ? "#444" : "#ccc", fontSize: 12, fontWeight: 600, cursor: page >= totalPages - 1 ? "default" : "pointer" }}>
                  Sig →
                </button>
              </div>
            )}
              </>);
            })()}
          </div>

          {/* Logo clicks */}
          {totalLogoClicks > 0 && (
            <div className="fb-section">
              <div className="fb-section-title">Clicks en logos ({totalLogoClicks})</div>
              <div className="fb-logos">
                {Object.entries(logoClicks).sort((a, b) => b[1] - a[1]).map(([slug, count]) => (
                  <div key={slug} className="fb-logo-chip">
                    <span style={{ color: "#8b5cf6", fontWeight: 700, fontSize: 12 }}>{slug}</span>
                    <span style={{ color: "#666", fontSize: 12 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections + Clicks */}
          <div className="fb-two-col">
            <div className="fb-section">
              <div className="fb-section-title">Secciones vistas</div>
              {sortedSections.length === 0 && <div className="fb-empty">Sin datos todavia.</div>}
              {sortedSections.map(([name, count]) => {
                const pct = Math.round((count / (stats.totalSessions || 1)) * 100);
                return (
                  <div key={name} style={{ padding: "6px 0", borderBottom: "1px solid #141414" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: "#bbb" }}>{name}</span>
                      <span style={{ color: "#14b8a6", fontWeight: 700 }}>{count} <span style={{ color: "#555", fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: "#14b8a6", borderRadius: 3, transition: "width .5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="fb-section">
              <div className="fb-section-title">Elementos con click</div>
              {sortedClicks.length === 0 && <div className="fb-empty">Sin datos todavia.</div>}
              {sortedClicks.map(([label, count]) => {
                const pct = Math.round((count / (sortedClicks[0]?.[1] || 1)) * 100);
                return (
                  <div key={label} style={{ padding: "6px 0", borderBottom: "1px solid #141414" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, marginRight: 8 }}>{label}</span>
                      <span style={{ color: "#8b5cf6", fontWeight: 700, flexShrink: 0 }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#8b5cf6", borderRadius: 3, transition: "width .5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>}
      </div>
    </>
  );
}

function StatCard({ label, value, color, suffix }: { label: string; value: number | string; color?: string; suffix?: string }) {
  return (
    <div className="fb-card" style={{ borderColor: `${color}20` }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `${color}40`, borderRadius: "14px 14px 0 0" }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="fb-card-val" style={{ color: color || "#fff" }}>{value}</span>
        {suffix && <span className="fb-card-suffix">{suffix}</span>}
      </div>
      <div className="fb-card-label">{label}</div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string | null | undefined; color?: string }) {
  return (
    <div className="fb-detail-row">
      <span style={{ color: "#aaa", flexShrink: 0, fontWeight: 600 }}>{label}</span>
      <span className="fb-detail-val" style={{ color: color || "#ccc" }}>{value || "—"}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="fb-skel">
      <div className="fb-skel-row">
        <div className="fb-skel-block" />
        <div className="fb-skel-block" />
        <div className="fb-skel-block" />
        <div className="fb-skel-block" />
      </div>
      <div className="fb-skel-row">
        <div className="fb-skel-block" />
        <div className="fb-skel-block" />
        <div className="fb-skel-block" />
        <div className="fb-skel-block" />
      </div>
      <div className="fb-skel-bar" />
      <div className="fb-skel-bar" style={{ height: 120 }} />
      <div className="fb-skel-line" />
      <div className="fb-skel-line" />
      <div className="fb-skel-line" />
      <div className="fb-skel-line" />
      <div className="fb-skel-line" />
    </div>
  );
}
