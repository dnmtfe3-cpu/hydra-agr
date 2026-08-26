import "./community-social.css";
import { publicMediaUrl, supabase } from "../../services/supabase";

type SocialProfile = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  followers: number;
  following: number;
  is_following: boolean;
};

type Conversation = {
  peer_id: string;
  peer_name: string;
  peer_avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  last_message: string;
  last_at: string;
  unread_count: number;
};

type Suggestion = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  followers: number;
  is_following: boolean;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at?: string | null;
  created_at: string;
};

let overlay: HTMLDivElement | null = null;
let currentUserId = "";
let activePeerId = "";
let activePeerName = "";
let realtimeCleanup: (() => void) | null = null;

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function avatar(path: unknown, name: string, cls = "social-avatar") {
  const url = publicMediaUrl("avatars", path ? String(path) : undefined);
  const initial = esc((name.trim()[0] || "P").toUpperCase());
  return `<span class="${cls}">${url ? `<img src="${esc(url)}" alt="" />` : initial}</span>`;
}

function timeLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

async function sessionUser() {
  const client = supabase;
  if (!client) return "";
  const { data } = await client.auth.getSession();
  currentUserId = data.session?.user.id || "";
  return currentUserId;
}

function closeOverlay() {
  realtimeCleanup?.();
  realtimeCleanup = null;
  activePeerId = "";
  activePeerName = "";
  overlay?.remove();
  overlay = null;
}

function shell(title: string, subtitle = "") {
  closeOverlay();
  overlay = document.createElement("div");
  overlay.className = "social-layer";
  overlay.innerHTML = `
    <section class="social-sheet" role="dialog" aria-modal="true">
      <header class="social-sheet-head">
        <div><small>${esc(subtitle)}</small><h2>${esc(title)}</h2></div>
        <button class="social-close" type="button" aria-label="Fechar">×</button>
      </header>
      <div class="social-sheet-body"><div class="social-loading"><span></span><strong>Carregando…</strong></div></div>
    </section>`;
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeOverlay(); });
  overlay.querySelector<HTMLButtonElement>(".social-close")?.addEventListener("click", closeOverlay);
  document.body.appendChild(overlay);
  return overlay.querySelector<HTMLElement>(".social-sheet-body")!;
}

async function openProfile(userId: string) {
  if (!userId) return;
  const client = supabase;
  if (!client) return;
  const body = shell("Perfil da comunidade", "PRODUTOR");
  await sessionUser();
  const { data, error } = await client.rpc("social_profile", { p_user_id: userId });
  if (error || !Array.isArray(data) || !data[0]) {
    body.innerHTML = `<div class="social-empty"><strong>Perfil indisponível</strong><p>Não foi possível abrir este perfil agora.</p></div>`;
    return;
  }
  const profile = data[0] as SocialProfile;
  const mine = profile.user_id === currentUserId;
  body.innerHTML = `
    <div class="social-profile-hero">
      ${avatar(profile.avatar_path, profile.full_name, "social-profile-avatar")}
      <h3>${esc(profile.full_name)}</h3>
      <p>${esc([profile.property_name, profile.municipality].filter(Boolean).join(" · ") || "Produtor da comunidade")}</p>
      <div class="social-counts"><span><strong>${Number(profile.followers || 0)}</strong><small>seguidores</small></span><span><strong>${Number(profile.following || 0)}</strong><small>seguindo</small></span></div>
      ${mine ? "" : `<div class="social-profile-actions"><button class="social-follow ${profile.is_following ? "following" : ""}">${profile.is_following ? "Seguindo" : "Seguir"}</button><button class="social-message">Mensagem</button></div>`}
    </div>`;
  if (!mine) {
    body.querySelector<HTMLButtonElement>(".social-follow")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      const { data: following, error: followError } = await client.rpc("toggle_follow", { p_target: profile.user_id });
      button.disabled = false;
      if (followError) return;
      const next = Boolean(following);
      button.classList.toggle("following", next);
      button.textContent = next ? "Seguindo" : "Seguir";
      const count = body.querySelector<HTMLElement>(".social-counts span:first-child strong");
      if (count) count.textContent = String(Math.max(0, Number(count.textContent || 0) + (next ? 1 : -1)));
    });
    body.querySelector<HTMLButtonElement>(".social-message")?.addEventListener("click", () => void openChat(profile.user_id, profile.full_name, profile.avatar_path));
  }
}

async function openInbox() {
  const client = supabase;
  if (!client) return;
  const body = shell("Mensagens", "CONVERSAS");
  await sessionUser();
  const [{ data: conversations, error }, { data: suggestions }] = await Promise.all([
    client.rpc("social_conversations"),
    client.rpc("social_suggestions", { p_limit: 12 }),
  ]);
  if (error) {
    body.innerHTML = `<div class="social-empty"><strong>Não foi possível carregar</strong><p>Tente novamente daqui a pouco.</p></div>`;
    return;
  }
  const rows = (conversations || []) as Conversation[];
  const people = (suggestions || []) as Suggestion[];
  body.innerHTML = `
    <div class="social-inbox-search"><span>Mensagens privadas entre produtores.</span></div>
    ${rows.length ? `<div class="social-conversation-list">${rows.map((item) => `
      <button class="social-conversation" data-peer="${esc(item.peer_id)}" data-name="${esc(item.peer_name)}" data-avatar="${esc(item.peer_avatar_path || "")}">
        ${avatar(item.peer_avatar_path, item.peer_name)}
        <span><strong>${esc(item.peer_name)}</strong><small>${esc(item.last_message)}</small></span>
        <em>${item.unread_count > 0 ? `<b>${item.unread_count}</b>` : esc(timeLabel(item.last_at))}</em>
      </button>`).join("")}</div>` : `<div class="social-empty compact"><strong>Nenhuma conversa ainda</strong><p>Escolha alguém abaixo para começar.</p></div>`}
    <div class="social-people-title"><strong>Descobrir produtores</strong><small>da sua região e comunidade</small></div>
    <div class="social-people-list">${people.map((person) => `
      <button class="social-person" data-peer="${esc(person.user_id)}" data-name="${esc(person.full_name)}" data-avatar="${esc(person.avatar_path || "")}">
        ${avatar(person.avatar_path, person.full_name)}
        <span><strong>${esc(person.full_name)}</strong><small>${esc([person.property_name, person.municipality].filter(Boolean).join(" · ") || `${person.followers || 0} seguidores`)}</small></span>
        <em>Mensagem</em>
      </button>`).join("")}</div>`;
  body.querySelectorAll<HTMLButtonElement>("[data-peer]").forEach((button) => button.addEventListener("click", () => {
    void openChat(button.dataset.peer || "", button.dataset.name || "Produtor", button.dataset.avatar || undefined);
  }));
}

