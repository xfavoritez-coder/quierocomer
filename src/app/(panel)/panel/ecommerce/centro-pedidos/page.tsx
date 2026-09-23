import { redirect } from "next/navigation";

/**
 * Centro de pedidos salió de Ecommerce y ahora es su propio pilar en
 * /panel/centro-pedidos (habilitado por el superadmin con centroPedidosEnabled).
 * Esta ruta vieja redirige para no romper enlaces guardados por el staff.
 */
export default function CentroPedidosMoved() {
  redirect("/panel/centro-pedidos");
}
