self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "QuieroComer", {
      body: data.body || "",
      icon: "/landing/logo.png",
      badge: "/landing/logo.png",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/admin/funnel" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin/funnel";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/admin") && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
