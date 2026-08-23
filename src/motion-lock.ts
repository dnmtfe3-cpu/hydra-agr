/*
 * Hydra Agro — motion controller.
 * Mantém a navegação estável e impede os antigos "pulos" de ícones.
 * As animações intencionais ficam na troca de tela, Equipe/Rebanho e NFC.
 */

const LOCK_ATTR = "data-hydra-motion-locked";
const seenScreens = new WeakSet<HTMLElement>();
const seenFeatureBlocks = new WeakSet<HTMLElement>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const smoothEase = "cubic-bezier(.16, 1, .3, 1)";

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

function animateOnce(
  element: HTMLElement,
  delay = 0,
  distance = 10,
  duration = 330,
) {
  if (seenFeatureBlocks.has(element) || reducedMotion.matches) return;
  seenFeatureBlocks.add(element);
  element.animate(
    [
      { opacity: 0, transform: `translate3d(0, ${distance}px, 0) scale(.992)` },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ],
    { duration, delay, easing: smoothEase, fill: "none" },
  );
}

function animateOpacityOnce(element: HTMLElement, delay = 0, duration = 280) {
  if (seenFeatureBlocks.has(element) || reducedMotion.matches) return;
  seenFeatureBlocks.add(element);
  element.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration, delay, easing: smoothEase, fill: "none" },
  );
}

function animateScreen(screen: HTMLElement) {
  if (seenScreens.has(screen)) return;
  seenScreens.add(screen);
  if (reducedMotion.matches || screen.classList.contains("nfc-screen")) return;

  const host = screen.parentElement;
  const backwards = host?.classList.contains("route-motion-back") ?? false;
  const fromX = backwards ? -10 : 10;

  screen.animate(
    [
      { opacity: 0.7, transform: `translate3d(${fromX}px, 2px, 0) scale(.996)` },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ],
    { duration: 310, easing: smoothEase, fill: "none" },
  );
}

function animateOperations(screen: HTMLElement) {
  if (!screen.classList.contains("operations-screen") || reducedMotion.matches) return;

  const hero = screen.querySelector<HTMLElement>(":scope > .operations-header");
  const tabs = screen.querySelector<HTMLElement>(":scope > .operations-tabs");
  if (hero) animateOnce(hero, 20, 12, 390);
  if (tabs) animateOnce(tabs, 65, 8, 340);

  screen.querySelectorAll<HTMLElement>(
    ":scope > .operations-summary, :scope > .operations-actions, :scope > .operations-panel, :scope > .staff-session-banner",
  ).forEach((block, index) => animateOnce(block, 85 + index * 34, 12, 360));

  screen.querySelectorAll<HTMLElement>(
    ":scope > .operations-summary > div, :scope > .operations-actions > button, .staff-access-explainer, .operations-title, .staff-member-list > article, .operations-list > article",
  ).forEach((item, index) => {
    if (item.matches("button")) animateOpacityOnce(item, 125 + Math.min(index, 8) * 22, 300);
    else animateOnce(item, 120 + Math.min(index, 8) * 24, 7, 325);
  });
}

function isHerdScreen(screen: HTMLElement) {
  return screen.classList.contains("herd-screen-enhanced") || Boolean(screen.querySelector(":scope > .nfc-inline-card"));
}

function animateHerd(screen: HTMLElement) {
  if (!isHerdScreen(screen) || reducedMotion.matches) return;

  const header = screen.querySelector<HTMLElement>(":scope > .screen-header");
  const tabs = screen.querySelector<HTMLElement>(":scope > .herd-view-tabs");
  if (header) animateOnce(header, 25, 11, 390);
  if (tabs) animateOnce(tabs, 70, 8, 340);

  const visibleBlocks = screen.querySelectorAll<HTMLElement>(
    ":scope > .herd-overview-view-item:not([hidden]), :scope > .herd-animal-view-item:not([hidden])",
  );
  visibleBlocks.forEach((block, index) => {
    if (block.matches("button")) animateOpacityOnce(block, 105 + index * 28, 320);
    else animateOnce(block, 105 + index * 30, 9, 350);
  });

  screen.querySelectorAll<HTMLElement>(":scope > .animal-list:not([hidden]) > .animal-card").forEach((card, index) => {
    animateOpacityOnce(card, 135 + Math.min(index, 10) * 24, 300);
  });
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
    lockElement(el, el.matches("button, [role='button']"));
  });

  animateScreen(screen);
  animateOperations(screen);
  animateHerd(screen);
}

function lockBottomNav(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(
    ".bottom-nav, .bottom-nav > button, .bottom-nav > button > span, .bottom-nav > button > small, .bottom-nav > button svg",
  ).forEach((el) => lockElement(el, el.matches("button")));

  root.querySelectorAll<HTMLElement>(".bottom-nav > button.nav-nfc > span:first-of-type").forEach((el) => {
    important(el, "transform", "translateY(-9px)");
  });
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
