export {};

const STYLE_ID = "hydra-admin-user-cleanup";

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.admin-user-detail .admin-user-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
.admin-user-detail .admin-user-summary-grid article{min-height:62px!important;padding:10px 11px!important;border-radius:14px!important}
.admin-user-detail .admin-user-summary-grid small{font-size:7px!important;margin-bottom:4px!important}
.admin-user-detail .admin-user-summary-grid strong{font-size:9px!important;line-height:1.35!important}
.admin-user-detail .admin-user-usage{grid-template-columns:repeat(4,minmax(0,1fr))!important;padding:10px!important;gap:6px!important}
.admin-user-detail .admin-user-usage>div{padding:7px 3px!important}
.admin-user-detail .admin-user-usage strong{font-size:14px!important}
.admin-user-detail .admin-runtime-details{gap:10px!important}
.admin-user-detail .admin-user-statusline{min-height:40px!important}
@media(max-width:390px){.admin-user-detail .admin-user-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.admin-user-detail .admin-user-usage{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
`;
  document.head.appendChild(style);
}

const hiddenLabels = new Set(["E-MAIL CONFIRMADO", "TIPO DE CONTA", "ÁREA", "TIPO DA PROPRIEDADE", "ATIVIDADE PRINCIPAL"]);

function normalizeRole(value: string) {
  const role = value.trim().toLowerCase();
  if (role === "user") return "Usuário";
  if (role === "moderator") return "Moderador";
  if (role === "admin") return "Administrador";
  if (role === "owner") return "Proprietário do app";
  return value;
}

function cleanUserDetail() {
  document.querySelectorAll(".admin-runtime-user-summary").forEach((node) => node.remove());
  const detail = document.querySelector<HTMLElement>(".admin-user-detail");
  if (!detail) return;

  detail.querySelectorAll<HTMLElement>(".admin-user-summary-grid article").forEach((card) => {
    const label = card.querySelector("small")?.textContent?.trim().toUpperCase() || "";
    if (hiddenLabels.has(label)) { card.remove(); return; }
    if (label === "PERMISSÃO") {
      const value = card.querySelector<HTMLElement>("strong");
      if (value) value.textContent = normalizeRole(value.textContent || "");
    }
  });
}

if (typeof document !== "undefined") {
  installStyle();
  cleanUserDetail();
  const observer = new MutationObserver(cleanUserDetail);
  observer.observe(document.body, { childList: true, subtree: true });
}
