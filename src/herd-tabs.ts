const HERD_SELECTOR = ".herd-production-context";
const TAB_CLASS = "herd-view-tabs";

type HerdView = "overview" | "animals";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const smoothEase = "cubic-bezier(.16, 1, .3, 1)";

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

  const activeButton = screen.querySelector<HTMLElement>(`:scope > .${TAB_CLASS} button[data-view="${view}"]`);
  activeButton?.animate(
    [{ opacity: .72 }, { opacity: 1 }],
    { duration: 220, easing: smoothEase, fill: "none" },
  );

  const selector = view === "animals"
    ? ":scope > .herd-animal-view-item:not([hidden])"
    : ":scope > .herd-overview-view-item:not([hidden])";

  const blocks = Array.from(screen.querySelectorAll<HTMLElement>(selector));
  blocks.forEach((block, index) => {
    const keyframes = block.matches("button")
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "translate3d(0, 10px, 0) scale(.994)" },
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ];
    block.animate(keyframes, {
      duration: 330,
      delay: index * 34,
      easing: smoothEase,
      fill: "none",
    });
  });

  if (view === "animals") {
    screen.querySelectorAll<HTMLElement>(":scope > .animal-list:not([hidden]) > .animal-card").forEach((card, index) => {
      card.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 280, delay: 70 + Math.min(index, 10) * 24, easing: smoothEase, fill: "none" },
      );
    });
  }
}

function setView(screen: HTMLElement, view: HerdView, animate = false) {
  const previous = screen.dataset.herdView as HerdView | undefined;
  screen.dataset.herdView = view;
  const tabs = screen.querySelector<HTMLElement>(`:scope > .${TAB_CLASS}`);
  tabs?.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });

  applyVisibility(screen, view);
  if (animate && previous !== view) animateViewChange(screen, view);
  try { window.sessionStorage.setItem("hydra.herd.view", view); } catch { /* armazenamento indisponível */ }
}

function createTabs(screen: HTMLElement) {
  if (screen.querySelector(`:scope > .${TAB_CLASS}`)) return;
  const nav = document.createElement("nav");
  nav.className = TAB_CLASS;
  nav.setAttribute("aria-label", "Seções do rebanho");
  nav.setAttribute("role", "tablist");

  const overview = document.createElement("button");
  overview.type = "button";
  overview.dataset.view = "overview";
  overview.setAttribute("role", "tab");
  overview.innerHTML = "<span>Visão geral</span>";

  const animals = document.createElement("button");
  animals.type = "button";
  animals.dataset.view = "animals";
  animals.setAttribute("role", "tab");
  animals.innerHTML = `<span>Animais cadastrados</span><small>${animalCount(screen)}</small>`;

  nav.append(overview, animals);
  nav.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-view]") : null;
    if (!button) return;
    setView(screen, button.dataset.view === "animals" ? "animals" : "overview", true);
  });

  const header = screen.querySelector(":scope > .screen-header");
  if (header?.nextSibling) screen.insertBefore(nav, header.nextSibling);
  else screen.prepend(nav);
}

function enhance() {
  const marker = document.querySelector(HERD_SELECTOR);
  const screen = marker?.closest<HTMLElement>(".screen");
  if (!screen) return;

  screen.classList.add("herd-screen-enhanced");
  markViewItems(screen);
  createTabs(screen);

  const badge = screen.querySelector<HTMLElement>(`:scope > .${TAB_CLASS} button[data-view="animals"] small`);
  if (badge) badge.textContent = String(animalCount(screen));

  let saved: HerdView = "overview";
  try { saved = window.sessionStorage.getItem("hydra.herd.view") === "animals" ? "animals" : "overview"; } catch { /* armazenamento indisponível */ }
  setView(screen, (screen.dataset.herdView as HerdView | undefined) || saved);
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
