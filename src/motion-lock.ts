/*
 * Hydra Agro — motion lock.
 * A navegação e todas as telas comuns ficam estáticas.
 * A experiência NFC é a única exceção e continua usando suas animações próprias.
 */

const LOCK_ATTR = "data-hydra-motion-locked";

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
}

function lockBottomNav(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".bottom-nav, .bottom-nav > button, .bottom-nav > button > span, .bottom-nav > button > small, .bottom-nav > button svg").forEach((el) => {
    lockElement(el, el.matches("button"));
  });

  root.querySelectorAll<HTMLElement>(".bottom-nav > button.nav-nfc > span:first-of-type").forEach((el) => {
    important(el, "transform", "translateY(-9px)");
  });
}

function applyMotionLock() {
  document.querySelectorAll<HTMLElement>(".phone-app .app-content > .screen").forEach(lockScreen);
  lockBottomNav();
}

function scheduleLock() {
  requestAnimationFrame(() => {
    applyMotionLock();
    requestAnimationFrame(applyMotionLock);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleLock, { once: true });
} else {
  scheduleLock();
}

const observer = new MutationObserver(() => scheduleLock());
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
