import { Capacitor } from "@capacitor/core";
import { requireSupabase } from "./services/supabase";
import { DAILY_BRIEFING_CHANNEL_ID } from "./services/daily-briefing";

let channel: ReturnType<ReturnType<typeof requireSupabase>["channel"]> | null = null;
let actionHandle: { remove: () => Promise<void> } | null = null;

function openHydraNotifications() {
  window.focus();
  const notificationButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.getAttribute("aria-label") === "Notificações",
  );
  notificationButton?.click();
}

function openTodayBriefing() {
  window.focus();
  const notificationButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.getAttribute("aria-label") === "Notificações",
  );
  notificationButton?.click();
  window.setTimeout(() => {
    const briefingButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("O que fazer hoje"),
    );
    briefingButton?.click();
  }, 120);
}

async function requestNativeNotificationPermission() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") permission = await LocalNotifications.requestPermissions();
  return permission.display === "granted";
}

async function setupAndroidChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.createChannel({
    id: DAILY_BRIEFING_CHANNEL_ID,
    name: "Hydra Agro",
    description: "Avisos do Hydra Agro sobre propriedade, animais, atividades e alertas.",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  }).catch(() => undefined);
}

async function showNativeNotification(row: { id?: string; title?: string; body?: string }) {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const numericId = Math.abs(
    Array.from(row.id || `${Date.now()}`).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17),
  ) % 2147483000;

  await LocalNotifications.schedule({
    notifications: [{
      id: numericId || Math.floor(Date.now() % 2147483000),
      title: row.title || "Hydra Agro",
      body: row.body || "Você recebeu uma nova notificação.",
      channelId: Capacitor.getPlatform() === "android" ? DAILY_BRIEFING_CHANNEL_ID : undefined,
      sound: "default",
      extra: { route: "notifications", source: "hydra-system", notificationId: row.id || "" },
    }],
  });
}

async function startNativeNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  await setupAndroidChannel();

  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const allowed = await requestNativeNotificationPermission();
  if (!allowed) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  actionHandle = await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    const extra = action.notification.extra || {};
    if (extra.route === "today") openTodayBriefing();
    else openHydraNotifications();
  });

  channel = client
    .channel(`hydra-native-system-notifications-${user.id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
      (payload) => {
        void showNativeNotification(payload.new as { id?: string; title?: string; body?: string });
      },
    )
    .subscribe();
}

if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
  void startNativeNotifications().catch((error) => {
    console.warn("[Hydra Agro] notificações nativas indisponíveis:", error);
  });

  window.addEventListener("beforeunload", () => {
    void actionHandle?.remove();
    const client = requireSupabase();
    if (channel) void client.removeChannel(channel);
  });
}
