import { Capacitor } from "@capacitor/core";
import { requireSupabase } from "./supabase";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function bytesToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function supportsWebPush() {
  return !Capacitor.isNativePlatform() && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function ensureWebPushSubscription(requestPermission = false) {
  if (!supportsWebPush()) return false;
  if (requestPermission && Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission !== "granted") return false;

  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const { data: publicKey, error: keyError } = await client.rpc("web_push_public_key");
  if (keyError || !publicKey) throw keyError ?? new Error("Chave de notificação indisponível.");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(String(publicKey)),
    });
  }

  const endpoint = subscription.endpoint;
  const p256dh = bytesToBase64Url(subscription.getKey("p256dh"));
  const auth = bytesToBase64Url(subscription.getKey("auth"));
  if (!endpoint || !p256dh || !auth) throw new Error("Assinatura de notificação incompleta.");

  const { error } = await client.from("web_push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent.slice(0, 500),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" });
  if (error) throw error;
  return true;
}

export async function disableWebPushSubscription() {
  if (!supportsWebPush()) return;
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (user && subscription?.endpoint) {
    await client.from("web_push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint);
  }
  if (subscription) await subscription.unsubscribe();
}