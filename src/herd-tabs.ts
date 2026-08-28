import "./herd-tools-view.css";

const HERD_SELECTOR = ".herd-production-context";
const TOOL_CLASS = "herd-tools-panel";

type HerdView = "overview" | "animals";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const smoothEase = "cubic-bezier(.22, .78, .22, 1)";

function animalCount(screen: HTMLElement) {
  const subtitle = screen.querySelector<HTMLElement>(".screen-heading p")?.textContent || "";
  const match = subtitle.match(/(\d+)\s+animais?/i);
  if (match) return Number(match[1]);
  return screen.querySelectorAll(":scope > .animal-list .animal-card").length;
}

function markViewItems(screen: HTMLElement) {
  const overviewSelectors = [
    ":scope > .nfc-inline-card",
    ":scope > .herd-care-launch",
    ":scope > .herd-production-context",
    ":scope > .herd-reproduction-tools",
    ":scope > .herd-health-tools",
  ];
  const animalSelectors = [
    ":scope > .search-row",
    ":scope > .filter-chips",
    ":scope > .animal-list",
    ":scope > .empty-state",
  ];

  overviewSelectors.forEach((selector) => {
    screen.querySelectorAll<HTMLElement>(selector).forEach((node) => node.classList.add("herd-overview-view-item"));
  });
  animalSelectors.forEach((selector) => {
    screen.querySelectorAll<HTMLElement>(selector).forEach((node) => node.classList.add("herd-animal-view-item"));
  });
}

function applyVisibility(screen: HTMLElement, view: HerdView) {
  screen.querySelectorAll<HTMLElement>(":scope > .herd-overview-view-item").forEach((node) => {
    node.hidden = view !== "overview";
    node.setAttribute("aria-hidden", view === "overview" ? "false" : "true");
  });
  screen.querySelectorAll<HTMLElement>(":scope > .herd-animal-view-item").forEach((node) => {
    node.hidden = view !== "animals";
    node.setAttribute("aria-hidden", view === "animals" ? "false" : "true");
  });
}

function animateViewChange(screen: HTMLElement, view: HerdView) {
  if (reducedMotion.matches) return;
  const selector = view === "animals"
    ? ":scope > .herd-animal-view-item:not([hidden])"
    : ":scope > .herd-overview-view-item:not([hidden])";

  screen.querySelectorAll<HTMLElement>(selector).forEach((block) => {
    block.animate([{ opacity: 0.2 }, { opacity: 1 }], {
      duration: 220,
      easing: smoothEase,
      fill: "none",
    });
  });
}

function setView(screen: HTMLElement, view: HerdView, animate = false) {
  const previous = screen.dataset.herdView as HerdView | undefined;
  screen.dataset.herdView = view;
  const tools = screen.querySelector<HTMLElement>(`:scope > .${TOOL_CLASS}`);
  tools?.querySelectorAll<HTMLButtonElement>("button[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  applyVisibility(screen, view);
  if (animate && previous !== view) animateViewChange(screen, view);
}

function createTools(screen: HTMLElement) {
  let panel = screen.querySelector<HTMLElement>(`:scope > .${TOOL_CLASS}`);
  if (!panel) {
    panel = document.createElement("section");
    panel.className = TOOL_CLASS;
    panel.setAttribute("aria-label", "Ferramentas do rebanho");
    panel.innerHTML = `
      <small>Ferramentas do rebanho</small>
      <div class="herd-tools-grid">
        <button type="button" data-view="overview" aria-pressed="true">
          <span>Visão geral</span>
          <small>Cuidados, NFC e gestão</small>
        </button>
        <button type="button" data-view="animals" aria-pressed="false">
          <span>Animais cadastrados</span>
          <small><b data-animal-count>${animalCount(screen)}</b> no rebanho</small>
        </button>
      </div>`;

    panel.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-view]") : null;
      if (!button) return;
      setView(screen, button.dataset.view === "animals" ? "animals" : "overview", true);
    });

    const header = screen.querySelector(":scope > .screen-header");
    if (header?.nextSibling) screen.insertBefore(panel, header.nextSibling);
    else screen.prepend(panel);
  }

  const count = panel.querySelector<HTMLElement>("[data-animal-count]");
  if (count) count.textContent = String(animalCount(screen));
}

function enhance() {
  const marker = document.querySelector(HERD_SELECTOR);
  const screen = marker?.closest<HTMLElement>(".screen");
  if (!screen) return;

  screen.classList.add("herd-screen-enhanced");
  // Remove a navegação antiga para que a lista de animais fique somente em Ferramentas > Animais cadastrados.
  screen.querySelector(":scope > .herd-view-tabs")?.remove();
  markViewItems(screen);
  createTools(screen);

  const current = screen.dataset.herdView === "animals" ? "animals" : "overview";
  setView(screen, current);
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
scheduleEnhance();

export {};
