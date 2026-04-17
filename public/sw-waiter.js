self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || "Llamada de cliente",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200, 100, 200],
    tag: "waiter-call-" + data.tableId,
    renotify: true,
    data: { url: "/qr/admin/garzon", ...data },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Llamada", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/qr/admin/garzon";
  event.waitUntil(clients.openWindow(url));
});
