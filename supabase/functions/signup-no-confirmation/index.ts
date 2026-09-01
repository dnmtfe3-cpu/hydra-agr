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
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, x-hydra-signup-proof, x-supabase-api-version, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
  if (origin && originAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeHtml(value: unknown) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function firstName(value: string) { return value.trim().split(/\s+/)[0] || "produtor"; }
async function digest(value: string) { const bytes = new TextEncoder().encode(value); const hash = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left: string, right: string) { if (left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i); return diff === 0; }

function sanitizeProperty(raw: unknown) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const short = (key: string, max: number) => typeof input[key] === "string" ? String(input[key]).trim().slice(0, max) : "";
  const stringArray = (key: string, maxItems = 20, maxLength = 80) => Array.isArray(input[key]) ? (input[key] as unknown[]).filter((value) => typeof value === "string").slice(0, maxItems).map((value) => String(value).trim().slice(0, maxLength)).filter(Boolean) : [];
  return {
    name: short("name", 120),
    municipality: short("municipality", 120),
    state: short("state", 2).toUpperCase(),
    postalCode: short("postalCode", 10),
    area: short("area", 32),
    areaUnit: short("areaUnit", 32),
    type: short("type", 80),
    mainActivity: short("mainActivity", 100),
    otherActivities: stringArray("otherActivities"),
    approximateAnimals: short("approximateAnimals", 20),
    waterKinds: stringArray("waterKinds"),
    locationDetails: short("locationDetails", 300),
    municipalityIbgeCode: short("municipalityIbgeCode", 20),
    stateName: short("stateName", 80),
    region: short("region", 80),
    street: short("street", 160),
    district: short("district", 120),
    addressComplement: short("addressComplement", 160),
    ddd: short("ddd", 3),
  };
}

