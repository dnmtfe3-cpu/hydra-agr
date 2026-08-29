import "./home-more-tools.css";
import "./splash-final-fix.css";

const HOME_SELECTOR = ".home-screen";
const SOURCE_CLASS = "home-more-tools-source";
const LAYER_CLASS = "home-more-tools-layer";
const CLOSE_CLASS = "home-more-tools-close";

function syncSplashViewport() {
  const active = Boolean(document.querySelector(".splash-screen"));
  const dark = Boolean(document.querySelector(".hydra-root.theme-dark"));
  const color = active ? "#09271b" : dark ? "#08261c" : "#f8f6ef";

  document.documentElement.classList.toggle("hydra-splash-active", active);
  document.documentElement.style.setProperty("background-color", color, "important");
  document.body.style.setProperty("background-color", color, "important");

  const root = document.getElementById("root");
  root?.style.setProperty("background-color", color, "important");

  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = color;
}

function findMoreToolsSource(screen: HTMLElement) {
  return Array.from(screen.querySelectorAll<HTMLButtonElement>(":scope > button.history-home-row"))
    .find((button) => button.textContent?.includes("Mais ferramentas")) ?? null;
}

function closeCurrentTools() {
  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);
  const source = screen ? findMoreToolsSource(screen) : null;
  if (source?.getAttribute("aria-expanded") === "true") source.click();
}

function openCurrentTools() {
  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);
  const source = screen ? findMoreToolsSource(screen) : null;
  if (source?.getAttribute("aria-expanded") !== "true") source?.click();
}

function ensureCloseButton(layer: HTMLElement) {
  let close = layer.querySelector<HTMLButtonElement>(`.${CLOSE_CLASS}`);
  if (close) return close;

  close = document.createElement("button");
  close.type = "button";
  close.className = CLOSE_CLASS;
  close.setAttribute("aria-label", "Fechar ações");
  close.setAttribute("title", "Fechar");
  close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  close.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeCurrentTools();
  };
  layer.appendChild(close);
  return close;
}

function enhanceHome() {
  syncSplashViewport();

  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);
  if (!screen) {
    document.documentElement.classList.remove("home-tools-open");
    return;
  }

  const source = findMoreToolsSource(screen);
  if (!source) return;
  source.classList.add(SOURCE_CLASS);

  const expanded = source.getAttribute("aria-expanded") === "true";
  document.documentElement.classList.toggle("home-tools-open", expanded);

  const layer = screen.querySelector<HTMLElement>(".home-tools-list");
  if (!layer) return;

  layer.classList.add(LAYER_CLASS);
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", "Nova ação");
  ensureCloseButton(layer);

  layer.onclick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target === layer) {
      closeCurrentTools();
      return;
    }

    if (target.closest(`.${CLOSE_CLASS}`)) return;

    const action = target.closest("button");
    if (action && layer.contains(action)) {
      window.setTimeout(closeCurrentTools, 0);
    }
  };
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceHome();
  });
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["aria-expanded", "class"],
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest(".home-screen .home-fab-label") : null;
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openCurrentTools();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.documentElement.classList.contains("home-tools-open")) {
    closeCurrentTools();
  }
});

window.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
scheduleEnhance();

export {};
