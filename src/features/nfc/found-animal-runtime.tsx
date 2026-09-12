import { createRoot, type Root } from "react-dom/client";
import { Search } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { requireSupabase } from "../../services/supabase";
import { FoundAnimalPanel } from "./found-animal-panel";

let mountedScreen: Element | null = null;
let root: Root | null = null;
let overlay: HTMLDivElement | null = null;

async function openFoundAnimal() {
  if (overlay) return;
  const client = requireSupabase();
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) return;

  let municipality = "";
  let state = "";
  const { data: property } = await client
    .from("properties")
    .select("municipality,state")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (property) {
    municipality = String(property.municipality ?? "");
    state = String(property.state ?? "");
  }

  const account = {
    id: user.id,
    property: { municipality, state },
  } as HydraAccount;

  overlay = document.createElement("div");
  overlay.className = "found-animal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Animal Encontrado");
  document.body.appendChild(overlay);

  const close = () => {
    root?.unmount();
    root = null;
    overlay?.remove();
    overlay = null;
  };

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });

  root = createRoot(overlay);
  root.render(<div className="found-animal-overlay-sheet"><FoundAnimalPanel account={account} onClose={close} /></div>);
}

function mountEntry(screen: Element) {
  if (mountedScreen === screen && screen.querySelector("[data-found-animal-entry]")) return;
  mountedScreen = screen;
  if (screen.querySelector("[data-found-animal-entry]")) return;

  const card = document.createElement("button");
  card.type = "button";
  card.dataset.foundAnimalEntry = "true";
  card.className = "found-animal-entry";
  card.innerHTML = `<span class="found-animal-entry-icon"></span><span><strong>Animal Encontrado</strong><small>Identifique à distância ou envie uma foto sem se aproximar</small></span><span class="found-animal-entry-arrow">›</span>`;
  const iconHost = card.querySelector(".found-animal-entry-icon");
  if (iconHost) {
    const iconRoot = createRoot(iconHost);
    iconRoot.render(<Search size={21} />);
  }
  card.addEventListener("click", () => void openFoundAnimal());

  const anchor = screen.querySelector(".nfc-inline-card");
  if (anchor?.parentElement) anchor.parentElement.insertBefore(card, anchor);
  else screen.appendChild(card);
}

function scan() {
  const screen = document.querySelector(".nfc-screen");
  if (screen) mountEntry(screen);
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
}
