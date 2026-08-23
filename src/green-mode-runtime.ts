import "./green-mode-theme.css";
import "./bottom-nav-runtime-fix.css";
import "./green-mode-final-fixes.css";
import "./green-mode-portal-fix.css";

const GREEN_THEME_COLOR = "#08261c";
const LIGHT_THEME_COLOR = "#0f3727";

function setTextIf(node: Element | null, from: string, to: string) {
  if (node?.textContent?.trim() === from) node.textContent = to;
}

function syncGreenModeUi() {
  const root = document.querySelector<HTMLElement>(".hydra-root");
  const isGreen = root?.classList.contains("theme-dark") ?? false;

  document.documentElement.classList.toggle("hydra-green-mode", isGreen);
  document.body.classList.toggle("hydra-green-mode", isGreen);
  document.documentElement.style.backgroundColor = isGreen ? GREEN_THEME_COLOR : "#f8f6ef";
  document.body.style.backgroundColor = isGreen ? GREEN_THEME_COLOR : "#f8f6ef";

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = isGreen ? GREEN_THEME_COLOR : LIGHT_THEME_COLOR;

  document.querySelectorAll<HTMLElement>(".theme-menu-row small").forEach((node) => {
    setTextIf(node, "Modo escuro", "Modo verde");
  });

  document.querySelectorAll<HTMLElement>(".profile-settings-sheet small").forEach((node) => {
    setTextIf(node, "Modo claro ou escuro", "Modo claro ou verde");
  });

  document.querySelectorAll<HTMLButtonElement>(".theme-option").forEach((button) => {
    const title = button.querySelector("strong");
    if (title?.textContent?.trim() !== "Escuro" && title?.textContent?.trim() !== "Verde") return;
    if (title) title.textContent = "Verde";
    const description = button.querySelector("small");
    if (description) description.textContent = "Verde profundo, creme e laranja";
  });
}

let scheduled = false;
function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    syncGreenModeUi();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleSync, { once: true });
} else {
  scheduleSync();
}

const observer = new MutationObserver(scheduleSync);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

export {};
