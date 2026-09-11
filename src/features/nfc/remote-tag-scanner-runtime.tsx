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

  // A identificação por câmera é uma ação principal quando o animal está longe.
  // Por isso fica logo abaixo do cabeçalho, antes do bloco de NFC por aproximação.
  const header = screen.querySelector<HTMLElement>(".screen-header, .screen-header-row");
  if (header?.nextSibling) {
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
