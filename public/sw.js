self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Hydra Agro";
  const options = {
    body: data.body || "Você recebeu um novo aviso.",
    icon: "/icon-512.png",
    badge: "/favicon.svg",
    tag: data.notificationId || undefined,
    data: { url: data.url || "https://www.hydraagro.sbs/?open=notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "https://www.hydraagro.sbs/?open=notifications";
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});