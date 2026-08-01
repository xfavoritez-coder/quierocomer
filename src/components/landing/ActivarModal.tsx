"use client";

import { useState } from "react";
import { trackPurchase } from "@/lib/metaPixel";
import { useLandingLang } from "@/lib/i18n/landing";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ActivarModal({ open, onClose }: Props) {
  const { t } = useLandingLang();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({ ownerName: "", localName: "", email: "", whatsapp: "" });

  const close = () => {
    onClose();
    setFormData({ ownerName: "", localName: "", email: "", whatsapp: "" });
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/activar/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      trackPurchase("PREMIUM", 49900);
      try {
        sessionStorage.setItem("qc_welcome", JSON.stringify({
          localName: data.localName || formData.localName,
          ownerName: data.ownerName || formData.ownerName,
          email: data.email || formData.email,
          password: data.generatedPassword || "",
          autoLoginUrl: data.autoLoginUrl || "",
          slug: data.slug || "",
        }));
      } catch {}
      window.location.href = "/bienvenida";
    } catch (err) {
      setFormError((err as Error).message || "Ocurrió un error, intenta de nuevo.");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        .qc-modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: qcFadeIn .2s ease;
        }
        @keyframes qcFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .qc-modal-card {
          background: white; border-radius: 20px;
          width: 100%; max-width: 440px; padding: 36px 32px;
          position: relative; animation: qcSlideUp .25s ease;
          font-family: 'Instrument Sans', system-ui, sans-serif;
        }
        @keyframes qcSlideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .qc-modal-close {
          position: absolute; top: 16px; right: 16px;
          background: #F5F5F3; border: none; border-radius: 50%;
          width: 32px; height: 32px; font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #71716C; transition: background .2s; line-height: 1;
        }
        .qc-modal-close:hover { background: #EBEBEA; color: #111; }
        .qc-modal-emoji { font-size: 32px; margin-bottom: 10px; display: block; text-align: center; }
        .qc-modal-title { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 4px; text-align: center; }
        .qc-modal-sub { font-size: 14px; color: #71716C; margin-bottom: 28px; text-align: center; }
        .qc-form-group { margin-bottom: 16px; }
        .qc-form-label { display: block; font-size: 13px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .qc-form-input {
          width: 100%; padding: 11px 14px;
          border: 1.5px solid #DDDDD8; border-radius: 10px;
          font-size: 15px; font-family: inherit; color: #111;
          background: white; transition: border-color .2s; outline: none;
        }
        .qc-form-input:focus { border-color: #F59E1B; }
        .qc-form-input::placeholder { color: #B8B8B2; }
        .qc-btn-submit {
          width: 100%; padding: 14px;
          background: #F59E1B; color: white;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: background .2s; margin-top: 8px;
        }
        .qc-btn-submit:hover:not(:disabled) { background: #E08D0C; }
        .qc-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        .qc-form-error { font-size: 13px; color: #DC2626; background: #FEF2F2; border-radius: 8px; padding: 10px 14px; margin-top: 10px; }
        .qc-phone-group { display: flex; border: 1.5px solid #DDDDD8; border-radius: 10px; overflow: hidden; transition: border-color .2s; }
        .qc-phone-group:focus-within { border-color: #F59E1B; }
        .qc-phone-prefix { display: flex; align-items: center; gap: 6px; padding: 0 12px; background: #F5F5F3; border-right: 1.5px solid #DDDDD8; font-size: 13px; font-weight: 600; color: #444; white-space: nowrap; flex-shrink: 0; }
        .qc-phone-group .qc-form-input { border: none; border-radius: 0; }
        .qc-phone-group .qc-form-input:focus { border-color: transparent; }
        @media (max-width: 480px) { .qc-modal-card { padding: 28px 20px; } }
      `}</style>
      <div className="qc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="qc-modal-card">
        <button className="qc-modal-close" onClick={close} aria-label="Cerrar">×</button>
        <span className="qc-modal-emoji">✨</span>
        <h2 className="qc-modal-title">{t("modal_title")}</h2>
        <p className="qc-modal-sub">{t("modal_subtitle")}</p>
        <form onSubmit={handleSubmit}>
          <div className="qc-form-group">
            <label className="qc-form-label">{t("form_owner")}</label>
            <input
              className="qc-form-input"
              type="text"
              placeholder={t("form_owner_ph")}
              value={formData.ownerName}
              onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="qc-form-group">
            <label className="qc-form-label">{t("form_local")}</label>
            <input
              className="qc-form-input"
              type="text"
              placeholder={t("form_local_ph")}
              value={formData.localName}
              onChange={(e) => setFormData({ ...formData, localName: e.target.value })}
              required
            />
          </div>
          <div className="qc-form-group">
            <label className="qc-form-label">{t("form_email")}</label>
            <input
              className="qc-form-input"
              type="email"
              placeholder={t("form_email_ph")}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="qc-form-group">
            <label className="qc-form-label">{t("form_whatsapp")}</label>
            <div className="qc-phone-group">
              <span className="qc-phone-prefix">
                <svg width="18" height="13" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
                  <rect width="20" height="7" fill="#fff" />
                  <rect y="7" width="20" height="7" fill="#D52B1E" />
                  <rect width="7" height="7" fill="#0039A6" />
                  <polygon points="3.5,1.5 4.1,3.3 6,3.3 4.5,4.4 5,6.2 3.5,5.1 2,6.2 2.5,4.4 1,3.3 2.9,3.3" fill="#fff" />
                </svg>
                +56
              </span>
              <input
                className="qc-form-input"
                type="tel"
                placeholder={t("form_whatsapp_ph")}
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              />
            </div>
          </div>
          {formError && <div className="qc-form-error">{formError}</div>}
          <button className="qc-btn-submit" type="submit" disabled={submitting}>
            {submitting ? t("form_loading") : t("form_submit")}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
