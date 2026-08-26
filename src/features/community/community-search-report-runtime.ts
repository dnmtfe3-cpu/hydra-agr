import { publicMediaUrl, supabase } from "../../services/supabase";
import "./community-search-report.css";

type Person = {
  user_id: string;
  full_name: string;
  avatar_path?: string | null;
  property_name?: string | null;
  municipality?: string | null;
  followers: number;
  is_following: boolean;
};

let layer: HTMLDivElement | null = null;

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function avatar(path: string | null | undefined, name: string) {
  const url = publicMediaUrl("avatars", path || undefined);
  return url
    ? `<span class="csr-avatar"><img src="${esc(url)}" alt="" /></span>`
    : `<span class="csr-avatar">${esc((name.trim()[0] || "P").toUpperCase())}</span>`;
}

function closeLayer() {
  layer?.classList.add("closing");
  const node = layer;
  window.setTimeout(() => node?.remove(), 180);
  layer = null;
}

function shell(title: string, eyebrow: string) {
  closeLayer();
  layer = document.createElement("div");
  layer.className = "csr-layer";
  layer.innerHTML = `<section class="csr-sheet" role="dialog" aria-modal="true"><header><div><small>${esc(eyebrow)}</small><h2>${esc(title)}</h2></div><button class="csr-close" aria-label="Fechar">×</button></header><div class="csr-body"></div></section>`;
  layer.addEventListener("mousedown", (event) => { if (event.target === layer) closeLayer(); });
  layer.querySelector<HTMLButtonElement>(".csr-close")?.addEventListener("click", closeLayer);
  document.body.appendChild(layer);
  return layer.querySelector<HTMLElement>(".csr-body")!;
}

async function sessionId() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id || "";
}

async function sendReport(targetUserId: string, targetName: string) {
  if (!supabase) return;
  const uid = await sessionId();
  if (!uid || uid === targetUserId) return;
  const body = shell("Denunciar perfil", "SEGURANÇA");
  body.innerHTML = `<div class="csr-report-intro"><span>!</span><div><strong>Denunciar ${esc(targetName)}</strong><p>A denúncia será enviada para a moderação. O usuário denunciado não verá quem enviou.</p></div></div><form class="csr-report-form"><label>Motivo<select required><option value="">Selecione</option><option value="spam">Spam ou propaganda</option><option value="harassment">Assédio ou comportamento ofensivo</option><option value="fake">Perfil falso ou informação enganosa</option><option value="unsafe">Conteúdo impróprio ou inseguro</option><option value="other">Outro motivo</option></select></label><label>Detalhes <small>opcional</small><textarea maxlength="800" placeholder="Explique rapidamente o que aconteceu..."></textarea></label><p class="csr-report-status"></p><button class="csr-report-submit" type="submit">Enviar denúncia</button></form>`;
  const form = body.querySelector<HTMLFormElement>("form")!;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const select = form.querySelector<HTMLSelectElement>("select")!;
    const textarea = form.querySelector<HTMLTextAreaElement>("textarea")!;
    const status = form.querySelector<HTMLElement>(".csr-report-status")!;
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    if (!select.value) return;
    button.disabled = true;
    button.textContent = "Enviando...";
    const { error } = await supabase!.from("community_reports").insert({ reporter_id: uid, target_user_id: targetUserId, target_type: "profile", reason: select.value, details: textarea.value.trim() || null });
    if (error) {
      status.textContent = "Não foi possível enviar agora.";
      button.disabled = false;
      button.textContent = "Tentar novamente";
      return;
    }
    form.classList.add("success");
    status.innerHTML = `<strong>Denúncia enviada</strong><span>Obrigado por ajudar a manter a comunidade segura.</span>`;
    button.textContent = "Enviado";
  });
}

async function openPerson(person: Person) {
  if (!supabase) return;
  const uid = await sessionId();
  const mine = uid === person.user_id;
  const body = shell("Perfil", "COMUNIDADE");
  body.innerHTML = `<div class="csr-profile">${avatar(person.avatar_path, person.full_name)}<h3>${esc(person.full_name)}</h3><p>${esc([person.property_name, person.municipality].filter(Boolean).join(" · ") || "Produtor da comunidade")}</p><div class="csr-profile-count"><strong>${Number(person.followers || 0)}</strong><span>seguidores</span></div>${mine ? "" : `<div class="csr-profile-actions"><button class="csr-follow ${person.is_following ? "following" : ""}">${person.is_following ? "Seguindo" : "Seguir"}</button><button class="csr-report">Denunciar</button></div>`}</div>`;
  if (!mine) {
    body.querySelector<HTMLButtonElement>(".csr-follow")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      const { data, error } = await supabase!.rpc("toggle_follow", { p_target: person.user_id });
      button.disabled = false;
      if (!error) {
        const following = Boolean(data);
        button.textContent = following ? "Seguindo" : "Seguir";
        button.classList.toggle("following", following);
      }
    });
    body.querySelector<HTMLButtonElement>(".csr-report")?.addEventListener("click", () => void sendReport(person.user_id, person.full_name));
  }
}

async function openSearch() {
  if (!supabase) return;
  const body = shell("Pesquisar usuários", "COMUNIDADE");
  body.innerHTML = `<div class="csr-search"><span class="csr-search-icon">⌕</span><input type="search" placeholder="Nome, fazenda ou município" autocomplete="off" /></div><div class="csr-search-status">Carregando usuários...</div><div class="csr-results"></div>`;
  const input = body.querySelector<HTMLInputElement>("input")!;
  const status = body.querySelector<HTMLElement>(".csr-search-status")!;
  const results = body.querySelector<HTMLElement>(".csr-results")!;
  const { data, error } = await supabase.rpc("social_suggestions", { p_limit: 80 });
  if (error) {
    status.textContent = "Não foi possível carregar os usuários.";
    return;
  }
  const people = (data || []) as Person[];
  const render = () => {
    const q = input.value.trim().toLocaleLowerCase("pt-BR");
    const filtered = people.filter((person) => !q || [person.full_name, person.property_name, person.municipality].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(q)));
    status.textContent = filtered.length ? `${filtered.length} usuário${filtered.length === 1 ? "" : "s"}` : "Nenhum usuário encontrado";
    results.innerHTML = filtered.map((person, index) => `<button class="csr-result" style="--i:${index}" data-id="${esc(person.user_id)}">${avatar(person.avatar_path, person.full_name)}<span><strong>${esc(person.full_name)}</strong><small>${esc([person.property_name, person.municipality].filter(Boolean).join(" · ") || `${person.followers || 0} seguidores`)}</small></span><em>›</em></button>`).join("");
    results.querySelectorAll<HTMLButtonElement>(".csr-result").forEach((button) => button.addEventListener("click", () => {
      const person = people.find((item) => item.user_id === button.dataset.id);
      if (person) void openPerson(person);
    }));
  };
  input.addEventListener("input", render);
  render();
  window.setTimeout(() => input.focus(), 120);
}

function wireSearchButton() {
  const actions = document.querySelector<HTMLElement>(".community-screen .header-action-pair");
  if (!actions || actions.querySelector(".csr-search-button")) return;
  const button = document.createElement("button");
  button.className = "icon-button csr-search-button";
  button.type = "button";
  button.setAttribute("aria-label", "Pesquisar usuários");
  button.title = "Pesquisar usuários";
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>`;
  button.addEventListener("click", () => void openSearch());
  actions.prepend(button);
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(wireSearchButton);
  observer.observe(document.body, { childList: true, subtree: true });
  wireSearchButton();
}
