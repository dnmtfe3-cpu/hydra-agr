/*
 * Hydra Agro — motion controller.
 * Mantém ícones, botões e conteúdo interno estáveis, mas permite uma transição
 * suave do bloco inteiro ao trocar de função. A NFC continua com seu motion próprio.
 */

const LOCK_ATTR = "data-hydra-motion-locked";
const seenScreens = new WeakSet<HTMLElement>();
const seenOperationsBlocks = new WeakSet<HTMLElement>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

function animateScreen(screen: HTMLElement) {
  if (seenScreens.has(screen)) return;
  seenScreens.add(screen);
  if (reducedMotion.matches || screen.classList.contains("nfc-screen")) return;

  const host = screen.parentElement;
  const backwards = host?.classList.contains("route-motion-back") ?? false;
  const fromX = backwards ? -10 : 10;

  screen.animate(
    [
      { opacity: 0.72, transform: `translate3d(${fromX}px, 2px, 0) scale(.996)` },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ],
    {
      duration: 285,
      easing: "cubic-bezier(.16, 1, .3, 1)",
      fill: "none",
    },
  );
}

function animateOperationsBlocks(screen: HTMLElement) {
  if (!screen.classList.contains("operations-screen") || reducedMotion.matches) return;

  screen.querySelectorAll<HTMLElement>(":scope > .operations-summary, :scope > .operations-actions, :scope > .operations-panel").forEach((block) => {
    if (seenOperationsBlocks.has(block)) return;
    seenOperationsBlocks.add(block);
    block.animate(
      [
        { opacity: 0.62, transform: "translate3d(0, 8px, 0) scale(.994)" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      {
        duration: 255,
        easing: "cubic-bezier(.16, 1, .3, 1)",
        fill: "none",
      },
    );
  });
}

function lockScreen(screen: HTMLElement) {
  if (screen.classList.contains("nfc-screen")) return;

  /* Mata animações CSS antigas antes do primeiro paint. */
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
  animateOperationsBlocks(screen);
}

function lockBottomNav(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".bottom-nav, .bottom-nav > button, .bottom-nav > button > span, .bottom-nav > button > small, .bottom-nav > button svg").forEach((el) => {
    lockElement(el, el.matches("button"));
  });

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

/* MutationObserver roda antes do próximo paint e impede os saltos dos CSS antigos. */
const observer = new MutationObserver(() => applyMotionController());
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
