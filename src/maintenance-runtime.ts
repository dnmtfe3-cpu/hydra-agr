import { requireSupabase } from "./services/supabase";

type MaintenanceSetting = {
  enabled?: boolean;
  title?: string;
  message?: string;
};

type AppRole = "user" | "moderator" | "admin" | "owner" | "";

const STYLE_ID = "hydra-maintenance-runtime-style";
const SETTING_KEY = "maintenance";
const CHECK_INTERVAL = 15_000;
const ADMIN_LOGIN_WINDOW = 2 * 60_000;

let latest: MaintenanceSetting = {
  enabled: false,
  title: "App em atualização",
  message: "Volte em breve!",
};
let adminLoginUntil = 0;
let checking = false;

const css = `
.hydra-maintenance-screen{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:max(28px,env(safe-area-inset-top)) 28px max(28px,env(safe-area-inset-bottom));background:#063524;color:#f7f5ee;font-family:Manrope,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}.hydra-maintenance-inner{width:min(100%,350px)}.hydra-maintenance-mark{width:82px;height:82px;margin:0 auto 26px;border-radius:25px;display:grid;place-items:center;background:rgba(11,73,51,.72);border:1px solid rgba(255,255,255,.11)}.hydra-maintenance-mark img{display:block;width:58px;height:58px}.hydra-maintenance-screen h1{margin:0;color:#fffaf3;font:700 30px/1.08 Sora,Manrope,sans-serif;letter-spacing:-.04em}.hydra-maintenance-screen p{margin:12px auto 0;max-width:300px;color:rgba(244,247,242,.7);font-size:15px;line-height:1.5}.hydra-maintenance-brand{display:block;margin-top:27px;color:rgba(244,247,242,.42);font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.hydra-maintenance-admin{margin-top:18px;min-height:42px;padding:0 14px;border:0;border-radius:12px;background:transparent;color:rgba(255,255,255,.5);font:700 12px Manrope,system-ui,-apple-system,sans-serif}.hydra-maintenance-admin:active{opacity:.7}.hydra-maintenance-admin:disabled{opacity:.35}.maintenance-admin-card{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:14px 0 18px;padding:17px;border:1px solid var(--border,#dfe5df);border-radius:18px;background:var(--surface,#fff);box-shadow:none}.maintenance-admin-card-copy{display:grid;gap:4px;min-width:0}.maintenance-admin-card-copy strong{font-size:14px;line-height:1.2}.maintenance-admin-card-copy small{color:var(--muted,#748078);font-size:12px;line-height:1.38}.maintenance-admin-switch{flex:0 0 auto;min-width:88px;height:40px;padding:0 12px;border:0;border-radius:999px;background:#e8ece9;color:#3d584a;font:800 12px Manrope,system-ui,-apple-system,sans-serif;transition:transform .12s ease,background-color .16s ease,color .16s ease}.maintenance-admin-switch.on{background:#18533a;color:#fff}.maintenance-admin-switch:active{transform:scale(.97)}.maintenance-admin-switch:disabled{opacity:.55}.maintenance-admin-card.is-on{border-color:rgba(24,83,58,.22);background:rgba(24,83,58,.045)}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function isAdminRole(role: AppRole) {
  return role === "moderator" || role === "admin" || role === "owner";
}

async function sessionRole(): Promise<{ role: AppRole; userId: string | null }> {
  const db = requireSupabase();
  const { data: sessionData } = await db.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;
  if (!userId) return { role: "", userId: null };

  const { data, error } = await db.from("roles").select("role").eq("user_id", userId).maybeSingle();
  if (error) return { role: "user", userId };
  return { role: String(data?.role ?? "user") as AppRole, userId };
}

function hideMaintenance() {
  document.querySelector(".hydra-maintenance-screen")?.remove();
}

function splashIsActive() {
  return document.documentElement.classList.contains("hydra-splash-active") || Boolean(document.querySelector(".splash-screen"));
}

function showMaintenance(setting: MaintenanceSetting) {
  if (splashIsActive()) return;
  ensureStyle();

  let screen = document.querySelector<HTMLElement>(".hydra-maintenance-screen");
  if (!screen) {
    screen = document.createElement("main");
    screen.className = "hydra-maintenance-screen";
    screen.setAttribute("role", "status");
    screen.setAttribute("aria-live", "polite");
    screen.innerHTML = `
      <div class="hydra-maintenance-inner">
        <div class="hydra-maintenance-mark"><img src="/hydra-mark.svg" alt="" aria-hidden="true" /></div>
        <h1></h1>
        <p></p>
        <span class="hydra-maintenance-brand">Hydra Agro</span>
        <button class="hydra-maintenance-admin" type="button">Acesso administrativo</button>
      </div>`;

    const adminButton = screen.querySelector<HTMLButtonElement>(".hydra-maintenance-admin")!;
    adminButton.addEventListener("click", async () => {
      adminButton.disabled = true;
      try {
        const db = requireSupabase();
        const { data } = await db.auth.getSession();
        if (data.session?.user) await db.auth.signOut();
        adminLoginUntil = Date.now() + ADMIN_LOGIN_WINDOW;
        hideMaintenance();
      } finally {
        adminButton.disabled = false;
      }
    });
    document.body.appendChild(screen);
  }

  const title = screen.querySelector("h1");
  const message = screen.querySelector("p");
  if (title) title.textContent = setting.title?.trim() || "App em atualização";
  if (message) message.textContent = setting.message?.trim() || "Volte em breve!";
}

function paintAdminCard() {
  const card = document.querySelector<HTMLElement>(".maintenance-admin-card");
  if (!card) return;
  const button = card.querySelector<HTMLButtonElement>(".maintenance-admin-switch");
  if (!button) return;
  const enabled = Boolean(latest.enabled);
  card.classList.toggle("is-on", enabled);
  button.classList.toggle("on", enabled);
  button.textContent = enabled ? "Ativado" : "Desativado";
  button.setAttribute("aria-pressed", String(enabled));
}

async function toggleMaintenance(button: HTMLButtonElement) {
  const next = !Boolean(latest.enabled);
  if (next && !window.confirm("Ativar o modo manutenção? Usuários comuns serão bloqueados até você desativar.")) return;

  button.disabled = true;
  try {
    const db = requireSupabase();
    const { role, userId } = await sessionRole();
    if (!userId || !isAdminRole(role)) throw new Error("Apenas administradores podem alterar o modo manutenção.");

    const value: MaintenanceSetting = {
      enabled: next,
      title: "App em atualização",
      message: "Volte em breve!",
    };
    const { error } = await db.from("app_settings").upsert({
      key: SETTING_KEY,
      value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (error) throw error;

    latest = value;
    paintAdminCard();
    await checkMaintenanceMode();
  } catch (error) {
    console.error("maintenance toggle", error);
    window.alert(error instanceof Error ? error.message : "Não foi possível alterar o modo manutenção.");
  } finally {
    button.disabled = false;
  }
}

function ensureAdminCard() {
  ensureStyle();
  const ownerStrip = document.querySelector(".admin-screen .admin-owner-strip");
  if (!ownerStrip || document.querySelector(".maintenance-admin-card")) return;

  const card = document.createElement("section");
  card.className = "maintenance-admin-card";
  card.innerHTML = `
    <div class="maintenance-admin-card-copy">
      <strong>Modo manutenção</strong>
      <small>Quando ativado, usuários comuns veem “App em atualização”. Administradores continuam com acesso.</small>
    </div>
    <button class="maintenance-admin-switch" type="button" aria-label="Ativar ou desativar modo manutenção"></button>`;

  const button = card.querySelector<HTMLButtonElement>(".maintenance-admin-switch")!;
  button.addEventListener("click", () => void toggleMaintenance(button));
  ownerStrip.insertAdjacentElement("afterend", card);
  paintAdminCard();
}

export async function checkMaintenanceMode() {
  if (checking) return;
  checking = true;
  try {
    const db = requireSupabase();
    const { data, error } = await db.from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
    if (error) throw error;

    latest = { ...latest, ...((data?.value ?? {}) as MaintenanceSetting) };
    const { role, userId } = await sessionRole();

    if (!latest.enabled) {
      adminLoginUntil = 0;
      hideMaintenance();
    } else if (isAdminRole(role)) {
      adminLoginUntil = 0;
      hideMaintenance();
    } else if (!userId && Date.now() < adminLoginUntil) {
      hideMaintenance();
    } else {
      showMaintenance(latest);
    }

    ensureAdminCard();
    paintAdminCard();
  } catch {
    // Falha aberta: uma indisponibilidade do Supabase não deve bloquear o app por engano.
  } finally {
    checking = false;
  }
}

if (typeof window !== "undefined") {
  ensureStyle();
  void checkMaintenanceMode();
  window.setInterval(() => void checkMaintenanceMode(), CHECK_INTERVAL);
  window.addEventListener("focus", () => void checkMaintenanceMode());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkMaintenanceMode();
  });

  const observer = new MutationObserver(() => {
    ensureAdminCard();
    if (latest.enabled && !document.querySelector(".hydra-maintenance-screen") && Date.now() >= adminLoginUntil) {
      void checkMaintenanceMode();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  try {
    const db = requireSupabase();
    db.auth.onAuthStateChange(() => {
      window.setTimeout(() => void checkMaintenanceMode(), 0);
    });
  } catch {
    // O bootstrap normal do app trata ausência de backend separadamente.
  }
}
