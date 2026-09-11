import { createRoot } from "react-dom/client";
import { AppTutorial } from "./app-tutorial";

const HOST_ID = "hydra-app-tutorial-runtime";

function mountTutorial() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  createRoot(host).render(<AppTutorial />);
}

if (typeof document !== "undefined") {
  if (document.body) mountTutorial();
  else document.addEventListener("DOMContentLoaded", mountTutorial, { once: true });
}
