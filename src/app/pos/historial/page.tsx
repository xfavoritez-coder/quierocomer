// El Historial del POS vive dentro de la SPA (/pos) como panel ("Historial de
// pedidos"). La SPA, al montar, lee la URL (/pos/historial → innerPage='historial')
// y abre el panel correcto. Sin este archivo, refrescar en /pos/historial daba 404
// y caía al home de marketing (quierocomer.com). Mismo patrón que /pos/config.
export { default } from '../page'
