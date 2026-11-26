// Estados del lead en /ventas (se guardan en Lead.crmStatus, el mismo campo que usa /leads).
export const VENTAS_STATUSES = [
  { id: "nuevo", label: "Nuevo", color: "#6b7280", next: "Hacer la demo" },
  { id: "demo_hecha", label: "Demo hecha", color: "#3b82f6", next: "Marcar resultado" },
  { id: "interesado", label: "Interesado", color: "#8b5cf6", next: "Seguimiento en la fecha agendada" },
  { id: "registro_enviado", label: "Registro enviado", color: "#DE7C00", next: "Recordatorio a las 48 h" },
  { id: "registrado", label: "Registrado", color: "#16a34a", next: "Onboarding" },
  { id: "activo", label: "Activo", color: "#15803d", next: "Upsell de otros módulos" },
  { id: "perdido", label: "Perdido", color: "#dc2626", next: "Reintentar en 90 días" },
] as const;

export type VentasStatus = (typeof VENTAS_STATUSES)[number]["id"];

export const statusInfo = (id: string) =>
  VENTAS_STATUSES.find((s) => s.id === id) ?? { id, label: id, color: "#6b7280", next: "" };
