import { redirect } from "next/navigation";

/**
 * "Tomar pedidos" se movió al pilar Centro de pedidos
 * (/panel/centro-pedidos/tomar-pedidos). Esta ruta vieja redirige para no
 * romper enlaces guardados por el staff.
 */
export default function TomarPedidosMoved() {
  redirect("/panel/centro-pedidos/tomar-pedidos");
}
