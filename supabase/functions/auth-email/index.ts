import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, x-supabase-api-version, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Purpose = "login_code" | "signup" | "password_reset" | "password_change";
type ChallengePurpose = Exclude<Purpose, "login_code">;

type GuardRow = {
  id: string;
  purpose: string;
  window_started_at: string;
  last_sent_at: string | null;
  request_count: number;
};

type ChallengeRow = {
  id: string;
  email: string;
  purpose: ChallengePurpose;
  code_hash: string;
  expires_at: string;
  attempts: number;
  verified_at: string | null;
  verification_token_hash: string | null;
  consumed_at: string | null;
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

function randomCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, "0");
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
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head>
  <body style="margin:0;background:#f4f1e9;font-family:Arial,Helvetica,sans-serif;color:#10281d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;background:#f4f1e9"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffefb;border:1px solid #e3e5df;border-radius:24px;overflow:hidden"><tr><td style="padding:32px 36px;background:#0B5136"><div style="font-size:13px;letter-spacing:1.7px;text-transform:uppercase;color:#d8eadf;font-weight:700">Hydra Agro</div><div style="margin-top:12px;font-size:30px;line-height:1.15;color:#fff;font-weight:800">${safeTitle}</div><div style="margin-top:9px;font-size:15px;line-height:1.55;color:#d8eadf">${safeCopy}</div></td></tr><tr><td style="padding:34px 36px 38px"><div style="padding:22px 12px;text-align:center;background:#f6f7f2;border:1px solid #e6e9e2;border-radius:18px;font-size:35px;line-height:1;letter-spacing:9px;font-weight:800;color:#0B5136">${safeCode}</div><p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#657169">O código expira em 10 minutos e não deve ser compartilhado.</p><p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #eceee8;font-size:12px;line-height:1.55;color:#879089">Hydra Agro • verificação segura</p></td></tr></table></td></tr></table></body></html>`;
}

async function checkGuard(admin: ReturnType<typeof createClient>, id: string, purpose: string, minSeconds: number, maxPerHour: number) {
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

async function saveGuard(admin: ReturnType<typeof createClient>, id: string, purpose: string, count: number, windowStartedAt: string) {
  const now = new Date().toISOString();
  const { error } = await admin.from("auth_email_rate_limits").upsert({ id, purpose, request_count: count, window_started_at: windowStartedAt, last_sent_at: now, updated_at: now }, { onConflict: "id" });
  if (error) throw error;
}

async function latestChallenge(admin: ReturnType<typeof createClient>, email: string, purpose: ChallengePurpose) {
  const { data, error } = await admin.from("auth_email_challenges")
    .select("id,email,purpose,code_hash,expires_at,attempts,verified_at,verification_token_hash,consumed_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ChallengeRow | null;
}

async function verifyChallenge(admin: ReturnType<typeof createClient>, serviceRoleKey: string, email: string, purpose: ChallengePurpose, code: string) {
  const challenge = await latestChallenge(admin, email, purpose);
  if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) return { ok: false as const, message: "Código expirado. Solicite um novo código." };
  if (challenge.attempts >= 5) return { ok: false as const, message: "Muitas tentativas. Solicite um novo código." };
  const codeHash = await digest(`${serviceRoleKey}:${purpose}:${email}:${code}`);
  if (codeHash !== challenge.code_hash) {
    await admin.from("auth_email_challenges").update({ attempts: challenge.attempts + 1, updated_at: new Date().toISOString() }).eq("id", challenge.id);
    return { ok: false as const, message: "Código inválido. Confira e tente novamente." };
  }
  return { ok: true as const, challenge };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Método não permitido." }, 405);

  try {
    const body = await req.json();
    const action = body?.action === "verify" ? "verify" : "request";
    const rawPurpose = String(body?.purpose ?? "");
    const purpose: Purpose | null = ["login_code", "signup", "password_reset", "password_change"].includes(rawPurpose) ? rawPurpose as Purpose : null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const platform = body?.platform === "native" ? "native" : "web";
    if (!purpose || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json({ ok: false, message: "Informe um e-mail válido." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("HYDRA_EMAIL_FROM")?.trim();
    const appUrl = (Deno.env.get("HYDRA_APP_URL")?.trim() || "https://www.hydraagro.sbs").replace(/\/$/, "");
    if (!supabaseUrl || !serviceRoleKey || !resendKey || !from) return json({ ok: false, message: "O envio por e-mail está temporariamente indisponível." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    if (action === "verify") {
      if (purpose === "login_code") return json({ ok: false, message: "Use a validação de login do Supabase." }, 400);
      const code = String(body?.code ?? "").replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) return json({ ok: false, message: "Digite o código de 6 dígitos." }, 400);
      const verified = await verifyChallenge(admin, serviceRoleKey, email, purpose, code);
      if (!verified.ok) return json({ ok: false, message: verified.message }, 400);

      if (purpose === "password_reset") {
        const redirectTo = platform === "native" ? "br.com.hydraagro.app://auth/recovery" : `${appUrl}/auth/recovery`;
        const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } } as never);
        if (error || !data?.properties?.action_link) return json({ ok: false, message: "Não foi possível iniciar a troca de senha agora." }, 503);
        await admin.from("auth_email_challenges").update({ verified_at: new Date().toISOString(), consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", verified.challenge.id);
        return json({ ok: true, actionLink: data.properties.action_link });
      }

      const verificationToken = randomToken();
      const verificationTokenHash = await digest(`${serviceRoleKey}:${purpose}:${email}:${verificationToken}`);
      await admin.from("auth_email_challenges").update({ verified_at: new Date().toISOString(), verification_token_hash: verificationTokenHash, updated_at: new Date().toISOString() }).eq("id", verified.challenge.id);
      return json({ ok: true, verificationToken });
    }

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

    let code = "";
    let subject = "";
    let html = "";

    if (purpose === "login_code") {
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email } as never);
      if (error || !data?.properties) return json({ ok: true });
      code = String((data.properties as unknown as { email_otp?: string }).email_otp ?? "").replace(/\D/g, "").slice(0, 10);
      if (!/^\d{6,10}$/.test(code)) return json({ ok: false, message: "Não foi possível preparar o e-mail agora." }, 503);
      subject = `${code} é seu código do Hydra Agro`;
      html = emailCodeHtml(code);
    } else {
      code = randomCode();
      const codeHash = await digest(`${serviceRoleKey}:${purpose}:${email}:${code}`);
      const now = new Date();
      await admin.from("auth_email_challenges").update({ consumed_at: now.toISOString(), updated_at: now.toISOString() }).eq("email", email).eq("purpose", purpose).is("consumed_at", null);
      const { error } = await admin.from("auth_email_challenges").insert({ email, purpose, code_hash: codeHash, expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString() });
      if (error) throw error;
      subject = `${code} é seu código de verificação do Hydra Agro`;
      html = emailCodeHtml(code, challengeTitle(purpose), challengeCopy(purpose));
    }

    await Promise.all([
      saveGuard(admin, emailGuardId, purpose, emailGuard.count ?? 1, emailGuard.windowStartedAt ?? new Date().toISOString()),
      saveGuard(admin, ipGuardId, purpose, ipGuard.count ?? 1, ipGuard.windowStartedAt ?? new Date().toISOString()),
    ]);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject, html }),
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
