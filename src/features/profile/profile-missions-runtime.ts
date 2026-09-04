import { requireSupabase } from "../../services/supabase";

const STYLE_ID = "hydra-profile-missions-runtime";
let overlay: HTMLDivElement | null = null;
let injectedPlan: HTMLElement | null = null;

type Mission = {
  title: string;
  description: string;
  current: number;
  target: number;
  reward: number;
  completed: boolean;
};

type MissionData = {
  xp: number;
  level: number;
  levelProgress: number;
  missions: Mission[];
};

function targetIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2"/></svg>`;
}

function arrowIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
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
    <span class="profile-mission-icon">${mission.completed ? "✓" : targetIcon()}</span>
    <div class="profile-mission-copy"><strong>${mission.title}</strong><small>${mission.description}</small></div>
    <b>+${mission.reward} XP</b>
    <div class="profile-mission-progress"><i style="width:${percent}%"></i></div>
    <footer><span>${mission.completed ? "Concluída" : `${mission.current}/${mission.target}`}</span><span>${percent}%</span></footer>
  </article>`;
}

async function loadMissionData(): Promise<MissionData> {
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
  const levelProgress = level >= 10 ? 100 : Math.max(0, Math.min(100, Math.round(((xp - levelStart) / 500) * 100)));

  const missions: Mission[] = [
    { title: "Propriedade pronta", description: "Complete os dados principais da fazenda.", reward: 200, current: propertyComplete ? 1 : 0, target: 1, completed: propertyComplete },
    { title: "Rebanho conectado", description: "Vincule NFC/RFID em 5 animais.", reward: 200, current: Math.min(identified, 5), target: 5, completed: identified >= 5 },
    { title: "Rotina em dia", description: "Conclua 10 atividades da propriedade.", reward: 200, current: Math.min(completedActivities, 10), target: 10, completed: completedActivities >= 10 },
    { title: "Olho na fazenda", description: "Faça 5 monitoramentos.", reward: 200, current: Math.min(monitoringCount, 5), target: 5, completed: monitoringCount >= 5 },
    { title: "Água sob controle", description: "Registre água em 7 dias diferentes.", reward: 200, current: Math.min(waterDays, 7), target: 7, completed: waterDays >= 7 },
  ];

  return { xp, level, levelProgress, missions };
}

function renderShortcut(button: HTMLButtonElement, data: MissionData) {
  const completed = data.missions.filter((mission) => mission.completed).length;
  button.classList.remove("is-loading");
  button.innerHTML = `<div class="profile-missions-shortcut-top">
      <span class="profile-missions-shortcut-icon">${targetIcon()}</span>
      <div><small>PROGRESSO DA FAZENDA</small><strong>Missões e XP</strong></div>
      <span class="profile-missions-shortcut-level">Nv. ${data.level}</span>
    </div>
    <div class="profile-missions-shortcut-stats"><strong>${formatXp(data.xp)} XP</strong><span>${completed}/${data.missions.length} missões concluídas</span></div>
    <div class="profile-missions-shortcut-progress"><i style="width:${data.levelProgress}%"></i></div>
    <div class="profile-missions-shortcut-footer"><span>${data.level >= 10 ? "Nível máximo alcançado" : "Continue usando o app para subir de nível"}</span>${arrowIcon()}</div>`;
}

async function openMissions() {
  closeOverlay();
  overlay = document.createElement("div");
  overlay.className = "profile-missions-backdrop";
  overlay.innerHTML = `<section class="profile-missions-sheet" role="dialog" aria-modal="true" aria-label="Missões e XP">
    <header class="profile-missions-topbar"><button type="button" class="profile-missions-close" aria-label="Fechar">‹</button><div><small>PROGRESSO DA FAZENDA</small><h2>Missões e XP</h2></div></header>
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
      <div class="profile-xp-hero-copy"><span>NÍVEL DA FAZENDA</span><strong>Nível ${level}</strong><small>${formatXp(xp)} de 5.000 XP</small></div>
      <b>${level}</b>
      <div class="profile-xp-progress"><i style="width:${levelProgress}%"></i></div>
      <div class="profile-xp-hero-foot"><span>${level >= 10 ? "VIP vitalício liberado" : "Próximo nível a cada 500 XP"}</span><strong>${levelProgress}%</strong></div>
    </section>
    <div class="profile-missions-heading"><div><small>DESAFIOS</small><h3>Suas missões</h3></div><span>${completed}/${missions.length}</span></div>
    <div class="profile-missions-list">${missions.map(missionHtml).join("")}</div>
    <div class="profile-missions-note">As missões avançam automaticamente conforme você registra atividades reais da propriedade.</div>`;
  } catch (error) {
    body.innerHTML = `<div class="profile-missions-error"><strong>Não foi possível carregar</strong><p>${error instanceof Error ? error.message : "Tente novamente em instantes."}</p></div>`;
  }
}

function ensureMissionShortcut() {
  const plan = document.querySelector<HTMLElement>(".profile-screen .plan-card");
  if (!plan || plan === injectedPlan) return;
  injectedPlan = plan;

  document.querySelector(".profile-screen .profile-social-tabs .profile-missions-tab")?.remove();
  document.querySelector(".profile-screen .profile-missions-shortcut")?.remove();

  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-missions-shortcut is-loading";
  button.innerHTML = `<div class="profile-missions-shortcut-top"><span class="profile-missions-shortcut-icon">${targetIcon()}</span><div><small>PROGRESSO DA FAZENDA</small><strong>Missões e XP</strong></div><span class="profile-missions-shortcut-level">…</span></div><div class="profile-missions-shortcut-skeleton"></div>`;
  button.addEventListener("click", () => void openMissions());
  plan.insertAdjacentElement("afterend", button);

  void loadMissionData().then((data) => {
    if (button.isConnected) renderShortcut(button, data);
  }).catch(() => {
    if (!button.isConnected) return;
    button.classList.remove("is-loading");
    button.innerHTML = `<div class="profile-missions-shortcut-top"><span class="profile-missions-shortcut-icon">${targetIcon()}</span><div><small>PROGRESSO DA FAZENDA</small><strong>Missões e XP</strong></div>${arrowIcon()}</div><div class="profile-missions-shortcut-footer"><span>Toque para ver suas missões</span></div>`;
  });
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.profile-missions-shortcut{width:calc(100% - 32px);margin:12px 16px 4px;padding:15px 16px;border:0;border-radius:22px;background:linear-gradient(145deg,#102f23 0%,#174c36 72%,#225f45 100%);color:#fff;text-align:left;box-shadow:0 13px 30px rgba(15,55,39,.16);overflow:hidden;position:relative}.profile-missions-shortcut:after{content:"";position:absolute;width:120px;height:120px;right:-48px;top:-72px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none}.profile-missions-shortcut:active{transform:scale(.985)}.profile-missions-shortcut-top{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;position:relative;z-index:1}.profile-missions-shortcut-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.11);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.profile-missions-shortcut-icon svg{width:20px;height:20px}.profile-missions-shortcut-top>div{display:grid;gap:2px}.profile-missions-shortcut-top small{font-size:7px;letter-spacing:.1em;font-weight:850;color:rgba(255,255,255,.55)}.profile-missions-shortcut-top strong{font-size:12px}.profile-missions-shortcut-level{padding:6px 8px;border-radius:999px;background:#ff8712;color:#fff;font-size:8px;font-weight:900}.profile-missions-shortcut-top>svg{width:18px;height:18px;opacity:.7}.profile-missions-shortcut-stats{display:flex;align-items:center;justify-content:space-between;margin-top:13px;font-size:8px;color:rgba(255,255,255,.65)}.profile-missions-shortcut-stats strong{font-size:10px;color:#fff}.profile-missions-shortcut-progress{height:6px;margin-top:7px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}.profile-missions-shortcut-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#83ba5b,#a8d879)}.profile-missions-shortcut-footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;color:rgba(255,255,255,.58);font-size:7.5px}.profile-missions-shortcut-footer svg{width:16px;height:16px}.profile-missions-shortcut-skeleton{height:34px;margin-top:12px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.13),rgba(255,255,255,.06));background-size:200% 100%;animation:missionShimmer 1.1s linear infinite}.profile-missions-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(5,25,17,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:grid;place-items:end center}.profile-missions-sheet{width:min(100%,620px);height:min(90vh,790px);overflow:hidden;border-radius:30px 30px 0 0;background:#f7faf8;box-shadow:0 -22px 70px rgba(0,0,0,.24);animation:profileMissionIn .24s cubic-bezier(.2,.85,.25,1) both}.profile-missions-topbar{height:76px;padding:0 18px;display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#0e3324,#174c36 72%,#236047);color:#fff}.profile-missions-topbar button{width:40px;height:40px;border:0;border-radius:13px;background:rgba(255,255,255,.1);color:#fff;font-size:28px}.profile-missions-topbar div{display:grid;gap:2px}.profile-missions-topbar small{font-size:7px;letter-spacing:.1em;font-weight:800;opacity:.55}.profile-missions-topbar h2{margin:0;font-size:17px;letter-spacing:-.025em}.profile-missions-body{height:calc(100% - 76px);overflow:auto;padding:15px 16px 30px}.profile-missions-loading,.profile-missions-error{min-height:230px;display:grid;place-items:center;text-align:center;color:#718078}.profile-missions-loading span{width:28px;height:28px;border:3px solid #dfe8e2;border-top-color:#174c36;border-radius:50%;animation:profileMissionSpin .8s linear infinite}.profile-xp-hero{padding:17px;border-radius:22px;background:linear-gradient(135deg,#102f23,#174c36 68%,#236247);color:#fff;display:grid;grid-template-columns:1fr auto;gap:11px;box-shadow:0 14px 30px rgba(15,55,39,.16);position:relative;overflow:hidden}.profile-xp-hero:after{content:"";position:absolute;width:120px;height:120px;right:-54px;top:-66px;border-radius:50%;background:rgba(255,255,255,.065)}.profile-xp-hero-copy{display:grid;gap:3px;position:relative;z-index:1}.profile-xp-hero-copy span{font-size:7px;letter-spacing:.1em;font-weight:800;opacity:.55}.profile-xp-hero-copy strong{font-size:20px;letter-spacing:-.03em}.profile-xp-hero-copy small{font-size:8.5px;opacity:.67}.profile-xp-hero>b{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:#ff8712;font-size:18px;box-shadow:0 8px 18px rgba(0,0,0,.12);z-index:1}.profile-xp-progress{grid-column:1/-1;height:7px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}.profile-xp-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#83ba5b,#b4df8d)}.profile-xp-hero-foot{grid-column:1/-1;display:flex;justify-content:space-between;color:rgba(255,255,255,.6);font-size:7.5px}.profile-xp-hero-foot strong{color:#fff}.profile-missions-heading{display:flex;align-items:end;justify-content:space-between;margin:19px 2px 10px}.profile-missions-heading>div{display:grid;gap:2px}.profile-missions-heading small{font-size:7px;letter-spacing:.1em;font-weight:850;color:#8c9791}.profile-missions-heading h3{margin:0;color:#173c2d;font-size:15px;letter-spacing:-.02em}.profile-missions-heading>span{min-width:30px;height:26px;padding:0 8px;display:grid;place-items:center;border-radius:999px;background:#e9f2ec;color:#174c36;font-size:8px;font-weight:900}.profile-missions-list{display:grid;gap:9px}.profile-mission-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:9px;padding:12px;border:1px solid rgba(23,76,54,.08);border-radius:18px;background:#fff;box-shadow:0 7px 20px rgba(17,43,32,.04)}.profile-mission-card.completed{background:linear-gradient(145deg,#f3f9f5,#fff);border-color:rgba(23,76,54,.12)}.profile-mission-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#edf4ef;color:#174c36;font-weight:900}.profile-mission-card.completed .profile-mission-icon{background:#174c36;color:#fff}.profile-mission-icon svg{width:20px;height:20px}.profile-mission-copy{min-width:0;display:grid;gap:3px}.profile-mission-copy strong{font-size:10px;color:#173c2d}.profile-mission-copy small{font-size:8px;line-height:1.35;color:#7d8982}.profile-mission-card>b{align-self:start;padding:5px 7px;border-radius:999px;background:#fff0dc;color:#c46608;font-size:7px}.profile-mission-progress{grid-column:2/-1;height:6px;border-radius:999px;background:#eef2ef;overflow:hidden}.profile-mission-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#174c36,#83ba5b)}.profile-mission-card footer{grid-column:2/-1;display:flex;justify-content:space-between;color:#87918b;font-size:7px}.profile-mission-card.completed footer span:first-child{color:#174c36;font-weight:850}.profile-missions-note{margin-top:12px;padding:11px 12px;border-radius:14px;background:#eef4ef;color:#718078;font-size:7.5px;line-height:1.45;text-align:center}@keyframes profileMissionIn{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}@keyframes profileMissionSpin{to{transform:rotate(360deg)}}@keyframes missionShimmer{to{background-position:-200% 0}}@media(min-width:700px){.profile-missions-backdrop{place-items:center}.profile-missions-sheet{border-radius:30px;height:min(84vh,790px)}}`;
  document.head.appendChild(style);
}

if (typeof document !== "undefined") {
  installStyle();
  ensureMissionShortcut();
  const observer = new MutationObserver(() => ensureMissionShortcut());
  observer.observe(document.body, { childList: true, subtree: true });
}
