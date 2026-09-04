import { requireSupabase } from "../../services/supabase";

const STYLE_ID = "hydra-profile-missions-runtime";
let overlay: HTMLDivElement | null = null;
let injectedTabs: HTMLElement | null = null;

type Mission = {
  title: string;
  description: string;
  current: number;
  target: number;
  reward: number;
  completed: boolean;
};

function iconTarget() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2"/></svg>`;
}

function closeOverlay() {
  overlay?.remove();
  overlay = null;
}

function formatXp(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)));
}

function missionHtml(mission: Mission) {
  const percent = mission.target > 0 ? Math.min(100, Math.round((mission.current / mission.target) * 100)) : 0;
  return `<article class="profile-mission-card${mission.completed ? " completed" : ""}">
    <span class="profile-mission-icon">${mission.completed ? "✓" : iconTarget()}</span>
    <div class="profile-mission-copy"><strong>${mission.title}</strong><small>${mission.description}</small></div>
    <b>+${mission.reward} XP</b>
    <div class="profile-mission-progress"><i style="width:${percent}%"></i></div>
    <footer><span>${mission.completed ? "Concluída" : `${mission.current}/${mission.target}`}</span><span>${percent}%</span></footer>
  </article>`;
}

async function loadMissionData() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error("Entre na conta para ver suas missões.");
  const uid = authData.user.id;

  const [property, animals, activities, monitoring, water, xpResult] = await Promise.all([
    client.from("properties").select("name,municipality,main_activity").eq("owner_user_id", uid).maybeSingle(),
    client.from("animals").select("electronic_id").eq("owner_user_id", uid),
    client.from("activities").select("done").eq("owner_user_id", uid),
    client.from("monitoring_records").select("id").eq("owner_user_id", uid),
    client.from("water_records").select("recorded_on").eq("owner_user_id", uid),
    client.rpc("farm_xp_for_owner", { p_owner: uid }),
  ]);

  const firstError = [property.error, animals.error, activities.error, monitoring.error, water.error, xpResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message || "Não foi possível carregar suas missões.");

  const propertyComplete = Boolean(property.data?.name && property.data?.municipality && property.data?.main_activity);
  const identified = (animals.data ?? []).filter((row) => Boolean(row.electronic_id)).length;
  const completedActivities = (activities.data ?? []).filter((row) => Boolean(row.done)).length;
  const monitoringCount = monitoring.data?.length ?? 0;
  const waterDays = new Set((water.data ?? []).map((row) => String(row.recorded_on))).size;
  const xp = Number(xpResult.data ?? 0);
  const level = Math.min(10, Math.floor(xp / 500) + 1);
  const levelStart = (level - 1) * 500;
  const levelProgress = level >= 10 ? 100 : Math.min(100, Math.round(((xp - levelStart) / 500) * 100));

  const missions: Mission[] = [
    { title: "Propriedade pronta", description: "Complete os dados principais da fazenda.", reward: 200, current: propertyComplete ? 1 : 0, target: 1, completed: propertyComplete },
    { title: "Rebanho conectado", description: "Vincule NFC/RFID em 5 animais.", reward: 200, current: Math.min(identified, 5), target: 5, completed: identified >= 5 },
    { title: "Rotina em dia", description: "Conclua 10 atividades da propriedade.", reward: 200, current: Math.min(completedActivities, 10), target: 10, completed: completedActivities >= 10 },
    { title: "Olho na fazenda", description: "Faça 5 monitoramentos.", reward: 200, current: Math.min(monitoringCount, 5), target: 5, completed: monitoringCount >= 5 },
    { title: "Água sob controle", description: "Registre água em 7 dias diferentes.", reward: 200, current: Math.min(waterDays, 7), target: 7, completed: waterDays >= 7 },
  ];

  return { xp, level, levelProgress, missions };
}

async function openMissions() {
  closeOverlay();
  overlay = document.createElement("div");
  overlay.className = "profile-missions-backdrop";
  overlay.innerHTML = `<section class="profile-missions-sheet" role="dialog" aria-modal="true" aria-label="Missões e XP">
    <header class="profile-missions-topbar"><button type="button" class="profile-missions-close" aria-label="Fechar">‹</button><div><small>PROGRESSO</small><h2>Missões e XP</h2></div></header>
    <div class="profile-missions-body"><div class="profile-missions-loading"><span></span><strong>Carregando missões…</strong></div></div>
  </section>`;
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeOverlay(); });
  overlay.querySelector<HTMLButtonElement>(".profile-missions-close")?.addEventListener("click", closeOverlay);
  document.body.appendChild(overlay);

  const body = overlay.querySelector<HTMLElement>(".profile-missions-body");
  if (!body) return;
  try {
    const { xp, level, levelProgress, missions } = await loadMissionData();
    const completed = missions.filter((mission) => mission.completed).length;
    body.innerHTML = `<section class="profile-xp-hero">
      <div><span>NÍVEL DA FAZENDA</span><strong>Nível ${level}</strong><small>${formatXp(xp)} / 5.000 XP</small></div>
      <b>${level}</b>
      <div class="profile-xp-progress"><i style="width:${levelProgress}%"></i></div>
      <p>${level >= 10 ? "VIP vitalício liberado" : "Chegue ao nível 10 para liberar o VIP vitalício"}</p>
    </section>
    <div class="profile-missions-heading"><h3>Missões</h3><span>${completed}/${missions.length} concluídas</span></div>
    <div class="profile-missions-list">${missions.map(missionHtml).join("")}</div>`;
  } catch (error) {
    body.innerHTML = `<div class="profile-missions-error"><strong>Não foi possível carregar</strong><p>${error instanceof Error ? error.message : "Tente novamente em instantes."}</p></div>`;
  }
}

