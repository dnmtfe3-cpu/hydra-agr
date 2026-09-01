import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

function json(body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length || left.length < 32) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, message: "Método não permitido." }, 405, { Allow: "POST" });
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) return json({ ok: false, message: "Requisição muito grande." }, 413);

  try {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false }, 400);
    const notificationId = String((body as Record<string, unknown>).notificationId ?? "").trim();
    const token = String((body as Record<string, unknown>).token ?? "").trim();
    if (!/^notification-[0-9a-f-]{36}$/i.test(notificationId) || token.length > 256) return json({ ok: false }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) return json({ ok: false }, 503);
    const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: config, error: configError } = await admin.from("web_push_config").select("vapid_public_key,vapid_private_key,webhook_token").eq("id", true).single();
    if (configError || !config || !constantTimeEqual(token, String(config.webhook_token || ""))) return json({ ok: false }, 401);

    const tokenBucket = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const bucket = Array.from(new Uint8Array(tokenBucket)).slice(0, 10).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data: rate, error: rateError } = await admin.rpc("consume_service_rate_limit", { p_bucket: `web-push:${bucket}`, p_limit: 240, p_window_seconds: 60 });
    if (rateError) return json({ ok: false }, 503);
    const guard = rate as { allowed?: boolean; retryAfter?: number } | null;
    if (guard?.allowed === false) {
      const retryAfter = Math.max(1, Number(guard.retryAfter || 60));
      return json({ ok: false }, 429, { "Retry-After": String(retryAfter) });
    }

    const { data: notification, error: notificationError } = await admin.from("notifications").select("id,recipient_user_id,title,body,kind,created_at").eq("id", notificationId).single();
    if (notificationError || !notification) return json({ ok: false }, 404);
    const createdAt = new Date(String(notification.created_at)).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 24 * 60 * 60 * 1000) return json({ ok: true, skipped: true });

    const { data: profile } = await admin.from("profiles").select("push_notifications").eq("id", notification.recipient_user_id).maybeSingle();
    if (profile?.push_notifications === false) return json({ ok: true, skipped: true });

    const { data: subscriptions, error: subsError } = await admin.from("web_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", notification.recipient_user_id);
    if (subsError) throw subsError;
    if (!subscriptions?.length) return json({ ok: true, sent: 0 });

    webpush.setVapidDetails("mailto:naoresponda@hydraagro.sbs", String(config.vapid_public_key), String(config.vapid_private_key));
    const payload = JSON.stringify({
      title: String(notification.title || "Hydra Agro").slice(0, 120),
      body: String(notification.body || "Você recebeu um novo aviso.").slice(0, 500),
      kind: String(notification.kind || "general").slice(0, 50),
      notificationId: notification.id,
      url: "https://www.hydraagro.sbs/?open=notifications",
    });

    let sent = 0;
    for (const sub of subscriptions.slice(0, 10)) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600, urgency: "normal" });
        sent += 1;
      } catch (error) {
        const status = Number((error as { statusCode?: number })?.statusCode ?? 0);
        if (status === 404 || status === 410) await admin.from("web_push_subscriptions").delete().eq("id", sub.id);
        else console.error("[web-push] send failed", status || "unknown");
      }
    }
    return json({ ok: true, sent });
  } catch (error) {
    console.error("[web-push]", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, message: "Falha no envio push" }, 500);
  }
});