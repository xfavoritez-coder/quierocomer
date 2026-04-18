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
}

function trackPromo(restaurantId: string, eventType: string, dishId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId: dishId || null, guestId: getGuestId(), sessionId: getSessionId() }),
  }).catch(() => {});
}

export default function PromoCarousel({ restaurantId, onViewDish }: Props) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    fetch(`/api/qr/promos?restaurantId=${restaurantId}&guestId=${getGuestId()}`)
      .then(r => r.json())
      .then(d => {
        // API returns single promo, but we want all active
        // Fetch all promos directly
        fetch(`/api/qr/promos/all?restaurantId=${restaurantId}`)
          .then(r => r.json())
          .then(d2 => { if (d2.promos?.length) setPromos(d2.promos); })
          .catch(() => { if (d.promo) setPromos([d.promo]); });
      })
      .catch(() => {});
  }, [restaurantId]);

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

  const openPromo = (p: Promo) => {
    setSelectedPromo(p);
    setModalVisible(true);
    trackPromo(restaurantId, "PROMO_CLICKED", p.dishes[0]?.id);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedPromo(null), 200);
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

      {/* Promo Detail Modal */}
      {selectedPromo && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "fixed", top: 0, left: 0, right: 0,
            height: "100vh",
            ...({ height: "100dvh" } as any),
            ...({ height: "-webkit-fill-available" } as any),
            zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            opacity: modalVisible ? 1 : 0, transition: "opacity 0.2s ease",
          }}
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480,
              maxHeight: "85vh", overflowY: "auto",
              transform: modalVisible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.25s ease-out",
            }}
          >
            {/* Close */}
            <button onClick={closeModal} style={{ position: "absolute", top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={16} color="white" />
            </button>

            {/* Hero photo */}
            {selectedPromo.dishes[0]?.photos?.[0] && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/10", overflow: "hidden", borderRadius: "20px 20px 0 0" }}>
                <Image src={selectedPromo.dishes[0].photos[0]} alt="" fill className="object-cover" sizes="100vw" />
                {selectedPromo.discountPct && (
                  <div style={{
                    position: "absolute", top: 16, left: 16,
                    background: "#16a34a", color: "white",
                    fontSize: "16px", fontWeight: 700, padding: "6px 14px", borderRadius: 50,
                  }}>
                    -{selectedPromo.discountPct}% OFF
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div style={{ padding: "20px 20px 32px" }}>
              <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 4px" }}>
                {selectedPromo.dishes[0]?.name || selectedPromo.name}
              </h2>
              {selectedPromo.name !== selectedPromo.dishes[0]?.name && (
                <p style={{ fontSize: "0.88rem", color: "#F4A623", fontWeight: 600, margin: "0 0 12px" }}>{selectedPromo.name}</p>
              )}

              {selectedPromo.description && (
                <p style={{ fontSize: "0.92rem", color: "#666", lineHeight: 1.5, margin: "0 0 16px" }}>{selectedPromo.description}</p>
              )}

              {/* Price block */}
              <div style={{ background: "linear-gradient(135deg, rgba(244,166,35,0.08), rgba(244,166,35,0.03))", border: "1px solid rgba(244,166,35,0.15)", borderRadius: 14, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Precio promo</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#F4A623" }}>${selectedPromo.promoPrice?.toLocaleString("es-CL")}</span>
                    {selectedPromo.originalPrice && (
                      <span style={{ fontSize: "1rem", color: "#ccc", textDecoration: "line-through" }}>${selectedPromo.originalPrice.toLocaleString("es-CL")}</span>
                    )}
                  </div>
                </div>
                {selectedPromo.discountPct && (
                  <div style={{ background: "#16a34a", color: "white", fontSize: "1.1rem", fontWeight: 700, padding: "8px 14px", borderRadius: 10 }}>
                    -{selectedPromo.discountPct}%
                  </div>
                )}
              </div>

              {/* Ingredients */}
              {selectedPromo.dishes[0]?.ingredients && (
                <p style={{ fontSize: "0.82rem", color: "#999", margin: "0 0 12px" }}>
                  <strong style={{ color: "#666" }}>Ingredientes:</strong> {selectedPromo.dishes[0].ingredients}
                </p>
              )}

              {/* Description of first dish */}
              {selectedPromo.dishes[0]?.description && (
                <p style={{ fontSize: "0.85rem", color: "#888", lineHeight: 1.5, margin: "0 0 12px", fontStyle: "italic" }}>{selectedPromo.dishes[0].description}</p>
              )}

              {/* Multiple dishes */}
              {selectedPromo.dishes.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Incluye</p>
                  {selectedPromo.dishes.map(d => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                      {d.photos?.[0] && (
                        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                          <Image src={d.photos[0]} alt="" fill className="object-cover" sizes="40px" />
                        </div>
                      )}
                      <span style={{ fontSize: "0.88rem", color: "#333", flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: "0.82rem", color: "#999" }}>${d.price.toLocaleString("es-CL")}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Validity */}
              {selectedPromo.validUntil && (
                <p style={{ fontSize: "0.78rem", color: "#999", margin: "0 0 16px" }}>
                  Válido hasta {new Date(selectedPromo.validUntil).toLocaleDateString("es-CL")}
                </p>
              )}

              {/* CTA */}
              <button
                onClick={() => handleViewDish(selectedPromo.dishes[0]?.id)}
                className="active:scale-[0.98] transition-transform"
                style={{
                  width: "100%", padding: "14px", background: "#F4A623", color: "#0a0a0a",
                  border: "none", borderRadius: 50, fontSize: "1rem", fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                }}
              >
                Ver plato completo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
