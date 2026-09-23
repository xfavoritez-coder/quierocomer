import { redirect } from "next/navigation";

/**
 * La gestión de Repartidores se movió al pilar Centro de pedidos
 * (/panel/centro-pedidos/repartidores). Esta ruta vieja redirige para no
 * romper enlaces guardados por el staff.
 */
export default function RepartidoresMoved() {
  redirect("/panel/centro-pedidos/repartidores");
}