function ensureMissionTab() {
  const tabs = document.querySelector<HTMLElement>(".profile-screen .profile-social-tabs");
  if (!tabs || tabs === injectedTabs) return;
  injectedTabs = tabs;
  if (tabs.querySelector(".profile-missions-tab")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-missions-tab";
  button.innerHTML = `${iconTarget()}<span>Missões</span>`;
  button.addEventListener("click", () => void openMissions());
  tabs.appendChild(button);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .profile-social-tabs .profile-missions-tab svg{width:19px;height:19px}.profile-missions-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(5,25,17,.46);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:grid;place-items:end center}.profile-missions-sheet{width:min(100%,620px);height:min(88vh,760px);overflow:hidden;border-radius:28px 28px 0 0;background:#f8faf8;box-shadow:0 -18px 60px rgba(0,0,0,.22);animation:profileMissionIn .24s cubic-bezier(.2,.85,.25,1) both}.profile-missions-topbar{height:72px;padding:0 18px;display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#103b2a,#174c36);color:#fff}.profile-missions-topbar button{width:38px;height:38px;border:0;border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-size:28px}.profile-missions-topbar div{display:grid;gap:2px}.profile-missions-topbar small{font-size:8px;letter-spacing:.08em;opacity:.65}.profile-missions-topbar h2{margin:0;font-size:18px}.profile-missions-body{height:calc(100% - 72px);overflow:auto;padding:16px 16px 26px}.profile-missions-loading,.profile-missions-error{min-height:220px;display:grid;place-items:center;text-align:center;color:#718078}.profile-missions-loading span{width:28px;height:28px;border:3px solid #dfe8e2;border-top-color:#174c36;border-radius:50%;animation:profileMissionSpin .8s linear infinite}.profile-xp-hero{padding:17px;border-radius:22px;background:linear-gradient(135deg,#102f23,#174c36 68%,#236247);color:#fff;display:grid;grid-template-columns:1fr auto;gap:12px;box-shadow:0 14px 30px rgba(15,55,39,.17)}.profile-xp-hero>div:first-child{display:grid;gap:3px}.profile-xp-hero span{font-size:8px;letter-spacing:.08em;opacity:.65}.profile-xp-hero strong{font-size:19px}.profile-xp-hero small{font-size:9px;opacity:.7}.profile-xp-hero>b{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:rgba(255,255,255,.12);font-size:18px}.profile-xp-progress{grid-column:1/-1;height:7px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}.profile-xp-progress i{display:block;height:100%;border-radius:inherit;background:#83ba5b}.profile-xp-hero p{grid-column:1/-1;margin:0;font-size:9px;opacity:.75}.profile-missions-heading{display:flex;align-items:center;justify-content:space-between;margin:18px 2px 10px}.profile-missions-heading h3{margin:0;color:#173c2d;font-size:14px}.profile-missions-heading span{font-size:8px;color:#718078}.profile-missions-list{display:grid;gap:9px}.profile-mission-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:9px;padding:12px;border:1px solid rgba(23,76,54,.09);border-radius:18px;background:#fff;box-shadow:0 7px 20px rgba(17,43,32,.045)}.profile-mission-card.completed{background:linear-gradient(145deg,#f4faf5,#fff)}.profile-mission-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#edf4ef;color:#174c36;font-weight:900}.profile-mission-icon svg{width:20px;height:20px}.profile-mission-copy{min-width:0;display:grid;gap:3px}.profile-mission-copy strong{font-size:10px;color:#173c2d}.profile-mission-copy small{font-size:8px;line-height:1.35;color:#7d8982}.profile-mission-card>b{align-self:start;padding:5px 7px;border-radius:999px;background:#fff0dc;color:#c46608;font-size:7px}.profile-mission-progress{grid-column:2/-1;height:6px;border-radius:999px;background:#eef2ef;overflow:hidden}.profile-mission-progress i{display:block;height:100%;border-radius:inherit;background:#174c36}.profile-mission-card footer{grid-column:2/-1;display:flex;justify-content:space-between;color:#87918b;font-size:7px}.profile-mission-card.completed footer span:first-child{color:#174c36;font-weight:800}@keyframes profileMissionIn{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}@keyframes profileMissionSpin{to{transform:rotate(360deg)}}@media(min-width:700px){.profile-missions-backdrop{place-items:center}.profile-missions-sheet{border-radius:28px;height:min(82vh,760px)}}`;
  document.head.appendChild(style);
}

if (typeof document !== "undefined") {
  installStyle();
  ensureMissionTab();
  const observer = new MutationObserver(() => ensureMissionTab());
  observer.observe(document.body, { childList: true, subtree: true });
}
