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

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!originAllowed(origin)) return json(req, { ok: false, message: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "Método não permitido." }, 405);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) return json(req, { ok: false, message: "Requisição muito grande." }, 413);

  try {
    const authorization = req.headers.get("authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || jwt.length > 4096) return json(req, { ok: false, message: "Sessão inválida. Entre novamente." }, 401);

    const body = await req.json();
    const newPassword = String(body?.newPassword ?? "");
    const verificationToken = String(body?.verificationToken ?? "").trim();
    if (newPassword.length < 8 || newPassword.length > 256) return json(req, { ok: false, message: "A nova senha precisa ter entre 8 e 256 caracteres." }, 400);
    if (!/^[a-f0-9]{64}$/i.test(verificationToken)) return json(req, { ok: false, message: "Confirme o código enviado ao seu e-mail." }, 403);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(req, { ok: false, message: "Não foi possível atualizar a senha agora." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    const user = userData.user;
    const email = user?.email?.trim().toLowerCase();
    if (userError || !user || !email) return json(req, { ok: false, message: "Sessão inválida. Entre novamente." }, 401);

    const tokenHash = await digest(`${serviceRoleKey}:password_change:${email}:${verificationToken}`);
    const { data: challenge, error: challengeError } = await admin.from("auth_email_challenges")
      .select("id,expires_at,verified_at,consumed_at")
      .eq("email", email)
      .eq("purpose", "password_change")
      .eq("verification_token_hash", tokenHash)
      .not("verified_at", "is", null)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError) throw challengeError;
    if (!challenge || new Date(String(challenge.expires_at)).getTime() <= Date.now()) return json(req, { ok: false, message: "A confirmação expirou. Solicite um novo código." }, 403);

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updateError) {
      console.error("change-password-verified update error", updateError.message);
      return json(req, { ok: false, message: "Não foi possível atualizar a senha agora." }, 500);
    }

    await admin.from("auth_email_challenges")
      .update({ consumed_at: new Date().toISOString(), verification_token_hash: null, updated_at: new Date().toISOString() })
      .eq("id", String(challenge.id))
      .is("consumed_at", null);

    return json(req, { ok: true, message: "Senha atualizada com segurança." });
  } catch (error) {
    console.error("change-password-verified unexpected error", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, message: "Não foi possível atualizar a senha agora." }, 500);
  }
});
