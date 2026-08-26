import { publicMediaUrl, supabase } from "../../services/supabase";

type Person = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  followers: number;
  is_following: boolean;
};

let peopleLayer: HTMLDivElement | null = null;

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function avatar(person: Person) {
  const url = publicMediaUrl("avatars", person.avatar_path ? String(person.avatar_path) : undefined);
  return `<span class="social-avatar">${url ? `<img src="${esc(url)}" alt="" />` : esc((person.full_name?.[0] || "P").toUpperCase())}</span>`;
}

function closePeople() {
  peopleLayer?.remove();
  peopleLayer = null;
}

async function openPeople() {
  const client = supabase;
  if (!client) return;
  closePeople();
  peopleLayer = document.createElement("div");
  peopleLayer.className = "social-layer";
  peopleLayer.innerHTML = `<section class="social-sheet" role="dialog" aria-modal="true"><header class="social-sheet-head"><div><small>COMUNIDADE</small><h2>Produtores</h2></div><button class="social-close" aria-label="Fechar">×</button></header><div class="social-sheet-body"><div class="social-loading"><span></span><strong>Buscando produtores…</strong></div></div></section>`;
  peopleLayer.addEventListener("mousedown", (event) => { if (event.target === peopleLayer) closePeople(); });
  peopleLayer.querySelector<HTMLButtonElement>(".social-close")?.addEventListener("click", closePeople);
  document.body.appendChild(peopleLayer);
  const body = peopleLayer.querySelector<HTMLElement>(".social-sheet-body")!;
  const { data, error } = await client.rpc("social_suggestions", { p_limit: 40 });
  if (error) {
    body.innerHTML = `<div class="social-empty"><strong>Não foi possível carregar</strong><p>Tente novamente em instantes.</p></div>`;
    return;
  }
  const people = (data || []) as Person[];
  body.innerHTML = `<div class="social-people-title"><strong>Descobrir produtores</strong><small>Siga fazendas e pessoas da região</small></div><div class="social-people-list">${people.map((person) => `<div class="social-person follow-person" data-user="${esc(person.user_id)}">${avatar(person)}<span><strong>${esc(person.full_name)}</strong><small>${esc([person.property_name, person.municipality].filter(Boolean).join(" · ") || `${person.followers || 0} seguidores`)}</small></span><button class="follow-inline ${person.is_following ? "following" : ""}" data-follow="${esc(person.user_id)}">${person.is_following ? "Seguindo" : "Seguir"}</button></div>`).join("")}</div>`;
  body.querySelectorAll<HTMLButtonElement>("[data-follow]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.follow || "";
    if (!id) return;
    button.disabled = true;
    const { data: following, error: followError } = await client.rpc("toggle_follow", { p_target: id });
    button.disabled = false;
    if (followError) return;
    const next = Boolean(following);
    button.classList.toggle("following", next);
    button.textContent = next ? "Seguindo" : "Seguir";
  }));
}

function wirePeopleButton() {
  const screen = document.querySelector<HTMLElement>(".community-screen");
  const tabs = screen?.querySelector<HTMLElement>(".community-tabs");
  if (!tabs || tabs.querySelector(".community-people-tab")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "community-people-tab";
  button.textContent = "Pessoas";
  button.addEventListener("click", () => void openPeople());
  tabs.appendChild(button);
}

if (typeof document !== "undefined") {
  wirePeopleButton();
  const observer = new MutationObserver(wirePeopleButton);
  observer.observe(document.body, { childList: true, subtree: true });
}
