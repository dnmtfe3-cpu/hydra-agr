import { ensureWebPushSubscription, disableWebPushSubscription, supportsWebPush } from "../../services/web-push";

if (supportsWebPush()) {
  if (Notification.permission === "granted") {
    void ensureWebPushSubscription(false).catch(() => undefined);
  }

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const toggle = target?.closest<HTMLButtonElement>('button[role="switch"][aria-label="Notificações do aplicativo"]');
    if (!toggle) return;
    const enabling = toggle.getAttribute("aria-checked") !== "true";
    if (enabling) {
      void ensureWebPushSubscription(true).catch(() => undefined);
    } else {
      void disableWebPushSubscription().catch(() => undefined);
    }
  }, true);
}