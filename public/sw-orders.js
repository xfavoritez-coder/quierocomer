self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || "Nuevo pedido recibido",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    tag: "new-order-" + (data.orderId || Date.now()),
    renotify: true,
    data: { url: "/panel/pedir-online/pedidos", ...data },
  };
  event.waitUntil(
    self.registration.showNotification(data.title || "¡Nuevo pedido!", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/panel/pedir-online/pedidos";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/panel")) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
