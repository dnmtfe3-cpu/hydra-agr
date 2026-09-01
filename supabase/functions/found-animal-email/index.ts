import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.hydraagro.sbs",
  "https://hydraagro.sbs",
  "http://localhost",
  "capacitor://localhost",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://www.hydraagro.sbs";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, x-hydra-client, x-supabase-api-version, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
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

function safeAppUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("invalid protocol");
    if (!["www.hydraagro.sbs", "hydraagro.sbs"].includes(url.hostname)) throw new Error("invalid host");
    return `${url.protocol}//${url.host}`;
  } catch {
    return "https://www.hydraagro.sbs";
  }
}

function foundAnimalHtml(input: {
  ownerName: string;
  animalName: string;
  hydraId: string;
  propertyName: string;
  location: string;
  finderName: string;
  finderPhone: string;
  finderEmail: string;
  profileUrl: string;
  messageUrl: string;
}) {
  const owner = escapeHtml(input.ownerName.trim().split(/\s+/)[0] || "produtor");
  const animal = escapeHtml(input.animalName);
  const hydraId = escapeHtml(input.hydraId);
  const property = escapeHtml(input.propertyName);
  const location = escapeHtml(input.location);
  const finderName = escapeHtml(input.finderName || "Usuário Hydra Agro");
  const finderPhone = escapeHtml(input.finderPhone);
  const finderEmail = escapeHtml(input.finderEmail);
  const profileUrl = escapeHtml(input.profileUrl);
  const messageUrl = escapeHtml(input.messageUrl);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Encontraram seu animal</title></head>
<body style="margin:0;background:#FAF8F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18352A;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F1;padding:32px 14px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #E5E7E2;border-radius:22px;overflow:hidden;box-shadow:0 8px 28px rgba(7,61,42,.06);">
<tr><td style="height:6px;background:#FF8A12"></td></tr>
<tr><td style="padding:30px 34px 34px"><div style="font-size:15px;font-weight:800;color:#0B5136">Hydra Agro · Hydra Tag</div>
<h1 style="margin:28px 0 10px;font-size:29px;line-height:1.16;color:#10281D">Encontraram ${animal}.</h1>
<p style="margin:0;font-size:16px;line-height:1.65;color:#5E6C65">${owner}, <strong style="color:#18352A">${finderName}</strong> informou que encontrou este animal.</p>
<div style="margin-top:24px;padding:20px 22px;background:#F7F8F4;border:1px solid #E7E9E4;border-radius:16px"><div style="font-size:11px;font-weight:800;letter-spacing:1.2px;color:#7B8781">ANIMAL IDENTIFICADO</div><div style="margin-top:8px;font-size:18px;font-weight:800">${animal}</div><div style="margin-top:7px;font-size:14px;line-height:1.75;color:#627069">Hydra ID: <strong>${hydraId}</strong>${property ? `<br>Propriedade: <strong>${property}</strong>` : ""}${location ? `<br>Localidade: <strong>${location}</strong>` : ""}</div></div>
<div style="margin-top:16px;padding:20px 22px;background:#EDF5F0;border:1px solid #DCE9DF;border-radius:16px"><div style="font-size:11px;font-weight:800;letter-spacing:1.2px;color:#668074">QUEM ENCONTROU</div><div style="margin-top:8px;font-size:18px;font-weight:800">${finderName}</div><div style="margin-top:8px;font-size:14px;line-height:1.8;color:#56675F">${finderPhone ? `Telefone: <strong>${finderPhone}</strong><br>` : ""}${finderEmail ? `E-mail: <strong>${finderEmail}</strong>` : ""}${!finderPhone && !finderEmail ? "Converse pelo Hydra Agro." : ""}</div></div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px"><tr><td style="padding-right:6px;width:50%"><a href="${profileUrl}" style="display:block;padding:14px 16px;border:1px solid #CFE0D6;border-radius:13px;color:#0B5136;text-decoration:none;text-align:center;font-size:14px;font-weight:800">Ver perfil</a></td><td style="padding-left:6px;width:50%"><a href="${messageUrl}" style="display:block;padding:14px 16px;background:#0B5136;border-radius:13px;color:#fff;text-decoration:none;text-align:center;font-size:14px;font-weight:800">Enviar mensagem</a></td></tr></table>
<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #ECEEEA;font-size:12px;line-height:1.6;color:#8A938E">Este aviso foi gerado por uma ocorrência autenticada no Hydra Agro.</p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(req, { ok: false, message: "Entre na sua conta para enviar este aviso." }, 401);

    const payload = await req.json();
    const reportId = String(payload?.reportId ?? "").trim();
    const hydraCode = String(payload?.hydraCode ?? "").trim();
    if (!/^found-[a-f0-9]{32}$/i.test(reportId) || !hydraCode || hydraCode.length > 80) {
      return json(req, { ok: false, message: "Aviso inválido." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("HYDRA_EMAIL_FROM")?.trim();
    const appUrl = safeAppUrl(Deno.env.get("HYDRA_APP_URL")?.trim() || "https://www.hydraagro.sbs");
    if (!supabaseUrl || !serviceRoleKey || !resendKey || !from) return json(req, { ok: false, message: "Envio de e-mail temporariamente indisponível." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
    const caller = callerData.user;
    if (callerError || !caller) return json(req, { ok: false, message: "Sessão inválida. Entre novamente." }, 401);

    const { data: report, error: reportError } = await admin.from("animal_found_reports")
      .select("id,animal_id,owner_user_id,finder_user_id,status,created_at,email_sent_at")
      .eq("id", reportId)
      .maybeSingle();
    if (reportError || !report) return json(req, { ok: false, message: "Ocorrência não encontrada." }, 404);
    if (String(report.finder_user_id || "") !== caller.id) return json(req, { ok: false, message: "Você não pode enviar avisos desta ocorrência." }, 403);
    if (report.email_sent_at) return json(req, { ok: true, sent: true, duplicate: true });

    const createdAt = new Date(String(report.created_at)).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 24 * 60 * 60 * 1000) return json(req, { ok: false, message: "Ocorrência expirada para envio automático." }, 410);

    const { data: animal, error: animalError } = await admin.from("animals")
      .select("id,owner_user_id,property_id,name,identification,hydra_code")
      .eq("id", report.animal_id)
      .maybeSingle();
    if (animalError || !animal || String(animal.owner_user_id) !== String(report.owner_user_id)) return json(req, { ok: false, message: "Animal inválido para esta ocorrência." }, 409);

    const codeMatches = [animal.id, animal.hydra_code, animal.identification].filter(Boolean).some((value) => String(value) === hydraCode);
    if (!codeMatches) return json(req, { ok: false, message: "Hydra ID não corresponde à ocorrência." }, 409);

    const [ownerProfileResult, propertyResult, ownerUserResult, finderProfileResult, finderUserResult] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", report.owner_user_id).maybeSingle(),
      admin.from("properties").select("name,municipality,state").eq("id", animal.property_id).maybeSingle(),
      admin.auth.admin.getUserById(String(report.owner_user_id)),
      admin.from("profiles").select("full_name,phone").eq("id", caller.id).maybeSingle(),
      admin.auth.admin.getUserById(caller.id),
    ]);

    const ownerEmail = ownerUserResult.data.user?.email?.trim();
    if (!ownerEmail) return json(req, { ok: false, message: "O proprietário não possui e-mail cadastrado." }, 409);

    const animalName = String(animal.name || animal.identification || "Animal identificado");
    const ownerName = String(ownerProfileResult.data?.full_name || ownerUserResult.data.user?.user_metadata?.full_name || "Produtor");
    const propertyName = String(propertyResult.data?.name || "");
    const location = [propertyResult.data?.municipality, propertyResult.data?.state].filter(Boolean).join(" / ");
    const finderName = String(finderProfileResult.data?.full_name || finderUserResult.data.user?.user_metadata?.full_name || "Usuário Hydra Agro");
    const finderPhone = String(finderProfileResult.data?.phone || "");
    const finderEmail = String(finderUserResult.data.user?.email || "");
    const profileUrl = `${appUrl}/?foundReport=${encodeURIComponent(reportId)}&mode=profile`;
    const messageUrl = `${appUrl}/?foundReport=${encodeURIComponent(reportId)}&mode=chat`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [ownerEmail],
        subject: `Hydra Tag · ${finderName} encontrou ${animalName}`,
        html: foundAnimalHtml({ ownerName, animalName, hydraId: String(animal.identification), propertyName, location, finderName, finderPhone, finderEmail, profileUrl, messageUrl }),
      }),
    });

    if (!response.ok) {
      await admin.from("animal_found_reports").update({ email_status: `failed:${response.status}` }).eq("id", reportId);
      console.error("found-animal-email provider error", response.status);
      return json(req, { ok: false, message: "O aviso foi salvo, mas o e-mail não pôde ser enviado agora." }, 503);
    }

    await admin.from("animal_found_reports").update({ email_sent_at: new Date().toISOString(), email_status: "sent" }).eq("id", reportId);
    return json(req, { ok: true, sent: true });
  } catch (error) {
    console.error("found-animal-email unexpected error", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, message: "Não foi possível enviar o aviso por e-mail agora." }, 500);
  }
});
