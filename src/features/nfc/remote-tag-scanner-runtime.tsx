import { createRoot, type Root } from "react-dom/client";
import { RemoteTagScanner } from "./remote-tag-scanner";
import "./remote-tag-scanner.css";
import "./remote-tag-scanner-fix.css";

let mountedHost: HTMLElement | null = null;
let mountedRoot: Root | null = null;
let scheduled = false;

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

  const host = document.createElement("div");
  host.className = "distance-id-runtime-host";

  // NFC por aproximação permanece como ação principal. A câmera/QR aparece
  // em seguida como alternativa para identificar o animal à distância.
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
  scheduleMount();
  const observer = new MutationObserver(() => scheduleMount());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
