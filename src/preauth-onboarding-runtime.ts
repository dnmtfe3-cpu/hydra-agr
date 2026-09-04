export {};

const STORAGE_KEY = "hydra.preauth.onboarding.v1";
const ROOT_CLASS = "hydra-preauth-onboarding";

const slides = [
  {
    eyebrow: "HYDRA AGRO",
    title: "Sua fazenda, mais organizada.",
    copy: "Acompanhe propriedade, rotina, água e rebanho em um só lugar.",
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/></svg>`,
    chips: ["Propriedade", "Rotina", "Água"],
  },
  {
    eyebrow: "REBANHO",
    title: "Identificação que acompanha o campo.",
    copy: "Cadastre animais, use NFC/RFID e mantenha as informações importantes sempre por perto.",
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8c-2.8 0-4 1.7-4 4s1.7 4 4.5 4H9m8-8c2.8 0 4 1.7 4 4s-1.7 4-4.5 4H15M8 7.5C8 5.6 9.8 4 12 4s4 1.6 4 3.5V15c0 2.8-1.8 5-4 5s-4-2.2-4-5V7.5Z"/><path d="M9 11h.01M15 11h.01M10 15c1.2.8 2.8.8 4 0"/></svg>`,
    chips: ["NFC / RFID", "Animais", "Histórico"],
  },
  {
    eyebrow: "PROGRESSO",
    title: "Faça no campo. Evolua no app.",
    copy: "Missões são liberadas uma por vez. Complete a atual, ganhe XP e avance naturalmente.",
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 8l7-5 7 5-7 5-7-5Z"/><path d="m5 14 7 5 7-5"/></svg>`,
    chips: ["Missões", "XP", "Ranking"],
  },
];

function wasSeen() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; }
  catch { return false; }
}

function markSeen() {
  try { localStorage.setItem(STORAGE_KEY, "1"); }
  catch { /* armazenamento indisponível */ }
}

function findAction(kind: "login" | "signup") {
  const landing = document.querySelector<HTMLElement>(".auth-landing");
  if (!landing) return null;
  return landing.querySelector<HTMLButtonElement>(kind === "login" ? ".auth-landing-primary" : ".auth-landing-secondary");
}

function mountOnboarding() {
  if (wasSeen() || document.querySelector(`.${ROOT_CLASS}`)) return;
  const landing = document.querySelector<HTMLElement>(".auth-landing");
  if (!landing) return;

  let index = 0;
  const overlay = document.createElement("section");
  overlay.className = ROOT_CLASS;
  overlay.setAttribute("aria-label", "Conheça o Hydra Agro");

  const render = () => {
    const slide = slides[index];
    const last = index === slides.length - 1;
    overlay.innerHTML = `
      <div class="preauth-orb preauth-orb-a" aria-hidden="true"></div>
      <div class="preauth-orb preauth-orb-b" aria-hidden="true"></div>
      <header class="preauth-topbar">
        <span class="preauth-brand"><i></i> Hydra Agro</span>
        <button type="button" class="preauth-skip">Pular</button>
      </header>
      <div class="preauth-stage">
        <div class="preauth-visual" aria-hidden="true">
          <span class="preauth-icon">${slide.icon}</span>
          <span class="preauth-line line-a"></span>
          <span class="preauth-line line-b"></span>
          <span class="preauth-mini mini-a"></span>
          <span class="preauth-mini mini-b"></span>
        </div>
        <div class="preauth-copy">
          <span class="preauth-eyebrow">${slide.eyebrow}</span>
          <h1>${slide.title}</h1>
          <p>${slide.copy}</p>
          <div class="preauth-chips">${slide.chips.map((chip) => `<span>${chip}</span>`).join("")}</div>
        </div>
      </div>
      <footer class="preauth-footer">
        <div class="preauth-dots" aria-label="Etapa ${index + 1} de ${slides.length}">${slides.map((_, dot) => `<span class="${dot === index ? "active" : ""}"></span>`).join("")}</div>
        ${last ? `
          <div class="preauth-final-actions">
            <button type="button" class="preauth-create">Criar minha conta</button>
            <button type="button" class="preauth-login">Já tenho uma conta</button>
          </div>` : `
          <div class="preauth-nav-actions">
            ${index > 0 ? `<button type="button" class="preauth-back">Voltar</button>` : `<span></span>`}
            <button type="button" class="preauth-next">Continuar <b>→</b></button>
          </div>`}
      </footer>`;

    overlay.querySelector<HTMLButtonElement>(".preauth-skip")?.addEventListener("click", () => {
      markSeen(); overlay.remove();
    });
    overlay.querySelector<HTMLButtonElement>(".preauth-next")?.addEventListener("click", () => {
      index = Math.min(slides.length - 1, index + 1); render();
    });
    overlay.querySelector<HTMLButtonElement>(".preauth-back")?.addEventListener("click", () => {
      index = Math.max(0, index - 1); render();
    });
    overlay.querySelector<HTMLButtonElement>(".preauth-create")?.addEventListener("click", () => {
      markSeen(); overlay.remove(); findAction("signup")?.click();
    });
    overlay.querySelector<HTMLButtonElement>(".preauth-login")?.addEventListener("click", () => {
      markSeen(); overlay.remove(); findAction("login")?.click();
    });
  };

  render();
  landing.insertAdjacentElement("afterend", overlay);
}

if (typeof document !== "undefined") {
  mountOnboarding();
  const observer = new MutationObserver(() => {
    if (!wasSeen() && document.querySelector(".auth-landing")) mountOnboarding();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
