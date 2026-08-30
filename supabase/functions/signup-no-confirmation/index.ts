import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, x-supabase-api-version, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "produtor";
}

function welcomeEmailHtml(name: string, propertyName: string, appUrl: string) {
  const safeName = escapeHtml(firstName(name));
  const safeProperty = escapeHtml(propertyName || "sua propriedade");
  const safeUrl = escapeHtml(appUrl);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bem-vindo ao Hydra Agro</title></head><body style="margin:0;background:#f4f1e9;font-family:Arial,Helvetica,sans-serif;color:#10281d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1e9;padding:28px 14px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffefb;border-radius:24px;overflow:hidden;border:1px solid #e3e5df"><tr><td style="background:#0B5136;padding:34px 36px 30px"><div style="font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#d8eadf;font-weight:700">Hydra Agro</div><div style="margin-top:12px;font-size:34px;line-height:1.12;color:#fff;font-weight:800">Bem-vindo, ${safeName}.</div><div style="margin-top:10px;font-size:16px;line-height:1.55;color:#d8eadf">Seu e-mail foi confirmado e ${safeProperty} já pode ser gerenciada no Hydra Agro.</div></td></tr><tr><td style="padding:34px 36px 38px"><div style="font-size:17px;line-height:1.6;color:#536158">Agora você pode cadastrar animais, organizar atividades, acompanhar a propriedade e usar a Hydra Tag para identificação por NFC.</div><table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px"><tr><td style="background:#FF8A12;border-radius:14px"><a href="${safeUrl}" style="display:inline-block;padding:15px 24px;color:#fff;text-decoration:none;font-size:16px;font-weight:800">Abrir Hydra Agro</a></td></tr></table></td></tr></table></td></tr></table></body></html>`;
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
      body: JSON.stringify({ from, to: [input.email], subject: `Bem-vindo ao Hydra Agro, ${firstName(input.name)}!`, html: welcomeEmailHtml(input.name, input.propertyName, appUrl) }),
    });
    if (!response.ok) {
      console.error("welcome email provider error", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("welcome email unexpected error", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Método não permitido." }, 405);

  try {
    const payload = await req.json();
    const name = String(payload?.name ?? "").trim();
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const phone = String(payload?.phone ?? "").trim();
    const password = String(payload?.password ?? "");
    const property = payload?.property && typeof payload.property === "object" ? payload.property : {};

    if (name.length < 2) return json({ ok: false, message: "Informe seu nome completo." });
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, message: "Informe um e-mail válido." });
    if (password.length < 8) return json({ ok: false, message: "A senha precisa ter pelo menos 8 caracteres." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, message: "Não foi possível criar a conta agora. Tente novamente em instantes." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: challenge, error: challengeError } = await admin.from("auth_email_challenges")
      .select("id,expires_at,verified_at,consumed_at")
      .eq("email", email)
      .eq("purpose", "signup")
      .not("verified_at", "is", null)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError) throw challengeError;
    if (!challenge || new Date(String(challenge.expires_at)).getTime() <= Date.now()) {
      return json({ ok: false, code: "EMAIL_CODE_REQUIRED", message: "Confirme o código enviado ao seu e-mail antes de criar a conta." }, 403);
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
        return json({ ok: false, code: "EMAIL_EXISTS", message: "Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail." });
      }
      console.error("signup-no-confirmation createUser error", error);
      return json({ ok: false, message: "Não foi possível criar a conta. Confira os dados e tente novamente." });
    }

    await admin.from("auth_email_challenges").update({ consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", String(challenge.id));
    const propertyName = typeof property?.name === "string" ? property.name.trim() : "";
    const welcomeEmailSent = await sendWelcomeEmail({ email, name, propertyName });
    return json({ ok: true, userId: data.user.id, welcomeEmailSent });
  } catch (error) {
    console.error("signup-no-confirmation unexpected error", error);
    return json({ ok: false, message: "Não foi possível criar a conta. Tente novamente." }, 500);
  }
});
