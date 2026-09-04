const PULL_THRESHOLD = 82;
const MAX_VISUAL_PULL = 74;

let startY = 0;
let startX = 0;
let tracking = false;
let refreshing = false;
let rawDistance = 0;

const indicator = document.createElement("div");
indicator.className = "hydra-pull-refresh";
indicator.setAttribute("aria-live", "polite");
indicator.innerHTML = '<i class="hydra-pull-refresh-spinner" aria-hidden="true"></i><span>Puxe para atualizar</span>';
document.body.appendChild(indicator);

const label = indicator.querySelector("span")!;
const spinner = indicator.querySelector<HTMLElement>(".hydra-pull-refresh-spinner")!;

function currentScrollTop() {
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
    document.scrollingElement?.scrollTop || 0,
  );
}

function canStart(target: EventTarget | null) {
  if (refreshing || currentScrollTop() > 0) return false;
  if (!(target instanceof Element)) return true;
  if (target.closest("input, textarea, select, [contenteditable='true'], .quick-layer, .modal-backdrop, .auth-shell")) return false;
  return Boolean(document.querySelector(".phone-app"));
}

function resetIndicator() {
  tracking = false;
  refreshing = false;
  rawDistance = 0;
  indicator.classList.remove("is-visible", "is-refreshing");
  indicator.style.transform = "translate(-50%, -64px) scale(.96)";
  spinner.style.setProperty("--pull-rotation", "0deg");
  label.textContent = "Puxe para atualizar";
}

function updateIndicator(distance: number) {
  const progress = Math.min(1, distance / PULL_THRESHOLD);
  const visual = Math.min(MAX_VISUAL_PULL, distance * .46);
  const offset = -64 + visual;
  indicator.classList.add("is-visible");
  indicator.style.transform = `translate(-50%, ${offset}px) scale(${.96 + progress * .04})`;
  spinner.style.setProperty("--pull-rotation", `${Math.round(progress * 250)}deg`);
  label.textContent = progress >= 1 ? "Solte para atualizar" : "Puxe para atualizar";
}

function refreshPage() {
  if (refreshing) return;
  refreshing = true;
  tracking = false;
  indicator.classList.add("is-visible", "is-refreshing");
  indicator.style.transform = "translate(-50%, 0) scale(1)";
  label.textContent = "Atualizando";

  const current = document.querySelector<HTMLElement>(".app-content");
  const refreshButton = current?.querySelector<HTMLButtonElement>(
    'button[aria-label*="Atualizar"], button[title*="Atualizar"], button[data-refresh="true"]',
  );

  window.dispatchEvent(new CustomEvent("hydra:refresh", { detail: { preservePage: true } }));
  refreshButton?.click();

  window.setTimeout(() => {
    label.textContent = "Atualizado";
    window.setTimeout(resetIndicator, 260);
  }, 520);
}

document.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1 || !canStart(event.target)) return;
  const touch = event.touches[0];
  startY = touch.clientY;
  startX = touch.clientX;
  rawDistance = 0;
  tracking = true;
}, { passive: true });

document.addEventListener("touchmove", (event) => {
  if (!tracking || refreshing || event.touches.length !== 1) return;
  if (currentScrollTop() > 0) {
    resetIndicator();
    return;
  }

  const touch = event.touches[0];
  const vertical = touch.clientY - startY;
  const horizontal = Math.abs(touch.clientX - startX);

  if (vertical <= 0 || horizontal > vertical) {
    resetIndicator();
    return;
  }

  rawDistance = vertical;
  if (vertical > 8) {
    event.preventDefault();
    updateIndicator(vertical);
  }
}, { passive: false });

document.addEventListener("touchend", () => {
  if (!tracking || refreshing) return;
  if (rawDistance >= PULL_THRESHOLD) refreshPage();
  else resetIndicator();
}, { passive: true });

document.addEventListener("touchcancel", () => {
  if (!refreshing) resetIndicator();
}, { passive: true });
