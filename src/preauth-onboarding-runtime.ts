export {};

const STORAGE_KEY = "hydra.preauth.onboarding.v4";
const ROOT_CLASS = "hydra-preauth-onboarding";

const hydraMark = `<svg class="onb-brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#174c36"/><path d="M17 35c0-10 7-18 15-24 0 14 8 18 8 29 0 8-5 14-12 14-6 0-11-4-11-10 0-5 3-9 8-13-1 7 1 12 6 15" fill="#f49a31"/><path d="M39 14c8 2 12 8 10 17-7-1-12-5-13-12 4 4 7 6 11 7" fill="#83ba5b"/><path d="M23 46c4 4 11 4 16-1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/></svg>`;
const cowMark = `<svg class="onb-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7C5 5 3 5 2 7c2 .5 3 1.5 4 3m11-3c2-2 4-2 5 0-2 .5-3 1.5-4 3M7 7c1-3 3-4 5-4s4 1 5 4v7c0 4-2 7-5 7s-5-3-5-7V7Z"/><path d="M9 12h.01M15 12h.01M10 17c1.3.8 2.7.8 4 0"/></svg>`;
const dropMark = `<svg class="onb-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-2 5-6 8-6 13a6 6 0 0 0 12 0c0-5-4-8-6-13Z"/><path d="M9 17c.7 1.2 1.7 1.8 3 1.8"/></svg>`;
const trophyMark = `<svg class="onb-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM8 6H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3M12 12v5m-3 3h6"/></svg>`;

const scenes = {
  dashboard: `<div class="onb-phone onb-dashboard"><div class="onb-phone-head">${hydraMark}<div><strong>Hydra Agro</strong><small>Minha propriedade</small></div><span class="onb-head-dot"></span></div><div class="onb-hero-card"><small>VISÃO DA FAZENDA</small><strong>Tudo organizado em um só lugar</strong><p>Rebanho, água e rotina juntos.</p></div><div class="onb-mini-grid"><article><span class="onb-symbol">${cowMark}</span><small>REBANHO</small><strong>Animais e identificação</strong></article><article><span class="onb-symbol water">${dropMark}</span><small>ÁGUA</small><strong>Registros e histórico</strong></article></div><div class="onb-row-card"><span class="onb-check">✓</span><div><small>ROTINA</small><strong>Atividades da propriedade</strong></div><b>›</b></div></div>`,
  herd: `<div class="onb-phone onb-herd"><div class="onb-phone-head">${hydraMark}<div><strong>Rebanho</strong><small>Gestão individual</small></div></div><div class="onb-animal-card"><div class="onb-animal-avatar">${cowMark}</div><div><small>ANIMAL CADASTRADO</small><strong>Ficha completa no campo</strong><p>Dados e histórico em um só lugar.</p></div></div><div class="onb-nfc-card"><span class="onb-nfc">NFC</span><div><small>IDENTIFICAÇÃO</small><strong>NFC / RFID vinculado</strong></div><span class="onb-ok">✓</span></div><div class="onb-timeline"><i></i><div><small>HISTÓRICO</small><strong>Manejo e registros</strong></div><span></span><div><small>ACESSO RÁPIDO</small><strong>Informações na hora</strong></div></div></div>`,
  water: `<div class="onb-phone onb-water"><div class="onb-phone-head">${hydraMark}<div><strong>Controle de água</strong><small>Acompanhamento diário</small></div></div><div class="onb-water-ring">${dropMark}<strong>Água</strong><small>Registros por dia</small></div><div class="onb-water-list"><article><i></i><div><small>NOVO REGISTRO</small><strong>Adicione o consumo do dia</strong></div></article><article><i></i><div><small>HISTÓRICO</small><strong>Acompanhe os registros anteriores</strong></div></article></div></div>`,
  missions: `<div class="onb-phone onb-missions"><div class="onb-phone-head">${hydraMark}<div><strong>Missões e XP</strong><small>Progresso automático</small></div></div><div class="onb-xp-card"><small>MISSÃO ATUAL</small><strong>Complete uma etapa por vez</strong><div class="onb-progress"><i></i></div><p>Concluiu → ganha XP → próxima missão.</p></div><div class="onb-mission-flow"><span>1</span><i></i><span>2</span><i></i><span>3</span></div><div class="onb-ranking-card"><span class="onb-trophy">${trophyMark}</span><div><small>RANKING</small><strong>Compare sua evolução</strong></div><b>XP</b></div></div>`,
} as const;

