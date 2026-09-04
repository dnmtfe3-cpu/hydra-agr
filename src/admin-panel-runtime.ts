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
.admin-screen{--admin-deep:#0f3727;--admin-green:#174c36;--admin-bright:#83ba5b;--admin-warm:#ff8712}.admin-screen .screen-header h1{letter-spacing:-.045em!important}.admin-owner-strip{position:relative!important;overflow:hidden!important;border:0!important;background:linear-gradient(135deg,#0f3727 0%,#174c36 72%,#286849 100%)!important;box-shadow:0 14px 32px rgba(15,55,39,.16)!important}.admin-owner-strip:after{content:"";position:absolute;width:120px;height:120px;right:-46px;top:-64px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none}.admin-owner-strip>svg,.admin-owner-strip strong{color:#fff!important}.admin-owner-strip small{color:rgba(255,255,255,.68)!important}.admin-tabs button{border-color:rgba(23,76,54,.09)!important;background:rgba(255,255,255,.9)!important;box-shadow:0 5px 14px rgba(17,43,32,.045)!important;transition:transform .18s ease,box-shadow .18s ease!important}.admin-tabs button:active{transform:scale(.96)!important}.admin-tabs button.active{background:linear-gradient(135deg,#123e2c,#1d5b41)!important;box-shadow:0 8px 18px rgba(23,76,54,.19)!important}.admin-metric-grid article{border-color:rgba(23,76,54,.09)!important;background:linear-gradient(145deg,#fff,#fbfdfb)!important;box-shadow:0 9px 26px rgba(17,43,32,.055)!important}.admin-user-list>button{border-color:rgba(23,76,54,.09)!important;background:linear-gradient(145deg,#fff,#fafcfb)!important;box-shadow:0 8px 22px rgba(17,43,32,.05)!important;transition:transform .18s ease,box-shadow .18s ease!important}.admin-user-list>button:active{transform:scale(.985)!important}.admin-user-detail{gap:16px!important}.admin-user-identity{padding:17px!important;border:0!important;border-radius:22px!important;background:linear-gradient(135deg,#102f23,#174c36)!important;box-shadow:0 12px 30px rgba(15,55,39,.17)!important}.admin-user-identity strong{color:#fff!important}.admin-user-identity small{color:rgba(255,255,255,.64)!important}.admin-user-identity>span{background:rgba(255,255,255,.12)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)!important}.admin-runtime-details{display:grid;gap:14px}.admin-user-statusline{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-radius:16px;background:linear-gradient(135deg,#edf6f0,#f7faf8);border:1px solid #d8e9dc}.admin-user-statusline span{font-size:10px;color:#718078}.admin-user-statusline strong{font-size:11px;color:#174c36}.admin-user-statusline.is-blocked{background:#fff0ee;border-color:#f2d5d1}.admin-user-statusline.is-blocked strong{color:#b7473e}.admin-user-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.admin-user-summary-grid article{min-width:0;padding:12px;border-radius:15px;background:linear-gradient(145deg,#fff,#fbfcfb);border:1px solid #e7ece8;box-shadow:0 6px 18px rgba(20,61,43,.04)}.admin-user-summary-grid small{display:block;margin-bottom:5px;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#87928c}.admin-user-summary-grid strong{display:block;font-size:10px;line-height:1.35;color:#163d2d;overflow-wrap:anywhere}.admin-user-usage{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:13px;border-radius:18px;background:linear-gradient(135deg,#123e2d,#1b573d);color:#fff;box-shadow:0 10px 24px rgba(18,62,45,.15)}.admin-user-usage>div{text-align:center}.admin-user-usage strong{display:block;font-size:18px}.admin-user-usage small{font-size:8px;opacity:.72}.admin-danger-zone{padding:15px;border:1px solid #f0d0cc;border-radius:19px;background:linear-gradient(145deg,#fff9f8,#fff1ef)}.admin-danger-zone h4{margin:0 0 4px;color:#9f3f37;font-size:12px}.admin-danger-zone p{margin:0 0 12px;color:#8b6a66;font-size:9px;line-height:1.45}.admin-delete-account{width:100%;height:43px;border:1px solid rgba(183,71,62,.16);border-radius:13px;background:#fff;color:#a83e37;font-weight:850;font-size:10px;box-shadow:0 6px 16px rgba(183,71,62,.08)}.admin-delete-account:active{transform:scale(.98)}.admin-delete-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:end center;padding:18px;background:rgba(4,20,14,.52);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:adminOverlayIn .18s ease both}.admin-delete-sheet{width:min(100%,520px);padding:20px;border-radius:26px;background:#fffefb;box-shadow:0 28px 80px rgba(0,0,0,.26);animation:adminSheetIn .24s cubic-bezier(.2,.85,.25,1) both}.admin-delete-sheet .icon{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:#fff0ee;color:#b7473e;font-size:24px}.admin-delete-sheet .danger-pill{display:inline-flex;margin-top:13px;padding:5px 8px;border-radius:999px;background:#fde8e5;color:#a33d36;font-size:8px;font-weight:900;letter-spacing:.07em}.admin-delete-sheet h3{margin:10px 0 6px;font-size:19px;color:#173b2d;letter-spacing:-.025em}.admin-delete-sheet p{margin:0;color:#728078;font-size:10px;line-height:1.5}.admin-delete-sheet strong{color:#173b2d}.admin-delete-target{margin:13px 0;padding:11px;border-radius:14px;background:#f4f7f5}.admin-delete-target strong,.admin-delete-target small{display:block}.admin-delete-target strong{font-size:11px}.admin-delete-target small{margin-top:3px;font-size:9px;color:#7d8882;overflow-wrap:anywhere}.admin-delete-label{display:grid;gap:6px;color:#69766f;font-size:9px;font-weight:750}.admin-delete-label input{width:100%;min-height:44px;padding:0 12px;border:1px solid rgba(183,71,62,.2);border-radius:12px;background:#fff;color:#173b2d;outline:none;font-size:12px;font-weight:850;text-transform:uppercase}.admin-delete-label input:focus{border-color:#b7473e;box-shadow:0 0 0 3px rgba(183,71,62,.09)}.admin-delete-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.admin-delete-actions button{height:44px;border:0;border-radius:13px;font-weight:850;font-size:10px}.admin-delete-cancel{background:#eef3ef;color:#315344}.admin-delete-confirm{background:linear-gradient(135deg,#a43e37,#c45047);color:#fff;box-shadow:0 8px 18px rgba(183,71,62,.2)}.admin-delete-confirm:disabled{opacity:.38;box-shadow:none}.admin-delete-error{margin-top:10px!important;color:#b7473e!important;font-size:9px!important}.admin-delete-loading{opacity:.65;pointer-events:none}@keyframes adminOverlayIn{from{opacity:0}to{opacity:1}}@keyframes adminSheetIn{from{opacity:0;transform:translateY(22px) scale(.98)}to{opacity:1;transform:none}}@media(min-width:720px){.admin-delete-overlay{place-items:center}.admin-delete-sheet{margin:auto}}@media(max-width:420px){.admin-user-summary-grid{grid-template-columns:1fr}.admin-user-usage{grid-template-columns:repeat(2,1fr)}}`;
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
      confirm.textContent = "Conta excluída";
      window.setTimeout(() => window.location.reload(), 450);
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

function readClickedUser(event: Event) {
  const target = event.target instanceof Element ? event.target.closest(".admin-user-list > button") : null;
  if (!(target instanceof HTMLElement)) return;
  selectedEmail = target.querySelector("small")?.textContent?.trim() || "";
  window.setTimeout(() => void enhanceUserModal(), 0);
}

document.addEventListener("click", readClickedUser, true);
const observer = new MutationObserver(() => { if (document.querySelector(".admin-user-detail")) void enhanceUserModal(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
