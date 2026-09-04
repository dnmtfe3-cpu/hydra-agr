import { loadAdminData } from "./services/hydra-repository";

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

async function getUsers() {
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
      ["Cadastro", formatDate(user.createdAt, true)],
      ["Último acesso", formatDate(user.lastSignInAt, true)],
      ["E-mail confirmado", formatDate(user.emailConfirmedAt, true)],
      ["Telefone", safe(user.phone)],
      ["Tipo de conta", user.accountType === "staff" ? "Funcionário" : "Proprietário"],
      ["Permissão", safe(user.role)],
      ["Propriedade", safe(user.propertyName)],
      ["Localização", location],
      ["Área", area],
      ["Tipo da propriedade", safe(user.propertyType)],
      ["Atividade principal", safe(user.mainActivity)],
      ["Plano", safe(user.plan)],
    ].forEach(([label, value]) => grid.appendChild(detailCard(label, value)));

    const usage = document.createElement("div");
    usage.className = "admin-user-usage";
    usage.append(
      usageItem(user.animalsCount, "animais"),
      usageItem(user.waterRecordsCount, "água"),
      usageItem(user.activitiesCount, "atividades"),
      usageItem(user.postsCount, "posts"),
    );

    wrapper.append(status, grid, usage);
    const identity = modal.querySelector(".admin-user-identity");
    identity?.insertAdjacentElement("afterend", wrapper);
  } catch {
    // Mantém o painel funcional se os detalhes complementares não carregarem.
  }
}

function readClickedUser(event: Event) {
  const target = event.target instanceof Element ? event.target.closest(".admin-user-list > button") : null;
  if (!(target instanceof HTMLElement)) return;
  selectedEmail = target.querySelector("small")?.textContent?.trim() || "";
  window.setTimeout(() => void enhanceUserModal(), 0);
}

document.addEventListener("click", readClickedUser, true);

const observer = new MutationObserver(() => {
  if (document.querySelector(".admin-user-detail")) void enhanceUserModal();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
