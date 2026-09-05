import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { requireSupabase } from "./supabase";

const TOKEN_KEY = "hydra.push.token";
const PLATFORM_KEY = "hydra.push.platform";

async function syncPushToken(token: string, platform: string) {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const { error } = await client.from("push_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  if (error) throw error;
  return true;
}

export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== "granted") permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.removeAllListeners();

  await PushNotifications.addListener("registration", async (token) => {
    const platform = Capacitor.getPlatform();
    await Preferences.set({ key: TOKEN_KEY, value: token.value });
    await Preferences.set({ key: PLATFORM_KEY, value: platform });
    await syncPushToken(token.value, platform).catch((error) => console.warn("Hydra push token sync failed", error));
    window.dispatchEvent(new CustomEvent("hydra:push-token", { detail: { token: token.value, platform } }));
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("Hydra push registration failed", error);
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    window.dispatchEvent(new CustomEvent("hydra:push-received", { detail: notification }));
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data || {};
    window.dispatchEvent(new CustomEvent("hydra:push-open", { detail: data }));
  });

  const stored = await getStoredPushRegistration();
  if (stored) void syncPushToken(stored.token, stored.platform).catch(() => undefined);
  await PushNotifications.register();
}

export async function getStoredPushRegistration() {
  const token = (await Preferences.get({ key: TOKEN_KEY })).value;
  const platform = (await Preferences.get({ key: PLATFORM_KEY })).value;
  return token ? { token, platform: platform || Capacitor.getPlatform() } : null;
}