async function loadMessages(peerId: string, list: HTMLElement) {
  const client = supabase;
  if (!client || !currentUserId) return;
  const { data } = await client.from("direct_messages")
    .select("id,sender_id,recipient_id,body,read_at,created_at")
    .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${currentUserId})`)
    .order("created_at", { ascending: true })
    .limit(200);
  const messages = (data || []) as DirectMessage[];
  list.innerHTML = messages.length ? messages.map((message) => `
    <div class="social-bubble ${message.sender_id === currentUserId ? "mine" : "theirs"}"><p>${esc(message.body)}</p><small>${esc(timeLabel(message.created_at))}</small></div>`).join("") : `<div class="social-empty compact"><strong>Comece a conversa</strong><p>Envie uma mensagem para ${esc(activePeerName)}.</p></div>`;
  list.scrollTop = list.scrollHeight;
  await client.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("sender_id", peerId).eq("recipient_id", currentUserId).is("read_at", null);
}

async function openChat(peerId: string, peerName: string, avatarPath?: string) {
  if (!peerId) return;
  const client = supabase;
  if (!client) return;
  await sessionUser();
  activePeerId = peerId;
  activePeerName = peerName;
  const body = shell(peerName, "MENSAGEM DIRETA");
  body.classList.add("social-chat-body");
  body.innerHTML = `
    <button class="social-chat-profile" type="button">${avatar(avatarPath, peerName)}<span><strong>${esc(peerName)}</strong><small>Ver perfil</small></span></button>
    <div class="social-message-list"></div>
    <form class="social-compose"><input maxlength="1200" placeholder="Mensagem…" autocomplete="off" /><button type="submit" aria-label="Enviar">➤</button></form>`;
  const list = body.querySelector<HTMLElement>(".social-message-list")!;
  const form = body.querySelector<HTMLFormElement>(".social-compose")!;
  const input = form.querySelector<HTMLInputElement>("input")!;
  body.querySelector<HTMLButtonElement>(".social-chat-profile")?.addEventListener("click", () => void openProfile(peerId));
  await loadMessages(peerId, list);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    const { error } = await client.from("direct_messages").insert({ sender_id: currentUserId, recipient_id: peerId, body: text });
    input.disabled = false;
    if (!error) { input.value = ""; await loadMessages(peerId, list); input.focus(); }
  });
  const channel = client.channel(`social-dm-${currentUserId}-${peerId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
    const row = payload.new as DirectMessage;
    if ((row.sender_id === currentUserId && row.recipient_id === peerId) || (row.sender_id === peerId && row.recipient_id === currentUserId)) void loadMessages(peerId, list);
  }).subscribe();
  realtimeCleanup = () => { void client.removeChannel(channel); };
}

function wireCommunity() {
  const screen = document.querySelector<HTMLElement>(".community-screen");
  if (!screen) return;
  const actions = screen.querySelector<HTMLElement>(".header-action-pair");
  if (actions && !actions.querySelector(".social-inbox-button")) {
    const button = document.createElement("button");
    button.className = "icon-button social-inbox-button";
    button.type = "button";
    button.setAttribute("aria-label", "Mensagens");
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg>`;
    button.addEventListener("click", () => void openInbox());
    actions.prepend(button);
  }

  const posts = Array.from(screen.querySelectorAll<HTMLElement>(".post-card"));
  posts.forEach((card) => {
    if (card.dataset.socialWired === "1") return;
    card.dataset.socialWired = "1";
    const header = card.querySelector<HTMLElement>("header");
    if (!header) return;
    const postAuthorName = header.querySelector("strong")?.textContent?.trim() || "";
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(".post-card"));
    const index = candidates.indexOf(card);
    const postData = (window as unknown as { __hydraCommunityPosts?: Array<{ authorId?: string }> }).__hydraCommunityPosts?.[index];
    const findId = () => {
      const reactKeys = Object.keys(card).filter((key) => key.startsWith("__reactProps"));
      for (const key of reactKeys) {
        const props = (card as unknown as Record<string, unknown>)[key] as { children?: unknown } | undefined;
        const text = JSON.stringify(props || {});
        const match = text.match(/"authorId":"([^"]+)"/);
        if (match) return match[1];
      }
      return postData?.authorId || "";
    };
    header.classList.add("social-author-header");
    header.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button")) return;
      const id = findId();
      if (id) void openProfile(id);
    });
    header.title = postAuthorName ? `Abrir perfil de ${postAuthorName}` : "Abrir perfil";
  });
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(() => wireCommunity());
  observer.observe(document.body, { childList: true, subtree: true });
  wireCommunity();
}
