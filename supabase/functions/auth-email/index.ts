import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Purpose = "login_code" | "password_recovery";

type GuardRow = {
  id: string;
  purpose: Purpose;
  window_started_at: string;
  last_sent_at: string | null;
  request_count: number;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function emailCodeHtml(code: string) {
  const safeCode = escapeHtml(code);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Código de acesso Hydra Agro</title></head>
  <body style="margin:0;background:#f4f1e9;font-family:Arial,Helvetica,sans-serif;color:#10281d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;background:#f4f1e9"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffefb;border:1px solid #e3e5df;border-radius:24px;overflow:hidden"><tr><td style="padding:32px 36px;background:#0B5136"><div style="font-size:13px;letter-spacing:1.7px;text-transform:uppercase;color:#d8eadf;font-weight:700">Hydra Agro</div><div style="margin-top:12px;font-size:30px;line-height:1.15;color:#fff;font-weight:800">Seu código de acesso</div><div style="margin-top:9px;font-size:15px;line-height:1.55;color:#d8eadf">Use este código para entrar com segurança. Ele é de uso único.</div></td></tr><tr><td style="padding:34px 36px 38px"><div style="padding:22px 12px;text-align:center;background:#f6f7f2;border:1px solid #e6e9e2;border-radius:18px;font-size:35px;line-height:1;letter-spacing:9px;font-weight:800;color:#0B5136">${safeCode}</div><p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#657169">Não compartilhe este código. Se você não tentou entrar no Hydra Agro, ignore este e-mail.</p><p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #eceee8;font-size:12px;line-height:1.55;color:#879089">Hydra Agro • acesso seguro</p></td></tr></table></td></tr></table></body></html>`;
}

function recoveryHtml(actionLink: string) {
  const link = escapeHtml(actionLink);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redefinir senha Hydra Agro</title></head>
  <body style="margin:0;background:#f4f1e9;font-family:Arial,Helvetica,sans-serif;color:#10281d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;background:#f4f1e9"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffefb;border:1px solid #e3e5df;border-radius:24px;overflow:hidden"><tr><td style="padding:32px 36px;background:#0B5136"><div style="font-size:13px;letter-spacing:1.7px;text-transform:uppercase;color:#d8eadf;font-weight:700">Hydra Agro</div><div style="margin-top:12px;font-size:30px;line-height:1.15;color:#fff;font-weight:800">Redefina sua senha</div><div style="margin-top:9px;font-size:15px;line-height:1.55;color:#d8eadf">Recebemos uma solicitação para criar uma nova senha para sua conta.</div></td></tr><tr><td style="padding:34px 36px 38px"><p style="margin:0;font-size:15px;line-height:1.65;color:#59675e">Toque no botão abaixo para continuar pelo fluxo seguro do Supabase. O link é temporário e só deve ser usado por você.</p><table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px"><tr><td style="background:#FF8A12;border-radius:14px"><a href="${link}" style="display:inline-block;padding:15px 24px;color:#fff;text-decoration:none;font-size:16px;font-weight:800">Criar nova senha</a></td></tr></table><p style="margin:25px 0 0;padding-top:20px;border-top:1px solid #eceee8;font-size:12px;line-height:1.6;color:#879089">Se você não solicitou a troca de senha, ignore este e-mail. Sua senha atual continuará válida.</p></td></tr></table></td></tr></table></body></html>`;
}

async function checkGuard(admin: ReturnType<typeof createClient>, id: string, purpose: Purpose, minSeconds: number, maxPerHour: number) {
  const now = Date.now();
  const { data, error } = await admin.from("auth_email_rate_limits").select("id,purpose,window_started_at,last_sent_at,request_count").eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as GuardRow | null;
  if (!row) return { allowed: true, count: 1, windowStartedAt: new Date(now).toISOString() };
  const last = row.last_sent_at ? new Date(row.last_sent_at).getTime() : 0;
  const windowStart = new Date(row.window_started_at).getTime();
  if (last && now - last < minSeconds * 1000) return { allowed: false, retryAfter: Math.max(1, Math.ceil((minSeconds * 1000 - (now - last)) / 1000)) };
  if (!Number.isFinite(windowStart) || now - windowStart >= 60 * 60 * 1000) return { allowed: true, count: 1, windowStartedAt: new Date(now).toISOString() };
  if (Number(row.request_count) >= maxPerHour) return { allowed: false, retryAfter: Math.max(60, Math.ceil((60 * 60 * 1000 - (now - windowStart)) / 1000)) };
  return { allowed: true, count: Number(row.request_count) + 1, windowStartedAt: row.window_started_at };
}

async function saveGuard(admin: ReturnType<typeof createClient>, id: string, purpose: Purpose, count: number, windowStartedAt: string) {
  const now = new Date().toISOString();
  await admin.from("auth_email_rate_limits").upsert({ id, purpose, request_count: count, window_started_at: windowStartedAt, last_sent_at: now, updated_at: now }, { onConflict: "id" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Método não permitido." }, 405);

  try {
    const body = await req.json();
    const purpose = body?.purpose === "password_recovery" ? "password_recovery" : body?.purpose === "login_code" ? "login_code" : null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const platform = body?.platform === "native" ? "native" : "web";
    if (!purpose || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json({ ok: false, message: "Informe um e-mail válido." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("HYDRA_EMAIL_FROM")?.trim();
    const appUrl = (Deno.env.get("HYDRA_APP_URL")?.trim() || "https://www.hydraagro.sbs").replace(/\/$/, "");
    if (!supabaseUrl || !serviceRoleKey || !resendKey || !from) {
      console.error("auth-email missing server configuration");
      return json({ ok: false, message: "O envio por e-mail está temporariamente indisponível." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
    const emailGuardId = await digest(`hydra:${purpose}:email:${email}`);
    const ipGuardId = await digest(`hydra:${purpose}:ip:${ip}`);
    const [emailGuard, ipGuard] = await Promise.all([
      checkGuard(admin, emailGuardId, purpose, 60, 5),
      checkGuard(admin, ipGuardId, purpose, 4, 20),
    ]);
    if (!emailGuard.allowed || !ipGuard.allowed) {
      const retryAfter = Math.max(emailGuard.retryAfter ?? 0, ipGuard.retryAfter ?? 0, 1);
      return json({ ok: false, code: "RATE_LIMIT", retryAfter, message: retryAfter <= 90 ? `Aguarde ${retryAfter} segundos para tentar novamente.` : "Muitas solicitações. Tente novamente mais tarde." }, 429);
    }

    const redirectTo = platform === "native" ? "br.com.hydraagro.app://auth/recovery" : `${appUrl}/auth/recovery`;
    const params = purpose === "login_code"
      ? { type: "magiclink" as const, email }
      : { type: "recovery" as const, email, options: { redirectTo } };
    const { data, error } = await admin.auth.admin.generateLink(params as never);

    await Promise.all([
      saveGuard(admin, emailGuardId, purpose, emailGuard.count ?? 1, emailGuard.windowStartedAt ?? new Date().toISOString()),
      saveGuard(admin, ipGuardId, purpose, ipGuard.count ?? 1, ipGuard.windowStartedAt ?? new Date().toISOString()),
    ]);

    if (error || !data?.properties) {
      if (error) console.info("auth-email generateLink skipped", error.code || error.message);
      return json({ ok: true });
    }

    const properties = data.properties as unknown as { email_otp?: string; action_link?: string };
    const isCode = purpose === "login_code";
    const code = String(properties.email_otp ?? "").replace(/\D/g, "").slice(0, 10);
    const actionLink = String(properties.action_link ?? "");
    if ((isCode && !/^\d{6,10}$/.test(code)) || (!isCode && !/^https:\/\//i.test(actionLink))) {
      console.error("auth-email generated payload missing expected property", purpose);
      return json({ ok: false, message: "Não foi possível preparar o e-mail agora. Tente novamente." }, 503);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: isCode ? `${code} é seu código do Hydra Agro` : "Redefina sua senha do Hydra Agro",
        html: isCode ? emailCodeHtml(code) : recoveryHtml(actionLink),
      }),
    });
    if (!response.ok) {
      console.error("auth-email resend error", response.status, await response.text());
      return json({ ok: false, message: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." }, 503);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("auth-email unexpected error", error);
    return json({ ok: false, message: "Não foi possível concluir o envio agora. Tente novamente." }, 500);
  }
});
