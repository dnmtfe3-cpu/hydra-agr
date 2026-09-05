import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "hydra.push.token";
const PLATFORM_KEY = "hydra.push.platform";

export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== "granted") permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.removeAllListeners();

  await PushNotifications.addListener("registration", async (token) => {
    await Preferences.set({ key: TOKEN_KEY, value: token.value });
    await Preferences.set({ key: PLATFORM_KEY, value: Capacitor.getPlatform() });
    window.dispatchEvent(new CustomEvent("hydra:push-token", {
      detail: { token: token.value, platform: Capacitor.getPlatform() },
    }));
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

  await PushNotifications.register();
}

export async function getStoredPushRegistration() {
  const token = (await Preferences.get({ key: TOKEN_KEY })).value;
  const platform = (await Preferences.get({ key: PLATFORM_KEY })).value;
  return token ? { token, platform: platform || Capacitor.getPlatform() } : null;
}
