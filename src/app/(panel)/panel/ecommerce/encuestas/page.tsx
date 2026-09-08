"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Save, Send, Plus, Trash2, ArrowUp, ArrowDown, Settings, ListChecks, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { parseStoreConfig, type EcommerceStoreConfig, type SurveyQuestion } from "@/lib/ecommerce/store-config";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

type RespData = {
  averages: { id: string; text: string; avg: number; count: number }[];
  responses: { id: string; orderNumber: number | null; customerName: string | null; comment: string | null; createdAt: string; answers: { id: string; text: string; v: number }[] }[];
  total: number;
};

export default function EncuestasPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [cfg, setCfg] = useState<EcommerceStoreConfig>(() => parseStoreConfig(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"config" | "preguntas" | "respuestas">("config");
  const [newQ, setNewQ] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [resp, setResp] = useState<RespData | null>(null);

  const survey = cfg.survey;

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) setCfg(d.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const loadResponses = useCallback(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/survey/responses?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setResp(d); })
      .catch(() => {});
  }, [restaurantId]);

  useEffect(() => { loadResponses(); }, [loadResponses]);

  // Guarda el config completo (con la encuesta editada) vía el endpoint de settings.
  const saveNow = useCallback(async (nextCfg: EcommerceStoreConfig, quiet = false) => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: nextCfg }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); return; }
      setCfg(data.config);
      if (!quiet) toast.success("Guardado");
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  }, [restaurantId]);

  const setSurvey = (patch: Partial<EcommerceStoreConfig["survey"]>) => setCfg((c) => ({ ...c, survey: { ...c.survey, ...patch } }));
  const setQuestions = (questions: SurveyQuestion[], persist = true) => {
    const next = { ...cfg, survey: { ...cfg.survey, questions } };
    setCfg(next);
    if (persist) saveNow(next, true);
  };

  function addQuestion() {
    const text = newQ.trim();
    if (!text) return;
    const q: SurveyQuestion = { id: `s_${Math.random().toString(36).slice(2, 10)}`, text: text.slice(0, 160), active: true };
    setQuestions([...survey.questions, q]);
    setNewQ("");
  }
  function delQuestion(id: string) { setQuestions(survey.questions.filter((q) => q.id !== id)); }
  function toggleQuestion(id: string) { setQuestions(survey.questions.map((q) => (q.id === id ? { ...q, active: !q.active } : q))); }
  function move(id: string, dir: -1 | 1) {
    const arr = [...survey.questions];
    const i = arr.findIndex((q) => q.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setQuestions(arr);
  }

  async function sendTest() {
    if (!restaurantId || !testEmail.trim() || testing) return;
    setTesting(true);
    try {
      const res = await fetch("/api/panel/ecommerce/survey/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, email: testEmail.trim() }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo enviar"); return; }
      toast.success("Encuesta de prueba enviada");
      setTestEmail("");
    } catch { toast.error("Error de conexión"); }
    finally { setTesting(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Star size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Encuestas de satisfacción</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Pide a tus clientes que califiquen su pedido, por correo, tras la entrega.</p>
        </div>
      </div>

      {!loading && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 18, marginBottom: 4 }}>
          <Tab active={tab === "config"} onClick={() => setTab("config")} icon={Settings} label="Configuración" />
          <Tab active={tab === "preguntas"} onClick={() => setTab("preguntas")} icon={ListChecks} label="Preguntas" />
          <Tab active={tab === "respuestas"} onClick={() => { setTab("respuestas"); loadResponses(); }} icon={BarChart3} label={`Respuestas${resp ? ` (${resp.total})` : ""}`} />
        </div>
      )}

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {/* ── Configuración ── */}
          {tab === "config" && (
          <>
            <section style={card}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={survey.enabled} onChange={(e) => setSurvey({ enabled: e.target.checked })} style={{ width: 18, height: 18, accentColor: ACCENT }} />
                <span style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)" }}>Activar envío automático de encuestas</span>
              </label>

              <div style={{ marginTop: 16 }}>
                <FieldLabel>Enviar la encuesta cuántas horas después del pedido</FieldLabel>
                <input type="number" min={0} value={survey.hoursAfter} onChange={(e) => setSurvey({ hoursAfter: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  style={{ ...input, width: 120 }} />
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>Se envía solo a pedidos con estado <b>Entregado</b> y que tengan correo.</p>
              </div>

              <div style={{ marginTop: 16 }}>
                <FieldLabel>Asunto del correo</FieldLabel>
                <input value={survey.subject} onChange={(e) => setSurvey({ subject: e.target.value })} style={input} />
              </div>

              <div style={{ marginTop: 16 }}>
                <FieldLabel>Texto de introducción</FieldLabel>
                <textarea value={survey.intro} onChange={(e) => setSurvey({ intro: e.target.value })} rows={3} style={{ ...input, resize: "vertical" }} />
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0", lineHeight: 1.5 }}>
                  Variables disponibles en el asunto y los textos: <code>{"{nombre}"}</code> (primer nombre del cliente) · <code>{"{local}"}</code> (nombre del local).
                </p>
              </div>

              <div style={{ marginTop: 16 }}>
                <FieldLabel>Mensaje de agradecimiento (tras responder)</FieldLabel>
                <input value={survey.thankYou} onChange={(e) => setSurvey({ thankYou: e.target.value })} style={input} />
              </div>

              <button onClick={() => saveNow(cfg)} disabled={saving} style={{ ...btn(ACCENT), marginTop: 20, opacity: saving ? 0.5 : 1 }}>
                <Save size={16} /> {saving ? "Guardando…" : "Guardar configuración"}
              </button>
            </section>

            <section style={card}>
              <FieldLabel>Enviar encuesta de prueba a un correo</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" inputMode="email" style={{ ...input, flex: 1 }} />
                <button onClick={sendTest} disabled={testing || !testEmail.trim()} style={{ ...btn("var(--adm-text)"), background: "var(--adm-hover)", color: "var(--adm-text)", border: "1px solid var(--adm-card-border)", opacity: testing || !testEmail.trim() ? 0.5 : 1, flexShrink: 0 }}>
                  <Send size={15} /> {testing ? "Enviando…" : "Enviar prueba"}
                </button>
              </div>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>Usa las preguntas activas actuales. No requiere un pedido real y no cuenta en las respuestas.</p>
            </section>
          </>
          )}

          {/* ── Preguntas ── */}
          {tab === "preguntas" && (
          <section style={card}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newQ} onChange={(e) => setNewQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuestion()} placeholder="Nueva pregunta (ej: ¿Cómo calificas la rapidez de la entrega?)" style={{ ...input, flex: 1 }} />
              <button onClick={addQuestion} disabled={!newQ.trim()} style={{ ...btn(ACCENT), flexShrink: 0, opacity: newQ.trim() ? 1 : 0.5 }}><Plus size={16} /> Agregar</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {survey.questions.map((q, i) => (
                <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => move(q.id, -1)} disabled={i === 0} style={arrowBtn(i === 0)}><ArrowUp size={13} /></button>
                    <button onClick={() => move(q.id, 1)} disabled={i === survey.questions.length - 1} style={arrowBtn(i === survey.questions.length - 1)}><ArrowDown size={13} /></button>
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 800, color: "var(--adm-text3)", width: 16, textAlign: "center" }}>{i + 1}</span>
                  <span style={{ flex: 1, fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text)" }}>{q.text}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
                    <input type="checkbox" checked={q.active} onChange={() => toggleQuestion(q.id)} style={{ width: 16, height: 16, accentColor: ACCENT }} />
                    <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)" }}>Activa</span>
                  </label>
                  <button onClick={() => delQuestion(q.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", flexShrink: 0 }}><Trash2 size={16} /></button>
                </div>
              ))}
              {survey.questions.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>Agrega al menos una pregunta.</p>}
            </div>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "12px 0 0" }}>Usa ⬆⬇ para reordenar. Todas se califican del 1 (malo) al 5 (excelente). Los cambios se guardan solos.</p>
          </section>
          )}

          {/* ── Respuestas ── */}
          {tab === "respuestas" && (
          <>
            {!resp ? (
              <p style={{ fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</p>
            ) : resp.total === 0 ? (
              <section style={card}><p style={{ fontFamily: FB, color: "var(--adm-text3)", margin: 0 }}>Aún no hay respuestas. Cuando tus clientes califiquen sus pedidos, aparecerán aquí.</p></section>
            ) : (
              <>
                <section style={card}>
                  <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--adm-text3)", margin: "0 0 12px" }}>Promedio por pregunta</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {resp.averages.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text)" }}>{a.text}</span>
                        <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Star size={15} color="#f5b301" fill="#f5b301" /> {a.count ? a.avg.toFixed(1) : "—"} <span style={{ color: "var(--adm-text3)", fontWeight: 600 }}>({a.count})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {resp.responses.map((r) => (
                  <section key={r.id} style={card}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)" }}>
                        {r.customerName || "Cliente"} {r.orderNumber != null && <span style={{ color: "var(--adm-text3)", fontWeight: 600 }}>· #{r.orderNumber}</span>}
                      </span>
                      <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{new Date(r.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 8 }}>
                      {r.answers.map((a) => (
                        <span key={a.id} style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)" }}>
                          {a.text}: <b style={{ color: "var(--adm-text)" }}>{a.v}</b> <Star size={12} color="#f5b301" fill="#f5b301" style={{ verticalAlign: "-1px" }} />
                        </span>
                      ))}
                    </div>
                    {r.comment && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", fontStyle: "italic", margin: "10px 0 0", padding: "8px 12px", background: "var(--adm-hover)", borderRadius: 10 }}>&ldquo;{r.comment}&rdquo;</p>}
                  </section>
                ))}
              </>
            )}
          </>
          )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 18 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none" };
const btn = (bg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: bg, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" });
const arrowBtn = (disabled: boolean): React.CSSProperties => ({ display: "grid", placeItems: "center", width: 20, height: 16, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer", color: "var(--adm-text3)", opacity: disabled ? 0.4 : 1, padding: 0 });

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: "var(--adm-text)", marginBottom: 6 }}>{children}</label>;
}
function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, cursor: "pointer", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, border: `1px solid ${active ? ACCENT : "var(--adm-card-border)"}`, background: active ? `${ACCENT}1a` : "transparent", color: active ? ACCENT : "var(--adm-text2)" }}>
      <Icon size={15} /> {label}
    </button>
  );
}
