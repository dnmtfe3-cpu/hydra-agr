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

const style = document.createElement("style");
style.textContent = `
.admin-user-detail{gap:16px!important}.admin-user-identity{padding:18px!important;border:1px solid #e0e9e3!important;border-radius:22px!important;background:linear-gradient(145deg,#f8fbf9,#eef5f0)!important;box-shadow:0 10px 30px rgba(20,61,43,.07)!important}.admin-runtime-details{display:grid;gap:14px}.admin-user-statusline{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-radius:16px;background:#edf6f0;border:1px solid #d8e9dc}.admin-user-statusline span{font-size:12px;color:#718078}.admin-user-statusline strong{font-size:13px;color:#174c36}.admin-user-statusline.is-blocked{background:#fff0ee;border-color:#f2d5d1}.admin-user-statusline.is-blocked strong{color:#b7473e}.admin-user-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-user-summary-grid article{min-width:0;padding:13px;border-radius:16px;background:#fff;border:1px solid #e7ece8;box-shadow:0 6px 18px rgba(20,61,43,.045)}.admin-user-summary-grid small{display:block;margin-bottom:5px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#87928c}.admin-user-summary-grid strong{display:block;font-size:13px;line-height:1.3;color:#163d2d;overflow-wrap:anywhere}.admin-user-usage{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px;border-radius:18px;background:#123e2d;color:#fff}.admin-user-usage>div{text-align:center}.admin-user-usage strong{display:block;font-size:21px}.admin-user-usage small{font-size:10px;opacity:.72}.admin-danger-zone{padding:15px;border:1px solid #f0d0cc;border-radius:19px;background:linear-gradient(145deg,#fff8f7,#fff1ef)}.admin-danger-zone h4{margin:0 0 4px;color:#9f3f37;font-size:14px}.admin-danger-zone p{margin:0 0 12px;color:#8b6a66;font-size:12px;line-height:1.45}.admin-delete-account{width:100%;height:46px;border:0;border-radius:14px;background:#b7473e;color:#fff;font-weight:800;box-shadow:0 8px 18px rgba(183,71,62,.18)}.admin-delete-account:disabled{opacity:.45}.admin-delete-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:end center;padding:18px;background:rgba(4,20,14,.48);backdrop-filter:blur(8px)}.admin-delete-sheet{width:min(100%,520px);padding:20px;border-radius:26px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.24);animation:adminSheetIn .22s ease both}.admin-delete-sheet .icon{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:#fff0ee;color:#b7473e;font-size:24px}.admin-delete-sheet h3{margin:14px 0 6px;font-size:20px;color:#173b2d}.admin-delete-sheet p{margin:0;color:#728078;font-size:13px;line-height:1.5}.admin-delete-sheet strong{color:#173b2d}.admin-delete-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.admin-delete-actions button{height:46px;border:0;border-radius:14px;font-weight:800}.admin-delete-cancel{background:#eef3ef;color:#315344}.admin-delete-confirm{background:#b7473e;color:#fff}.admin-delete-error{margin-top:10px!important;color:#b7473e!important}.admin-delete-loading{opacity:.65;pointer-events:none}@keyframes adminSheetIn{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}@media(max-width:420px){.admin-user-summary-grid{grid-template-columns:1fr}.admin-user-usage{grid-template-columns:repeat(2,1fr)}}`;
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

function openDeleteConfirm(user: AdminRuntimeUser) {
  if (document.querySelector(".admin-delete-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "admin-delete-overlay";
  const sheet = document.createElement("section");
  sheet.className = "admin-delete-sheet";
  sheet.innerHTML = `<div class="icon">!</div><h3>Excluir esta conta?</h3><p>A conta de <strong></strong> será removida junto com os dados vinculados. Essa ação não pode ser desfeita.</p><div class="admin-delete-actions"><button class="admin-delete-cancel">Cancelar</button><button class="admin-delete-confirm">Excluir conta</button></div>`;
  sheet.querySelector("strong")!.textContent = user.name || user.email;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const cancel = sheet.querySelector<HTMLButtonElement>(".admin-delete-cancel")!;
  const confirm = sheet.querySelector<HTMLButtonElement>(".admin-delete-confirm")!;
  cancel.onclick = () => overlay.remove();
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  confirm.onclick = async () => {
    sheet.classList.add("admin-delete-loading");
    confirm.textContent = "Excluindo...";
    try {
      const { error } = await requireSupabase().rpc("admin_delete_user_account", { target_user_id: user.id });
      if (error) throw error;
      users = null;
      overlay.remove();
      window.location.reload();
    } catch (caught) {
      sheet.classList.remove("admin-delete-loading");
      confirm.textContent = "Excluir conta";
      let error = sheet.querySelector<HTMLElement>(".admin-delete-error");
      if (!error) {
        error = document.createElement("p");
        error.className = "admin-delete-error";
        sheet.appendChild(error);
      }
      error.textContent = caught instanceof Error ? caught.message : "Não foi possível excluir esta conta.";
    }
  };
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
    status.innerHTML = "<span>Status da conta</span><strong></strong>";
    status.querySelector("strong")!.textContent = user.bannedAt ? `Bloqueado${user.banReason ? ` · ${user.banReason}` : ""}` : "Ativa";

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
    if (user.role !== "owner") {
      const danger = document.createElement("section");
      danger.className = "admin-danger-zone";
      danger.innerHTML = `<h4>Zona de risco</h4><p>Exclui permanentemente esta conta e os dados vinculados.</p><button class="admin-delete-account" type="button">Excluir conta</button>`;
      danger.querySelector<HTMLButtonElement>("button")!.onclick = () => openDeleteConfirm(user);
      wrapper.appendChild(danger);
    }
    modal.querySelector(".admin-user-identity")?.insertAdjacentElement("afterend", wrapper);
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
const observer = new MutationObserver(() => { if (document.querySelector(".admin-user-detail")) void enhanceUserModal(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
