self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const url = data.slug ? `/qr/admin/garzon/${data.slug}` : "/qr/admin/garzon";
  const options = {
    body: data.body || "Llamada de cliente",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200, 100, 200],
    tag: "waiter-call-" + data.tableId,
    renotify: true,
    data: { url, ...data },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Llamada", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/qr/admin/garzon";
  // Try to focus existing window first, open new one if none found
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/qr/admin/garzon") || client.url.includes("/garzon")) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