const slides = [
  { eyebrow: "HYDRA AGRO", title: "Sua fazenda em um só lugar.", copy: "Organize propriedade, rebanho, água e rotina sem espalhar informação por vários lugares.", scene: scenes.dashboard },
  { eyebrow: "REBANHO + NFC", title: "Informação certa na hora do manejo.", copy: "Cadastre os animais, vincule NFC/RFID e consulte a ficha e o histórico direto no campo.", scene: scenes.herd },
  { eyebrow: "CONTROLE DE ÁGUA", title: "Registre hoje. Acompanhe depois.", copy: "Faça registros de água e mantenha um histórico simples para acompanhar a rotina da propriedade.", scene: scenes.water },
  { eyebrow: "MISSÕES + XP", title: "Cuide da fazenda e evolua no Hydra.", copy: "As missões avançam sozinhas: conclua a atual, ganhe XP e acompanhe sua posição no ranking.", scene: scenes.missions },
];

function wasSeen() { try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; } }
function markSeen() { try { localStorage.setItem(STORAGE_KEY, "1"); } catch {} }
function authAction(kind: "login" | "signup") { const landing = document.querySelector<HTMLElement>(".auth-landing"); return landing?.querySelector<HTMLButtonElement>(kind === "login" ? ".auth-landing-primary" : ".auth-landing-secondary"); }

function mountOnboarding() {
  if (wasSeen() || document.querySelector(`.${ROOT_CLASS}`) || !document.querySelector(".auth-landing")) return;
  let index = 0;
  let touchStart = 0;
  const overlay = document.createElement("section");
  overlay.className = ROOT_CLASS;
  overlay.setAttribute("aria-label", "Conheça o Hydra Agro");
  const render = () => {
    const slide = slides[index];
    const last = index === slides.length - 1;
    overlay.innerHTML = `<header class="preauth-topbar"><button class="preauth-back" ${index === 0 ? "disabled" : ""} aria-label="Voltar">‹</button><span class="preauth-counter">${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}</span></header><main class="preauth-stage"><div class="preauth-visual">${slide.scene}</div><div class="preauth-copy"><span class="preauth-eyebrow">${slide.eyebrow}</span><h1>${slide.title}</h1><p>${slide.copy}</p></div></main><footer class="preauth-footer"><div class="preauth-dots">${slides.map((_, dot) => `<span class="${dot === index ? "active" : ""}"></span>`).join("")}</div>${last ? `<button class="preauth-create">Criar conta</button><button class="preauth-login">Já tenho uma conta</button>` : `<button class="preauth-next">Continuar <b>→</b></button><button class="preauth-skip">Pular</button>`}</footer>`;
    overlay.querySelector<HTMLButtonElement>(".preauth-next")?.addEventListener("click", () => { index += 1; render(); });
    overlay.querySelector<HTMLButtonElement>(".preauth-back")?.addEventListener("click", () => { if (index > 0) { index -= 1; render(); } });
    overlay.querySelector<HTMLButtonElement>(".preauth-skip")?.addEventListener("click", () => { markSeen(); overlay.remove(); });
    overlay.querySelector<HTMLButtonElement>(".preauth-create")?.addEventListener("click", () => { markSeen(); overlay.remove(); authAction("signup")?.click(); });
    overlay.querySelector<HTMLButtonElement>(".preauth-login")?.addEventListener("click", () => { markSeen(); overlay.remove(); authAction("login")?.click(); });
  };
  overlay.addEventListener("touchstart", (event) => { touchStart = event.touches[0]?.clientX ?? 0; }, { passive: true });
  overlay.addEventListener("touchend", (event) => { const end = event.changedTouches[0]?.clientX ?? touchStart; const delta = end - touchStart; if (delta < -55 && index < slides.length - 1) { index += 1; render(); } if (delta > 55 && index > 0) { index -= 1; render(); } }, { passive: true });
  render();
  document.querySelector(".auth-landing")?.insertAdjacentElement("afterend", overlay);
}

if (typeof document !== "undefined") {
  mountOnboarding();
  new MutationObserver(() => { if (!wasSeen() && document.querySelector(".auth-landing")) mountOnboarding(); }).observe(document.documentElement, { childList: true, subtree: true });
}
