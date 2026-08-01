"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { trackPurchase } from "@/lib/metaPixel";
import LandingFooter from "@/components/landing/LandingFooter";
import { useLandingLang } from "@/lib/i18n/landing";

const RESTAURANTS = [
  { name: "Hand Roll", url: "https://quierocomer.com/qr/hand-roll", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png" },
  { name: "Horus Vegan", url: "https://quierocomer.com/qr/horusvegan", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/horusvegan/logo.png" },
  { name: "Juana la Brava", url: "https://quierocomer.com/qr/juana-la-brava", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779212065016-vn71iczuzue.jpg" },
  { name: "Alleria Pizza", url: "https://quierocomer.com/qr/alleria-pizza", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777477859043-9ibluljyt89.png" },
  { name: "La Oveja Negra", url: "https://quierocomer.com/qr/la-oveja-negra-restaurante", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781573105032-to2loqezh47.webp" },
  { name: "El Menú de la Esquina", url: "https://quierocomer.com/qr/el-menu-de-la-esquina", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779594834786-i3nhsddtw68.png" },
  { name: "Entre Pisco y Pebre", url: "https://quierocomer.com/qr/entre-pisco-y-pebre", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1785560529971-6n72tdb1cf7.webp" },
  { name: "Guffsushi Nikkei", url: "https://quierocomer.com/qr/guffsushi", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781291439973-bzmbjnjzwo.webp" },
];


export default function LandingPage() {
  const { t, testimonials, proFeatures, loyaltyFeatures } = useLandingLang();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({ ownerName: "", localName: "", email: "", whatsapp: "" });

  const testimonialsRef = useRef<HTMLDivElement>(null);
  const scrollTestimonials = (dir: "left" | "right") => {
    if (testimonialsRef.current) {
      testimonialsRef.current.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
    }
  };

  const openModal = () => { setModalOpen(true); setFormError(""); };
  const closeModal = () => { setModalOpen(false); setFormData({ ownerName: "", localName: "", email: "", whatsapp: "" }); };

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
      // Store welcome data in sessionStorage and redirect to /bienvenida
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
        .qc-logo { font-size: 18px; font-weight: 700; color: var(--tinta); text-decoration: none; letter-spacing: -0.02em; display: flex; align-items: center; gap: 7px; }
        .qc-logo img { width: 22px; height: 22px; display: block; flex-shrink: 0; }
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

/* iPhone carta mock en módulo */
        .qc-iphone-wrap { display: flex; justify-content: flex-start; margin-top: 16px; }
        .qc-iphone {
          width: 200px; height: 360px;
          background: #0A0A0A; border-radius: 36px;
          border: 6px solid #2a2a2a;
          box-shadow: 0 0 0 1px #3a3a3a, 0 20px 60px rgba(0,0,0,0.35);
          overflow: hidden; position: relative; flex-shrink: 0;
        }
        .qc-iphone-notch { width: 80px; height: 18px; background: #0A0A0A; border-radius: 0 0 14px 14px; margin: 0 auto; position: relative; z-index: 3; }
        .qc-iphone-screen { position: absolute; inset: 0; background: #111; overflow: hidden; display: flex; flex-direction: column; }
        .qc-iphone-hero { height: 130px; flex-shrink: 0; position: relative; }
        .qc-iphone-hero-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .qc-iphone-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%); }
        .qc-iphone-hero-text { position: absolute; bottom: 9px; left: 10px; right: 10px; }
        .qc-iphone-hero-text h4 { font-size: 12px; font-weight: 700; color: white; margin-bottom: 1px; }
        .qc-iphone-hero-text p { font-size: 8px; color: rgba(255,255,255,0.7); }
        .qc-iphone-pills { display: flex; gap: 5px; padding: 8px 8px 5px; overflow-x: auto; scrollbar-width: none; flex-shrink: 0; }
        .qc-iphone-pills::-webkit-scrollbar { display: none; }
        .qc-iphone-pill { padding: 3px 8px; border-radius: 100px; font-size: 7px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
        .qc-iphone-pill-a { background: var(--ambar); color: #000; }
        .qc-iphone-pill-i { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
        .qc-iphone-dishes { flex: 1; overflow-y: auto; padding: 2px 8px; scrollbar-width: none; }
        .qc-iphone-dishes::-webkit-scrollbar { display: none; }
        .qc-iphone-dish { display: flex; gap: 7px; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .qc-iphone-dish:last-child { border-bottom: none; }
        .qc-iphone-dish img { width: 38px; height: 38px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
        .qc-iphone-dish-info { flex: 1; min-width: 0; }
        .qc-iphone-dish-info h5 { font-size: 8px; font-weight: 600; color: white; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .qc-iphone-dish-info p { font-size: 7px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .qc-iphone-price { font-size: 8px; font-weight: 700; color: var(--ambar); flex-shrink: 0; }

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
        .qc-rest-tile img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: var(--linea); }
        .qc-rest-tile-initials { width: 32px; height: 32px; border-radius: 50%; background: var(--ambar-fondo); border: 1.5px solid var(--linea); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--ambar-tinta); flex-shrink: 0; }

        /* TESTIMONIOS */
        .qc-testimonios-wrap { position: relative; }
        .qc-testimonios-scroll { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 8px; scroll-behavior: smooth; }
        .qc-testimonios-scroll::-webkit-scrollbar { display: none; }
        .qc-testimonios-arrow { display: none; position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%; background: white; border: 1.5px solid var(--linea); box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; font-size: 16px; color: var(--tinta); align-items: center; justify-content: center; transition: border-color .2s, box-shadow .2s; z-index: 2; }
        .qc-testimonios-arrow:hover { border-color: #bbb; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
        .qc-testimonios-arrow-left { left: -18px; }
        .qc-testimonios-arrow-right { right: -18px; }
        @media (min-width: 681px) { .qc-testimonios-arrow { display: flex; } }
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
          /* Acercar testimonios y precios */
          .qc-testimonios-section { padding-bottom: 24px; }
          .qc-precios-section { padding-top: 24px; }
        }
      `}</style>

      <div className="qc-landing">

        {/* NAV */}
        <nav className="qc-nav">
          <div className="qc-nav-inner">
            <a href="/" className="qc-logo"><img src="/logo.png" alt="" />QuieroComer</a>
            <div className="qc-nav-links">
              <a href="/carta-qr" className="qc-nav-link">Carta QR</a>
              <a href="/fidelizacion" className="qc-nav-link">Loyalty</a>
              <a href="#precios" className="qc-nav-link">Precios</a>
            </div>
            <div className="qc-nav-actions">
              <a href="/panel/login" className="qc-btn-ghost">{t("nav_login")}</a>
              <a href="https://wa.me/56999946208?text=Hola%20tengo%20una%20consulta%20sobre%20QuieroComer" target="_blank" rel="noopener noreferrer" className="qc-btn-ambar" style={{display:"flex",alignItems:"center",gap:6,textDecoration:"none"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar
              </a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="qc-hero">
          <div className="qc-hero-inner">
            <span className="qc-label">{t("hero_label")}</span>
            <h1>{t("hero_title")}</h1>
            <p className="qc-hero-sub">
              {t("hero_subtitle")}
            </p>
            <div className="qc-hero-cta">
              <button className="qc-btn-ambar qc-btn-ambar-xl" onClick={openModal}>
                {t("hero_cta")}
              </button>
              <a href="https://quierocomer.com/qr/hand-roll" target="_blank" rel="noopener noreferrer" className="qc-link-ghost">
                {t("hero_demo")}
              </a>
            </div>
            <p className="qc-hero-note">{t("hero_note")}</p>
          </div>
        </section>

        {/* MÓDULOS */}
        <section className="qc-section" style={{ background: "white", paddingTop: 16 }}>
          <div className="qc-section-inner">
            <div className="qc-modulos-grid">

              {/* Carta QR */}
              <div className="qc-card qc-card-amber">
                <span className="qc-badge qc-badge-amber">Más vendido</span>
                <h2>{t("module_qr_label")}</h2>
                <p>{t("module_qr_desc")}</p>
                <div className="qc-card-btns">
                  <a href="https://quierocomer.com/qr/horusvegan" target="_blank" rel="noopener noreferrer" className="qc-btn-outline">{t("module_qr_demo")}</a>
                  <a href="/carta-qr" className="qc-btn-outline">{t("module_qr_more")}</a>
                </div>
                <div className="qc-iphone-wrap">
                  <div className="qc-iphone">
                    <div className="qc-iphone-notch"></div>
                    <div className="qc-iphone-screen">
                      <div className="qc-iphone-hero">
                        <img src="https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1783901270166-pizza-alla-genovese.webp" alt="" className="qc-iphone-hero-img" />
                        <div className="qc-iphone-hero-overlay"></div>
                        <div className="qc-iphone-hero-text">
                          <h4>Alleria Pizza</h4>
                          <p>📍 Providencia · Carta digital</p>
                        </div>
                      </div>
                      <div className="qc-iphone-pills">
                        <span className="qc-iphone-pill qc-iphone-pill-a">Todo</span>
                        <span className="qc-iphone-pill qc-iphone-pill-i">Entradas</span>
                        <span className="qc-iphone-pill qc-iphone-pill-i">Pizzas</span>
                        <span className="qc-iphone-pill qc-iphone-pill-i">Postres</span>
                      </div>
                      <div className="qc-iphone-dishes">
                        {[
                          { name: "Pizza alla Genovese", desc: "Filete y cebollas 10 hrs.", price: "$24.680", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1783901270166-pizza-alla-genovese.webp" },
                          { name: "Arancinis di Riso", desc: "Risotto con carne y ragú", price: "$13.400", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1778093711966-arancinis-di-riso.webp" },
                          { name: "Pasta alla Genovese", desc: "Receta tradicional Nonna", price: "$18.980", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1783875855139-pasta-alla-genovese.webp" },
                          { name: "Baba Napolitana", desc: "Nutella, chantilly, ron", price: "$10.900", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1780618444541-baba-napolitana.webp" },
                        ].map((dish, i) => (
                          <div key={i} className="qc-iphone-dish">
                            <img src={dish.img} alt={dish.name} />
                            <div className="qc-iphone-dish-info">
                              <h5>{dish.name}</h5>
                              <p>{dish.desc}</p>
                            </div>
                            <span className="qc-iphone-price">{dish.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loyalty */}
              <div className="qc-card qc-card-light">
                <span className="qc-badge qc-badge-dark">Nuevo</span>
                <h2>{t("module_loyalty_label")}</h2>
                <p>{t("module_loyalty_desc")}</p>
                <div className="qc-card-btns">
                  <a href="https://quierocomer.com/fidelidad/hand-roll" target="_blank" rel="noopener noreferrer" className="qc-btn-outline">{t("module_loyalty_demo")}</a>
                  <a href="/fidelizacion" className="qc-btn-outline">{t("module_qr_more")}</a>
                </div>
                <div className="qc-loyalty-mock">
                  <div className="qc-loyalty-mock-header">{t("loyalty_mock_header")}</div>
                  <h4>{t("loyalty_card_title")}</h4>
                  <div className="qc-stamps">
                    {[true, true, true, true, true, true, false, false, false, false].map((filled, i) => (
                      <div key={i} className={`qc-stamp ${filled ? "qc-stamp-filled" : "qc-stamp-empty"}`}>
                        {filled ? "⭐" : ""}
                      </div>
                    ))}
                  </div>
                  <div className="qc-loyalty-mock-footer">{t("loyalty_progress")}</div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* RESTAURANTES */}
        <section className="qc-rest-section">
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <p style={{ textAlign: "center", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gris-claro)", marginBottom: 20 }}>
              {t("restaurants_label")}
            </p>
            <div className="qc-rest-grid">
              {RESTAURANTS.map((r) => {
                const initials = r.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" className="qc-rest-tile">
                    {r.logo ? (
                      <img
                        src={r.logo}
                        alt={r.name}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          const sib = img.nextElementSibling as HTMLElement | null;
                          if (sib) sib.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <span
                      className="qc-rest-tile-initials"
                      style={{ display: r.logo ? "none" : "flex" }}
                    >
                      {initials}
                    </span>
                    {r.name}
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* TESTIMONIOS */}
        <section className="qc-section qc-testimonios-section" style={{ background: "white" }}>
          <div className="qc-section-inner">
            <h2 className="qc-section-title" style={{ textAlign: "center", marginBottom: 48 }}>{t("testimonials_title")}</h2>
            <div className="qc-testimonios-wrap">
              <button className="qc-testimonios-arrow qc-testimonios-arrow-left" onClick={() => scrollTestimonials("left")} aria-label="Anterior">‹</button>
              <div className="qc-testimonios-scroll" ref={testimonialsRef}>
                {testimonials.map((t, i) => (
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
              <button className="qc-testimonios-arrow qc-testimonios-arrow-right" onClick={() => scrollTestimonials("right")} aria-label="Siguiente">›</button>
            </div>
          </div>
        </section>

        {/* PRECIOS */}
        <section className="qc-precios-section" id="precios">
          <div className="qc-section-inner" style={{ textAlign: "center" }}>
            <span className="qc-label">{t("pricing_label")}</span>
            <h2 className="qc-section-title" style={{ marginBottom: 8 }}>{t("pricing_title")}</h2>
            <p className="qc-section-sub">{t("pricing_subtitle")}</p>
            <div className="qc-precios-grid">

              {/* Pro */}
              <div className="qc-precio-card qc-precio-card-featured">
                <span className="qc-badge qc-badge-amber" style={{ marginBottom: 16 }}>{t("pricing_trial")}</span>
                <div className="qc-precio-name">{t("plan_pro")}</div>
                <div className="qc-precio-price">{t("plan_price_pro")} <span style={{ fontSize: 18 }}>{t("plan_price_unit")}</span></div>
                <div className="qc-precio-sub">{t("plan_price_tax")}</div>
                <ul className="qc-feature-list">
                  {proFeatures.map((f, i) => (
                    <li key={i}><span className="qc-check">✓</span>{f}</li>
                  ))}
                </ul>
                <button className="qc-btn-ambar" style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15 }} onClick={openModal}>
                  {t("plan_cta_pro")}
                </button>
              </div>

              {/* Loyalty */}
              <div className="qc-precio-card qc-precio-card-purple">
                <span className="qc-badge qc-badge-purple" style={{ marginBottom: 16 }}>{t("plan_addon")}</span>
                <div className="qc-precio-name">{t("plan_loyalty")}</div>
                <div className="qc-precio-price" style={{ color: "var(--purpura)" }}>{t("plan_price_loyalty")} <span style={{ fontSize: 18 }}>{t("plan_price_unit")}</span></div>
                <div className="qc-precio-sub">{t("plan_price_tax")}</div>
                <ul className="qc-feature-list">
                  {loyaltyFeatures.map((f, i) => (
                    <li key={i}><span className="qc-check-purple">✓</span>{f}</li>
                  ))}
                </ul>
                <p className="qc-precio-note">{t("plan_loyalty_note")}</p>
                <button className="qc-btn-purple" onClick={openModal}>
                  {t("plan_cta_loyalty")}
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="qc-cta-final">
          <div className="qc-cta-final-card">
            <h2>{t("final_title")}</h2>
            <p style={{color:"rgba(255,255,255,0.75)"}}>{t("final_subtitle")}</p>
            <button className="qc-btn-white" onClick={openModal}>{t("final_cta")}</button>
            <p className="qc-cta-note" style={{color:"rgba(255,255,255,0.4)"}}>{t("final_note")}</p>
          </div>
        </section>

        <LandingFooter />

        {/* MODAL */}
        {modalOpen && (
          <div className="qc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
            <div className="qc-modal-card">
              <button className="qc-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>

              <span className="qc-modal-emoji">🍽️</span>
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
        )}

      </div>
    </>
  );
}
