import "./home-more-tools.css";

const HOME_SELECTOR = ".home-screen";
const SHORTCUT_CLASS = "home-more-tools-shortcut";
const SOURCE_CLASS = "home-more-tools-source";
const LAYER_CLASS = "home-more-tools-layer";

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

function buildShortcut(source: HTMLButtonElement) {
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = SHORTCUT_CLASS;
  shortcut.setAttribute("aria-label", "Mais ferramentas");
  shortcut.setAttribute("title", "Mais ferramentas");

  const sourceIcon = source.querySelector<HTMLElement>(":scope > span");
  if (sourceIcon) {
    shortcut.appendChild(sourceIcon.cloneNode(true));
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = "+";
    fallback.setAttribute("aria-hidden", "true");
    shortcut.appendChild(fallback);
  }

  return shortcut;
}

function closeCurrentTools() {
  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);
  const source = screen ? findMoreToolsSource(screen) : null;
  if (source?.getAttribute("aria-expanded") === "true") source.click();
}

function enhanceHome() {
  syncSplashViewport();

  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);
  if (!screen) {
    document.documentElement.classList.remove("home-tools-open");
    return;
  }

  const shortcuts = screen.querySelector<HTMLElement>(".shortcut-row.home-shortcuts-five");
  const source = findMoreToolsSource(screen);
  if (!shortcuts || !source) return;

  shortcuts.classList.add("home-shortcuts-with-more");
  source.classList.add(SOURCE_CLASS);

  let shortcut = shortcuts.querySelector<HTMLButtonElement>(`.${SHORTCUT_CLASS}`);
  if (!shortcut) {
    shortcut = buildShortcut(source);
    shortcuts.appendChild(shortcut);
  }

  shortcut.onclick = () => {
    const currentScreen = document.querySelector<HTMLElement>(HOME_SELECTOR);
    const currentSource = currentScreen ? findMoreToolsSource(currentScreen) : null;
    currentSource?.click();
  };

  const expanded = source.getAttribute("aria-expanded") === "true";
  shortcut.classList.toggle("active", expanded);
  shortcut.setAttribute("aria-pressed", expanded ? "true" : "false");
  document.documentElement.classList.toggle("home-tools-open", expanded);

  const layer = screen.querySelector<HTMLElement>(".home-tools-list");
  if (!layer) return;

  layer.classList.add(LAYER_CLASS);
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", "Mais ferramentas");

  layer.onclick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target === layer) {
      closeCurrentTools();
      return;
    }

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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.documentElement.classList.contains("home-tools-open")) {
    closeCurrentTools();
  }
});

window.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
scheduleEnhance();

export {};
