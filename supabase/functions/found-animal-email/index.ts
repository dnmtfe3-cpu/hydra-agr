import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function foundAnimalHtml(input: {
  ownerName: string;
  animalName: string;
  hydraId: string;
  propertyName: string;
  location: string;
  appUrl: string;
}) {
  const owner = escapeHtml(firstName(input.ownerName));
  const animal = escapeHtml(input.animalName);
  const hydraId = escapeHtml(input.hydraId);
  const property = escapeHtml(input.propertyName);
  const location = escapeHtml(input.location);
  const appUrl = escapeHtml(input.appUrl);

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Encontraram seu animal</title></head>
<body style="margin:0;background:#f4f1e9;font-family:Arial,Helvetica,sans-serif;color:#10281d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1e9;padding:28px 14px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffefb;border-radius:24px;overflow:hidden;border:1px solid #e3e5df;">
<tr><td style="background:#0B5136;padding:32px 36px;">
<div style="font-size:13px;letter-spacing:1.8px;text-transform:uppercase;color:#d8eadf;font-weight:700;">Hydra Tag</div>
<div style="margin-top:12px;font-size:31px;line-height:1.15;color:#fff;font-weight:800;">Encontraram seu animal.</div>
<div style="margin-top:10px;font-size:16px;line-height:1.55;color:#d8eadf;">${owner}, alguém abriu a Hydra Tag de <strong style="color:#fff">${animal}</strong> e informou que encontrou o animal.</div>
</td></tr>
<tr><td style="padding:32px 36px 38px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f2;border-radius:16px;border:1px solid #e6e9e2;">
<tr><td style="padding:18px 20px;font-size:14px;line-height:1.7;color:#536158;">
<strong style="color:#10281d;font-size:16px;">${animal}</strong><br>
Hydra ID: ${hydraId}<br>
${property ? `Propriedade: ${property}<br>` : ""}${location ? `Localidade: ${location}` : ""}
</td></tr></table>
<div style="margin-top:20px;font-size:15px;line-height:1.6;color:#536158;">O Hydra Agro não revelou seu telefone, e-mail, CEP ou endereço para quem encontrou o animal. Abra o app para conferir o aviso e atualizar a ocorrência.</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px;"><tr><td style="background:#FF8A12;border-radius:14px;"><a href="${appUrl}" style="display:inline-block;padding:15px 24px;color:#fff;text-decoration:none;font-size:16px;font-weight:800;">Abrir Hydra Agro</a></td></tr></table>
<div style="margin-top:28px;padding-top:20px;border-top:1px solid #eceee8;font-size:12px;line-height:1.55;color:#879089;">Este aviso foi gerado pela ficha pública da Hydra Tag. Nenhum dado de contato do proprietário foi exibido.</div>
</td></tr></table>
<div style="max-width:620px;padding:18px 8px 0;font-size:12px;color:#8b938e;text-align:center;">Hydra Agro • Hydra Tag</div>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false }, 405);

  try {
    const payload = await req.json();
    const reportId = String(payload?.reportId ?? "").trim();
    const hydraCode = String(payload?.hydraCode ?? "").trim();
    if (!/^found-[a-f0-9]{32}$/i.test(reportId) || !hydraCode || hydraCode.length > 80) return json({ ok: true });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("HYDRA_EMAIL_FROM")?.trim();
    const appUrl = Deno.env.get("HYDRA_APP_URL")?.trim() || "https://www.hydraagro.sbs";
    if (!supabaseUrl || !serviceRoleKey || !resendKey || !from) return json({ ok: true });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: report, error: reportError } = await admin.from("animal_found_reports")
      .select("id,animal_id,owner_user_id,status,created_at,email_sent_at")
      .eq("id", reportId).maybeSingle();
    if (reportError || !report || report.email_sent_at) return json({ ok: true });

    const createdAt = new Date(String(report.created_at)).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 2 * 60 * 60 * 1000) return json({ ok: true });

    const { data: animal, error: animalError } = await admin.from("animals")
      .select("id,owner_user_id,property_id,name,identification,hydra_code,status")
      .eq("id", report.animal_id).maybeSingle();
    if (animalError || !animal || String(animal.owner_user_id) !== String(report.owner_user_id)) return json({ ok: true });

    const codeMatches = [animal.id, animal.hydra_code, animal.identification].filter(Boolean).some((value) => String(value) === hydraCode);
    if (!codeMatches) return json({ ok: true });

    const [{ data: profile }, { data: property }, userResult] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", report.owner_user_id).maybeSingle(),
      admin.from("properties").select("name,municipality,state").eq("id", animal.property_id).maybeSingle(),
      admin.auth.admin.getUserById(String(report.owner_user_id)),
    ]);

    const email = userResult.data.user?.email?.trim();
    if (!email) return json({ ok: true });

    const animalName = String(animal.name || animal.identification || "Animal identificado");
    const ownerName = String(profile?.full_name || userResult.data.user?.user_metadata?.full_name || "Produtor");
    const propertyName = String(property?.name || "");
    const location = [property?.municipality, property?.state].filter(Boolean).join(" / ");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Hydra Tag: encontraram ${animalName}`,
        html: foundAnimalHtml({ ownerName, animalName, hydraId: String(animal.identification), propertyName, location, appUrl }),
      }),
    });

    if (!response.ok) {
      await admin.from("animal_found_reports").update({ email_status: `failed:${response.status}` }).eq("id", reportId);
      console.error("found-animal-email provider error", response.status, await response.text());
      return json({ ok: true });
    }

    await admin.from("animal_found_reports").update({ email_sent_at: new Date().toISOString(), email_status: "sent" }).eq("id", reportId);
    return json({ ok: true });
  } catch (error) {
    console.error("found-animal-email unexpected error", error);
    return json({ ok: true });
  }
});
