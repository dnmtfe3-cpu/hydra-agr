import { createRoot, type Root } from "react-dom/client";
import { RemoteTagScanner } from "./remote-tag-scanner";
import "./remote-tag-scanner.css";
import "./remote-tag-scanner-fix.css";

let mountedHost: HTMLElement | null = null;
let mountedRoot: Root | null = null;
let scheduled = false;

function installNfcPrimaryHierarchy() {
  if (document.getElementById("hydra-nfc-primary-hierarchy")) return;
  const style = document.createElement("style");
  style.id = "hydra-nfc-primary-hierarchy";
  style.textContent = `
    /* NFC continua sendo a função principal. Câmera/QR é alternativa para distância. */
    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      min-height: 220px !important;
      margin: 10px 0 12px !important;
      padding: 22px 18px !important;
      border: 1px solid rgba(23, 76, 54, .16) !important;
      border-radius: 24px !important;
      background: linear-gradient(145deg, #edf7f1 0%, #ffffff 72%) !important;
      box-shadow: 0 14px 34px rgba(31, 66, 51, .09) !important;
      text-align: center !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero .nfc-waves {
      width: 86px !important;
      height: 86px !important;
      min-width: 86px !important;
      margin: 0 0 3px !important;
      border-radius: 50% !important;
      background: #dfeee5 !important;
      color: #174c36 !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero .nfc-waves > span {
      display: block !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero .nfc-waves > svg {
      width: 34px !important;
      height: 34px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero h2 {
      margin: 0 !important;
      color: #173f2f !important;
      font-size: 19px !important;
      line-height: 1.18 !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero p {
      max-width: 34ch !important;
      margin: 0 !important;
      color: #65766d !important;
      font-size: 11.5px !important;
      line-height: 1.4 !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero .nfc-native-read-button {
      width: 100% !important;
      min-height: 52px !important;
      margin: 5px 0 0 !important;
      padding: 0 16px !important;
      border-radius: 15px !important;
      background: linear-gradient(145deg, #1f6247, #174c36) !important;
      color: #fff !important;
      font-size: 11.5px !important;
      font-weight: 800 !important;
      box-shadow: 0 9px 20px rgba(23, 76, 54, .16) !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .nfc-hero > small {
      display: flex !important;
      align-items: center !important;
      gap: 5px !important;
      color: #718078 !important;
      font-size: 9.5px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-runtime-host {
      margin: 0 0 12px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-card {
      padding: 13px !important;
      border: 1px solid rgba(23, 76, 54, .09) !important;
      border-radius: 17px !important;
      background: #f8faf9 !important;
      box-shadow: none !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-icon {
      width: 40px !important;
      height: 40px !important;
      flex-basis: 40px !important;
      border-radius: 12px !important;
      background: #e9f2ed !important;
      color: #174c36 !important;
      box-shadow: none !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-copy small {
      color: #7a8981 !important;
      font-size: 8px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-copy strong {
      color: #294b3a !important;
      font-size: 13px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-copy p {
      color: #75847c !important;
      font-size: 9.5px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-actions {
      grid-template-columns: 1fr 1fr !important;
      gap: 7px !important;
      margin-top: 10px !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-action-primary,
    body:not(.hydra-easy-mode) .nfc-screen .distance-action:not(.distance-action-primary) {
      grid-column: auto !important;
      min-height: 48px !important;
      padding: 9px 10px !important;
      border: 1px solid rgba(23, 76, 54, .09) !important;
      border-radius: 13px !important;
      background: #fff !important;
      color: #294b3a !important;
      box-shadow: none !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-action-primary small {
      color: #7a8981 !important;
    }

    body:not(.hydra-easy-mode) .nfc-screen .distance-id-safety {
      margin-top: 8px !important;
      padding: 8px 8px 0 !important;
      font-size: 8.5px !important;
    }

    @media (max-width: 390px) {
      body:not(.hydra-easy-mode) .nfc-screen .nfc-hero {
        min-height: 205px !important;
        padding: 18px 14px !important;
      }
      body:not(.hydra-easy-mode) .nfc-screen .distance-id-actions {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function cleanupIfDetached() {
  if (mountedHost && !document.contains(mountedHost)) {
    mountedRoot?.unmount();
    mountedRoot = null;
    mountedHost = null;
  }
}

function mountScanner() {
  scheduled = false;
  cleanupIfDetached();
  const screen = document.querySelector<HTMLElement>(".nfc-screen");
  if (!screen || mountedHost) return;

  installNfcPrimaryHierarchy();

  const host = document.createElement("div");
  host.className = "distance-id-runtime-host";

  // NFC por aproximação é a função principal. A identificação por câmera/QR
  // permanece logo depois como alternativa quando não dá para chegar perto do animal.
  const nfcHero = screen.querySelector<HTMLElement>(":scope > .nfc-hero");
  const header = screen.querySelector<HTMLElement>(".screen-header, .screen-header-row");
  if (nfcHero?.nextSibling) {
    screen.insertBefore(host, nfcHero.nextSibling);
  } else if (nfcHero) {
    screen.appendChild(host);
  } else if (header?.nextSibling) {
    screen.insertBefore(host, header.nextSibling);
  } else if (screen.firstChild) {
    screen.insertBefore(host, screen.firstChild);
  } else {
    screen.appendChild(host);
  }

  mountedHost = host;
  mountedRoot = createRoot(host);
  mountedRoot.render(<RemoteTagScanner />);
}

function scheduleMount() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(mountScanner);
}

if (typeof document !== "undefined") {
  installNfcPrimaryHierarchy();
  scheduleMount();
  const observer = new MutationObserver(() => scheduleMount());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
