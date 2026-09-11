import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Anima el cierre de overlays (bottom sheets / modales). En vez de desmontar de
 * inmediato, `requestClose` marca `closing=true` (para reproducir la animación de
 * salida) y llama al `onClose` real cuando termina la animación.
 *
 * Uso:
 *   const { closing, requestClose } = useCloseAnimation(onClose);
 *   // clase de salida cuando closing === true; usar requestClose en overlay/X/acciones
 */
export function useCloseAnimation(onClose: () => void, duration = 260) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (timer.current) return; // ya cerrando
    setClosing(true);
    timer.current = setTimeout(onClose, duration);
  }, [onClose, duration]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { closing, requestClose };
}
