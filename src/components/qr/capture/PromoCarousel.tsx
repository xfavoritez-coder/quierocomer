"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

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
  promoType?: string; // "product" | "graphic"
  imageUrl?: string | null;
  discountPct: number | null;
  promoPrice: number | null;
  originalPrice: number | null;
  validUntil: string | null;
  daysOfWeek?: number[];
  dishes: PromoDish[];
}

interface Props {
  restaurantId: string;
  onViewDish?: (dishId: string) => void;
  initialPromos?: Promo[];
}

function trackPromo(restaurantId: string, eventType: string, dishId?: string, promoId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId: dishId || null, promoId: promoId || null, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
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
            trackPromo(restaurantId, "PROMO_VIEWED", undefined, id);
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

  // Swipe between promos
  const [slideOut, setSlideOut] = useState<"left" | "right" | null>(null);
  const [slideIn, setSlideIn] = useState(false);
  const slideRef = useRef<"left" | "right">("left");
  const touchRef2 = useRef<{ x: number; y: number } | null>(null);
  const prevPromoRef = useRef<string | null>(null);

  const currentPromoIdx = selectedPromo ? promos.findIndex(p => p.id === selectedPromo.id) : -1;
  const hasNextPromo = currentPromoIdx < promos.length - 1;
  const hasPrevPromo = currentPromoIdx > 0;

  // When selected promo changes, trigger slide-in animation
  useEffect(() => {
    if (selectedPromo && prevPromoRef.current && prevPromoRef.current !== selectedPromo.id) {
      setSlideIn(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(false)));
    }
    if (selectedPromo) prevPromoRef.current = selectedPromo.id;
  }, [selectedPromo]);

  const goNextPromo = useCallback(() => {
    if (!hasNextPromo) return;
    slideRef.current = "left";
    setSlideOut("left");
    setTimeout(() => {
      setSlideOut(null);
      const next = promos[currentPromoIdx + 1];
      setSelectedPromo(next);
      trackPromo(restaurantId, "PROMO_CLICKED", next.dishes[0]?.id);
    }, 200);
  }, [hasNextPromo, currentPromoIdx, promos, restaurantId]);

  const goPrevPromo = useCallback(() => {
    if (!hasPrevPromo) return;
    slideRef.current = "right";
    setSlideOut("right");
    setTimeout(() => {
      setSlideOut(null);
      const prev = promos[currentPromoIdx - 1];
      setSelectedPromo(prev);
      trackPromo(restaurantId, "PROMO_CLICKED", prev.dishes[0]?.id);
    }, 200);
  }, [hasPrevPromo, currentPromoIdx, promos, restaurantId]);

  const handleModalTouchStart = (e: React.TouchEvent) => {
    touchRef2.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleModalTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef2.current) return;
    const dx = touchRef2.current.x - e.changedTouches[0].clientX;
    const dy = touchRef2.current.y - e.changedTouches[0].clientY;
    touchRef2.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
      if (dx > 0) goNextPromo();
      else goPrevPromo();
    }
  };

  const getPromoTransform = () => {
    if (slideOut === "left") return "translateX(-100%)";
    if (slideOut === "right") return "translateX(100%)";
    if (slideIn) return slideRef.current === "left" ? "translateX(100%)" : "translateX(-100%)";
    return "translateX(0)";
  };

  const openPromo = (p: Promo) => {
    prevPromoRef.current = null; // Don't animate on first open
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
      <div className="font-[family-name:var(--font-dm)]" style={{ padding: "0 0 12px" }}>
        {/* Carousel */}
        <div style={{ position: "relative" }}>
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
                  display: "flex", alignItems: "stretch", gap: 0,
                  padding: 0,
                  cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(244,166,35,0.08)",
                  position: "relative",
                  overflow: "hidden",
                  textAlign: "left",
                  transition: "box-shadow 0.2s ease",
                }}
              >
                {/* Photo */}
                <div style={{ position: "relative", width: 95, minHeight: 80, overflow: "hidden", flexShrink: 0 }}>
                  {(p.promoType === "graphic" && p.imageUrl) ? (
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="95px" />
                  ) : dish?.photos?.[0] ? (
                    <Image src={dish.photos[0]} alt={dish.name} fill className="object-cover" sizes="95px" />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e8d4b0, #d4b896)" }} />
                  )}
                  {/* Discount badge */}
                  {p.discountPct && (
                    <div style={{
                      position: "absolute", top: 4, left: 4,
                      background: "#10b981", color: "white",
                      fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                      letterSpacing: "0.02em",
                    }}>
                      -{p.discountPct}%
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 12px" }}>
                  <span style={{ display: "inline-block", fontSize: "13px", fontWeight: 700, color: p.daysOfWeek?.length ? "#C23B1E" : "#F4A623", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 3 }}>{p.daysOfWeek?.length ? "HOY" : "OFERTA"}</span>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#0e0e0e", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </p>
                  {p.description && (
                    <p style={{ fontSize: "12.5px", color: "#8a7060", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: p.promoPrice ? 1 : 3, WebkitBoxOrient: "vertical" as any, lineHeight: 1.4 }}>{p.description}</p>
                  )}
                  {(p.promoPrice || (p.promoType !== "graphic" && dish?.price)) && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#F4A623" }}>
                        ${(p.promoPrice || dish?.price)?.toLocaleString("es-CL")}
                      </span>
                      {p.originalPrice && (
                        <span style={{ fontSize: "13px", color: "#999999", textDecoration: "line-through" }}>
                          ${p.originalPrice.toLocaleString("es-CL")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* Fade right — hide when at last card */}
        {promos.length > 1 && activeIdx < promos.length - 1 && (
          <div style={{ position: "absolute", top: 0, right: -20, width: 40, height: "100%", background: "linear-gradient(to right, transparent, #f7f7f5)", pointerEvents: "none", zIndex: 2, transition: "opacity 0.2s ease" }} />
        )}
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
      {selectedPromo && (() => {
        const dish = selectedPromo.dishes[0];
        const isGraphic = selectedPromo.promoType === "graphic" && selectedPromo.imageUrl;
        const heroImg = isGraphic ? selectedPromo.imageUrl! : dish?.photos?.[0];
        const savings = selectedPromo.originalPrice && selectedPromo.promoPrice
          ? selectedPromo.originalPrice - selectedPromo.promoPrice : 0;
        const multiDish = selectedPromo.dishes.length > 1;
        return (
        <>
          <div onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }} style={{ position: "fixed", inset: 0, minHeight: "100dvh", zIndex: 100, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", opacity: modalVisible ? 1 : 0, transition: "opacity 0.3s ease" }} />
          <div
            className="font-[family-name:var(--font-dm)]"
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed", bottom: 0, left: "50%",
              transform: modalVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100%)",
              width: "100%", maxWidth: "100%",
              height: "100dvh",
              background: isGraphic ? "#000" : "white",
              borderRadius: 0,
              zIndex: 101, display: "flex", flexDirection: "column",
              transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              overflow: "hidden",
            }}
          >
            {/* Close button */}
            <button onClick={closeModal} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 10 }}>
              <X size={16} color="white" strokeWidth={2} />
            </button>
            {/* Handle bar — only for product type */}
            {!isGraphic && <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, background: "rgba(0,0,0,0.15)", borderRadius: 100, zIndex: 10 }} />}

            {/* Promo counter */}
            {promos.length > 1 && (
              <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", fontSize: "11px", fontWeight: 600, color: isGraphic ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)", zIndex: 10, letterSpacing: "0.05em" }}>
                {currentPromoIdx + 1} / {promos.length}
              </div>
            )}

            {/* Slide wrapper for swipe transitions */}
            <div
              style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                transform: getPromoTransform(),
                transition: slideIn ? "none" : "transform 0.2s ease-out",
              }}
              onTouchStart={handleModalTouchStart}
              onTouchEnd={handleModalTouchEnd}
            >

            {isGraphic ? (
              /* GRAPHIC PROMO — fullscreen photo, title + price over overlay */
              <div style={{ position: "relative", flex: 1 }}>
                {heroImg && <Image src={heroImg} alt={selectedPromo.name} fill className="object-cover" sizes="100vw" />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 25%, transparent 45%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.88) 100%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 24px 32px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#F4A623", letterSpacing: "0.2em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>✦ OFERTA</span>
                  <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1.1, color: "white", margin: "0 0 8px", textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                    {selectedPromo.name}
                  </h2>
                  {selectedPromo.description && (
                    <p style={{ fontSize: "16px", lineHeight: 1.5, color: "rgba(255,255,255,0.7)", margin: "0 0 12px", maxWidth: 320 }}>
                      {selectedPromo.description}
                    </p>
                  )}
                  {(selectedPromo.promoPrice || selectedPromo.originalPrice) && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      {selectedPromo.promoPrice && <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "20px", fontWeight: 600, color: "#F4A623" }}>${selectedPromo.promoPrice.toLocaleString("es-CL")}</span>}
                      {selectedPromo.originalPrice && selectedPromo.promoPrice && <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>${selectedPromo.originalPrice.toLocaleString("es-CL")}</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* PRODUCT PROMO — scrollable content */
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {(() => {
                  const allPhotos = selectedPromo.dishes.flatMap(d => (d.photos || []).map(url => ({ url, name: d.name }))).filter(p => p.url);
                  if (allPhotos.length === 0) return null;
                  return (
                    <div style={{ position: "relative", width: "100%", height: 340, overflow: "hidden" }}>
                      <div style={{ display: "flex", width: "100%", height: "100%", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
                        {allPhotos.map((p, i) => (
                          <div key={i} style={{ minWidth: "100%", height: "100%", position: "relative", scrollSnapAlign: "start" }}>
                            <Image src={p.url} alt={p.name} fill className="object-cover" sizes="100vw" />
                          </div>
                        ))}
                      </div>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 40%, rgba(0,0,0,0.5) 100%)", pointerEvents: "none" }} />
                      {selectedPromo.discountPct && (
                        <div style={{ position: "absolute", top: 20, left: 20, background: "#10b981", color: "white", padding: "8px 14px", borderRadius: 100, fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", boxShadow: "0 4px 12px rgba(16,185,129,0.4)" }}>-{selectedPromo.discountPct}% OFF</div>
                      )}
                      {allPhotos.length > 1 && (
                        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
                          {allPhotos.map((_, i) => (
                            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "white" : "rgba(255,255,255,0.4)" }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ padding: "16px 24px 40px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <div style={{ width: 14, height: 1, background: "#F4A623", opacity: 0.6 }} />
                    <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#F4A623", letterSpacing: "0.15em", textTransform: "uppercase" }}>OFERTA</span>
                  </div>

                  <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#0e0e0e", margin: "0 0 12px" }}>
                    {selectedPromo.name}
                  </h2>

                  {selectedPromo.description && (
                    <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#4a4a4a", margin: "0 0 20px" }}>{selectedPromo.description}</p>
                  )}

                  {selectedPromo.promoPrice && (
                    <div style={{ padding: "18px 0", borderTop: "1px solid rgba(0,0,0,0.08)", borderBottom: "1px solid rgba(0,0,0,0.08)", marginBottom: 24 }}>
                      <p style={{ fontSize: "11px", fontWeight: 500, color: "#8a8a8a", letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 6px" }}>PRECIO OFERTA</p>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "34px", fontWeight: 600, color: "#F4A623", letterSpacing: "-0.02em", lineHeight: 1 }}>${selectedPromo.promoPrice.toLocaleString("es-CL")}</span>
                        {selectedPromo.originalPrice && <span style={{ fontSize: "16px", color: "#8a8a8a", textDecoration: "line-through" }}>${selectedPromo.originalPrice.toLocaleString("es-CL")}</span>}
                        {savings > 0 && <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: "#10b981", background: "#d1fae5", padding: "6px 10px", borderRadius: 8 }}>Ahorras ${savings.toLocaleString("es-CL")}</span>}
                      </div>
                    </div>
                  )}

                  {multiDish && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "18px", fontWeight: 600, color: "#0e0e0e", margin: "0 0 4px" }}>Qué incluye</h3>
                      <p style={{ fontSize: "12.5px", color: "#8a8a8a", margin: "0 0 14px" }}>{selectedPromo.dishes.length} platos en esta oferta</p>
                      <div style={{ background: "#fafaf8", borderRadius: 18, padding: 6 }}>
                        {selectedPromo.dishes.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: "white", marginBottom: 4 }}>
                            {d.photos?.[0] && <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", position: "relative", flexShrink: 0 }}><Image src={d.photos[0]} alt={d.name} fill className="object-cover" sizes="48px" /></div>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: "14px", fontWeight: 600, color: "#0e0e0e", margin: 0 }}>{d.name}</p>
                              <p style={{ fontSize: "11px", color: "#8a8a8a", margin: "2px 0 0" }}>${d.price.toLocaleString("es-CL")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
            )}
            </div>{/* end slide wrapper */}
          </div>
        </>
        );
      })()}
    </>
  );
}
