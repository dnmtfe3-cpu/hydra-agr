/*
 * Hydra Agro — controlador de movimento suave.
 * A tela inteira faz a transição; ícones e cards não entram pulando individualmente.
 * A experiência NFC mantém as animações próprias.
 */

const seenScreens = new WeakSet<HTMLElement>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const smoothEase = "cubic-bezier(.22, .78, .22, 1)";

function animateScreen(screen: HTMLElement) {
  if (seenScreens.has(screen)) return;
  seenScreens.add(screen);
  if (reducedMotion.matches || screen.classList.contains("nfc-screen")) return;

  const host = screen.parentElement;
  const backwards = host?.classList.contains("route-motion-back") ?? false;
  const fromX = backwards ? -4 : 4;

  /*
   * Usamos translate separado de transform para não brigar com os estilos dos
   * componentes. Assim a tela se move como uma camada única e os ícones não pulam.
   */
  screen.animate(
    [
      { opacity: 0.72, translate: `${fromX}px 5px` },
      { opacity: 1, translate: "0 0" },
    ],
    {
      duration: 280,
      easing: smoothEase,
      fill: "none",
    },
  );
}

function applyMotionController(root: ParentNode = document) {
  root
    .querySelectorAll<HTMLElement>(".phone-app .app-content > .screen")
    .forEach(animateScreen);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => applyMotionController(), { once: true });
} else {
  applyMotionController();
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(".phone-app .app-content > .screen")) animateScreen(node);
      applyMotionController(node);
    });
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {};
