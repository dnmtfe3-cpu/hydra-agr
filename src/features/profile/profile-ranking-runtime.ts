import "./profile-ranking.css";
import { supabase } from "../../services/supabase";

type RankingFarm = {
  ownerUserId?: string;
  propertyName: string;
  municipality: string;
  ownerName?: string;
  avatarPath?: string;
  xp: number;
  isCurrent?: boolean;
};

const MEDALS = ["1", "2", "3"];
let overlay: HTMLDivElement | null = null;
let injectedTarget: HTMLElement | null = null;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function rankingIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4"/><path d="M17 6h3v1a4 4 0 0 1-4 4"/></svg>`;
}

function closeRanking() {
  overlay?.remove();
  overlay = null;
}

function formatXp(value: number) {
  return `${new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)))} XP`;
}

function avatarMarkup(farm: RankingFarm) {
  const initial = escapeHtml((farm.propertyName.trim()[0] || "F").toUpperCase());
  return `<span class="regional-ranking-avatar">${initial}</span>`;
}

function renderRanking(farms: RankingFarm[], municipality: string, fallback = false) {
  if (!overlay) return;
  const body = overlay.querySelector<HTMLElement>(".regional-ranking-body");
  if (!body) return;

  if (farms.length === 0) {
    body.innerHTML = `<div class="regional-ranking-empty"><strong>Ainda não há fazendas suficientes</strong><p>Quando outras propriedades da região começarem a pontuar, o Top 3 aparece aqui.</p></div>`;
    return;
  }

  body.innerHTML = `
    <div class="regional-ranking-heading">
      <span>RANKING DA REGIÃO</span>
      <strong>Top 3 melhores fazendas</strong>
      <small>${escapeHtml(municipality || "Região atendida")} · ${fallback ? "pontuação pública temporária" : "XP calculado pelo uso do app"}</small>
    </div>
    <div class="regional-ranking-podium">
      ${farms.slice(0, 3).map((farm, index) => `
        <article class="regional-ranking-card place-${index + 1}${farm.isCurrent ? " is-current" : ""}">
          <div class="regional-ranking-position">${MEDALS[index]}</div>
          ${avatarMarkup(farm)}
          <div class="regional-ranking-copy">
            <strong>${escapeHtml(farm.propertyName || "Propriedade")}</strong>
            <small>${escapeHtml(farm.municipality || municipality || "Bahia")}</small>
            <b>${formatXp(farm.xp)}</b>
          </div>
          ${farm.isCurrent ? `<span class="regional-ranking-you">SUA FAZENDA</span>` : ""}
        </article>
      `).join("")}
    </div>
    <p class="regional-ranking-note">O ranking valoriza cadastro da propriedade, rebanho, identificação NFC/RFID, setores, tarefas concluídas, monitoramentos e registros de água.</p>
  `;
}

async function loadFallback(userId: string, municipality: string, currentPropertyName: string) {
  const client = supabase;
  if (!client) return [] as RankingFarm[];
  const { data, error } = await client.rpc("community_feed");
  if (error) return [] as RankingFarm[];

  const grouped = new Map<string, RankingFarm>();
  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const propertyName = String(raw.propertyName || "").trim();
    const city = String(raw.municipality || "").trim();
    if (!propertyName || (municipality && city !== municipality)) continue;
    const authorId = String(raw.authorId || "");
    const likes = Number(raw.likes ?? 0);
    const comments = Array.isArray(raw.comments) ? raw.comments.length : 0;
    const key = `${propertyName.toLowerCase()}|${city.toLowerCase()}`;
    const current = grouped.get(key) ?? { propertyName, municipality: city, xp: 0, isCurrent: authorId === userId };
    current.xp += 100 + likes * 18 + comments * 12;
    current.isCurrent = current.isCurrent || authorId === userId;
    grouped.set(key, current);
  }

  if (currentPropertyName && !Array.from(grouped.values()).some((farm) => farm.isCurrent)) {
    grouped.set(`current|${currentPropertyName}`, { propertyName: currentPropertyName, municipality, xp: 120, isCurrent: true });
  }
  return Array.from(grouped.values()).sort((a, b) => b.xp - a.xp).slice(0, 3);
}

