import { requireSupabase } from "../../services/supabase";

export {};

const STYLE_ID = "hydra-profile-missions-runtime";
let overlay: HTMLDivElement | null = null;
let injectedPlan: HTMLElement | null = null;

type Tier = "main" | "medium" | "hard";
type Mission = { title: string; description: string; current: number; target: number; reward: number; completed: boolean; tier: Tier };
type MissionData = { xp: number; level: number; levelProgress: number; missions: Mission[] };

function targetIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2"/></svg>`; }
function arrowIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`; }
function closeOverlay() { overlay?.remove(); overlay = null; }
function formatXp(value: number) { return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value))); }

function thresholdMission(tier: Tier, title: string, description: string, current: number, target: number, reward: number): Mission {
  return { tier, title, description, current: Math.min(current, target), target, reward, completed: current >= target };
}

async function loadMissionData(): Promise<MissionData> {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error("Entre na conta para ver suas missões.");
  const uid = authData.user.id;

  const [property, animals, activities, monitoring, water, nfc] = await Promise.all([
    client.from("properties").select("name,municipality,main_activity").eq("owner_user_id", uid).maybeSingle(),
    client.from("animals").select("id,electronic_id").eq("owner_user_id", uid),
    client.from("activities").select("done").eq("owner_user_id", uid),
    client.from("monitoring_records").select("id").eq("owner_user_id", uid),
    client.from("water_records").select("recorded_on").eq("owner_user_id", uid),
    client.from("nfc_tags").select("read_count").eq("owner_user_id", uid),
  ]);
  const firstError = [property.error, animals.error, activities.error, monitoring.error, water.error, nfc.error].find(Boolean);
  if (firstError) throw new Error(firstError.message || "Não foi possível carregar suas missões.");

  const propertyComplete = Boolean(property.data?.name && property.data?.municipality && property.data?.main_activity);
  const animalCount = animals.data?.length ?? 0;
  const identified = (animals.data ?? []).filter((row) => Boolean(row.electronic_id)).length;
  const completedActivities = (activities.data ?? []).filter((row) => Boolean(row.done)).length;
  const monitoringCount = monitoring.data?.length ?? 0;
  const waterDays = new Set((water.data ?? []).map((row) => String(row.recorded_on))).size;
  const nfcReads = (nfc.data ?? []).reduce((sum, row) => sum + Number(row.read_count ?? 0), 0);

  const missions: Mission[] = [
    thresholdMission("main", "Propriedade pronta", "Complete nome, município e atividade principal.", propertyComplete ? 1 : 0, 1, 40),
    thresholdMission("main", "Primeiro animal", "Cadastre o primeiro animal do rebanho.", animalCount, 1, 40),
    thresholdMission("main", "Primeira identificação", "Vincule NFC/RFID ao primeiro animal.", identified, 1, 40),
    thresholdMission("main", "Primeira atividade", "Conclua uma atividade da propriedade.", completedActivities, 1, 40),
    thresholdMission("main", "Primeiro registro de água", "Registre o primeiro dia de controle de água.", waterDays, 1, 40),
  ];

  const mediumSets: Array<[string,string,number,number[]]> = [
    ["Rebanho em crescimento", "Cadastre animais no rebanho.", animalCount, [3,5,10]],
    ["Rebanho identificado", "Aumente os animais com NFC/RFID.", identified, [3,5,8]],
    ["Rotina organizada", "Conclua atividades da propriedade.", completedActivities, [3,5,10]],
    ["Monitoramento ativo", "Faça monitoramentos na fazenda.", monitoringCount, [1,3,5]],
    ["Água acompanhada", "Registre dias diferentes de controle de água.", waterDays, [3,5,7]],
  ];
  mediumSets.forEach(([title, description, current, targets]) => targets.forEach((target, index) => missions.push(thresholdMission("medium", `${title} ${index + 1}`, description, current, target, 100))));

  const hardSets: Array<[string,string,number,number[]]> = [
    ["Rebanho avançado", "Amplie o rebanho cadastrado.", animalCount, [15,20,30,40,50]],
    ["Identificação avançada", "Identifique mais animais com NFC/RFID.", identified, [10,15,20,30,40]],
    ["Rotina avançada", "Conclua mais atividades na propriedade.", completedActivities, [15,25,40,60,100]],
    ["Monitoramento avançado", "Aumente a frequência de monitoramentos.", monitoringCount, [10,20,30,50,75]],
    ["Água avançada", "Mantenha o acompanhamento de água por mais dias.", waterDays, [10,20,30,60,90]],
    ["NFC em campo", "Realize leituras NFC/RFID na rotina.", nfcReads, [10,25,50,100,200]],
  ];
  hardSets.forEach(([title, description, current, targets]) => targets.forEach((target, index) => missions.push(thresholdMission("hard", `${title} ${index + 1}`, description, current, target, 110))));

  const xp = missions.filter((mission) => mission.completed).reduce((sum, mission) => sum + mission.reward, 0);
  const level = xp >= 5000 ? 10 : Math.min(9, Math.floor(xp / 500) + 1);
  const levelStart = (level - 1) * 500;
  const levelProgress = level === 10 ? 100 : Math.max(0, Math.min(100, Math.round(((xp - levelStart) / 500) * 100)));
  return { xp, level, levelProgress, missions };
}

function missionHtml(mission: Mission) {
  const percent = mission.target > 0 ? Math.min(100, Math.round((mission.current / mission.target) * 100)) : 0;
  return `<article class="profile-mission-card${mission.completed ? " completed" : ""}"><span class="profile-mission-icon">${mission.completed ? "✓" : targetIcon()}</span><div class="profile-mission-copy"><strong>${mission.title}</strong><small>${mission.description}</small></div><b>+${mission.reward} XP</b><div class="profile-mission-progress"><i style="width:${percent}%"></i></div><footer><span>${mission.completed ? "Concluída" : `${mission.current}/${mission.target}`}</span><span>${percent}%</span></footer></article>`;
}

function tierHtml(label: string, tier: Tier, missions: Mission[]) {
  const items = missions.filter((mission) => mission.tier === tier);
  const completed = items.filter((mission) => mission.completed).length;
  return `<section class="profile-mission-tier tier-${tier}"><header><div><small>${tier === "main" ? "COMECE AQUI" : tier === "medium" ? "EVOLUÇÃO" : "RETA FINAL"}</small><h3>${label}</h3></div><span>${completed}/${items.length}</span></header><div class="profile-missions-list">${items.map(missionHtml).join("")}</div></section>`;
}

function renderShortcut(button: HTMLButtonElement, data: MissionData) {
  const completed = data.missions.filter((mission) => mission.completed).length;
  button.classList.remove("is-loading");
  button.innerHTML = `<div class="profile-missions-shortcut-top"><span class="profile-missions-shortcut-icon">${targetIcon()}</span><div><small>TRILHA DE PROGRESSO</small><strong>Missões e XP</strong></div><span class="profile-missions-shortcut-level">Nv. ${data.level}</span></div><div class="profile-missions-shortcut-stats"><strong>${formatXp(data.xp)} XP</strong><span>${completed}/50 concluídas</span></div><div class="profile-missions-shortcut-progress"><i style="width:${Math.min(100,(data.xp/5000)*100)}%"></i></div><div class="profile-missions-shortcut-footer"><span>${data.level >= 10 ? "Nível 10 alcançado" : "Complete a trilha para chegar ao nível 10"}</span>${arrowIcon()}</div>`;
}

async function openMissions() {
  closeOverlay();
  overlay = document.createElement("div");
  overlay.className = "profile-missions-backdrop";
  overlay.innerHTML = `<section class="profile-missions-sheet" role="dialog" aria-modal="true" aria-label="Missões e XP"><header class="profile-missions-topbar"><button type="button" class="profile-missions-close" aria-label="Fechar">‹</button><div><small>TRILHA DA FAZENDA</small><h2>Missões e XP</h2></div></header><div class="profile-missions-body"><div class="profile-missions-loading"><span></span><strong>Carregando missões…</strong></div></div></section>`;
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeOverlay(); });
  overlay.querySelector<HTMLButtonElement>(".profile-missions-close")?.addEventListener("click", closeOverlay);
  document.body.appendChild(overlay);
  const body = overlay.querySelector<HTMLElement>(".profile-missions-body");
  if (!body) return;
  try {
    const data = await loadMissionData();
    const completed = data.missions.filter((mission) => mission.completed).length;
    body.innerHTML = `<section class="profile-xp-hero"><div><span>NÍVEL DA FAZENDA</span><strong>Nível ${data.level}</strong><small>${formatXp(data.xp)} de 5.000 XP</small></div><b>${data.level}</b><div class="profile-xp-progress"><i style="width:${Math.min(100,(data.xp/5000)*100)}%"></i></div><p>${completed}/50 missões concluídas · nível 10 no fim da trilha</p></section>${tierHtml("5 principais", "main", data.missions)}${tierHtml("15 médias", "medium", data.missions)}${tierHtml("30 difíceis", "hard", data.missions)}<div class="profile-missions-note">o xp só entra quando a missão é concluída. total da trilha: 5.000 xp.</div>`;
  } catch (error) {
    body.innerHTML = `<div class="profile-missions-error"><strong>Não foi possível carregar</strong><p>${error instanceof Error ? error.message : "Tente novamente em instantes."}</p></div>`;
  }
}

function ensureMissionShortcut() {
  const plan = document.querySelector<HTMLElement>(".profile-screen .plan-card");
  if (!plan || plan === injectedPlan) return;
  injectedPlan = plan;
  document.querySelector(".profile-screen .profile-missions-shortcut")?.remove();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-missions-shortcut is-loading";
  button.innerHTML = `<div class="profile-missions-shortcut-top"><span class="profile-missions-shortcut-icon">${targetIcon()}</span><div><small>TRILHA DE PROGRESSO</small><strong>Missões e XP</strong></div><span class="profile-missions-shortcut-level">…</span></div><div class="profile-missions-shortcut-skeleton"></div>`;
  button.addEventListener("click", () => void openMissions());
  plan.insertAdjacentElement("afterend", button);
  void loadMissionData().then((data) => { if (button.isConnected) renderShortcut(button, data); }).catch(() => undefined);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `.profile-missions-shortcut{width:calc(100% - 32px);margin:12px 16px 4px;padding:15px 16px;border:0;border-radius:22px;background:linear-gradient(145deg,#102f23,#174c36 72%,#225f45);color:#fff;text-align:left;box-shadow:0 13px 30px rgba(15,55,39,.16)}.profile-missions-shortcut-top{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:10px}.profile-missions-shortcut-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.11)}.profile-missions-shortcut-icon svg{width:20px}.profile-missions-shortcut-top div{display:grid;gap:2px}.profile-missions-shortcut-top small{font-size:7px;letter-spacing:.1em;opacity:.55}.profile-missions-shortcut-top strong{font-size:12px}.profile-missions-shortcut-level{padding:6px 8px;border-radius:999px;background:#ff8712;font-size:8px;font-weight:900}.profile-missions-shortcut-stats{display:flex;justify-content:space-between;margin-top:12px;font-size:8px;opacity:.72}.profile-missions-shortcut-stats strong{font-size:10px;color:#fff}.profile-missions-shortcut-progress,.profile-xp-progress,.profile-mission-progress{height:6px;border-radius:999px;background:rgba(255,255,255,.13);overflow:hidden}.profile-missions-shortcut-progress{margin-top:7px}.profile-missions-shortcut-progress i,.profile-xp-progress i{display:block;height:100%;background:#83ba5b}.profile-missions-shortcut-footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:7.5px;opacity:.62}.profile-missions-shortcut-footer svg{width:16px}.profile-missions-shortcut-skeleton{height:32px;margin-top:12px;border-radius:10px;background:rgba(255,255,255,.08)}.profile-missions-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:end center;background:rgba(5,25,17,.5);backdrop-filter:blur(8px)}.profile-missions-sheet{width:min(100%,620px);height:min(91vh,820px);overflow:hidden;border-radius:30px 30px 0 0;background:#f7faf8}.profile-missions-topbar{height:74px;padding:0 18px;display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#0e3324,#174c36);color:#fff}.profile-missions-topbar button{width:40px;height:40px;border:0;border-radius:13px;background:rgba(255,255,255,.1);color:#fff;font-size:28px}.profile-missions-topbar small{font-size:7px;opacity:.6}.profile-missions-topbar h2{margin:1px 0 0;font-size:17px}.profile-missions-body{height:calc(100% - 74px);overflow:auto;padding:15px 16px 30px}.profile-xp-hero{padding:17px;border-radius:22px;background:linear-gradient(135deg,#102f23,#174c36 68%,#236247);color:#fff;display:grid;grid-template-columns:1fr auto;gap:11px}.profile-xp-hero>div:first-child{display:grid;gap:3px}.profile-xp-hero span,.profile-xp-hero small{font-size:8px;opacity:.65}.profile-xp-hero strong{font-size:19px}.profile-xp-hero>b{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:#ff8712;font-size:18px}.profile-xp-progress{grid-column:1/-1}.profile-xp-hero p{grid-column:1/-1;margin:0;font-size:8px;opacity:.7}.profile-mission-tier{margin-top:18px}.profile-mission-tier>header{display:flex;justify-content:space-between;align-items:end;margin:0 2px 9px}.profile-mission-tier>header small{font-size:7px;font-weight:800;letter-spacing:.09em;color:#839088}.profile-mission-tier>header h3{margin:2px 0 0;font-size:14px;color:#173c2d}.profile-mission-tier>header>span{padding:5px 8px;border-radius:999px;background:#edf4ef;color:#174c36;font-size:8px;font-weight:900}.tier-hard>header>span{background:#fff0dc;color:#b85f08}.profile-missions-list{display:grid;gap:8px}.profile-mission-card{display:grid;grid-template-columns:40px 1fr auto;gap:9px;padding:11px;border:1px solid rgba(23,76,54,.09);border-radius:17px;background:#fff}.profile-mission-card.completed{background:#f4faf5}.profile-mission-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#edf4ef;color:#174c36;font-weight:900}.profile-mission-icon svg{width:19px}.profile-mission-copy{display:grid;gap:3px}.profile-mission-copy strong{font-size:9.5px;color:#173c2d}.profile-mission-copy small{font-size:7.5px;line-height:1.35;color:#7d8982}.profile-mission-card>b{align-self:start;padding:5px 7px;border-radius:999px;background:#fff0dc;color:#b85f08;font-size:7px}.profile-mission-progress{grid-column:2/-1;background:#edf1ee}.profile-mission-progress i{display:block;height:100%;background:#174c36}.profile-mission-card footer{grid-column:2/-1;display:flex;justify-content:space-between;font-size:7px;color:#87918b}.profile-missions-note{margin-top:16px;padding:11px;border-radius:14px;background:#eef4ef;color:#607068;font-size:8px;line-height:1.45}.profile-missions-loading,.profile-missions-error{min-height:220px;display:grid;place-items:center;text-align:center;color:#718078}@media(min-width:700px){.profile-missions-backdrop{place-items:center}.profile-missions-sheet{border-radius:30px}}`;
  document.head.appendChild(style);
}

if (typeof document !== "undefined") { installStyle(); ensureMissionShortcut(); const observer = new MutationObserver(ensureMissionShortcut); observer.observe(document.body,{childList:true,subtree:true}); }
