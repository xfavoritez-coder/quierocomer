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

interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  position: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  position: number;
  options: ModifierOption[];
}

interface ModifierTemplate {
  id: string;
  name: string;
  groups: ModifierGroup[];
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
  modifierTemplates?: ModifierTemplate[];
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

export default function PromoCarousel({ restaurantId, onViewDish, initialPromos, compact }: Props & { compact?: boolean }) {
  const [promos, setPromos] = useState<Promo[]>(initialPromos || []);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [modifierSelections, setModifierSelections] = useState<Record<string, Set<string>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(new Set<string>());

  // Reset modifier selections when switching promos (initialize with defaults)
  useEffect(() => {
    if (!selectedPromo?.modifierTemplates?.length) {
      setModifierSelections({});
      return;
    }
    const initial: Record<string, Set<string>> = {};
    for (const tpl of selectedPromo.modifierTemplates) {
      for (const g of tpl.groups) {
        const defaults = g.options.filter(o => o.isDefault).map(o => o.id);
        initial[g.id] = new Set(defaults);
      }
    }
    setModifierSelections(initial);
  }, [selectedPromo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleModifierOption = useCallback((group: ModifierGroup, optionId: string) => {
    setModifierSelections(prev => {
      const current = new Set(prev[group.id] || []);
      if (group.maxSelect === 1) {
        // Radio behavior
        return { ...prev, [group.id]: new Set([optionId]) };
      }
      // Checkbox behavior
      if (current.has(optionId)) {
        current.delete(optionId);
      } else if (current.size < group.maxSelect) {
        current.add(optionId);
      }
      return { ...prev, [group.id]: new Set(current) };
    });
  }, []);

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

  const modalContentRef = useRef<HTMLDivElement>(null);

  const handleModalTouchStart = (e: React.TouchEvent) => {
    touchRef2.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleModalTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef2.current) return;
    const dx = touchRef2.current.x - e.changedTouches[0].clientX;
    const dy = touchRef2.current.y - e.changedTouches[0].clientY;
    touchRef2.current = null;
    // Swipe left/right → navigate promos
    if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
      if (dx > 0) goNextPromo();
      else goPrevPromo();
      return;
    }
    // Swipe down → close (only when scrolled to top)
    const el = modalContentRef.current;
    const atTop = !el || el.scrollTop <= 0;
    if (atTop && dy < -100 && Math.abs(dx) < 80) {
      closeModal();
    }
  };

  const getPromoTransform = () => {
    if (slideOut === "left") return "translateX(-100%)";
    if (slideOut === "right") return "translateX(100%)";
    if (slideIn) return slideRef.current === "left" ? "translateX(100%)" : "translateX(-100%)";
    return "translateX(0)";
  };

  const savedScrollRef = useRef(0);

  const openPromo = (p: Promo) => {
    prevPromoRef.current = null;
    setSelectedPromo(p);
    setModalVisible(true);
    modalOpenedAt.current = Date.now();
    trackPromo(restaurantId, "PROMO_CLICKED", p.dishes[0]?.id);
    // Lock body to prevent iOS gap
    savedScrollRef.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedPromo(null);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedScrollRef.current);
    }, 400);
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
      <div className="font-[family-name:var(--font-dm)]" style={{ padding: compact ? "0 0 0" : "0 20px 0" }}>
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
                  background: "var(--carta-promo-bg)",
                  border: `1px solid var(--carta-promo-border)`,
                  borderRadius: 16,
                  display: "flex", alignItems: "stretch", gap: 0,
                  padding: 0,
                  cursor: "pointer",
                  boxShadow: "var(--carta-promo-shadow)",
                  backdropFilter: "blur(8px)",
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
                  {/* Badge: pill solida naranja con dia.
                       - sin daysOfWeek → 'OFERTA'
                       - con dias → 'OFERTA MIÉRCOLES' (dia actual)
                  */}
                  {(() => {
                    const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
                    const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
                    let label = "OFERTA";
                    if (p.daysOfWeek?.length) {
                      label = `OFERTA ${DAY_NAMES[todayDow]}`;
                    }
                    return (
                      <span style={{
                        display: "inline-block",
                        fontSize: "9.5px",
                        fontWeight: 800,
                        color: "white",
                        background: "var(--carta-accent, #F4A623)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 999,
                        marginBottom: 5,
                      }}>
                        {label}
                      </span>
                    );
                  })()}
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--carta-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </p>
                  {p.description && (
                    <p style={{ fontSize: "12.5px", color: "var(--carta-promo-desc)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: p.promoPrice ? 1 : 3, WebkitBoxOrient: "vertical" as any, lineHeight: 1.4 }}>{p.description}</p>
                  )}
                  {(p.promoPrice || (p.promoType !== "graphic" && dish?.price)) && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--carta-accent, #F4A623)" }}>
                        ${(p.promoPrice || dish?.price)?.toLocaleString("es-CL")}
                      </span>
                      {p.originalPrice && (
                        <span style={{ fontSize: "13px", color: "var(--carta-text3)", textDecoration: "line-through" }}>
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
          <div style={{ position: "absolute", top: 0, right: -20, width: 40, height: "100%", background: "linear-gradient(to right, transparent, var(--carta-bg))", pointerEvents: "none", zIndex: 2, transition: "opacity 0.2s ease" }} />
        )}
        </div>

        {/* Dots */}
        {promos.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 8 }}>
            {promos.map((_, i) => (
              <div key={i} style={{
                width: i === activeIdx ? 16 : 5, height: 5,
                borderRadius: i === activeIdx ? 3 : "50%",
                background: i === activeIdx ? "var(--carta-accent, #F4A623)" : "color-mix(in srgb, var(--carta-accent, #F4A623) 35%, transparent)",
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
              touchAction: "pan-y",
              background: "var(--carta-detail-bg)",
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
            {!isGraphic && <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, background: "var(--carta-card-border)", borderRadius: 100, zIndex: 10 }} />}

            {/* Promo counter */}
            {promos.length > 1 && (
              <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", fontSize: "11px", fontWeight: 600, color: isGraphic ? "rgba(255,255,255,0.5)" : "var(--carta-card-border)", zIndex: 10, letterSpacing: "0.05em" }}>
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
              /* GRAPHIC PROMO — Variante C: imagen 70% arriba, panel blanco abajo
                 con info legible. Antes era fullscreen con overlay y se mezclaba
                 con el texto que la imagen ya traia. */
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Imagen 70% */}
                <div style={{ position: "relative", height: "70%", background: "#000", overflow: "hidden", flexShrink: 0 }}>
                  {heroImg && <Image src={heroImg} alt={selectedPromo.name} fill className="object-cover" sizes="100vw" />}
                </div>
                {/* Panel blanco abajo con info */}
                <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "16px 22px 28px", background: "var(--carta-detail-bg)" }}>
                  {(() => {
                    const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
                    const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
                    const dow = selectedPromo.daysOfWeek;
                    let label = "OFERTA";
                    if (dow?.length) {
                      label = `OFERTA ${DAY_NAMES[todayDow]}`;
                    }
                    return (
                      <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "var(--carta-accent, #F4A623)", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, marginBottom: 10 }}>
                        {label}
                      </span>
                    );
                  })()}
                  <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.15, color: "var(--carta-text)", margin: "0 0 8px" }}>
                    {selectedPromo.name}
                  </h2>
                  {selectedPromo.description && (
                    <p style={{ fontSize: "13.5px", lineHeight: 1.55, color: "var(--carta-text2)", margin: "0 0 14px" }}>
                      {selectedPromo.description}
                    </p>
                  )}
                  {(selectedPromo.promoPrice || selectedPromo.originalPrice) && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      {selectedPromo.promoPrice && <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 700, color: "var(--carta-accent, #F4A623)", lineHeight: 1 }}>${selectedPromo.promoPrice.toLocaleString("es-CL")}</span>}
                      {selectedPromo.originalPrice && selectedPromo.promoPrice && <span style={{ fontSize: "14px", color: "var(--carta-text3)", textDecoration: "line-through" }}>${selectedPromo.originalPrice.toLocaleString("es-CL")}</span>}
                    </div>
                  )}
                  {/* Modifier templates */}
                  {selectedPromo.modifierTemplates && selectedPromo.modifierTemplates.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--carta-text)", margin: "0 0 10px" }}>Personaliza</p>
                      {selectedPromo.modifierTemplates.flatMap(tpl => [...tpl.groups].sort((a, b) => a.position - b.position)).map(group => (
                        <div key={group.id} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--carta-text)", margin: 0 }}>{group.name}</p>
                            {group.minSelect > 0 && (
                              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--carta-accent, #F4A623)", background: "color-mix(in srgb, var(--carta-accent, #F4A623) 12%, transparent)", padding: "2px 7px", borderRadius: 6, letterSpacing: "0.04em" }}>Requerido</span>
                            )}
                          </div>
                          <div style={{ background: "var(--carta-bg)", borderRadius: 12, padding: 4 }}>
                            {[...group.options].sort((a, b) => a.position - b.position).map(opt => {
                              const selected = modifierSelections[group.id]?.has(opt.id) || false;
                              const isRadio = group.maxSelect === 1;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleModifierOption(group, opt.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                                    padding: "9px 11px", borderRadius: 8, border: "none",
                                    background: selected ? "color-mix(in srgb, var(--carta-accent, #F4A623) 8%, transparent)" : "var(--carta-surface)",
                                    cursor: "pointer", marginBottom: 2, textAlign: "left",
                                    outline: selected ? "2px solid var(--carta-accent, #F4A623)" : "1px solid transparent",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <div style={{
                                    width: 18, height: 18, borderRadius: isRadio ? "50%" : 4, flexShrink: 0,
                                    border: selected ? "2px solid var(--carta-accent, #F4A623)" : "2px solid #d0d0d0",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: selected ? "#F4A623" : "var(--carta-surface)",
                                    transition: "all 0.15s ease",
                                  }}>
                                    {selected && (
                                      isRadio
                                        ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white" }} />
                                        : <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    )}
                                  </div>
                                  <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "var(--carta-text)" }}>{opt.name}</span>
                                  {opt.priceAdjustment > 0 && (
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--carta-accent, #F4A623)" }}>+${opt.priceAdjustment.toLocaleString("es-CL")}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedPromo.validUntil && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: "12px", color: "var(--carta-text3)" }}>
                      <span style={{ fontSize: "14px" }}>⏰</span>
                      <span>Válido hasta el {new Date(selectedPromo.validUntil).toLocaleDateString("es-CL")}</span>
                    </div>
                  )}
                  <p style={{ fontSize: "11.5px", color: "#b0a090", marginTop: 18, textAlign: "center", letterSpacing: "0.02em" }}>Solicítala con el garzón o en caja 🙌</p>
                </div>
              </div>
            ) : (
              /* PRODUCT PROMO — scrollable content */
              <div ref={modalContentRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
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
                  {(() => {
                    const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
                    const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
                    const badgeLabel = selectedPromo.daysOfWeek?.length ? `OFERTA ${DAY_NAMES[todayDow]}` : "OFERTA";
                    return (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <div style={{ width: 14, height: 1, background: "var(--carta-accent, #F4A623)", opacity: 0.6 }} />
                        <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--carta-accent, #F4A623)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{badgeLabel}</span>
                      </div>
                    );
                  })()}

                  <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "var(--carta-text)", margin: "0 0 12px" }}>
                    {selectedPromo.name}
                  </h2>

                  {selectedPromo.description && (
                    <p style={{ fontSize: "14px", lineHeight: 1.5, color: "var(--carta-text2)", margin: "0 0 20px" }}>{selectedPromo.description}</p>
                  )}

                  {selectedPromo.promoPrice && (
                    <div style={{ padding: "18px 0", borderTop: "1px solid var(--carta-card-border)", borderBottom: "1px solid var(--carta-card-border)", marginBottom: 24 }}>
                      <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--carta-text3)", letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 6px" }}>PRECIO OFERTA</p>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "34px", fontWeight: 600, color: "var(--carta-accent, #F4A623)", letterSpacing: "-0.02em", lineHeight: 1 }}>${selectedPromo.promoPrice.toLocaleString("es-CL")}</span>
                        {selectedPromo.originalPrice && <span style={{ fontSize: "16px", color: "var(--carta-text3)", textDecoration: "line-through" }}>${selectedPromo.originalPrice.toLocaleString("es-CL")}</span>}
                      </div>
                    </div>
                  )}

                  {multiDish && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "18px", fontWeight: 600, color: "var(--carta-text)", margin: "0 0 4px" }}>Qué incluye</h3>
                      <p style={{ fontSize: "12.5px", color: "var(--carta-text3)", margin: "0 0 14px" }}>{selectedPromo.dishes.length} platos en esta oferta</p>
                      <div style={{ background: "var(--carta-bg)", borderRadius: 18, padding: 6 }}>
                        {selectedPromo.dishes.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: "var(--carta-surface)", marginBottom: 4 }}>
                            {d.photos?.[0] && <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", position: "relative", flexShrink: 0 }}><Image src={d.photos[0]} alt={d.name} fill className="object-cover" sizes="48px" /></div>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--carta-text)", margin: 0 }}>{d.name}</p>
                              <p style={{ fontSize: "11px", color: "var(--carta-text3)", margin: "2px 0 0" }}>${d.price.toLocaleString("es-CL")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modifier templates */}
                  {selectedPromo.modifierTemplates && selectedPromo.modifierTemplates.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "18px", fontWeight: 600, color: "var(--carta-text)", margin: "0 0 14px" }}>Personaliza</h3>
                      {selectedPromo.modifierTemplates.flatMap(tpl => [...tpl.groups].sort((a, b) => a.position - b.position)).map(group => (
                        <div key={group.id} style={{ marginBottom: 18 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <p style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--carta-text)", margin: 0 }}>{group.name}</p>
                            {group.minSelect > 0 && (
                              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--carta-accent, #F4A623)", background: "color-mix(in srgb, var(--carta-accent, #F4A623) 12%, transparent)", padding: "2px 7px", borderRadius: 6, letterSpacing: "0.04em" }}>Requerido</span>
                            )}
                          </div>
                          <div style={{ background: "var(--carta-bg)", borderRadius: 14, padding: 4 }}>
                            {[...group.options].sort((a, b) => a.position - b.position).map(opt => {
                              const selected = modifierSelections[group.id]?.has(opt.id) || false;
                              const isRadio = group.maxSelect === 1;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleModifierOption(group, opt.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                                    padding: "10px 12px", borderRadius: 10, border: "none",
                                    background: selected ? "color-mix(in srgb, var(--carta-accent, #F4A623) 8%, transparent)" : "var(--carta-surface)",
                                    cursor: "pointer", marginBottom: 2, textAlign: "left",
                                    outline: selected ? "2px solid var(--carta-accent, #F4A623)" : "1px solid transparent",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  {/* Radio / Checkbox indicator */}
                                  <div style={{
                                    width: 20, height: 20, borderRadius: isRadio ? "50%" : 5, flexShrink: 0,
                                    border: selected ? "2px solid var(--carta-accent, #F4A623)" : "2px solid #d0d0d0",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: selected ? "#F4A623" : "var(--carta-surface)",
                                    transition: "all 0.15s ease",
                                  }}>
                                    {selected && (
                                      isRadio
                                        ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
                                        : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    )}
                                  </div>
                                  <span style={{ flex: 1, fontSize: "13.5px", fontWeight: 500, color: "var(--carta-text)" }}>{opt.name}</span>
                                  {opt.priceAdjustment > 0 && (
                                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--carta-accent, #F4A623)" }}>+${opt.priceAdjustment.toLocaleString("es-CL")}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedPromo.validUntil && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#fef9f0", borderRadius: 14, border: "1px solid #fce8c5" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--carta-accent, #F4A623)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px" }}>⏰</div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--carta-text)", margin: 0 }}>Válido hasta el {new Date(selectedPromo.validUntil).toLocaleDateString("es-CL")}</p>
                        <p style={{ fontSize: "11.5px", color: "#8a5a2c", margin: "2px 0 0" }}>Sujeto a disponibilidad del local</p>
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: "11.5px", color: "#b0a090", marginTop: 18, textAlign: "center", letterSpacing: "0.02em" }}>Solicítala con el garzón o en caja 🙌</p>
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