async function refreshRanking() {
  const client = supabase;
  if (!client || !overlay) return;
  const body = overlay.querySelector<HTMLElement>(".regional-ranking-body");
  if (body) body.innerHTML = `<div class="regional-ranking-loading"><span></span><strong>Calculando ranking da região…</strong></div>`;

  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id || "";
  if (!userId) {
    if (body) body.innerHTML = `<div class="regional-ranking-empty"><strong>Entre na conta para ver o ranking</strong></div>`;
    return;
  }

  const { data: propertyData } = await client.from("properties").select("name,municipality").eq("owner_user_id", userId).maybeSingle();
  const municipality = String(propertyData?.municipality || "");
  const currentPropertyName = String(propertyData?.name || "Sua fazenda");

  const { data, error } = await client.rpc("regional_farm_ranking", { p_municipality: municipality || null });
  if (!error && Array.isArray(data)) {
    const farms = (data as Array<Record<string, unknown>>).map((row) => ({
      ownerUserId: String(row.owner_user_id || ""),
      propertyName: String(row.property_name || "Propriedade"),
      municipality: String(row.municipality || municipality),
      ownerName: String(row.owner_name || ""),
      avatarPath: row.avatar_path ? String(row.avatar_path) : undefined,
      xp: Number(row.xp ?? 0),
      isCurrent: String(row.owner_user_id || "") === userId,
    }));
    renderRanking(farms, municipality, false);
    return;
  }

  const fallback = await loadFallback(userId, municipality, currentPropertyName);
  renderRanking(fallback, municipality, true);
}

function openRanking() {
  closeRanking();
  overlay = document.createElement("div");
  overlay.className = "regional-ranking-backdrop";
  overlay.innerHTML = `
    <section class="regional-ranking-dialog" role="dialog" aria-modal="true" aria-labelledby="regional-ranking-title">
      <header class="regional-ranking-topbar">
        <div><span class="regional-ranking-mark">${rankingIcon()}</span><div><small>REGIÃO</small><h2 id="regional-ranking-title">Ranking das fazendas</h2></div></div>
        <button type="button" class="regional-ranking-close" aria-label="Fechar ranking">×</button>
      </header>
      <div class="regional-ranking-body"></div>
    </section>
  `;
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeRanking(); });
  overlay.querySelector<HTMLButtonElement>(".regional-ranking-close")?.addEventListener("click", closeRanking);
  document.body.appendChild(overlay);
  void refreshRanking();
}

function ensureShortcut() {
  const groups = Array.from(document.querySelectorAll<HTMLElement>(".profile-screen .profile-group"));
  const accountGroup = groups.find((group) => group.querySelector(".group-label")?.textContent?.trim() === "MINHA CONTA");
  const target = accountGroup?.querySelector<HTMLElement>(".profile-menu-card") ?? null;
  if (!target || target === injectedTarget) return;
  injectedTarget = target;
  if (target.querySelector(".regional-ranking-menu-row")) return;

  const button = document.createElement("button");
  button.className = "profile-menu-row regional-ranking-menu-row";
  button.type = "button";
  button.innerHTML = `<span class="profile-menu-icon regional-ranking-icon">${rankingIcon()}</span><div><strong>Ranking da região</strong><small>Top 3 melhores fazendas da região</small></div><svg class="regional-ranking-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
  button.addEventListener("click", openRanking);
  target.appendChild(button);
}

if (typeof document !== "undefined") {
  ensureShortcut();
  const observer = new MutationObserver(() => ensureShortcut());
  observer.observe(document.body, { childList: true, subtree: true });
}
