import { createRoot, type Root } from "react-dom/client";
import { RemoteTagScanner } from "./remote-tag-scanner";
import "./remote-tag-scanner.css";

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

  // Mantém o fluxo principal do NFC no topo. A identificação à distância entra
  // logo depois do hero e antes dos controles de localizar/vincular.
  const segment = screen.querySelector<HTMLElement>(".nfc-segment");
  if (segment) {
    screen.insertBefore(host, segment);
  } else {
    const hero = screen.querySelector<HTMLElement>(".nfc-hero");
    if (hero?.nextSibling) screen.insertBefore(host, hero.nextSibling);
    else screen.appendChild(host);
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
