import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.hydraagro.sbs",
  "https://hydraagro.sbs",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

function originAllowed(origin: string) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https?:\/\/localhost:\d{2,5}$/.test(origin);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, x-supabase-api-version, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
  if (origin && originAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

type Purpose = "login_code" | "signup" | "password_reset" | "password_change";
type ChallengePurpose = Exclude<Purpose, "login_code">;
type GuardRow = { id: string; window_started_at: string; last_sent_at: string | null; request_count: number };
type ChallengeRow = { id: string; code_hash: string; expires_at: string; attempts: number; verified_at: string | null; verification_token_hash: string | null; consumed_at: string | null };

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(bytes).padStart(6, "0");
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function challengeTitle(purpose: ChallengePurpose) {
  if (purpose === "signup") return "Confirme a criação da sua conta";
  if (purpose === "password_change") return "Confirme a troca da sua senha";
  return "Confirme a recuperação da sua senha";
}

function challengeCopy(purpose: ChallengePurpose) {
  if (purpose === "signup") return "Digite este código no Hydra Agro para confirmar seu e-mail e criar a conta.";
  if (purpose === "password_change") return "Digite este código no Hydra Agro antes de salvar uma nova senha.";
  return "Digite este código no Hydra Agro para continuar a recuperação da sua senha.";
}

function emailCodeHtml(code: string, title = "Seu código de acesso", copy = "Use este código para entrar com segurança. Ele é de uso único.") {
  const safeCode = escapeHtml(code);
  const safeTitle = escapeHtml(title);
  const safeCopy = escapeHtml(copy);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="margin:0;background:#FAF8F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18352A"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 14px;background:#FAF8F1"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #E5E7E2;border-radius:22px;overflow:hidden"><tr><td style="height:6px;background:#FF8A12"></td></tr><tr><td style="padding:30px 34px 34px"><div style="font-size:15px;font-weight:800;color:#0B5136">Hydra Agro · Segurança</div><h1 style="margin:28px 0 10px;font-size:29px;line-height:1.16;color:#10281D">${safeTitle}</h1><p style="margin:0;font-size:16px;line-height:1.65;color:#5E6C65">${safeCopy}</p><div style="margin-top:26px;padding:23px 10px;text-align:center;background:#F5F7F3;border:1px solid #E4E8E2;border-radius:17px"><div style="font-size:11px;letter-spacing:1.3px;font-weight:800;color:#7A867F">CÓDIGO DE VERIFICAÇÃO</div><div style="margin-top:11px;font-size:36px;line-height:1;font-weight:800;letter-spacing:8px;color:#0B5136">${safeCode}</div></div><p style="margin:20px 0 0;font-size:14px;line-height:1.65;color:#68766F">Expira em <strong>10 minutos</strong>. Nunca compartilhe este código.</p><p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #ECEEEA;font-size:12px;line-height:1.6;color:#8A938E">Se você não solicitou este código, ignore esta mensagem.</p></td></tr></table></td></tr></table></body></html>`;
}

async function checkGuard(admin: ReturnType<typeof createClient>, id: string, minSeconds: number, maxPerHour: number) {
  const now = Date.now();
  const { data, error } = await admin.from("auth_email_rate_limits").select("id,window_started_at,last_sent_at,request_count").eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as GuardRow | null;
  if (!row) return { allowed: true, count: 1, windowStartedAt: new Date(now).toISOString(), retryAfter: 0 };
  const last = row.last_sent_at ? new Date(row.last_sent_at).getTime() : 0;
  const start = new Date(row.window_started_at).getTime();
  if (last && now - last < minSeconds * 1000) return { allowed: false, count: row.request_count, windowStartedAt: row.window_started_at, retryAfter: Math.max(1, Math.ceil((minSeconds * 1000 - (now - last)) / 1000)) };
  if (!Number.isFinite(start) || now - start >= 3_600_000) return { allowed: true, count: 1, windowStartedAt: new Date(now).toISOString(), retryAfter: 0 };
  if (Number(row.request_count) >= maxPerHour) return { allowed: false, count: row.request_count, windowStartedAt: row.window_started_at, retryAfter: Math.max(60, Math.ceil((3_600_000 - (now - start)) / 1000)) };
  return { allowed: true, count: Number(row.request_count) + 1, windowStartedAt: row.window_started_at, retryAfter: 0 };
}

async function saveGuard(admin: ReturnType<typeof createClient>, id: string, purpose: Purpose, count: number, windowStartedAt: string) {
  const now = new Date().toISOString();
  const { error } = await admin.from("auth_email_rate_limits").upsert({ id, purpose, request_count: count, window_started_at: windowStartedAt, last_sent_at: now, updated_at: now }, { onConflict: "id" });
  if (error) throw error;
}

async function latestChallenge(admin: ReturnType<typeof createClient>, email: string, purpose: ChallengePurpose) {
  const { data, error } = await admin.from("auth_email_challenges")
    .select("id,code_hash,expires_at,attempts,verified_at,verification_token_hash,consumed_at")
    .eq("email", email).eq("purpose", purpose).is("consumed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as ChallengeRow | null;
}

async function verifyChallenge(admin: ReturnType<typeof createClient>, serviceRoleKey: string, email: string, purpose: ChallengePurpose, code: string) {
  const challenge = await latestChallenge(admin, email, purpose);
  if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) return { ok: false as const, message: "Código expirado. Solicite um novo código." };
  if (challenge.attempts >= 5) return { ok: false as const, message: "Muitas tentativas. Solicite um novo código." };
  const expected = await digest(`${serviceRoleKey}:${purpose}:${email}:${code}`);
  if (expected !== challenge.code_hash) {
    await admin.from("auth_email_challenges").update({ attempts: challenge.attempts + 1, updated_at: new Date().toISOString() }).eq("id", challenge.id);
    return { ok: false as const, message: "Código inválido. Confira e tente novamente." };
  }
  return { ok: true as const, challenge };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!originAllowed(origin)) return json(req, { ok: false, message: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "Método não permitido." }, 405, { Allow: "POST, OPTIONS" });

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) return json(req, { ok: false, message: "Requisição muito grande." }, 413);

  try {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(req, { ok: false, message: "Dados inválidos." }, 400);

    const action = (body as Record<string, unknown>).action === "verify" ? "verify" : "request";
    const rawPurpose = String((body as Record<string, unknown>).purpose ?? "");
    const purpose = (["login_code", "signup", "password_reset", "password_change"] as Purpose[]).includes(rawPurpose as Purpose) ? rawPurpose as Purpose : null;
    const email = String((body as Record<string, unknown>).email ?? "").trim().toLowerCase();
    const platform = (body as Record<string, unknown>).platform === "native" ? "native" : "web";
    if (!purpose || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json(req, { ok: false, message: "Informe um e-mail válido." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("HYDRA_EMAIL_FROM")?.trim();
    const appUrl = (Deno.env.get("HYDRA_APP_URL")?.trim() || "https://www.hydraagro.sbs").replace(/\/$/, "");
    if (!supabaseUrl || !serviceRoleKey || !resendKey || !from) return json(req, { ok: false, message: "O envio por e-mail está temporariamente indisponível." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    if (action === "verify") {
      if (purpose === "login_code") return json(req, { ok: false, message: "Use a validação de login do Supabase." }, 400);
      const code = String((body as Record<string, unknown>).code ?? "").replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) return json(req, { ok: false, message: "Digite o código de 6 dígitos." }, 400);

      const verified = await verifyChallenge(admin, serviceRoleKey, email, purpose, code);
      if (!verified.ok) return json(req, { ok: false, message: verified.message }, 400);

      if (purpose === "password_reset") {
        const redirectTo = platform === "native" ? "br.com.hydraagro.app://auth/recovery" : `${appUrl}/auth/recovery`;
        const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } } as never);
        if (error || !data?.properties?.action_link) return json(req, { ok: false, message: "Não foi possível iniciar a troca de senha agora." }, 503);
        await admin.from("auth_email_challenges").update({ verified_at: new Date().toISOString(), consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", verified.challenge.id);
        return json(req, { ok: true, actionLink: data.properties.action_link });
      }

      const verificationToken = randomToken();
      const tokenHash = await digest(`${serviceRoleKey}:${purpose}:${email}:${verificationToken}`);
      await admin.from("auth_email_challenges").update({ verified_at: new Date().toISOString(), verification_token_hash: tokenHash, updated_at: new Date().toISOString() }).eq("id", verified.challenge.id);
      return json(req, { ok: true, verificationToken });
    }

    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim().slice(0, 80);
    const emailGuardId = await digest(`hydra:${purpose}:email:${email}`);
    const ipGuardId = await digest(`hydra:${purpose}:ip:${ip}`);
    const emailMinSeconds = purpose === "login_code" ? 45 : 60;
    const emailMaxPerHour = purpose === "login_code" ? 6 : 5;
    const [emailGuard, ipGuard] = await Promise.all([
      checkGuard(admin, emailGuardId, emailMinSeconds, emailMaxPerHour),
      checkGuard(admin, ipGuardId, 4, 20),
    ]);

    if (!emailGuard.allowed || !ipGuard.allowed) {
      const retryAfter = Math.max(emailGuard.retryAfter, ipGuard.retryAfter, 1);
      return json(req, { ok: false, code: "RATE_LIMIT", retryAfter, message: "Muitas solicitações. Aguarde e tente novamente." }, 429, { "Retry-After": String(retryAfter) });
    }

    let code = "";
    let subject = "";
    let html = "";

    if (purpose === "login_code") {
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email } as never);
      // Resposta neutra: não revelamos se o e-mail existe.
      if (error || !data?.properties) return json(req, { ok: true });
      code = String((data.properties as unknown as { email_otp?: string }).email_otp ?? "").replace(/\D/g, "").slice(0, 10);
      if (!/^\d{6,10}$/.test(code)) return json(req, { ok: true });
      subject = `${code} · seu código de acesso ao Hydra Agro`;
      html = emailCodeHtml(code);
    } else {
      code = randomCode();
      const codeHash = await digest(`${serviceRoleKey}:${purpose}:${email}:${code}`);
      const now = new Date();
      await admin.from("auth_email_challenges").update({ consumed_at: now.toISOString(), updated_at: now.toISOString() }).eq("email", email).eq("purpose", purpose).is("consumed_at", null);
      const { error } = await admin.from("auth_email_challenges").insert({ email, purpose, code_hash: codeHash, expires_at: new Date(now.getTime() + 600_000).toISOString() });
      if (error) throw error;
      subject = `${code} · ${challengeTitle(purpose)} no Hydra Agro`;
      html = emailCodeHtml(code, challengeTitle(purpose), challengeCopy(purpose));
    }

    await Promise.all([
      saveGuard(admin, emailGuardId, purpose, emailGuard.count, emailGuard.windowStartedAt),
      saveGuard(admin, ipGuardId, purpose, ipGuard.count, ipGuard.windowStartedAt),
    ]);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject, html }),
    });

    if (!response.ok) {
      console.error("auth-email resend error", response.status);
      return json(req, { ok: false, message: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." }, 503);
    }

    return json(req, { ok: true });
  } catch (error) {
    console.error("auth-email unexpected error", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, message: "Não foi possível concluir o envio agora. Tente novamente." }, 500);
  }
});
