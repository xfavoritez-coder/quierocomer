// Service worker de la tienda (PWA del ecommerce por local).
// Instalabilidad + manejo de notificaciones push de estado del pedido.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Fetch passthrough (no cacheamos agresivo: la tienda es dinámica). Tener un
// handler de fetch es requisito para que el navegador considere la app instalable.
self.addEventListener("fetch", () => {});

// Notificación push de estado del pedido ("Tu pedido está listo / en camino…").
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "Tu pedido";
  const options = {
    body: data.body || "Hay una actualización de tu pedido.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "order-status",
    renotify: true,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
