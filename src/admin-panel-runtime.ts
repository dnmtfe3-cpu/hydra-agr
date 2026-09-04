import { loadAdminData } from "./services/hydra-repository";
import { requireSupabase } from "./services/supabase";

type AdminRuntimeUser = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  propertyName?: string;
  municipality?: string;
  state?: string;
  propertyType?: string;
  mainActivity?: string;
  area?: string | number;
  areaUnit?: string;
  role?: string;
  accountType?: string;
  plan?: string;
  subscriptionStatus?: string;
  createdAt?: string;
  lastSignInAt?: string;
  emailConfirmedAt?: string;
  profileUpdatedAt?: string;
  animalsCount?: number;
  waterRecordsCount?: number;
  activitiesCount?: number;
  postsCount?: number;
  bannedAt?: string;
  banReason?: string;
};

let users: AdminRuntimeUser[] | null = null;
let selectedEmail = "";
let loading: Promise<AdminRuntimeUser[]> | null = null;

const TAB_KEY = "hydra.admin.tab";
const SEARCH_KEY = "hydra.admin.search";

const style = document.createElement("style");
style.textContent = `
.admin-runtime-details{display:grid;gap:14px}.admin-danger-zone{padding:15px;border:1px solid #f0d0cc;border-radius:19px;background:linear-gradient(145deg,#fff9f8,#fff1ef)}.admin-danger-zone h4{margin:0 0 4px;color:#9f3f37;font-size:12px}.admin-danger-zone p{margin:0 0 12px;color:#8b6a66;font-size:9px;line-height:1.45}.admin-delete-account{width:100%;height:43px;border:1px solid rgba(183,71,62,.16);border-radius:13px;background:#fff;color:#a83e37;font-weight:850;font-size:10px;box-shadow:0 6px 16px rgba(183,71,62,.08)}.admin-delete-account:active{transform:scale(.98)}.admin-delete-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:end center;padding:18px;background:rgba(4,20,14,.52);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:adminOverlayIn .18s ease both}.admin-delete-sheet{width:min(100%,520px);padding:20px;border-radius:26px;background:#fffefb;box-shadow:0 28px 80px rgba(0,0,0,.26);animation:adminSheetIn .24s cubic-bezier(.2,.85,.25,1) both}.admin-delete-sheet .icon{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:#fff0ee;color:#b7473e;font-size:24px}.admin-delete-sheet .danger-pill{display:inline-flex;margin-top:13px;padding:5px 8px;border-radius:999px;background:#fde8e5;color:#a33d36;font-size:8px;font-weight:900;letter-spacing:.07em}.admin-delete-sheet h3{margin:10px 0 6px;font-size:19px;color:#173b2d;letter-spacing:-.025em}.admin-delete-sheet p{margin:0;color:#728078;font-size:10px;line-height:1.5}.admin-delete-sheet strong{color:#173b2d}.admin-delete-target{margin:13px 0;padding:11px;border-radius:14px;background:#f4f7f5}.admin-delete-target strong,.admin-delete-target small{display:block}.admin-delete-target strong{font-size:11px}.admin-delete-target small{margin-top:3px;font-size:9px;color:#7d8882;overflow-wrap:anywhere}.admin-delete-label{display:grid;gap:6px;color:#69766f;font-size:9px;font-weight:750}.admin-delete-label input{width:100%;min-height:44px;padding:0 12px;border:1px solid rgba(183,71,62,.2);border-radius:12px;background:#fff;color:#173b2d;outline:none;font-size:12px;font-weight:850;text-transform:uppercase}.admin-delete-label input:focus{border-color:#b7473e;box-shadow:0 0 0 3px rgba(183,71,62,.09)}.admin-delete-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.admin-delete-actions button{height:44px;border:0;border-radius:13px;font-weight:850;font-size:10px}.admin-delete-cancel{background:#eef3ef;color:#315344}.admin-delete-confirm{background:linear-gradient(135deg,#a43e37,#c45047);color:#fff;box-shadow:0 8px 18px rgba(183,71,62,.2)}.admin-delete-confirm:disabled{opacity:.38;box-shadow:none}.admin-delete-error{margin-top:10px!important;color:#b7473e!important;font-size:9px!important}.admin-delete-loading{opacity:.65;pointer-events:none}@keyframes adminOverlayIn{from{opacity:0}to{opacity:1}}@keyframes adminSheetIn{from{opacity:0;transform:translateY(22px) scale(.98)}to{opacity:1;transform:none}}@media(min-width:720px){.admin-delete-overlay{place-items:center}.admin-delete-sheet{margin:auto}}`;
document.head.appendChild(style);

function formatDate(value?: string, withTime = false) {
  if (!value) return "Não disponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não disponível";
  return date.toLocaleString("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" });
}

