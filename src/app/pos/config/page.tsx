// La configuración del POS vive dentro de la SPA (/pos) como panel ("Configuración").
// La SPA abre el panel correcto según la URL (/pos/config → panel config). Antes
// había aquí una página de config standalone ya deprecada que, al refrescar en
// /pos/config, aparecía en vez del panel nuevo. Ahora esta ruta renderiza la MISMA
// SPA, así el refresco en /pos/config muestra el panel de configuración, consistente.
export { default } from '../page'
