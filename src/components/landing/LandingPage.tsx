"use client";
import { useState } from "react";
import Link from "next/link";
import { trackPurchase } from "@/lib/metaPixel";

const RESTAURANTS = [
  { name: "Hand Roll", url: "https://quierocomer.com/qr/hand-roll", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png" },
  { name: "Horus Vegan", url: "https://quierocomer.com/qr/horusvegan", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/horusvegan/logo.png" },
  { name: "Juana la Brava", url: "https://quierocomer.com/qr/juana-la-brava", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779212065016-vn71iczuzue.jpg" },
  { name: "Alleria Pizza", url: "https://quierocomer.com/qr/alleria-pizza", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777477859043-9ibluljyt89.png" },
  { name: "Nascosto Pizzeria", url: "https://quierocomer.com/qr/nascosto-pizzeria", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777586747684-596ypo9g4nu.png" },
  { name: "El Menú de la Esquina", url: "https://quierocomer.com/qr/el-menu-de-la-esquina", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779594834786-i3nhsddtw68.png" },
  { name: "Ceviche a lo Tigre", url: "https://quierocomer.com/qr/ceviche-a-lo-tigre", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1780810063195-17i4btgndfu.webp" },
  { name: "Guffsushi Nikkei", url: "https://quierocomer.com/qr/guffsushi", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781291439973-bzmbjnjzwo.webp" },
];

const TESTIMONIALS = [
  { quote: "Nuestra carta pasó a antojarse de verdad. El primer mes ya notamos más pedidos por mesa.", name: "María G.", restaurant: "Hand Roll", initials: "MG" },
  { quote: "El módulo Loyalty hizo que clientes regulares pasen de venir mensual a semanal. No lo pensé tanto.", name: "Andrés V.", restaurant: "Horus Vegan", initials: "AV" },
  { quote: "Lo configuré en una tarde. Al día siguiente la carta QR ya andaba con fotos y el menú actualizado.", name: "Tomás L.", restaurant: "Alleria Pizza", initials: "TL" },
  { quote: "Las estadísticas me mostraron cuándo llega más gente y qué piden. Cambié el menú del día y vendí el doble.", name: "Felipe R.", restaurant: "Juana la Brava", initials: "FR" },
  { quote: "Crecer un 30% sonaba a marketing hasta que lo viví. La carta digital marcó la diferencia.", name: "Daniela P.", restaurant: "El Menú de la Esquina", initials: "DP" },
];

const PRO_FEATURES = [
  "Carta QR con fotos y categorías",
  "Estadísticas de qué se ve y cuándo",
  "Llamado al garzón por QR",
  "Anuncios y promociones en la carta",
  "Pedidos online sin comisión",
  "Multi-idioma automático",
];

const LOYALTY_FEATURES = [
  "Tarjeta digital en Apple Wallet y Google Wallet",
  "Sellos por visita configurables",
  "Premios y recompensas propias",
  "Notificaciones push de cercanía",
  "Panel de miembros y canjes",
  "Link propio de tu programa",
];

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formStep, setFormStep] = useState<"form" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({ ownerName: "", localName: "", email: "", whatsapp: "" });
  const [registeredSlug, setRegisteredSlug] = useState("");

  const openModal = () => { setModalOpen(true); setFormStep("form"); setFormError(""); };
  const closeModal = () => { setModalOpen(false); setFormStep("form"); setFormData({ ownerName: "", localName: "", email: "", whatsapp: "" }); };

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
      setRegisteredSlug(data.slug || "");
      setFormStep("success");
    } catch (err) {
      setFormError((err as Error).message || "Ocurrió un error, intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        :root {
          --blanco: #FFFFFF;
          --tinta: #111111;
          --gris: #71716C;
          --gris-claro: #A8A8A2;
          --ambar: #F59E1B;
          --ambar-hover: #E08D0C;
          --ambar-tinta: #8F5A05;
          --ambar-fondo: #FFF7EA;
          --linea: #ECECEA;
          --purpura: #6d28d9;
          font-family: 'Instrument Sans', sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Instrument Sans', sans-serif; }

        .qc-landing { font-family: 'Instrument Sans', sans-serif; color: var(--tinta); background: var(--blanco); }

        /* NAV */
        .qc-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--linea);
          padding: 0 24px;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .qc-nav-inner { max-width: 1200px; width: 100%; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .qc-logo { font-size: 18px; font-weight: 700; color: var(--tinta); text-decoration: none; letter-spacing: -0.02em; }
        .qc-logo span { color: var(--ambar); }
        .qc-nav-links { display: flex; align-items: center; gap: 28px; }
        .qc-nav-link { font-size: 14px; color: var(--gris); text-decoration: none; font-weight: 500; transition: color .2s; }
        .qc-nav-link:hover { color: var(--tinta); }
        .qc-nav-actions { display: flex; align-items: center; gap: 10px; }
        .qc-btn-ghost { font-size: 14px; font-weight: 500; color: var(--tinta); text-decoration: none; padding: 8px 16px; border: 1.5px solid var(--linea); border-radius: 8px; transition: border-color .2s, background .2s; background: transparent; cursor: pointer; font-family: inherit; }
        .qc-btn-ghost:hover { border-color: #ccc; background: #f5f5f5; }
        .qc-btn-ambar { font-size: 14px; font-weight: 600; color: #fff; background: var(--ambar); border: none; border-radius: 8px; padding: 8px 18px; cursor: pointer; transition: background .2s; font-family: inherit; text-decoration: none; display: inline-block; }
        .qc-btn-ambar:hover { background: var(--ambar-hover); }
        .qc-btn-ambar-lg { font-size: 16px; font-weight: 700; padding: 14px 32px; border-radius: 12px; }
        .qc-btn-ambar-xl { font-size: 17px; font-weight: 700; padding: 16px 36px; border-radius: 12px; }

        /* HERO */
        .qc-hero {
          padding: 96px 24px 80px;
          text-align: center;
          background: linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%);
        }
        .qc-hero-inner { max-width: 760px; margin: 0 auto; }
        .qc-label {
          display: inline-block;
          font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ambar-tinta); background: var(--ambar-fondo);
          border-radius: 100px; padding: 5px 14px; margin-bottom: 24px;
        }
        .qc-hero h1 {
          font-size: clamp(36px, 6vw, 64px); font-weight: 700; color: var(--tinta);
          line-height: 1.08; letter-spacing: -0.03em; margin-bottom: 20px;
        }
        .qc-hero-sub { font-size: 18px; color: var(--gris); line-height: 1.6; margin-bottom: 36px; max-width: 560px; margin-left: auto; margin-right: auto; }
        .qc-hero-cta { display: flex; gap: 14px; justify-content: center; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
        .qc-link-ghost { font-size: 15px; font-weight: 600; color: var(--tinta); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; padding: 14px 24px; border-radius: 12px; border: 1.5px solid var(--linea); transition: border-color .2s, background .2s; }
        .qc-link-ghost:hover { border-color: #bbb; background: #fafafa; }
        .qc-hero-note { font-size: 13px; color: var(--gris-claro); }

        /* MODULOS */
        .qc-section { padding: 80px 24px; }
        .qc-section-inner { max-width: 1200px; margin: 0 auto; }
        .qc-section-title { font-size: clamp(24px, 4vw, 38px); font-weight: 700; color: var(--tinta); letter-spacing: -0.02em; margin-bottom: 8px; }
        .qc-section-sub { font-size: 16px; color: var(--gris); margin-bottom: 48px; line-height: 1.5; }

        .qc-modulos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 768px) { .qc-modulos-grid { grid-template-columns: 1fr; } }

        .qc-card { border-radius: 20px; overflow: hidden; padding: 40px; position: relative; }
        .qc-card-amber { background: var(--ambar-fondo); border: 1.5px solid rgba(245,158,27,0.2); }
        .qc-card-light { background: #F7F7F5; border: 1.5px solid var(--linea); }

        .qc-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 100px; padding: 4px 12px; margin-bottom: 18px; }
        .qc-badge-amber { background: var(--ambar); color: #fff; }
        .qc-badge-dark { background: var(--tinta); color: #fff; }
        .qc-badge-purple { background: var(--purpura); color: #fff; }

        .qc-card h2 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: var(--tinta); margin-bottom: 12px; }
        .qc-card p { font-size: 15px; color: var(--gris); line-height: 1.65; margin-bottom: 28px; }
        .qc-card-btns { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 32px; }

        .qc-btn-outline { font-size: 14px; font-weight: 600; color: var(--tinta); text-decoration: none; border: 1.5px solid rgba(0,0,0,0.2); border-radius: 8px; padding: 9px 18px; transition: border-color .2s, background .2s; background: transparent; cursor: pointer; font-family: inherit; display: inline-block; }
        .qc-btn-outline:hover { border-color: var(--tinta); background: rgba(0,0,0,0.04); }

        /* Carta mock */
        .qc-carta-mock {
          background: #fff; border-radius: 16px; padding: 20px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
          max-width: 260px;
        }
        .qc-carta-mock-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .qc-carta-logo { width: 36px; height: 36px; border-radius: 10px; background: var(--ambar); display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .qc-carta-mock-header h4 { font-size: 14px; font-weight: 700; color: var(--tinta); }
        .qc-carta-mock-header p { font-size: 11px; color: var(--gris); }
        .qc-dish-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F0F0EE; }
        .qc-dish-row:last-child { border-bottom: none; }
        .qc-dish-img { width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, #FFE4B5 0%, #FFC97A 100%); flex-shrink: 0; }
        .qc-dish-info h5 { font-size: 13px; font-weight: 600; color: var(--tinta); margin-bottom: 2px; }
        .qc-dish-info p { font-size: 11px; color: var(--gris); margin: 0; }
        .qc-dish-price { font-size: 13px; font-weight: 700; color: var(--ambar-tinta); margin-left: auto; flex-shrink: 0; }

        /* Loyalty mock */
        .qc-loyalty-mock {
          background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%);
          border-radius: 16px; padding: 20px;
          box-shadow: 0 8px 40px rgba(109,40,217,0.25);
          max-width: 260px; color: white;
        }
        .qc-loyalty-mock-header { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-bottom: 6px; }
        .qc-loyalty-mock h4 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
        .qc-stamps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
        .qc-stamp { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .qc-stamp-filled { background: rgba(255,255,255,0.9); }
        .qc-stamp-empty { border: 2px dashed rgba(255,255,255,0.3); }
        .qc-loyalty-mock-footer { font-size: 11px; opacity: 0.6; text-align: center; }

        /* RESTAURANTES */
        .qc-rest-section { padding: 64px 24px; background: #FAFAF8; }
        .qc-rest-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .qc-rest-tile {
          display: flex; align-items: center; gap: 10px;
          background: white; border: 1.5px solid var(--linea);
          border-radius: 12px; padding: 10px 16px;
          text-decoration: none; color: var(--tinta);
          transition: border-color .2s, box-shadow .2s;
          font-size: 14px; font-weight: 500;
        }
        .qc-rest-tile:hover { border-color: #bbb; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .qc-rest-tile img { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; background: var(--linea); }

        /* TESTIMONIOS */
        .qc-testimonios-scroll { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 8px; }
        .qc-testimonios-scroll::-webkit-scrollbar { display: none; }
        .qc-test-card { background: #FAFAF8; border: 1.5px solid var(--linea); border-radius: 16px; padding: 28px; min-width: 300px; max-width: 340px; flex-shrink: 0; scroll-snap-align: start; }
        .qc-stars { color: var(--ambar); font-size: 16px; letter-spacing: 2px; margin-bottom: 14px; }
        .qc-test-quote { font-size: 15px; line-height: 1.65; color: var(--tinta); margin-bottom: 20px; font-style: italic; }
        .qc-test-author { display: flex; align-items: center; gap: 12px; }
        .qc-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--ambar); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; }
        .qc-test-author-info strong { display: block; font-size: 14px; font-weight: 600; color: var(--tinta); }
        .qc-test-author-info span { font-size: 13px; color: var(--gris); }

        /* PRECIOS */
        .qc-precios-section { padding: 80px 24px; background: white; }
        .qc-precios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 840px; margin: 0 auto; }
        @media (max-width: 680px) { .qc-precios-grid { grid-template-columns: 1fr; } }
        .qc-precio-card { border-radius: 20px; padding: 36px; border: 2px solid var(--linea); }
        .qc-precio-card-featured { border-color: var(--ambar); background: var(--ambar-fondo); }
        .qc-precio-card-purple { border-color: var(--purpura); background: #FAF5FF; }
        .qc-precio-name { font-size: 22px; font-weight: 700; color: var(--tinta); margin-bottom: 6px; }
        .qc-precio-price { font-size: 36px; font-weight: 700; color: var(--tinta); letter-spacing: -0.02em; margin-bottom: 2px; }
        .qc-precio-sub { font-size: 13px; color: var(--gris); margin-bottom: 28px; }
        .qc-feature-list { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 10px; }
        .qc-feature-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--tinta); line-height: 1.5; }
        .qc-check { color: var(--ambar); font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .qc-check-purple { color: var(--purpura); font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .qc-precio-note { font-size: 12px; color: var(--gris); margin-bottom: 20px; font-style: italic; }
        .qc-btn-purple { font-size: 15px; font-weight: 600; color: #fff; background: var(--purpura); border: none; border-radius: 10px; padding: 13px 24px; cursor: pointer; font-family: inherit; width: 100%; transition: opacity .2s; }
        .qc-btn-purple:hover { opacity: 0.88; }

        /* CTA FINAL */
        .qc-cta-final { padding: 64px 24px; }
        .qc-cta-final-card {
          max-width: 680px; margin: 0 auto; background: #111;
          border-radius: 24px; padding: 56px 40px; text-align: center;
        }
        .qc-cta-final-card h2 { font-size: clamp(26px, 4vw, 40px); font-weight: 700; color: #fff; letter-spacing: -0.02em; margin-bottom: 12px; }
        .qc-cta-final-card p { font-size: 16px; color: rgba(255,255,255,0.65); margin-bottom: 32px; line-height: 1.55; }
        .qc-btn-white { font-size: 16px; font-weight: 700; color: #111; background: var(--ambar); border: none; border-radius: 12px; padding: 15px 36px; cursor: pointer; font-family: inherit; transition: opacity .2s; }
        .qc-btn-white:hover { opacity: 0.9; }
        .qc-cta-note { font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 14px; }

        /* FOOTER */
        .qc-footer { padding: 32px 24px; border-top: 1.5px solid var(--linea); }
        .qc-footer-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .qc-footer-copy { font-size: 13px; color: var(--gris); margin-top: 2px; }
        .qc-footer-nav { display: flex; gap: 20px; flex-wrap: wrap; align-items: center; }
        .qc-footer-link { font-size: 13px; color: var(--gris); text-decoration: none; transition: color .2s; }
        .qc-footer-link:hover { color: var(--tinta); }
        .qc-footer-sep { color: var(--linea); font-size: 13px; }
        .qc-footer-contact { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }

        /* MODAL */
        .qc-modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: fadeIn .2s ease;
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .qc-modal-card {
          background: white; border-radius: 20px;
          width: 100%; max-width: 440px;
          padding: 36px 32px;
          position: relative;
          animation: slideUp .25s ease;
        }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .qc-modal-close {
          position: absolute; top: 16px; right: 16px;
          background: #F5F5F3; border: none; border-radius: 50%;
          width: 32px; height: 32px; font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--gris); transition: background .2s;
          line-height: 1;
        }
        .qc-modal-close:hover { background: #EBEBEA; color: var(--tinta); }
        .qc-modal-emoji { font-size: 32px; margin-bottom: 10px; display: block; text-align: center; }
        .qc-modal-title { font-size: 22px; font-weight: 700; color: var(--tinta); margin-bottom: 4px; text-align: center; }
        .qc-modal-sub { font-size: 14px; color: var(--gris); margin-bottom: 28px; text-align: center; }
        .qc-form-group { margin-bottom: 16px; }
        .qc-form-label { display: block; font-size: 13px; font-weight: 600; color: var(--tinta); margin-bottom: 6px; }
        .qc-form-input {
          width: 100%; padding: 11px 14px;
          border: 1.5px solid #DDDDD8; border-radius: 10px;
          font-size: 15px; font-family: inherit; color: var(--tinta);
          background: white; transition: border-color .2s;
          outline: none;
        }
        .qc-form-input:focus { border-color: var(--ambar); }
        .qc-form-input::placeholder { color: #B8B8B2; }
        .qc-btn-submit {
          width: 100%; padding: 14px;
          background: var(--ambar); color: white;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: background .2s;
          margin-top: 8px;
        }
        .qc-btn-submit:hover:not(:disabled) { background: var(--ambar-hover); }
        .qc-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        .qc-form-error { font-size: 13px; color: #DC2626; background: #FEF2F2; border-radius: 8px; padding: 10px 14px; margin-top: 10px; }
        .qc-form-legal { font-size: 12px; color: var(--gris-claro); text-align: center; margin-top: 14px; line-height: 1.5; }

        /* PHONE GROUP */
        .qc-phone-group { display: flex; border: 1.5px solid #DDDDD8; border-radius: 10px; overflow: hidden; transition: border-color .2s; }
        .qc-phone-group:focus-within { border-color: var(--ambar); }
        .qc-phone-prefix { display: flex; align-items: center; gap: 6px; padding: 0 12px; background: #F5F5F3; border-right: 1.5px solid #DDDDD8; font-size: 13px; font-weight: 600; color: #444; white-space: nowrap; flex-shrink: 0; }
        .qc-phone-group .qc-form-input { border: none; border-radius: 0; }
        .qc-phone-group .qc-form-input:focus { border-color: transparent; }

        /* SUCCESS */
        .qc-success { text-align: center; }
        .qc-success-icon { font-size: 48px; display: block; margin-bottom: 16px; }
        .qc-success h2 { font-size: 24px; font-weight: 700; color: var(--tinta); margin-bottom: 10px; }
        .qc-success-desc { font-size: 15px; color: var(--gris); line-height: 1.65; margin-bottom: 24px; }
        .qc-success-features { background: var(--ambar-fondo); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; text-align: left; }
        .qc-success-feature { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--ambar-tinta); line-height: 1.5; margin-bottom: 8px; }
        .qc-success-feature:last-child { margin-bottom: 0; }
        .qc-success-note { font-size: 12px; color: var(--gris); margin-top: 12px; }

        /* Mobile nav */
        @media (max-width: 680px) {
          .qc-nav-links { display: none; }
          .qc-hero { padding: 64px 20px 56px; }
          .qc-section { padding: 56px 20px; }
          .qc-cta-final-card { padding: 40px 24px; }
          .qc-modal-card { padding: 28px 20px; }
        }
      `}</style>

      <div className="qc-landing">

        {/* NAV */}
        <nav className="qc-nav">
          <div className="qc-nav-inner">
            <a href="/" className="qc-logo">QuieroCome<span>r</span></a>
            <div className="qc-nav-links">
              <a href="/carta" className="qc-nav-link">Carta QR</a>
              <a href="/fidelizacion" className="qc-nav-link">Loyalty</a>
              <a href="#precios" className="qc-nav-link">Precios</a>
            </div>
            <div className="qc-nav-actions">
              <a href="/panel/login" className="qc-btn-ghost">Ingresar</a>
              <button className="qc-btn-ambar" onClick={openModal}>Empezar gratis</button>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="qc-hero">
          <div className="qc-hero-inner">
            <span className="qc-label">Plataforma para restaurantes · Chile</span>
            <h1>Haz que tus clientes se&nbsp;<span style={{color:"var(--ambar)"}}>enamoren</span> de&nbsp;tu negocio</h1>
            <p className="qc-hero-sub">
              Transforma tu negocio en una máquina de fidelización. Los negocios que usan QuieroComer aumentan un 30% sus ventas.
            </p>
            <div className="qc-hero-cta">
              <button className="qc-btn-ambar qc-btn-ambar-xl" onClick={openModal}>
                Probar gratis por 7 días
              </button>
              <a href="https://quierocomer.com/qr/hand-roll" target="_blank" rel="noopener noreferrer" className="qc-link-ghost">
                Ver demo →
              </a>
            </div>
            <p className="qc-hero-note">Sin tarjeta · Sin contratos · Configuración en 1 día</p>
          </div>
        </section>

        {/* MÓDULOS */}
        <section className="qc-section" style={{ background: "white", paddingTop: 16 }}>
          <div className="qc-section-inner">
            <div className="qc-modulos-grid">

              {/* Carta QR */}
              <div className="qc-card qc-card-amber">
                <span className="qc-badge qc-badge-amber">Más vendido</span>
                <h2>Carta QR Inteligente</h2>
                <p>Fotos que antojan, un genio que recomienda y datos de qué se pide más. Tu carta deja de ser un PDF.</p>
                <div className="qc-card-btns">
                  <a href="https://quierocomer.com/qr/horusvegan" target="_blank" rel="noopener noreferrer" className="qc-btn-outline">Ver demo →</a>
                  <a href="/carta" className="qc-btn-outline">Conocer más →</a>
                </div>
                <div className="qc-carta-mock">
                  <div className="qc-carta-mock-header">
                    <div className="qc-carta-logo">🍣</div>
                    <div>
                      <h4>Tu Restaurant</h4>
                      <p>Carta digital activa</p>
                    </div>
                  </div>
                  {[
                    { name: "Plato del día", desc: "Lomo con ensalada", price: "$9.900" },
                    { name: "Ceviche mixto", desc: "Con leche de tigre", price: "$10.500" },
                    { name: "Pasta carbonara", desc: "Con panceta crocante", price: "$8.900" },
                  ].map((dish, i) => (
                    <div key={i} className="qc-dish-row">
                      <div className="qc-dish-img" style={{ background: ["linear-gradient(135deg,#FFE4B5,#FFC97A)", "linear-gradient(135deg,#B5F7D1,#5ECFA0)", "linear-gradient(135deg,#FFD6B5,#FFA06A)"][i] }} />
                      <div className="qc-dish-info">
                        <h5>{dish.name}</h5>
                        <p>{dish.desc}</p>
                      </div>
                      <span className="qc-dish-price">{dish.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Loyalty */}
              <div className="qc-card qc-card-light">
                <span className="qc-badge qc-badge-dark">Nuevo</span>
                <h2>Programa de Loyalty</h2>
                <p>Tarjeta digital en Apple Wallet y Google Wallet. Tus clientes acumulan sellos, ganan premios y reciben notificaciones al pasar por tu local.</p>
                <div className="qc-card-btns">
                  <a href="https://quierocomer.com/fidelidad/hand-roll" target="_blank" rel="noopener noreferrer" className="qc-btn-outline">Ver tarjeta demo →</a>
                  <a href="/fidelizacion" className="qc-btn-outline">Conocer más →</a>
                </div>
                <div className="qc-loyalty-mock">
                  <div className="qc-loyalty-mock-header">Loyalty · Hand Roll</div>
                  <h4>Tu tarjeta de sellos</h4>
                  <div className="qc-stamps">
                    {[true, true, true, true, true, true, false, false, false, false].map((filled, i) => (
                      <div key={i} className={`qc-stamp ${filled ? "qc-stamp-filled" : "qc-stamp-empty"}`}>
                        {filled ? "⭐" : ""}
                      </div>
                    ))}
                  </div>
                  <div className="qc-loyalty-mock-footer">6 de 10 sellos · 4 más para tu premio 🎁</div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* RESTAURANTES */}
        <section className="qc-rest-section">
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <p style={{ textAlign: "center", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gris-claro)", marginBottom: 20 }}>
              Restaurantes que ya usan QuieroComer
            </p>
            <div className="qc-rest-grid">
              {RESTAURANTS.map((r) => (
                <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" className="qc-rest-tile">
                  <img src={r.logo} alt={r.name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  {r.name}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIOS */}
        <section className="qc-section" style={{ background: "white" }}>
          <div className="qc-section-inner">
            <h2 className="qc-section-title" style={{ textAlign: "center", marginBottom: 48 }}>Lo que dicen nuestros clientes</h2>
            <div className="qc-testimonios-scroll">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="qc-test-card">
                  <div className="qc-stars">★★★★★</div>
                  <p className="qc-test-quote">"{t.quote}"</p>
                  <div className="qc-test-author">
                    <div className="qc-avatar" style={{ background: ["#F59E1B","#6d28d9","#10B981","#EF4444","#3B82F6","#EC4899"][i % 6] }}>{t.initials}</div>
                    <div className="qc-test-author-info">
                      <strong>{t.name}</strong>
                      <span>{t.restaurant}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRECIOS */}
        <section className="qc-precios-section" id="precios">
          <div className="qc-section-inner" style={{ textAlign: "center" }}>
            <span className="qc-label">Precios</span>
            <h2 className="qc-section-title" style={{ marginBottom: 8 }}>Precios simples, sin sorpresas</h2>
            <p className="qc-section-sub">Sin comisiones, sin permanencia mínima.</p>
            <div className="qc-precios-grid">

              {/* Pro */}
              <div className="qc-precio-card qc-precio-card-featured">
                <span className="qc-badge qc-badge-amber" style={{ marginBottom: 16 }}>7 días gratis</span>
                <div className="qc-precio-name">Plan Pro</div>
                <div className="qc-precio-price">$44.900 <span style={{ fontSize: 18 }}>/mes</span></div>
                <div className="qc-precio-sub">+ IVA</div>
                <ul className="qc-feature-list">
                  {PRO_FEATURES.map((f, i) => (
                    <li key={i}><span className="qc-check">✓</span>{f}</li>
                  ))}
                </ul>
                <button className="qc-btn-ambar" style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15 }} onClick={openModal}>
                  Empezar gratis 7 días
                </button>
              </div>

              {/* Loyalty */}
              <div className="qc-precio-card qc-precio-card-purple">
                <span className="qc-badge qc-badge-purple" style={{ marginBottom: 16 }}>Módulo adicional</span>
                <div className="qc-precio-name">Loyalty</div>
                <div className="qc-precio-price" style={{ color: "var(--purpura)" }}>$29.900 <span style={{ fontSize: 18 }}>/mes</span></div>
                <div className="qc-precio-sub">+ IVA</div>
                <ul className="qc-feature-list">
                  {LOYALTY_FEATURES.map((f, i) => (
                    <li key={i}><span className="qc-check-purple">✓</span>{f}</li>
                  ))}
                </ul>
                <p className="qc-precio-note">Se suma al Plan Pro</p>
                <button className="qc-btn-purple" onClick={openModal}>
                  Probar Loyalty gratis
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="qc-cta-final">
          <div className="qc-cta-final-card">
            <h2>¿Listo para llenar tu restaurant?</h2>
            <p>7 días gratis, sin tarjeta de crédito. Configura tu carta en menos de un día.</p>
            <button className="qc-btn-white" onClick={openModal}>Empezar ahora gratis</button>
            <p className="qc-cta-note">Soporte en español · Cancelación sin trámites</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="qc-footer">
          <div className="qc-footer-inner">
            <span className="qc-footer-copy">© 2026 QuieroComer · Santiago de Chile</span>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
              <nav className="qc-footer-nav">
                <a href="/carta" className="qc-footer-link">Carta QR</a>
                <a href="/fidelizacion" className="qc-footer-link">Loyalty</a>
                <a href="#precios" className="qc-footer-link">Precios</a>
                <a href="/panel/login" className="qc-footer-link">Ingresar</a>
              </nav>
              <div className="qc-footer-contact">
                <span className="qc-footer-sep">|</span>
                <a href="https://instagram.com/quierocomer" target="_blank" rel="noopener noreferrer" className="qc-footer-link">Instagram</a>
                <a href="https://wa.me/56999946208" target="_blank" rel="noopener noreferrer" className="qc-footer-link">WhatsApp</a>
              </div>
            </div>
          </div>
        </footer>

        {/* MODAL */}
        {modalOpen && (
          <div className="qc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
            <div className="qc-modal-card">
              <button className="qc-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>

              {formStep === "form" ? (
                <>
                  <span className="qc-modal-emoji">🍽️</span>
                  <h2 className="qc-modal-title">Empieza gratis hoy</h2>
                  <p className="qc-modal-sub">7 días sin cobrar nada. Sin tarjeta.</p>
                  <form onSubmit={handleSubmit}>
                    <div className="qc-form-group">
                      <label className="qc-form-label">Tu nombre</label>
                      <input
                        className="qc-form-input"
                        type="text"
                        placeholder="María González"
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="qc-form-group">
                      <label className="qc-form-label">Nombre del local</label>
                      <input
                        className="qc-form-input"
                        type="text"
                        placeholder="Restaurante El Sabor"
                        value={formData.localName}
                        onChange={(e) => setFormData({ ...formData, localName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="qc-form-group">
                      <label className="qc-form-label">Tu email</label>
                      <input
                        className="qc-form-input"
                        type="email"
                        placeholder="maria@restaurante.cl"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="qc-form-group">
                      <label className="qc-form-label">Tu WhatsApp</label>
                      <div className="qc-phone-group">
                        <span className="qc-phone-prefix">
                          <svg width="18" height="13" viewBox="0 0 20 14" style={{borderRadius:2,flexShrink:0}}>
                            <rect width="20" height="7" fill="#fff"/>
                            <rect y="7" width="20" height="7" fill="#D52B1E"/>
                            <rect width="7" height="7" fill="#0039A6"/>
                            <polygon points="3.5,1.5 4.1,3.3 6,3.3 4.5,4.4 5,6.2 3.5,5.1 2,6.2 2.5,4.4 1,3.3 2.9,3.3" fill="#fff"/>
                          </svg>
                          +56
                        </span>
                        <input
                          className="qc-form-input"
                          type="tel"
                          placeholder="9 1234 5678"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        />
                      </div>
                    </div>
                    {formError && <div className="qc-form-error">{formError}</div>}
                    <button className="qc-btn-submit" type="submit" disabled={submitting}>
                      {submitting ? "Enviando..." : "Empezar mis 7 días gratis →"}
                    </button>
                  </form>
                  <p className="qc-form-legal">Al enviar aceptas que te contactemos para ayudarte a configurar tu carta.</p>
                </>
              ) : (
                <div className="qc-success">
                  <span className="qc-success-icon">✅</span>
                  <h2>¡Tu cuenta está lista!</h2>
                  <p className="qc-success-desc">
                    Creamos tu local con carta de ejemplo. Entra al panel, personalízala con tus platos y comparte el link con tus clientes.
                  </p>
                  <div className="qc-success-features">
                    {[
                      "14 días gratis, sin tarjeta",
                      "Carta QR activa ahora mismo con platos de ejemplo",
                      "El equipo te escribirá para ayudarte a subir tu carta real",
                    ].map((f, i) => (
                      <div key={i} className="qc-success-feature">
                        <span style={{ color: "var(--ambar)", fontWeight: 700 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a href="/panel/login" className="qc-btn-ambar" style={{ display: "block", textAlign: "center", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700 }}>
                      Ir a mi panel →
                    </a>
                    {registeredSlug && (
                      <a href={`/qr/${registeredSlug}`} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "var(--ambar-tinta)", background: "var(--ambar-fondo)", textDecoration: "none" }}>
                        Ver mi carta de ejemplo →
                      </a>
                    )}
                  </div>
                  {formData.email && <p className="qc-success-note">Cuenta creada con {formData.email}</p>}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
