/*
 * Hydra Agro — motion controller.
 * Ícones e controles permanecem estáveis. As trocas usam apenas movimento de camada
 * inteira e crossfade suave; NFC mantém seu motion próprio.
 */

const LOCK_ATTR = "data-hydra-motion-locked";
const seenScreens = new WeakSet<HTMLElement>();
const seenFeatureLayers = new WeakSet<HTMLElement>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const smoothEase = "cubic-bezier(.22, .78, .22, 1)";

function important(el: HTMLElement, property: string, value: string) {
  el.style.setProperty(property, value, "important");
}

function lockElement(el: HTMLElement, resetTransform = false) {
  important(el, "animation", "none");
  important(el, "animation-delay", "0ms");
  important(el, "animation-duration", "0ms");
  important(el, "transition", "none");
  if (resetTransform) {
    important(el, "transform", "none");
    important(el, "scale", "1");
  }
}

function fadeLayer(element: HTMLElement, duration = 260) {
  if (seenFeatureLayers.has(element) || reducedMotion.matches) return;
  seenFeatureLayers.add(element);
  element.animate(
    [
      { opacity: 0.22 },
      { opacity: 1 },
    ],
    { duration, easing: smoothEase, fill: "none" },
  );
}

function animateScreen(screen: HTMLElement) {
  if (seenScreens.has(screen)) return;
  seenScreens.add(screen);
  if (reducedMotion.matches || screen.classList.contains("nfc-screen")) return;

  const host = screen.parentElement;
  const backwards = host?.classList.contains("route-motion-back") ?? false;
  const fromX = backwards ? -4 : 4;

  screen.animate(
    [
      { opacity: 0.55, transform: `translate3d(${fromX}px, 0, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ],
    { duration: 260, easing: smoothEase, fill: "none" },
  );
}

function animateOperations(screen: HTMLElement) {
  if (!screen.classList.contains("operations-screen") || reducedMotion.matches) return;

  screen.querySelectorAll<HTMLElement>(
    ":scope > .operations-header, :scope > .operations-tabs, :scope > .operations-summary, :scope > .operations-actions, :scope > .operations-panel, :scope > .staff-session-banner",
  ).forEach((layer) => fadeLayer(layer, 280));
}

function isHerdScreen(screen: HTMLElement) {
  return screen.classList.contains("herd-screen-enhanced") || Boolean(screen.querySelector(":scope > .nfc-inline-card"));
}

function animateHerd(screen: HTMLElement) {
  if (!isHerdScreen(screen) || reducedMotion.matches) return;

  screen.querySelectorAll<HTMLElement>(
    ":scope > .screen-header, :scope > .herd-view-tabs, :scope > .herd-overview-view-item:not([hidden]), :scope > .herd-animal-view-item:not([hidden])",
  ).forEach((layer) => fadeLayer(layer, 280));
}

function lockScreen(screen: HTMLElement) {
  if (screen.classList.contains("nfc-screen")) return;

  important(screen, "animation", "none");
  important(screen, "animation-delay", "0ms");
  important(screen, "animation-duration", "0ms");
  important(screen, "transition", "none");
  important(screen, "transform", "none");
  important(screen, "opacity", "1");
  important(screen, "filter", "none");
  important(screen, "will-change", "auto");
  screen.setAttribute(LOCK_ATTR, "true");

  screen.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.closest(".nfc-screen")) return;
    lockElement(el, el.matches("button, [role='button'], svg"));
  });

  animateScreen(screen);
  animateOperations(screen);
  animateHerd(screen);
}

function lockBottomNav(root: ParentNode = document) {
  /*
   * A barra pode usar transform para se centralizar. Não zere o transform do
   * contêiner: isso deslocava a barra metade da largura para a direita no iPhone.
   */
  root.querySelectorAll<HTMLElement>(".bottom-nav").forEach((nav) => lockElement(nav, false));

  root.querySelectorAll<HTMLElement>(
    ".bottom-nav > button, .bottom-nav > button > span, .bottom-nav > button > small, .bottom-nav > button svg",
  ).forEach((el) => lockElement(el, true));
}

function applyMotionController() {
  document.querySelectorAll<HTMLElement>(".phone-app .app-content > .screen").forEach(lockScreen);
  lockBottomNav();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyMotionController, { once: true });
} else {
  applyMotionController();
}

const observer = new MutationObserver(() => applyMotionController());
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

export {};
