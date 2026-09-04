import "./profile-ranking.css";
import { publicMediaUrl, supabase } from "../../services/supabase";

type RankingScope = "city" | "state" | "brazil";
type RankingFarm = {
  ownerUserId?: string;
  propertyName: string;
  municipality: string;
  state: string;
  ownerName?: string;
  avatarUrl?: string;
  xp: number;
  isCurrent?: boolean;
};

const MEDALS = ["1", "2", "3"];
let overlay: HTMLDivElement | null = null;
let injectedTarget: HTMLElement | null = null;
let currentScope: RankingScope = "city";

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character); }
function rankingIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4"/><path d="M17 6h3v1a4 4 0 0 1-4 4"/></svg>`; }
function arrowIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`; }
function closeRanking() { overlay?.remove(); overlay = null; }
function formatXp(value: number) { return `${new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)))} XP`; }
function locationLabel(farm: RankingFarm) { return [farm.municipality, farm.state].filter(Boolean).join(", ") || "Brasil"; }

function avatarMarkup(farm: RankingFarm) {
  const initial = escapeHtml((farm.propertyName.trim()[0] || "F").toUpperCase());
  return farm.avatarUrl ? `<span class="regional-ranking-avatar"><img src="${escapeHtml(farm.avatarUrl)}" alt="" /></span>` : `<span class="regional-ranking-avatar">${initial}</span>`;
}

function scopeLabel(scope: RankingScope, municipality: string, state: string) {
  if (scope === "brazil") return "Brasil";
  if (scope === "state") return state || "Meu estado";
  return [municipality, state].filter(Boolean).join(", ") || "Minha cidade";
}

function scopeControls(scope: RankingScope) {
  return `<div class="regional-ranking-scopes" role="tablist" aria-label="Área do ranking">
    <button type="button" data-ranking-scope="city" class="${scope === "city" ? "active" : ""}">Cidade</button>
    <button type="button" data-ranking-scope="state" class="${scope === "state" ? "active" : ""}">Estado</button>
    <button type="button" data-ranking-scope="brazil" class="${scope === "brazil" ? "active" : ""}">Brasil</button>
  </div>`;
}

function bindScopeButtons() {
  overlay?.querySelectorAll<HTMLButtonElement>("[data-ranking-scope]").forEach((button) => button.addEventListener("click", () => {
    currentScope = button.dataset.rankingScope as RankingScope;
    void refreshRanking();
  }));
}

function renderRanking(farms: RankingFarm[], scope: RankingScope, municipality: string, state: string) {
  if (!overlay) return;
  const body = overlay.querySelector<HTMLElement>(".regional-ranking-body");
  if (!body) return;
  const controls = scopeControls(scope);
  const heading = `<div class="regional-ranking-heading"><span>CLASSIFICAÇÃO</span><strong>${escapeHtml(scopeLabel(scope, municipality, state))}</strong><small>XP das missões concluídas</small></div>`;
  if (farms.length === 0) {
    body.innerHTML = `${controls}${heading}<div class="regional-ranking-empty"><strong>Ainda não há propriedades no ranking</strong><p>Assim que houver XP nesse recorte, a classificação aparece aqui.</p></div>`;
    bindScopeButtons();
    return;
  }

  const currentIndex = farms.findIndex((farm) => farm.isCurrent);
  const current = currentIndex >= 0 ? farms[currentIndex] : undefined;
  const currentCard = current ? `<section class="regional-ranking-current"><div><small>SUA POSIÇÃO</small><strong>${currentIndex + 1}º</strong></div>${avatarMarkup(current)}<div class="regional-ranking-current-copy"><strong>${escapeHtml(current.propertyName || "Sua propriedade")}</strong><small>${escapeHtml(locationLabel(current))}</small><b>${formatXp(current.xp)}</b></div></section>` : "";
  const podium = farms.slice(0, 3).map((farm, index) => `<article class="regional-ranking-card place-${index + 1}${farm.isCurrent ? " is-current" : ""}"><div class="regional-ranking-position">${MEDALS[index]}</div>${avatarMarkup(farm)}<div class="regional-ranking-copy"><strong>${escapeHtml(farm.propertyName || "Propriedade")}</strong><small>${escapeHtml(locationLabel(farm))}</small><b>${formatXp(farm.xp)}</b></div>${farm.isCurrent ? `<span class="regional-ranking-you">VOCÊ</span>` : ""}</article>`).join("");
  const rows = farms.slice(3, 10).map((farm, index) => `<div class="regional-ranking-row${farm.isCurrent ? " is-current" : ""}"><span>${index + 4}º</span>${avatarMarkup(farm)}<div><strong>${escapeHtml(farm.propertyName || "Propriedade")}</strong><small>${escapeHtml(locationLabel(farm))}</small></div><b>${formatXp(farm.xp)}</b></div>`).join("");

  body.innerHTML = `${controls}${heading}${currentCard}<div class="regional-ranking-podium">${podium}</div>${rows ? `<div class="regional-ranking-list">${rows}</div>` : ""}<p class="regional-ranking-note">O ranking usa o XP salvo pelas missões. Ações feitas antes de uma missão ser liberada não entram nela.</p>`;
  bindScopeButtons();
}

async function refreshRanking() {
  const client = supabase;
  if (!client || !overlay) return;
  const body = overlay.querySelector<HTMLElement>(".regional-ranking-body");
  if (body) body.innerHTML = `<div class="regional-ranking-loading"><span></span><strong>Atualizando ranking…</strong></div>`;
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id || "";
  if (!userId) { if (body) body.innerHTML = `<div class="regional-ranking-empty"><strong>Entre na conta para ver o ranking</strong></div>`; return; }

  const { data: propertyData } = await client.from("properties").select("name,municipality,state").eq("owner_user_id", userId).maybeSingle();
  const municipality = String(propertyData?.municipality || "");
  const state = String(propertyData?.state || "");
  if (currentScope !== "brazil" && (currentScope === "state" ? !state : (!state || !municipality))) {
    if (body) body.innerHTML = `${scopeControls(currentScope)}<div class="regional-ranking-empty"><strong>Complete a localização da propriedade</strong><p>Município e UF são necessários para este ranking.</p></div>`;
    bindScopeButtons();
    return;
  }

  const { data, error } = await client.rpc("farm_ranking_scope", { p_scope: currentScope, p_municipality: municipality || null, p_state: state || null });
  if (error || !Array.isArray(data)) {
    if (body) body.innerHTML = `${scopeControls(currentScope)}<div class="regional-ranking-empty"><strong>Ranking indisponível agora</strong><p>Tente novamente em instantes.</p></div>`;
    bindScopeButtons();
    return;
  }

  const farms = (data as Array<Record<string, unknown>>).map((row) => {
    const avatarPath = row.avatar_path ? String(row.avatar_path) : undefined;
    return {
      ownerUserId: String(row.owner_user_id || ""),
      propertyName: String(row.property_name || "Propriedade"),
      municipality: String(row.municipality || ""),
      state: String(row.state || ""),
      ownerName: String(row.owner_name || ""),
      avatarUrl: publicMediaUrl("avatars", avatarPath),
      xp: Number(row.xp ?? 0),
      isCurrent: String(row.owner_user_id || "") === userId,
    } satisfies RankingFarm;
  });
  renderRanking(farms, currentScope, municipality, state);
}

function openRanking() {
  closeRanking(); currentScope = "city";
  overlay = document.createElement("div");
  overlay.className = "regional-ranking-backdrop";
  overlay.innerHTML = `<section class="regional-ranking-dialog" role="dialog" aria-modal="true" aria-labelledby="regional-ranking-title"><header class="regional-ranking-topbar"><div><span class="regional-ranking-mark">${rankingIcon()}</span><div><small>COMPETIÇÃO</small><h2 id="regional-ranking-title">Ranking das fazendas</h2></div></div><button type="button" class="regional-ranking-close" aria-label="Fechar ranking">×</button></header><div class="regional-ranking-body"></div></section>`;
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeRanking(); });
  overlay.querySelector<HTMLButtonElement>(".regional-ranking-close")?.addEventListener("click", closeRanking);
  document.body.appendChild(overlay); void refreshRanking();
}

function ensureShortcut() {
  const target = document.querySelector<HTMLElement>(".profile-screen .profile-social-tabs");
  if (!target || target === injectedTarget) return;
  injectedTarget = target;
  document.querySelector(".profile-screen .regional-ranking-menu-row")?.remove();
  document.querySelector(".profile-screen .regional-ranking-feature-card")?.remove();
  const button = document.createElement("button");
  button.className = "regional-ranking-feature-card";
  button.type = "button";
  button.innerHTML = `<span class="regional-ranking-feature-icon">${rankingIcon()}</span><div><small>RANKING</small><strong>Veja sua posição</strong><p>Cidade, estado e Brasil</p></div><span class="regional-ranking-feature-arrow">${arrowIcon()}</span>`;
  button.addEventListener("click", openRanking);
  target.insertAdjacentElement("afterend", button);
}

if (typeof document !== "undefined") {
  ensureShortcut();
  const observer = new MutationObserver(() => ensureShortcut());
  observer.observe(document.body, { childList: true, subtree: true });
}
