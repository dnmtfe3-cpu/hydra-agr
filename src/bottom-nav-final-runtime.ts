const styleId = "hydra-bottom-nav-final-runtime";

const css = String.raw`
@media (max-width: 899px) {
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav {
    position: fixed !important;
    left: 18px !important;
    right: 18px !important;
    bottom: calc(14px + env(safe-area-inset-bottom)) !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    height: 72px !important;
    min-height: 72px !important;
    max-height: 72px !important;
    margin: 0 !important;
    padding: 0 8px !important;
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    align-items: center !important;
    gap: 0 !important;
    overflow: visible !important;
    border: 0 !important;
    border-radius: 24px !important;
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
    border-radius: 24px !important;
    background: #fff !important;
    box-shadow: 0 10px 28px rgba(28, 50, 39, .11), 0 2px 7px rgba(28, 50, 39, .05) !important;
    -webkit-mask: radial-gradient(circle 43px at 50% -1px, transparent 42px, #000 43px) !important;
    mask: radial-gradient(circle 43px at 50% -1px, transparent 42px, #000 43px) !important;
    pointer-events: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav::after {
    content: "" !important;
    display: block !important;
    position: absolute !important;
    left: 50% !important;
    top: -27px !important;
    width: 76px !important;
    height: 76px !important;
    border: 0 !important;
    border-radius: 50% !important;
    background: #e9ecea !important;
    box-shadow: none !important;
    transform: translateX(-50%) !important;
    z-index: 0 !important;
    pointer-events: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button {
    position: relative !important;
    z-index: 2 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    height: 64px !important;
    min-height: 64px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: grid !important;
    place-items: center !important;
    border: 0 !important;
    border-radius: 18px !important;
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
    color: #239668 !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc,
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.active {
    position: relative !important;
    z-index: 4 !important;
    height: 72px !important;
    min-height: 72px !important;
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
    top: -24px !important;
    width: 66px !important;
    min-width: 66px !important;
    height: 66px !important;
    min-height: 66px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 50% !important;
    background: #299b6d !important;
    color: #fff !important;
    box-shadow: 0 8px 18px rgba(31, 126, 88, .18) !important;
    opacity: 1 !important;
    filter: none !important;
    transform: translateX(-50%) !important;
    animation: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc > span:first-of-type:not(.touch-ripple) svg,
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.active > span:first-of-type:not(.touch-ripple) svg {
    width: 29px !important;
    height: 29px !important;
    color: #fff !important;
    stroke-width: 1.9 !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav .bottom-nav-indicator {
    content: "" !important;
    display: block !important;
    position: absolute !important;
    z-index: 5 !important;
    left: calc((var(--active-index) * 20%) + 10%) !important;
    bottom: 8px !important;
    top: auto !important;
    width: 8px !important;
    min-width: 8px !important;
    height: 8px !important;
    min-height: 8px !important;
    border-radius: 50% !important;
    background: #239668 !important;
    opacity: 1 !important;
    transform: translateX(-50%) !important;
    transition: left 220ms cubic-bezier(.2,.8,.2,1) !important;
    pointer-events: none !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app .app-content {
    padding-bottom: calc(106px + env(safe-area-inset-bottom)) !important;
  }

  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav.is-hidden {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
}

@media (max-width: 380px) {
  html body #root .hydra-root.hydra-root.hydra-root .phone-app.phone-app nav.bottom-nav.bottom-nav {
    left: 12px !important;
    right: 12px !important;
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