function welcomeEmailHtml(name: string, propertyName: string, appUrl: string) {
  const safeName = escapeHtml(firstName(name));
  const safeProperty = escapeHtml(propertyName || "sua propriedade");
  const safeUrl = escapeHtml(appUrl);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Bem-vindo ao Hydra Agro</title></head>
<body style="margin:0;background:#FAF8F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18352A;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Sua conta no Hydra Agro está pronta.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F1;padding:32px 14px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E5E7E2;border-radius:22px;overflow:hidden;box-shadow:0 8px 28px rgba(7,61,42,.06);">
<tr><td style="height:6px;background:#FF8A12;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:30px 34px 22px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:15px;font-weight:800;color:#0B5136;letter-spacing:.2px;">Hydra Agro</td><td align="right"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#EDF5F0;color:#0B5136;font-size:11px;font-weight:700;">CONTA ATIVA</span></td></tr></table>
<h1 style="margin:30px 0 10px;font-size:30px;line-height:1.16;letter-spacing:-.6px;color:#10281D;">Bem-vindo, ${safeName}.</h1>
<p style="margin:0;font-size:16px;line-height:1.65;color:#5E6C65;">Seu cadastro foi concluído e <strong style="color:#18352A;">${safeProperty}</strong> já está pronta para ser gerenciada pelo Hydra Agro.</p>
</td></tr>
<tr><td style="padding:0 34px 34px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F8F4;border:1px solid #E8EAE5;border-radius:16px;"><tr><td style="padding:20px 22px;">
<div style="font-size:13px;font-weight:800;color:#0B5136;margin-bottom:9px;">O QUE VOCÊ JÁ PODE FAZER</div>
<div style="font-size:15px;line-height:1.75;color:#56655D;">Cadastrar animais e setores<br>Organizar atividades e registros da propriedade<br>Usar a Hydra Tag para identificação e acesso rápido às fichas</div>
</td></tr></table>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px;"><tr><td style="background:#0B5136;border-radius:13px;"><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:800;">Abrir Hydra Agro</a></td></tr></table>
<p style="margin:30px 0 0;padding-top:20px;border-top:1px solid #ECEEEA;font-size:12px;line-height:1.6;color:#8A938E;">Este é um e-mail automático do Hydra Agro. Você recebeu esta mensagem porque uma conta foi criada com este endereço.</p>
</td></tr></table>
<div style="padding:18px 8px 0;text-align:center;font-size:12px;color:#939B96;">Hydra Agro · gestão rural conectada</div>
</td></tr></table></body></html>`;
}

async function sendWelcomeEmail(input: { email: string; name: string; propertyName: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("HYDRA_EMAIL_FROM")?.trim();
  const appUrl = Deno.env.get("HYDRA_APP_URL")?.trim() || "https://www.hydraagro.sbs";
  if (!apiKey || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.email], subject: `Sua conta no Hydra Agro está pronta, ${firstName(input.name)}`, html: welcomeEmailHtml(input.name, input.propertyName, appUrl) }),
    });
    if (!response.ok) { console.error("welcome email provider error", response.status); return false; }
    return true;
  } catch (error) { console.error("welcome email unexpected error", error instanceof Error ? error.message : "unknown"); return false; }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!originAllowed(origin)) return json(req, { ok: false, message: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "Método não permitido." }, 405);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 32768) return json(req, { ok: false, message: "Requisição muito grande." }, 413);

  try {
    const payload = await req.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(req, { ok: false, message: "Dados inválidos." }, 400);
    const name = String(payload?.name ?? "").trim().slice(0, 120);
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const phone = String(payload?.phone ?? "").trim().slice(0, 30);
    const password = String(payload?.password ?? "");
    const verificationToken = String(req.headers.get("x-hydra-signup-proof") ?? "").trim();
    const property = sanitizeProperty(payload?.property);

    if (name.length < 2) return json(req, { ok: false, message: "Informe seu nome completo." }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json(req, { ok: false, message: "Informe um e-mail válido." }, 400);
    if (password.length < 8 || password.length > 256) return json(req, { ok: false, message: "A senha precisa ter entre 8 e 256 caracteres." }, 400);
    if (!/^[a-f0-9]{64}$/i.test(verificationToken)) return json(req, { ok: false, code: "EMAIL_CODE_REQUIRED", message: "Confirme o código enviado ao seu e-mail antes de criar a conta." }, 403);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(req, { ok: false, message: "Não foi possível criar a conta agora. Tente novamente em instantes." }, 503);
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: challenge, error: challengeError } = await admin.from("auth_email_challenges")
      .select("id,expires_at,verified_at,verification_token_hash,consumed_at")
      .eq("email", email)
      .eq("purpose", "signup")
      .not("verified_at", "is", null)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError) throw challengeError;

    const proofHash = await digest(`${serviceRoleKey}:signup:${email}:${verificationToken}`);
    if (!challenge || !challenge.verification_token_hash || new Date(String(challenge.expires_at)).getTime() <= Date.now() || !constantTimeEqual(proofHash, String(challenge.verification_token_hash))) {
      return json(req, { ok: false, code: "EMAIL_CODE_REQUIRED", message: "A confirmação de e-mail expirou. Solicite um novo código." }, 403);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, phone, property },
    });
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists") || normalized.includes("duplicate")) {
        return json(req, { ok: false, code: "ACCOUNT_UNAVAILABLE", message: "Não foi possível concluir o cadastro. Se você já possui uma conta, entre normalmente." }, 409);
      }
      console.error("signup-no-confirmation createUser error", error.message);
      return json(req, { ok: false, message: "Não foi possível criar a conta. Confira os dados e tente novamente." }, 400);
    }

    await admin.from("auth_email_challenges").update({
      consumed_at: new Date().toISOString(),
      verification_token_hash: null,
      updated_at: new Date().toISOString(),
    }).eq("id", String(challenge.id)).is("consumed_at", null);

    const welcomeEmailSent = await sendWelcomeEmail({ email, name, propertyName: property.name });
    return json(req, { ok: true, userId: data.user.id, welcomeEmailSent });
  } catch (error) {
    console.error("signup-no-confirmation unexpected error", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, message: "Não foi possível criar a conta. Tente novamente." }, 500);
  }
});