function safe(value: unknown, fallback = "Não informado") {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

async function getUsers(force = false) {
  if (force) users = null;
  if (users) return users;
  if (!loading) {
    loading = loadAdminData().then((data) => {
      users = data.users as AdminRuntimeUser[];
      return users;
    }).finally(() => { loading = null; });
  }
  return loading;
}

function detailCard(label: string, value: string) {
  const article = document.createElement("article");
  const small = document.createElement("small");
  const strong = document.createElement("strong");
  small.textContent = label;
  strong.textContent = value;
  article.append(small, strong);
  return article;
}

function usageItem(value: number | undefined, label: string) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  const small = document.createElement("small");
  strong.textContent = String(value ?? 0);
  small.textContent = label;
  item.append(strong, small);
  return item;
}

function closeUserModal() {
  const detail = document.querySelector<HTMLElement>(".admin-user-detail");
  if (!detail) return;
  const backdrop = detail.closest<HTMLElement>(".modal-backdrop");
  const close = backdrop?.querySelector<HTMLButtonElement>('button[aria-label*="Fechar"], button[aria-label*="fechar"]');
  if (close) close.click();
  else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function removeDeletedUserFromList(email: string) {
  document.querySelectorAll<HTMLElement>(".admin-user-list > button").forEach((row) => {
    if (row.querySelector("small")?.textContent?.trim().toLowerCase() === email.toLowerCase()) row.remove();
  });
}

function refreshAdminInPlace() {
  users = null;
  const button = document.querySelector<HTMLButtonElement>('button[aria-label="Atualizar painel"]');
  button?.click();
}

function openDeleteConfirm(user: AdminRuntimeUser) {
  if (document.querySelector(".admin-delete-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "admin-delete-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const sheet = document.createElement("section");
  sheet.className = "admin-delete-sheet";
  const icon = document.createElement("div");
  icon.className = "icon";
  icon.textContent = "!";
  const pill = document.createElement("span");
  pill.className = "danger-pill";
  pill.textContent = "AÇÃO IRREVERSÍVEL";
  const title = document.createElement("h3");
  title.textContent = "Excluir esta conta?";
  const copy = document.createElement("p");
  copy.textContent = "A conta e os dados vinculados serão removidos permanentemente. Essa ação não pode ser desfeita.";
  const target = document.createElement("div");
  target.className = "admin-delete-target";
  const targetName = document.createElement("strong");
  const targetEmail = document.createElement("small");
  targetName.textContent = user.name || "Usuário sem nome";
  targetEmail.textContent = user.email;
  target.append(targetName, targetEmail);

  const label = document.createElement("label");
  label.className = "admin-delete-label";
  const labelText = document.createElement("span");
  labelText.textContent = "Digite EXCLUIR para confirmar";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "EXCLUIR";
  input.autocomplete = "off";
  input.spellcheck = false;
  label.append(labelText, input);

  const errorText = document.createElement("p");
  errorText.className = "admin-delete-error";
  errorText.hidden = true;
  const actions = document.createElement("div");
  actions.className = "admin-delete-actions";
  const cancel = document.createElement("button");
  cancel.className = "admin-delete-cancel";
  cancel.type = "button";
  cancel.textContent = "Cancelar";
  const confirm = document.createElement("button");
  confirm.className = "admin-delete-confirm";
  confirm.type = "button";
  confirm.textContent = "Excluir conta";
  confirm.disabled = true;
  actions.append(cancel, confirm);

  input.addEventListener("input", () => {
    confirm.disabled = input.value.trim().toUpperCase() !== "EXCLUIR";
    errorText.hidden = true;
  });
  cancel.onclick = () => overlay.remove();
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  confirm.onclick = async () => {
    sheet.classList.add("admin-delete-loading");
    confirm.textContent = "Excluindo...";
    try {
      const { error } = await requireSupabase().rpc("admin_delete_user", { target_user_id: user.id });
      if (error) throw new Error(error.message);
      users = users?.filter((item) => item.id !== user.id) ?? null;
      removeDeletedUserFromList(user.email);
      overlay.remove();
      closeUserModal();
      window.setTimeout(refreshAdminInPlace, 80);
    } catch (caught) {
      sheet.classList.remove("admin-delete-loading");
      confirm.textContent = "Excluir conta";
      confirm.disabled = input.value.trim().toUpperCase() !== "EXCLUIR";
      errorText.textContent = caught instanceof Error ? caught.message : "Não foi possível excluir esta conta.";
      errorText.hidden = false;
    }
  };

  sheet.append(icon, pill, title, copy, target, label, errorText, actions);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  window.setTimeout(() => input.focus(), 80);
}

async function enhanceUserModal() {
  const modal = document.querySelector<HTMLElement>(".admin-user-detail");
  if (!modal || modal.querySelector(".admin-runtime-details")) return;
  const identityEmail = modal.querySelector(".admin-user-identity strong")?.textContent?.trim() || selectedEmail;
  if (!identityEmail) return;

  try {
    const list = await getUsers();
    if (!modal.isConnected || modal.querySelector(".admin-runtime-details")) return;
    const user = list.find((item) => item.email?.toLowerCase() === identityEmail.toLowerCase());
    if (!user) return;

    const wrapper = document.createElement("section");
    wrapper.className = "admin-runtime-details";
    const status = document.createElement("div");
    status.className = `admin-user-statusline${user.bannedAt ? " is-blocked" : ""}`;
    const statusLabel = document.createElement("span");
    const statusValue = document.createElement("strong");
    statusLabel.textContent = "Status da conta";
    statusValue.textContent = user.bannedAt ? `Bloqueado${user.banReason ? ` · ${user.banReason}` : ""}` : "Ativa";
    status.append(statusLabel, statusValue);

    const grid = document.createElement("div");
    grid.className = "admin-user-summary-grid";
    const location = [user.municipality, user.state].filter(Boolean).join("/") || "Não informada";
    const area = user.area ? `${user.area} ${user.areaUnit || ""}`.trim() : "Não informada";
    [
      ["Cadastro", formatDate(user.createdAt, true)], ["Último acesso", formatDate(user.lastSignInAt, true)],
      ["E-mail confirmado", formatDate(user.emailConfirmedAt, true)], ["Telefone", safe(user.phone)],
      ["Tipo de conta", user.accountType === "staff" ? "Funcionário" : "Proprietário"], ["Permissão", safe(user.role)],
      ["Propriedade", safe(user.propertyName)], ["Localização", location], ["Área", area],
      ["Tipo da propriedade", safe(user.propertyType)], ["Atividade principal", safe(user.mainActivity)], ["Plano", safe(user.plan)],
    ].forEach(([label, value]) => grid.appendChild(detailCard(label, value)));

    const usage = document.createElement("div");
    usage.className = "admin-user-usage";
    usage.append(usageItem(user.animalsCount, "animais"), usageItem(user.waterRecordsCount, "água"), usageItem(user.activitiesCount, "atividades"), usageItem(user.postsCount, "posts"));
    wrapper.append(status, grid, usage);

    const { data: authData } = await requireSupabase().auth.getUser();
    const currentId = authData.user?.id;
    const current = list.find((item) => item.id === currentId);
    if (current?.role === "owner" && user.role !== "owner" && user.id !== currentId) {
      const danger = document.createElement("section");
      danger.className = "admin-danger-zone";
      const dangerTitle = document.createElement("h4");
      dangerTitle.textContent = "Zona de risco";
      const dangerCopy = document.createElement("p");
      dangerCopy.textContent = "Exclui permanentemente esta conta e os dados vinculados.";
      const dangerButton = document.createElement("button");
      dangerButton.className = "admin-delete-account";
      dangerButton.type = "button";
      dangerButton.textContent = "Excluir conta permanentemente";
      dangerButton.onclick = () => openDeleteConfirm(user);
      danger.append(dangerTitle, dangerCopy, dangerButton);
      wrapper.appendChild(danger);
    }

    modal.querySelector(".admin-user-identity")?.insertAdjacentElement("afterend", wrapper);
  } catch {
    // Mantém o painel funcional se os detalhes complementares não carregarem.
  }
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function restoreAdminContext() {
  const tabs = document.querySelector<HTMLElement>(".admin-tabs");
  if (tabs && !tabs.dataset.contextRestored) {
    tabs.dataset.contextRestored = "true";
    const savedTab = sessionStorage.getItem(TAB_KEY);
    if (savedTab) {
      const target = [...tabs.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === savedTab);
      if (target && !target.classList.contains("active")) window.setTimeout(() => target.click(), 0);
    }
  }

  const search = document.querySelector<HTMLInputElement>(".admin-search input");
  if (search && !search.dataset.contextRestored) {
    search.dataset.contextRestored = "true";
    const savedSearch = sessionStorage.getItem(SEARCH_KEY) || "";
    if (savedSearch && search.value !== savedSearch) setReactInputValue(search, savedSearch);
  }
}

function handleAdminContext(event: Event) {
  const target = event.target instanceof Element ? event.target : null;
  const tab = target?.closest<HTMLButtonElement>(".admin-tabs button");
  if (tab) sessionStorage.setItem(TAB_KEY, tab.textContent?.trim() || "Visão geral");
  if (target instanceof HTMLInputElement && target.closest(".admin-search")) sessionStorage.setItem(SEARCH_KEY, target.value);

  const userButton = target?.closest(".admin-user-list > button");
  if (userButton instanceof HTMLElement) {
    selectedEmail = userButton.querySelector("small")?.textContent?.trim() || "";
    window.setTimeout(() => void enhanceUserModal(), 0);
  }
}

document.addEventListener("click", handleAdminContext, true);
document.addEventListener("input", handleAdminContext, true);
window.addEventListener("hydra:refresh", () => { if (document.querySelector(".admin-screen")) refreshAdminInPlace(); });

const observer = new MutationObserver(() => {
  restoreAdminContext();
  if (document.querySelector(".admin-user-detail")) void enhanceUserModal();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
restoreAdminContext();
