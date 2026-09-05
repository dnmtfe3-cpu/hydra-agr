const styleId = "hydra-bottom-nav-final-runtime";

const css = String.raw`
@media (max-width: 899px) {
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100vw !important;
    height: calc(62px + env(safe-area-inset-bottom)) !important;
    min-height: calc(62px + env(safe-area-inset-bottom)) !important;
    max-height: calc(62px + env(safe-area-inset-bottom)) !important;
    margin: 0 !important;
    padding: 0 8px env(safe-area-inset-bottom) !important;
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    align-items: center !important;
    gap: 0 !important;
    overflow: visible !important;
    border: 0 !important;
    border-radius: 22px 22px 0 0 !important;
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    filter: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    transform: none !important;
    isolation: isolate !important;
    z-index: 180 !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav::before {
    content: "" !important;
    display: block !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: -1 !important;
    border: 0 !important;
    border-radius: 22px 22px 0 0 !important;
    background: #fff !important;
    box-shadow: 0 -5px 18px rgba(28, 50, 39, .07) !important;
    -webkit-mask: radial-gradient(circle 38px at 50% -14px, transparent 37px, #000 38px) !important;
    mask: radial-gradient(circle 38px at 50% -14px, transparent 37px, #000 38px) !important;
    pointer-events: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav::after {
    content: none !important;
    display: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button {
    position: relative !important;
    z-index: 2 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    height: 54px !important;
    min-height: 54px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: grid !important;
    place-items: center !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #c8ccc9 !important;
    opacity: 1 !important;
    filter: none !important;
    overflow: visible !important;
    transform: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button > span:first-of-type:not(.touch-ripple) {
    width: 40px !important;
    min-width: 40px !important;
    height: 40px !important;
    min-height: 40px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: grid !important;
    place-items: center !important;
    border: 0 !important;
    border-radius: 50% !important;
    background: transparent !important;
    box-shadow: none !important;
    color: inherit !important;
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    animation: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button > span:first-of-type:not(.touch-ripple) svg {
    width: 24px !important;
    height: 24px !important;
    color: currentColor !important;
    stroke-width: 1.9 !important;
    transform: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button > small {
    display: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc) {
    color: var(--forest-800, #174c36) !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc)::after {
    content: "" !important;
    display: block !important;
    position: absolute !important;
    left: 50% !important;
    bottom: 3px !important;
    width: 7px !important;
    height: 7px !important;
    border-radius: 50% !important;
    background: var(--forest-800, #174c36) !important;
    transform: translateX(-50%) !important;
    pointer-events: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc,
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.active {
    position: relative !important;
    z-index: 4 !important;
    height: 62px !important;
    min-height: 62px !important;
    color: #fff !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
    transform: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.active > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.is-tapped > span:first-of-type:not(.touch-ripple) {
    position: absolute !important;
    left: 50% !important;
    top: -20px !important;
    width: 62px !important;
    min-width: 62px !important;
    height: 62px !important;
    min-height: 62px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 50% !important;
    background: #174c36 !important;
    color: #fff !important;
    box-shadow: 0 6px 14px rgba(23, 76, 54, .18) !important;
    opacity: 1 !important;
    filter: none !important;
    transform: translateX(-50%) !important;
    animation: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc > span:first-of-type:not(.touch-ripple) svg,
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.active > span:first-of-type:not(.touch-ripple) svg {
    width: 27px !important;
    height: 27px !important;
    color: #fff !important;
    stroke-width: 2 !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav .bottom-nav-indicator {
    display: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app .app-content {
    padding-bottom: calc(68px + env(safe-area-inset-bottom)) !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav.is-hidden {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  /* Tema escuro: a barra não pode herdar branco ou cinza do layout claro. */
  html body #root .hydra-root.theme-dark.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav::before {
    background: #0a1c13 !important;
    box-shadow: 0 -7px 24px rgba(0, 0, 0, .42), inset 0 1px 0 rgba(122, 190, 143, .08) !important;
  }

  html body #root .hydra-root.theme-dark.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button {
    color: #759083 !important;
  }

  html body #root .hydra-root.theme-dark.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc) {
    color: #8dcea0 !important;
  }

  html body #root .hydra-root.theme-dark.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc)::after {
    background: #ff922e !important;
    box-shadow: 0 0 0 4px rgba(255, 146, 46, .12) !important;
  }

  html body #root .hydra-root.theme-dark.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root.theme-dark.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.active > span:first-of-type:not(.touch-ripple) {
    background: #ff922e !important;
    box-shadow: 0 9px 22px rgba(255, 146, 46, .28) !important;
  }

}
`;

function installBottomNavFinalStyle() {
  const previous = document.getElementById(styleId);
  if (previous) previous.remove();
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

installBottomNavFinalStyle();
