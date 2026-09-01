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
    "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, x-supabase-api-version, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
  if (origin && originAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function canonicalCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function hashCode(value: string) {
  const bytes = new TextEncoder().encode(canonicalCode(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function smallDelay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!originAllowed(origin)) return json(req, { ok: false, message: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "Método não permitido." }, 405, { Allow: "POST, OPTIONS" });

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) return json(req, { ok: false, message: "Requisição muito grande." }, 413);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(req, { ok: false, message: "Login de funcionário indisponível agora." }, 503);

  try {
    const payload = await req.json().catch(() => ({}));
    const normalized = canonicalCode(String(payload?.code ?? ""));
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim().slice(0, 80);
    const codeHash = await hashCode(normalized || "invalid");

    const [minuteGuard, hourGuard, codeGuard] = await Promise.all([
      admin.rpc("consume_service_rate_limit", { p_bucket: `staff-ip-minute:${ip}`, p_limit: 12, p_window_seconds: 60 }),
      admin.rpc("consume_service_rate_limit", { p_bucket: `staff-ip-hour:${ip}`, p_limit: 80, p_window_seconds: 3600 }),
      admin.rpc("consume_service_rate_limit", { p_bucket: `staff-code:${codeHash}`, p_limit: 5, p_window_seconds: 600 }),
    ]);

    const guards = [minuteGuard.data, hourGuard.data, codeGuard.data] as Array<{ allowed?: boolean; retryAfter?: number } | null>;
    if (minuteGuard.error || hourGuard.error || codeGuard.error) {
      console.error("staff-code-login rate limit unavailable");
      return json(req, { ok: false, message: "Proteção de acesso temporariamente indisponível. Tente novamente." }, 503);
    }
    const blocked = guards.filter((guard) => guard?.allowed === false);
    if (blocked.length) {
      const retryAfter = Math.max(1, ...blocked.map((guard) => Number(guard?.retryAfter || 1)));
      await smallDelay(350);
      return json(req, { ok: false, message: "Muitas tentativas. Aguarde e tente novamente." }, 429, { "Retry-After": String(retryAfter) });
    }

    if (!/^HA[A-Z2-9]{12}$/.test(normalized)) {
      await smallDelay(350);
      return json(req, { ok: false, message: "Código de funcionário inválido ou desativado." }, 401);
    }

    const hash = await hashCode(normalized);
    const { data: member, error: memberError } = await admin
      .from("property_members")
      .select("id,user_id,login_count")
      .eq("access_code_hash", hash)
      .eq("active", true)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      await smallDelay(350);
      return json(req, { ok: false, message: "Código de funcionário inválido ou desativado." }, 401);
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(member.user_id);
    const email = userData.user?.email;
    if (userError || !email) throw userError ?? new Error("Conta do funcionário indisponível.");

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkError) throw linkError;
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) throw new Error("Token de acesso não gerado.");

    await admin.from("property_members").update({
      last_login_at: new Date().toISOString(),
      login_count: Number(member.login_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", member.id);

    return json(req, { ok: true, tokenHash });
  } catch (error) {
    console.error("staff-code-login error", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, message: "Não foi possível entrar com o código agora. Tente novamente." }, 500);
  }
});
