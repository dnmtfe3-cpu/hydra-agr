import "./home-more-tools.css";

const HOME_SELECTOR = ".home-screen";
const SHORTCUT_CLASS = "home-more-tools-shortcut";
const SOURCE_CLASS = "home-more-tools-source";

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

function enhanceHome() {
  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);
  if (!screen) return;

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
  attributeFilter: ["aria-expanded"],
});

window.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
scheduleEnhance();

export {};
