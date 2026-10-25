"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { parseStoreConfig, type EcommerceStoreConfig } from "@/lib/ecommerce/store-config";
import { buildPrintAgentInstaller, buildPrintAgentUninstaller } from "@/lib/ecommerce/printAgentScript";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
// Driver genérico de impresoras térmicas POS (Windows).
const POS_DRIVER_URL = "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/drivers/diver-generico-pos.exe";

const selStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box" };
const lblStyle: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 6 };

/** Configuración de impresión de comandas (impresora térmica / agente local ESC/POS). */
export default function ImpresionConfig({ restaurantId, storeName }: { restaurantId?: string; storeName?: string }) {
  const [cfg, setCfg] = useState<EcommerceStoreConfig>(() => parseStoreConfig(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) setCfg(d.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const patch = (p: Partial<EcommerceStoreConfig>) => setCfg((c) => ({ ...c, ...p }));

  async function saveCfg(next: EcommerceStoreConfig, okMsg = "Guardado") {
    if (!restaurantId) return;
    try {
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: next }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo guardar"); return; }
      setCfg(data.config);
      if (okMsg) toast.success(okMsg);
    } catch { toast.error("Error de conexión"); }
  }
  // Aplica un cambio y lo guarda de inmediato (selects); los text inputs guardan en blur.
  const patchAndSave = (p: Partial<EcommerceStoreConfig>) => { const next = { ...cfg, ...p }; setCfg(next); saveCfg(next); };
  const saveNow = () => saveCfg(cfg);

  async function generatePrintToken() {
    if (!restaurantId) return;
    const rnd = (globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
    const next = { ...cfg, printToken: rnd, printTokenAt: new Date().toISOString() };
    setCfg(next);
    await saveCfg(next, "Token generado");
  }

  const fileSlug = (storeName || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "local";

  function downloadFile(content: string, name: string) {
    const blob = new Blob([content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function downloadAgent() {
    if (!cfg.printToken) return;
    const base = typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com";
    downloadFile(buildPrintAgentInstaller(cfg.printToken, base, storeName || ""), `instalar-agente-${fileSlug}.bat`);
  }
  function downloadUninstaller() {
    downloadFile(buildPrintAgentUninstaller(cfg.printToken || undefined), `desinstalar-agente-${fileSlug}.bat`);
  }
  async function testPrint() {
    if (!restaurantId || !cfg.printToken) return;
    const next = { ...cfg, printTestAt: new Date().toISOString() };
    setCfg(next);
    await saveCfg(next, "Prueba enviada — sale en unos segundos si el agente está corriendo");
  }

  if (loading) return <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 30, textAlign: "center" }}>Cargando…</p>;

  return (
    <section style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Printer size={18} color={ACCENT} /></div>
        <div>
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Impresión de comandas</h2>
          <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0", lineHeight: 1.45 }}>Imprime un ticket con cada pedido en tu impresora térmica: por navegador o con el agente local (ESC/POS, sin navegador y con corte automático).</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
        <label style={{ display: "block" }}>
          <span style={lblStyle}>Modo de impresión</span>
          <select value={cfg.printMode} onChange={(e) => patchAndSave({ printMode: e.target.value as "off" | "manual" | "auto" })} style={selStyle}>
            <option value="off">Desactivada</option>
            <option value="manual">Manual (botón en cada pedido)</option>
            <option value="auto">Automática (imprime al llegar el pedido)</option>
          </select>
        </label>
        <label style={{ display: "block" }}>
          <span style={lblStyle}>Ancho del papel</span>
          <select value={cfg.printPaperWidth} onChange={(e) => patchAndSave({ printPaperWidth: Number(e.target.value) === 58 ? 58 : 80 })} style={selStyle}>
            <option value={80}>80 mm (estándar)</option>
            <option value={58}>58 mm (chica)</option>
          </select>
        </label>
        <label style={{ display: "block" }}>
          <span style={lblStyle}>Copias por comanda</span>
          <select value={cfg.printCopies} onChange={(e) => patchAndSave({ printCopies: Number(e.target.value) === 2 ? 2 : 1 })} style={selStyle}>
            <option value={1}>1 copia</option>
            <option value={2}>2 copias (imprime la comanda dos veces)</option>
          </select>
          <span style={{ display: "block", fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 5, lineHeight: 1.45 }}>Útil para dejar una copia en cocina y otra para el repartidor o la boleta.</span>
        </label>

        {cfg.printMode === "auto" && (
          <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Automática por navegador (sin instalar nada)</p>
            <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
              Abre esta misma pantalla de <strong>Pedidos</strong> en el equipo del local con Chrome en modo kiosco (<code>--kiosk-printing</code>) y déjala abierta. Si prefieres imprimir sin navegador, usa el <strong>agente local</strong> de abajo.
            </p>
          </div>
        )}

        {/* Agente de impresión local (ESC/POS) */}
        <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Agente de impresión local (ESC/POS)</p>
          <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
            Imprime directo en la térmica <strong>sin navegador</strong>, con corte automático. Respeta el <strong>Modo de impresión</strong> de arriba: en <strong>Automática</strong> imprime cada pedido nuevo al instante; en <strong>Manual</strong> o <strong>Desactivada</strong> NO auto-imprime y solo imprime cuando tocas <strong>Imprimir comanda</strong> en Pedidos.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "block" }}>
              <span style={lblStyle}>Impresora del agente</span>
              <select value={cfg.printTarget} onChange={(e) => patchAndSave({ printTarget: e.target.value as "default" | "name" | "ip" })} style={selStyle}>
                <option value="default">Predeterminada de Windows</option>
                <option value="name">Por nombre exacto</option>
                <option value="ip">Por IP de red (directo, sin driver)</option>
              </select>
            </label>
            {cfg.printTarget === "name" && (
              <input type="text" value={cfg.printerName || ""} onChange={(e) => patch({ printerName: e.target.value })} onBlur={saveNow} placeholder="Nombre exacto, ej: POS-80" style={selStyle} />
            )}
            {cfg.printTarget === "ip" && (
              <>
                <input type="text" value={cfg.printerIp || ""} onChange={(e) => patch({ printerIp: e.target.value })} onBlur={saveNow} placeholder="IP de la impresora, ej: 192.168.1.50" style={selStyle} />
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
                  La impresora debe tener <strong>IP fija</strong> y aceptar ESC/POS por el puerto <strong>9100</strong> (RAW/JetDirect, lo normal en térmicas de red). Si usa otro puerto, ponlo así: <code>192.168.1.50:9100</code>. No necesita driver.
                </p>
              </>
            )}
          </div>

          {cfg.printToken ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "8px 10px" }}>
                <code style={{ flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: "0.72rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.printToken}</code>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(cfg.printToken || "").then(() => toast.success("Token copiado")).catch(() => {}); }} style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>Copiar</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={downloadAgent} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  <Printer size={15} /> Descargar instalador (Windows)
                </button>
                <a href={POS_DRIVER_URL} download style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                  <Printer size={15} /> Descargar driver de impresora
                </a>
                <button type="button" onClick={testPrint} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>Imprimir de prueba</button>
                <button type="button" onClick={generatePrintToken} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>Regenerar token</button>
              </div>
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.55 }}>
                <strong>Driver de impresora:</strong> si la impresora térmica es nueva en ese Windows, instala primero el <strong>driver</strong> (se instala una vez) y asegúrate de que el nombre que le quede en Windows coincida con el de <em>Impresora del agente</em> (ej: <code>POS-80</code>). Luego instala el agente.
              </p>
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.55 }}>
                Guarda el archivo <code>instalar-agente-{fileSlug}.bat</code> en la PC Windows y <strong>haz doble clic</strong> (si aparece un aviso de Windows: <em>Más información → Ejecutar de todas formas</em>). El instalador crea el agente, lo deja corriendo <strong>junto al reloj</strong> y hace que <strong>arranque solo con Windows</strong>. Clic derecho en el ícono → <em>Imprimir prueba local</em>, <em>Desinstalar este agente</em> o <em>Salir</em>. Regenera el token si crees que se filtró (invalida el anterior).
              </p>
              <button type="button" onClick={downloadUninstaller} style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "transparent", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                Descargar desinstalador (quita el agente del equipo Windows)
              </button>
            </>
          ) : (
            <button type="button" onClick={generatePrintToken} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              Generar token del agente
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
