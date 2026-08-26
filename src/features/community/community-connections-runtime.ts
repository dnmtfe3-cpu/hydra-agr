import { publicMediaUrl, supabase } from "../../services/supabase";

type Connection = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  is_following: boolean;
};

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function avatar(path: unknown, name: string) {
  const url = publicMediaUrl("avatars", path ? String(path) : undefined);
  return `<span class="social-avatar">${url ? `<img src="${esc(url)}" alt="" />` : esc((name.trim()[0] || "P").toUpperCase())}</span>`;
}

function closeOwnLayer() {
  document.querySelector(".social-connections-layer")?.remove();
}

async function openList(hero: HTMLElement, kind: "followers" | "following") {
  const client = supabase;
  if (!client) return;
  const name = hero.querySelector("h3")?.textContent?.trim() || "Produtor";
  const identity = hero.querySelector(":scope > p")?.textContent?.trim() || "";
  const property = identity.split(" · ")[0]?.trim() || "";
  const { data: userId } = await client.rpc("social_resolve_profile", { p_name: name, p_property: property || null });
  if (!userId) return;

  closeOwnLayer();
  const layer = document.createElement("div");
  layer.className = "social-layer social-connections-layer";
  layer.innerHTML = `<section class="social-sheet" role="dialog" aria-modal="true"><header class="social-sheet-head"><div><small>${esc(name)}</small><h2>${kind === "followers" ? "Seguidores" : "Seguindo"}</h2></div><button class="social-close" type="button" aria-label="Fechar">×</button></header><div class="social-sheet-body"><div class="social-loading"><span></span><strong>Carregando…</strong></div></div></section>`;
  layer.addEventListener("mousedown", (event) => { if (event.target === layer) closeOwnLayer(); });
  layer.querySelector<HTMLButtonElement>(".social-close")?.addEventListener("click", closeOwnLayer);
  document.body.appendChild(layer);

  const body = layer.querySelector<HTMLElement>(".social-sheet-body")!;
  const { data, error } = await client.rpc("social_connections", { p_user_id: userId, p_kind: kind });
  if (error) {
    body.innerHTML = `<div class="social-empty"><strong>Não foi possível carregar</strong><p>Tente novamente em instantes.</p></div>`;
    return;
  }
  const rows = (data || []) as Connection[];
  if (!rows.length) {
    body.innerHTML = `<div class="social-empty"><strong>${kind === "followers" ? "Nenhum seguidor ainda" : "Ainda não segue ninguém"}</strong><p>As conexões vão aparecer aqui.</p></div>`;
    return;
  }
  body.innerHTML = `<div class="social-connections-list">${rows.map((person) => `<div class="social-connection-row">${avatar(person.avatar_path, person.full_name)}<span><strong>${esc(person.full_name)}</strong><small>${esc([person.property_name, person.municipality].filter(Boolean).join(" · ") || "Produtor")}</small></span><em>${person.is_following ? "Seguindo" : "Perfil"}</em></div>`).join("")}</div>`;
}

function wireProfileCounts() {
  document.querySelectorAll<HTMLElement>(".social-profile-hero").forEach((hero) => {
    if (hero.dataset.connectionWired === "1") return;
    const counts = hero.querySelectorAll<HTMLElement>(".social-counts > span");
    if (counts.length < 2) return;
    hero.dataset.connectionWired = "1";
    counts[0].classList.add("social-count-button");
    counts[1].classList.add("social-count-button");
    counts[0].setAttribute("role", "button");
    counts[1].setAttribute("role", "button");
    counts[0].tabIndex = 0;
    counts[1].tabIndex = 0;
    counts[0].addEventListener("click", () => void openList(hero, "followers"));
    counts[1].addEventListener("click", () => void openList(hero, "following"));
  });
}

if (typeof document !== "undefined") {
  new MutationObserver(wireProfileCounts).observe(document.body, { childList: true, subtree: true });
  wireProfileCounts();
}
