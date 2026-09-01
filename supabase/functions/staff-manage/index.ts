import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.hydraagro.sbs",
  "https://hydraagro.sbs",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
}

function createAccessCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `HA-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
function canonicalCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
async function hashCode(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalCode(value)));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function uniqueCode(admin: ReturnType<typeof createClient>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createAccessCode();
    const hash = await hashCode(code);
    const { data } = await admin.from("property_members").select("id").eq("access_code_hash", hash).maybeSingle();
    if (!data) return { code, hash };
  }
  throw new Error("code_generation_failed");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!originAllowed(origin)) return json(req, { ok: false, message: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "Método não permitido." }, 405, { Allow: "POST, OPTIONS" });
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) return json(req, { ok: false, message: "Requisição muito grande." }, 413);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !token || token.length > 4096) return json(req, { ok: false, message: "Sessão necessária." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: callerData, error: callerError } = await authClient.auth.getUser(token);
    const caller = callerData.user;
    if (callerError || !caller) return json(req, { ok: false, message: "Sessão inválida ou expirada." }, 401);

    const { data: rate, error: rateError } = await authClient.rpc("consume_api_rate_limit", { p_endpoint: "staff-manage", p_limit: 30, p_window_seconds: 60 });
    if (rateError) return json(req, { ok: false, message: "Proteção de acesso temporariamente indisponível." }, 503);
    const guard = rate as { allowed?: boolean; retryAfter?: number } | null;
    if (guard?.allowed === false) {
      const retryAfter = Math.max(1, Number(guard.retryAfter || 60));
      return json(req, { ok: false, message: "Muitas alterações em pouco tempo. Aguarde e tente novamente." }, 429, { "Retry-After": String(retryAfter) });
    }

    const { data: property, error: propertyError } = await admin.from("properties").select("id,owner_user_id").eq("owner_user_id", caller.id).maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return json(req, { ok: false, message: "Somente o dono da propriedade pode gerenciar acessos de funcionários." }, 403);

    const payload = await req.json().catch(() => ({}));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(req, { ok: false, message: "Dados inválidos." }, 400);
    const action = String(payload?.action ?? "create");
    if (!["create", "regenerate", "set_active", "update"].includes(action)) return json(req, { ok: false, message: "Ação inválida." }, 400);

    if (action === "create") {
      const name = String(payload?.name ?? "").trim().slice(0, 120);
      const role = payload?.role === "manager" ? "manager" : "employee";
      const area = String(payload?.area ?? "Geral").trim().slice(0, 100) || "Geral";
      if (name.length < 2) return json(req, { ok: false, message: "Informe o nome do funcionário." }, 400);

      const { code, hash } = await uniqueCode(admin);
      const syntheticEmail = `staff.${crypto.randomUUID().replaceAll("-", "")}@access.hydraagro.app`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email: syntheticEmail, email_confirm: true, user_metadata: { full_name: name, account_type: "staff" } });
      if (createError || !created.user) throw createError ?? new Error("staff_create_failed");

      const { data: member, error: memberError } = await admin.from("property_members").insert({ property_id: property.id, owner_user_id: caller.id, user_id: created.user.id, display_name: name, member_role: role, area, access_code_hash: hash, code_hint: code.slice(-4), active: true }).select("id,user_id,display_name,member_role,area,active,code_hint,created_at,last_login_at,login_count").single();
      if (memberError) {
        await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
        throw memberError;
      }
      return json(req, { ok: true, member, code });
    }

    const memberId = String(payload?.memberId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(memberId)) return json(req, { ok: false, message: "Funcionário inválido." }, 400);
    const { data: existing, error: lookupError } = await admin.from("property_members").select("id,user_id").eq("id", memberId).eq("owner_user_id", caller.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return json(req, { ok: false, message: "Funcionário não encontrado." }, 404);

    if (action === "regenerate") {
      const { code, hash } = await uniqueCode(admin);
      const { error } = await admin.from("property_members").update({ access_code_hash: hash, code_hint: code.slice(-4), active: true, updated_at: new Date().toISOString() }).eq("id", memberId).eq("owner_user_id", caller.id);
      if (error) throw error;
      return json(req, { ok: true, code });
    }

    if (action === "set_active") {
      if (typeof payload?.active !== "boolean") return json(req, { ok: false, message: "Estado inválido." }, 400);
      const { error } = await admin.from("property_members").update({ active: payload.active, updated_at: new Date().toISOString() }).eq("id", memberId).eq("owner_user_id", caller.id);
      if (error) throw error;
      return json(req, { ok: true, active: payload.active });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof payload?.name === "string") {
      const name = payload.name.trim().slice(0, 120);
      if (name.length < 2) return json(req, { ok: false, message: "Nome inválido." }, 400);
      updates.display_name = name;
    }
    if (typeof payload?.area === "string") updates.area = payload.area.trim().slice(0, 100) || "Geral";
    if (payload?.role === "employee" || payload?.role === "manager") updates.member_role = payload.role;
    const { error } = await admin.from("property_members").update(updates).eq("id", memberId).eq("owner_user_id", caller.id);
    if (error) throw error;
    return json(req, { ok: true });
  } catch (error) {
    console.error("staff-manage error", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, message: "Não foi possível gerenciar o acesso do funcionário agora." }, 500);
  }
});
