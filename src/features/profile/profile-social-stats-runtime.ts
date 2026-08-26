import { publicMediaUrl, supabase } from "../../services/supabase";

type SocialProfile = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  followers: number;
  following: number;
};

type Connection = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  is_following: boolean;
};

let activeUserId = "";
let channelCleanup: (() => void) | null = null;

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function avatar(path: unknown, name: string) {
  const url = publicMediaUrl("avatars", path ? String(path) : undefined);
  return `<span class="profile-social-list-avatar">${url ? `<img src="${esc(url)}" alt="" />` : esc((name.trim()[0] || "P").toUpperCase())}</span>`;
}

function closeLayer() {
  document.querySelector(".profile-social-list-layer")?.remove();
}

async function openConnections(kind: "followers" | "following") {
  const client = supabase;
  if (!client || !activeUserId) return;
  closeLayer();
  const layer = document.createElement("div");
  layer.className = "social-layer profile-social-list-layer";
  layer.innerHTML = `<section class="social-sheet" role="dialog" aria-modal="true"><header class="social-sheet-head"><div><small>PERFIL</small><h2>${kind === "followers" ? "Seguidores" : "Seguindo"}</h2></div><button class="social-close" aria-label="Fechar" type="button">×</button></header><div class="social-sheet-body"><div class="social-loading"><span></span><strong>Carregando…</strong></div></div></section>`;
  layer.addEventListener("mousedown", (event) => { if (event.target === layer) closeLayer(); });
  layer.querySelector<HTMLButtonElement>(".social-close")?.addEventListener("click", closeLayer);
  document.body.appendChild(layer);
  const body = layer.querySelector<HTMLElement>(".social-sheet-body")!;
  const { data, error } = await client.rpc("social_connections", { p_user_id: activeUserId, p_kind: kind });
  if (error) {
    body.innerHTML = `<div class="social-empty"><strong>Não foi possível carregar</strong><p>Tente novamente em instantes.</p></div>`;
    return;
  }
  const rows = (data || []) as Connection[];
  if (!rows.length) {
    body.innerHTML = `<div class="social-empty"><strong>${kind === "followers" ? "Nenhum seguidor ainda" : "Você ainda não segue ninguém"}</strong><p>As conexões vão aparecer aqui.</p></div>`;
    return;
  }
  body.innerHTML = `<div class="profile-social-list">${rows.map((person) => `<div class="profile-social-list-row">${avatar(person.avatar_path, person.full_name)}<span><strong>${esc(person.full_name)}</strong><small>${esc([person.property_name, person.municipality].filter(Boolean).join(" · ") || "Produtor")}</small></span><em>${person.is_following ? "Seguindo" : "Perfil"}</em></div>`).join("")}</div>`;
}

async function loadStats() {
  const client = supabase;
  const hero = document.querySelector<HTMLElement>(".profile-screen .profile-hero");
  if (!client || !hero) return;
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id || "";
  if (!userId) return;
  activeUserId = userId;
  const { data, error } = await client.rpc("social_profile", { p_user_id: userId });
  if (error || !Array.isArray(data) || !data[0]) return;
  const profile = data[0] as SocialProfile;
  let stats = hero.querySelector<HTMLElement>(".profile-instagram-stats");
  if (!stats) {
    stats = document.createElement("div");
    stats.className = "profile-instagram-stats";
    const bio = hero.querySelector(".profile-bio");
    if (bio) bio.insertAdjacentElement("beforebegin", stats);
    else hero.appendChild(stats);
  }
  stats.innerHTML = `<button type="button" data-kind="followers"><strong>${Number(profile.followers || 0)}</strong><span>seguidores</span></button><button type="button" data-kind="following"><strong>${Number(profile.following || 0)}</strong><span>seguindo</span></button>`;
  stats.querySelector<HTMLButtonElement>("[data-kind='followers']")?.addEventListener("click", () => void openConnections("followers"));
  stats.querySelector<HTMLButtonElement>("[data-kind='following']")?.addEventListener("click", () => void openConnections("following"));

  if (!channelCleanup) {
    const channel = client.channel(`profile-social-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_follows" }, () => { void loadStats(); })
      .subscribe();
    channelCleanup = () => { void client.removeChannel(channel); };
  }
}

function wireProfile() {
  if (document.querySelector(".profile-screen .profile-hero")) void loadStats();
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(wireProfile);
  observer.observe(document.body, { childList: true, subtree: true });
  wireProfile();
  window.addEventListener("focus", wireProfile);
}
