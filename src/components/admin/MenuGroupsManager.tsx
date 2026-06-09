"use client";

import { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const LBL: React.CSSProperties = { fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" as const };

interface MenuGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  categories: { id: string; name: string }[];
}

interface CategoryOption {
  id: string;
  name: string;
}

function SortableGroupCard({ group, isExpanded, onToggle, children }: { group: MenuGroup; isExpanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, marginBottom: 8 }}>
      <div style={{
        background: "var(--adm-card)", border: isExpanded ? `1.5px solid ${GOLD}` : "1px solid var(--adm-card-border)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {/* Header — clickeable */}
        <div
          onClick={onToggle}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}
        >
          {/* Drag handle */}
          <div {...attributes} {...listeners} onClick={e => e.stopPropagation()} style={{ cursor: "grab", padding: "4px 2px", color: "var(--adm-text3)", fontSize: "0.8rem", touchAction: "none" }}>⠿</div>
          {/* Image */}
          <div style={{
            width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0,
            background: group.imageUrl ? undefined : `linear-gradient(135deg, ${GOLD}20, ${GOLD}08)`,
            display: "grid", placeItems: "center",
            border: "1px solid var(--adm-card-border)",
          }}>
            {group.imageUrl ? (
              <img src={group.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: F, fontSize: "18px", fontWeight: 800, color: GOLD, opacity: 0.5 }}>
                {group.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.name}
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>
              {group.categories.length === 0 ? "Sin categorías" : group.categories.map(c => c.name).join(", ")}
            </p>
          </div>
          {/* Chevron */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--adm-text3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {/* Expanded content */}
        {isExpanded && (
          <div style={{ borderTop: "1px solid var(--adm-card-border)", padding: "14px" }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MenuGroupsManager({ restaurantId }: { restaurantId: string }) {
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [multiMenuEnabled, setMultiMenuEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editCatIds, setEditCatIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [groupsRes, catsRes, restRes] = await Promise.all([
      fetch(`/api/admin/menu-groups?restaurantId=${restaurantId}`).then(r => r.json()),
      fetch(`/api/admin/categories?restaurantId=${restaurantId}`).then(r => r.json()),
      fetch(`/api/admin/locales/${restaurantId}`).then(r => r.json()),
    ]);
    setGroups(groupsRes);
    setCategories(catsRes);
    setMultiMenuEnabled(restRes.multiMenuEnabled || false);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async () => {
    setToggling(true);
    await fetch(`/api/admin/locales/${restaurantId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ multiMenuEnabled: !multiMenuEnabled }),
    });
    setMultiMenuEnabled(!multiMenuEnabled);
    setToggling(false);
  };

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      const g = groups.find(x => x.id === id);
      if (g) {
        setEditName(g.name);
        setEditDesc(g.description || "");
        setEditImageUrl(g.imageUrl || null);
        setEditCatIds(new Set(g.categories.map(c => c.id)));
      }
      setExpandedId(id);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/admin/menu-groups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, name: newName.trim(), description: newDesc.trim() || undefined }),
    });
    if (res.ok) { setNewName(""); setNewDesc(""); setShowCreate(false); await fetchData(); }
    setCreating(false);
  };

  const handleSave = async () => {
    if (!expandedId || saving) return;
    setSaving(true);
    await fetch("/api/admin/menu-groups", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: expandedId, name: editName.trim(), description: editDesc.trim() || null, imageUrl: editImageUrl || null, categoryIds: Array.from(editCatIds) }),
    });
    await fetchData();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este menú? Las categorías se desvinculan pero no se borran.")) return;
    await fetch("/api/admin/menu-groups", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (expandedId === id) setExpandedId(null);
    await fetchData();
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "general");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setEditImageUrl(data.url);
    } catch { /* ignore */ }
    setUploadingImage(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex(g => g.id === active.id);
    const newIdx = groups.findIndex(g => g.id === over.id);
    const reordered = arrayMove(groups, oldIdx, newIdx);
    setGroups(reordered);
    await fetch("/api/admin/menu-groups/reorder", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, ids: reordered.map(g => g.id) }),
    });
  };

  // Categories already assigned to OTHER groups
  const assignedElsewhere = new Set(
    groups.filter(g => g.id !== expandedId).flatMap(g => g.categories.map(c => c.id)),
  );

  if (loading) return <p style={{ fontFamily: F, color: "var(--adm-text2)", fontSize: "0.82rem" }}>Cargando...</p>;

  return (
    <div>
      {/* Toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", marginBottom: 14,
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14,
      }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>Multi-Menú</p>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>Un QR, múltiples cartas.</p>
        </div>
        <button onClick={handleToggle} disabled={toggling} style={{
          width: 48, height: 26, borderRadius: 999, border: "none", cursor: "pointer",
          background: multiMenuEnabled ? GOLD : "var(--adm-card-border)",
          position: "relative", flexShrink: 0, transition: "background 0.2s",
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: "50%", background: "white",
            position: "absolute", top: 3, left: multiMenuEnabled ? 25 : 3,
            transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }} />
        </button>
      </div>

      {!multiMenuEnabled && (
        <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", textAlign: "center", padding: "20px 0" }}>
          Activa Multi-Menú para crear grupos de cartas. Tus clientes verán una landing al escanear el QR.
        </p>
      )}

      {multiMenuEnabled && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map(g => (
                <SortableGroupCard key={g.id} group={g} isExpanded={expandedId === g.id} onToggle={() => handleExpand(g.id)}>
                  {/* Edit form inside expanded card */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={LBL}>Nombre</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={INP} />
                    </div>
                    <div>
                      <label style={LBL}>Descripción</label>
                      <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Opcional" style={INP} />
                    </div>

                    {/* Image */}
                    <div>
                      <label style={LBL}>Imagen</label>
                      {editImageUrl ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img src={editImageUrl} alt="" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--adm-card-border)" }} />
                          <button onClick={() => setEditImageUrl(null)} style={{ background: "none", border: "none", color: "#ef4444", fontFamily: F, fontSize: "0.72rem", cursor: "pointer" }}>Quitar</button>
                        </div>
                      ) : (
                        <label style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "10px 0", borderRadius: 8, border: "1px dashed var(--adm-card-border)",
                          cursor: uploadingImage ? "wait" : "pointer", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem",
                        }}>
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
                          {uploadingImage ? "Subiendo..." : "Subir imagen"}
                        </label>
                      )}
                    </div>

                    {/* Categories */}
                    <div>
                      <label style={LBL}>Categorías</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflowY: "auto" }}>
                        {categories.filter(c => !assignedElsewhere.has(c.id)).map(c => (
                          <label key={c.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                            background: editCatIds.has(c.id) ? `${GOLD}10` : "transparent",
                            fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)",
                          }}>
                            <input type="checkbox" checked={editCatIds.has(c.id)} onChange={() => {
                              const next = new Set(editCatIds);
                              if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                              setEditCatIds(next);
                            }} style={{ accentColor: GOLD }} />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleSave} disabled={saving} style={{
                        flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                        background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.82rem",
                        fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1,
                      }}>
                        {saving ? "Guardando..." : "Guardar"}
                      </button>
                      <button onClick={() => handleDelete(g.id)} style={{
                        padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
                        background: "transparent", color: "#ef4444", fontFamily: F, fontSize: "0.78rem",
                        cursor: "pointer",
                      }}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </SortableGroupCard>
              ))}
            </SortableContext>
          </DndContext>

          {/* Create new */}
          {showCreate ? (
            <div style={{ padding: "14px", marginBottom: 8, background: "var(--adm-card)", border: `1px dashed ${GOLD}`, borderRadius: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={LBL}>Nombre del menú</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Boro, Bebestibles" style={INP} autoFocus />
                </div>
                <div>
                  <label style={LBL}>Descripción</label>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Opcional" style={INP} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreate} disabled={creating || !newName.trim()} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                    background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.82rem",
                    fontWeight: 700, cursor: "pointer", opacity: creating || !newName.trim() ? 0.6 : 1,
                  }}>
                    {creating ? "Creando..." : "Crear"}
                  </button>
                  <button onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }} style={{
                    padding: "8px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)",
                    background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", cursor: "pointer",
                  }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)} style={{
              width: "100%", padding: "12px 0", borderRadius: 10,
              border: "1px dashed var(--adm-card-border)", background: "transparent",
              color: GOLD, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
            }}>
              + Agregar menú
            </button>
          )}

          {groups.length < 2 && groups.length > 0 && (
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", textAlign: "center", marginTop: 10 }}>
              Necesitas al menos 2 menús para que la landing aparezca al escanear el QR.
            </p>
          )}
        </>
      )}
    </div>
  );
}
