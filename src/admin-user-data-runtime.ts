import { loadAdminData } from "./services/hydra-repository";

export {};

type ExtendedAdminUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  propertyName?: string;
  municipality?: string;
  state?: string;
  propertyType?: string;
  mainActivity?: string;
  area?: string | number | null;
  areaUnit?: string;
  role?: string;
  accountType?: string;
  plan?: string;
  subscriptionStatus?: string;
  createdAt?: string;
  lastSignInAt?: string;
  emailConfirmedAt?: string;
  profileUpdatedAt?: string;
  premiumStartedAt?: string;
  premiumExpiresAt?: string;
  bannedAt?: string;
  banReason?: string;
  animalsCount?: number;
  waterRecordsCount?: number;
  activitiesCount?: number;
  postsCount?: number;
};

type ExtendedAdminData = { users: ExtendedAdminUser[] };

const styleId = "hydra-admin-user-data-runtime";
const css = `
.admin-runtime-user-summary{margin-top:14px;display:grid;gap:10px}
.admin-runtime-user-summary .admin-runtime-section{border:1px solid var(--line,#e4e3da);border-radius:16px;background:var(--paper,#fffefb);padding:13px}
.admin-runtime-user-summary h4{margin:0 0 10px;font:700 12px/1.2 var(--font-display,"Sora"),system-ui,sans-serif;letter-spacing:.04em;color:var(--forest-800,#174c36);text-transform:uppercase}
.admin-runtime-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.admin-runtime-grid div{min-width:0;border-radius:12px;background:var(--cream,#f8f6ef);padding:9px 10px}
.admin-runtime-grid small{display:block;margin-bottom:3px;font-size:10px;font-weight:700;color:var(--muted,#6f7b74);text-transform:uppercase;letter-spacing:.04em}
.admin-runtime-grid strong{display:block;font-size:12px;line-height:1.35;color:var(--ink,#112b20);word-break:break-word}
.admin-user-list>button .admin-runtime-row-date{display:block!important;margin-top:2px!important;font-size:10px!important;font-style:normal!important;color:var(--muted,#6f7b74)!important}
@media(max-width:430px){.admin-runtime-grid{grid-template-columns:1fr 1fr}.admin-runtime-grid div{padding:8px}.admin-runtime-grid strong{font-size:11px}}
`;

function installStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

function fmtDate(value?: string, withTime = false) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return withTime ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
}

function text(value: unknown, fallback = "Não informado") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value);
}

function stat(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? String(number) : "0";
}

let cachedUsers: ExtendedAdminUser[] | null = null;
let loadingUsers: Promise<ExtendedAdminUser[]> | null = null;

async function getUsers() {
  if (cachedUsers) return cachedUsers;
  if (!loadingUsers) {
    loadingUsers = loadAdminData()
      .then((data) => ((data as unknown as ExtendedAdminData).users ?? []))
      .then((users) => { cachedUsers = users; return users; })
      .finally(() => { loadingUsers = null; });
  }
  return loadingUsers;
}

function field(label: string, value: string) {
  const div = document.createElement("div");
  const small = document.createElement("small");
  const strong = document.createElement("strong");
  small.textContent = label;
  strong.textContent = value;
  div.append(small, strong);
  return div;
}

function section(title: string, entries: Array<[string, string]>) {
  const box = document.createElement("section");
  box.className = "admin-runtime-section";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const grid = document.createElement("div");
  grid.className = "admin-runtime-grid";
  entries.forEach(([label, value]) => grid.appendChild(field(label, value)));
  box.append(heading, grid);
  return box;
}

async function enhanceUserModal() {
  const detail = document.querySelector<HTMLElement>(".admin-user-detail");
  if (!detail || detail.querySelector(".admin-runtime-user-summary")) return;
  const email = detail.querySelector<HTMLElement>(".admin-user-identity strong")?.textContent?.trim();
  if (!email) return;
  try {
    const users = await getUsers();
    const user = users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (!user || !detail.isConnected || detail.querySelector(".admin-runtime-user-summary")) return;

    const summary = document.createElement("div");
    summary.className = "admin-runtime-user-summary";
    summary.append(
      section("Conta", [
        ["ID", text(user.id)],
        ["Telefone", text(user.phone)],
        ["Tipo", user.accountType === "staff" ? "Funcionário" : "Proprietário"],
        ["Permissão", text(user.role)],
        ["Cadastro", fmtDate(user.createdAt, true)],
        ["Último acesso", fmtDate(user.lastSignInAt, true)],
        ["E-mail confirmado", user.emailConfirmedAt ? fmtDate(user.emailConfirmedAt, true) : "Não"],
        ["Perfil atualizado", fmtDate(user.profileUpdatedAt, true)],
      ]),
      section("Propriedade", [
        ["Nome", text(user.propertyName)],
        ["Localização", [user.municipality, user.state].filter(Boolean).join(" - ") || "Não informado"],
        ["Tipo", text(user.propertyType)],
        ["Atividade principal", text(user.mainActivity)],
        ["Área", user.area !== null && user.area !== undefined && String(user.area) !== "" ? `${user.area} ${text(user.areaUnit, "")}`.trim() : "Não informado"],
        ["Plano", text(user.plan)],
        ["Status", text(user.subscriptionStatus)],
        ["Bloqueio", user.bannedAt ? `Bloqueado em ${fmtDate(user.bannedAt, true)}` : "Ativo"],
      ]),
      section("Uso do aplicativo", [
        ["Animais", stat(user.animalsCount)],
        ["Registros de água", stat(user.waterRecordsCount)],
        ["Atividades", stat(user.activitiesCount)],
        ["Publicações", stat(user.postsCount)],
        ["Premium desde", fmtDate(user.premiumStartedAt)],
        ["Premium até", user.premiumExpiresAt ? fmtDate(user.premiumExpiresAt) : "Sem prazo"],
      ]),
    );
    const identity = detail.querySelector(".admin-user-identity");
    identity?.insertAdjacentElement("afterend", summary);
  } catch {
    // O painel original continua funcional se a leitura adicional falhar.
  }
}

async function enhanceUserRows() {
  const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".admin-user-list > button"));
  if (!rows.length) return;
  try {
    const users = await getUsers();
    rows.forEach((row) => {
      if (row.querySelector(".admin-runtime-row-date")) return;
      const email = row.querySelector("small")?.textContent?.trim();
      const user = users.find((item) => item.email?.toLowerCase() === email?.toLowerCase());
      if (!user) return;
      const target = row.querySelector("div");
      if (!target) return;
      const meta = document.createElement("em");
      meta.className = "admin-runtime-row-date";
      meta.textContent = `Cadastro: ${fmtDate(user.createdAt)} · Último acesso: ${user.lastSignInAt ? fmtDate(user.lastSignInAt) : "nunca"}`;
      target.appendChild(meta);
    });
  } catch {
    // Sem impacto no painel caso não seja possível enriquecer a lista.
  }
}

function refreshEnhancements() {
  void enhanceUserModal();
  void enhanceUserRows();
}

installStyle();
const observer = new MutationObserver(refreshEnhancements);
observer.observe(document.documentElement, { childList: true, subtree: true });
refreshEnhancements();
