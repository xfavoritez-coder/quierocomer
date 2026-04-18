"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { getGuestId, getSessionId } from "@/lib/guestId";

interface PromoDish {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  photos: string[];
  ingredients?: string | null;
}

interface Promo {
  id: string;
  name: string;
  description: string | null;
  discountPct: number | null;
  promoPrice: number | null;
  originalPrice: number | null;
  validUntil: string | null;
  dishes: PromoDish[];
}

interface Props {
  restaurantId: string;
  onViewDish?: (dishId: string) => void;
  initialPromos?: Promo[];
}

function trackPromo(restaurantId: string, eventType: string, dishId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId: dishId || null, guestId: getGuestId(), sessionId: getSessionId() }),
  }).catch(() => {});
}

export default function PromoCarousel({ restaurantId, onViewDish, initialPromos }: Props) {
  const [promos, setPromos] = useState<Promo[]>(initialPromos || []);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    if (initialPromos?.length) return; // Skip fetch if server provided promos
    fetch(`/api/qr/promos/all?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => { if (d.promos?.length) setPromos(d.promos); })
      .catch(() => {});
  }, [restaurantId, initialPromos]);

  // Intersection observer for PROMO_VIEWED
  useEffect(() => {
    if (!scrollRef.current || !promos.length) return;
    const cards = scrollRef.current.querySelectorAll("[data-promo-id]");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const id = (e.target as HTMLElement).dataset.promoId;
          if (id && !trackedRef.current.has(id)) {
            trackedRef.current.add(id);
            trackPromo(restaurantId, "PROMO_VIEWED");
          }
        }
      });
    }, { threshold: 0.5 });
    cards.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, [promos, restaurantId]);

  // Track scroll position for dots
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveIdx(idx);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [promos]);

  const modalOpenedAt = useRef(0);

  const openPromo = (p: Promo) => {
    setSelectedPromo(p);
    setModalVisible(true);
    modalOpenedAt.current = Date.now();
    trackPromo(restaurantId, "PROMO_CLICKED", p.dishes[0]?.id);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedPromo(null), 400);
  };

  const handleViewDish = (dishId: string) => {
    trackPromo(restaurantId, "PROMO_DISH_VIEWED", dishId);
    closeModal();
    onViewDish?.(dishId);
  };

  const handleRedeem = (p: Promo) => {
    trackPromo(restaurantId, "PROMO_REDEEMED", p.dishes[0]?.id);
    if (p.dishes[0] && onViewDish) {
      closeModal();
      onViewDish(p.dishes[0].id);
    }
  };

  if (!promos.length) return null;

  return (
    <>
      <div className="font-[family-name:var(--font-dm)]" style={{ padding: "16px 20px 8px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginBottom: 12 }}>
          <span style={{ color: "#F4A623", fontSize: "12px" }}>✦</span>
          <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "14px", fontWeight: 500, fontStyle: "italic", color: "#8a5a2c" }}>Promociones</span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(244,166,35,0.3), transparent)" }} />
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory",
            padding: 4, margin: "0 -4px",
            scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
          }}
        >
          {promos.map((p) => {
            const dish = p.dishes[0];
            const isSingle = promos.length === 1;
            return (
              <button
                key={p.id}
                data-promo-id={p.id}
                onClick={() => openPromo(p)}
                className="active:scale-[0.98] transition-all"
                style={{
                  flex: isSingle ? "1 1 100%" : "0 0 290px",
                  minWidth: isSingle ? undefined : 290,
                  scrollSnapAlign: "start",
                  background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
                  border: "1px solid rgba(244,166,35,0.25)",
                  borderRadius: 16,
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 10,
                  cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(244,166,35,0.08)",
                  position: "relative",
                  overflow: "hidden",
                  textAlign: "left",
                  transition: "box-shadow 0.2s ease",
                }}
              >
                {/* Photo */}
                <div style={{ position: "relative", width: 68, height: 68, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                  {dish?.photos?.[0] ? (
                    <Image src={dish.photos[0]} alt={dish.name} fill className="object-cover" sizes="68px" />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e8d4b0, #d4b896)" }} />
                  )}
                  {/* Discount badge */}
                  {p.discountPct && (
                    <div style={{
                      position: "absolute", top: 4, left: 4,
                      background: "#10b981", color: "white",
                      fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                      letterSpacing: "0.02em",
                    }}>
                      -{p.discountPct}%
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "inline-block", fontSize: "9px", fontWeight: 700, color: "#F4A623", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 3 }}>PROMO</span>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#0e0e0e", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {dish?.name || p.name}
                  </p>
                  {p.name !== dish?.name && (
                    <p style={{ fontSize: "10.5px", color: "#8a7060", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#F4A623" }}>
                      ${p.promoPrice?.toLocaleString("es-CL") || dish?.price?.toLocaleString("es-CL")}
                    </span>
                    {p.originalPrice && (
                      <span style={{ fontSize: "11px", color: "#a08060", textDecoration: "line-through" }}>
                        ${p.originalPrice.toLocaleString("es-CL")}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dots */}
        {promos.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 12 }}>
            {promos.map((_, i) => (
              <div key={i} style={{
                width: i === activeIdx ? 16 : 5, height: 5,
                borderRadius: i === activeIdx ? 3 : "50%",
                background: i === activeIdx ? "#F4A623" : "#e8d4b8",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Promo Detail Modal — Premium bottom sheet */}
      {selectedPromo && (() => {
        const dish = selectedPromo.dishes[0];
        const savings = selectedPromo.originalPrice && selectedPromo.promoPrice
          ? selectedPromo.originalPrice - selectedPromo.promoPrice : 0;
        return (
        <>
          {/* Overlay */}
          <div
            onClick={closeModal}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
              opacity: modalVisible ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />

          {/* Bottom sheet */}
          <div
            className="font-[family-name:var(--font-dm)]"
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed", bottom: 0, left: "50%",
              transform: modalVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100%)",
              width: "100%", maxWidth: 420, maxHeight: "92vh",
              background: "white", borderRadius: "28px 28px 0 0",
              zIndex: 101, display: "flex", flexDirection: "column",
              transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Hero image */}
            {dish?.photos?.[0] && (
              <div style={{ position: "relative", width: "100%", height: 280, flexShrink: 0, overflow: "hidden", borderRadius: "28px 28px 0 0" }}>
                <Image src={dish.photos[0]} alt={dish.name} fill className="object-cover" sizes="100vw" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)" }} />

                {/* Handle bar */}
                <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, background: "rgba(255,255,255,0.6)", borderRadius: 100, zIndex: 10 }} />

                {/* Close button */}
                <button onClick={closeModal} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", zIndex: 10 }}>
                  <X size={18} color="#0e0e0e" strokeWidth={1.5} />
                </button>

                {/* Discount badge */}
                {selectedPromo.discountPct && (
                  <div style={{ position: "absolute", top: 20, left: 20, background: "#10b981", color: "white", padding: "8px 14px", borderRadius: 100, fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", boxShadow: "0 4px 12px rgba(16,185,129,0.4)", zIndex: 10 }}>
                    -{selectedPromo.discountPct}% OFF
                  </div>
                )}
              </div>
            )}

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px 40px", scrollbarWidth: "none" }}>
              {/* Eyebrow */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <div style={{ width: 14, height: 1, background: "#F4A623", opacity: 0.6 }} />
                <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#F4A623", letterSpacing: "0.15em", textTransform: "uppercase" }}>PROMOCIÓN</span>
              </div>

              {/* Title */}
              <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#0e0e0e", margin: "0 0 16px" }}>
                {selectedPromo.name}
              </h2>

              {/* Description */}
              {(selectedPromo.description || dish?.description) && (
                <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#4a4a4a", margin: "0 0 24px" }}>
                  {selectedPromo.description || dish?.description}
                </p>
              )}

              {/* Price section */}
              <div style={{ padding: "18px 0", borderTop: "1px solid rgba(0,0,0,0.08)", borderBottom: "1px solid rgba(0,0,0,0.08)", marginBottom: 28 }}>
                <p style={{ fontSize: "11px", fontWeight: 500, color: "#8a8a8a", letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 6px" }}>PRECIO PROMO</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "34px", fontWeight: 600, color: "#F4A623", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    ${selectedPromo.promoPrice?.toLocaleString("es-CL")}
                  </span>
                  {selectedPromo.originalPrice && (
                    <span style={{ fontSize: "16px", color: "#8a8a8a", textDecoration: "line-through" }}>
                      ${selectedPromo.originalPrice.toLocaleString("es-CL")}
                    </span>
                  )}
                  {savings > 0 && (
                    <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: "#10b981", background: "#d1fae5", padding: "6px 10px", borderRadius: 8 }}>
                      Ahorras ${savings.toLocaleString("es-CL")}
                    </span>
                  )}
                </div>
              </div>

              {/* Qué incluye (multiple dishes) */}
              {selectedPromo.dishes.length > 1 && (
                <div style={{ marginBottom: 28 }}>
                  <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "18px", fontWeight: 600, color: "#0e0e0e", margin: "0 0 4px" }}>Qué incluye</h3>
                  <p style={{ fontSize: "12.5px", color: "#8a8a8a", margin: "0 0 16px" }}>{selectedPromo.dishes.length} platos combinados en esta promoción</p>
                  <div style={{ background: "#fafaf8", borderRadius: 18, padding: 6 }}>
                    {selectedPromo.dishes.map(d => (
                      <button
                        key={d.id}
                        onClick={() => { trackPromo(restaurantId, "PROMO_CLICKED", d.id); onViewDish?.(d.id); closeModal(); }}
                        className="active:bg-[#fff7e8]"
                        style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 14, background: "white", width: "100%", border: "none", cursor: "pointer", textAlign: "left", marginBottom: 4 }}
                      >
                        {d.photos?.[0] && (
                          <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                            <Image src={d.photos[0]} alt={d.name} fill className="object-cover" sizes="52px" />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "#0e0e0e", margin: 0 }}>{d.name}</p>
                          {d.description && <p style={{ fontSize: "11.5px", color: "#8a8a8a", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</p>}
                        </div>
                        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "15px", fontWeight: 500, color: "#0e0e0e", flexShrink: 0 }}>${d.price.toLocaleString("es-CL")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Validez */}
              {selectedPromo.validUntil && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#fef9f0", borderRadius: 14, border: "1px solid #fce8c5" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px" }}>⏰</div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#0e0e0e", margin: 0 }}>Válido hasta el {new Date(selectedPromo.validUntil).toLocaleDateString("es-CL")}</p>
                    <p style={{ fontSize: "11.5px", color: "#8a5a2c", margin: "2px 0 0" }}>Sujeto a disponibilidad del local</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
        );
      })()}
    </>
  );
}
