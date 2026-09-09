const interactionMotionStyleId = "hydra-interaction-motion-runtime";

const interactionMotionCss = String.raw`
@media (prefers-reduced-motion: no-preference) {
  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button {
    transition: color .2s ease, transform .18s ease !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button > span:first-of-type:not(.touch-ripple) {
    transition: transform .22s cubic-bezier(.2,.8,.2,1), background-color .2s ease, box-shadow .2s ease !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button:active > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.is-tapped > span:first-of-type:not(.touch-ripple) {
    transform: scale(.88) !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc) > span:first-of-type:not(.touch-ripple) {
    animation: hydra-nav-active-pop .28s cubic-bezier(.2,.9,.25,1.25) both !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc)::after {
    animation: hydra-nav-dot-in .24s cubic-bezier(.2,.9,.25,1.2) both !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc > span:first-of-type:not(.touch-ripple) {
    transition: transform .24s cubic-bezier(.2,.8,.2,1), box-shadow .24s ease !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc:active > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.is-tapped > span:first-of-type:not(.touch-ripple) {
    transform: translateX(-50%) scale(.91) !important;
    box-shadow: 0 3px 9px rgba(23, 76, 54, .14) !important;
  }

  html body #root .hydra-root .login-code-input,
  html body #root .hydra-root .staff-code-input,
  html body #root .hydra-root input[autocomplete="one-time-code"] {
    transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease, background-color .2s ease !important;
    animation: hydra-code-field-in .3s cubic-bezier(.2,.8,.2,1) both;
  }

  html body #root .hydra-root .login-code-input:focus,
  html body #root .hydra-root .staff-code-input:focus,
  html body #root .hydra-root input[autocomplete="one-time-code"]:focus {
    transform: translateY(-1px) scale(1.01) !important;
    box-shadow: 0 0 0 3px rgba(23,76,54,.12), 0 7px 18px rgba(23,76,54,.08) !important;
  }

  html body #root .hydra-root .auth-content:has(.login-code-input),
  html body #root .hydra-root .auth-content:has(.staff-code-input),
  html body #root .hydra-root .signup-panel:has(.login-code-input) {
    animation: hydra-code-screen-in .32s cubic-bezier(.2,.8,.2,1) both !important;
  }

  html body #root .hydra-root .form-error {
    animation: hydra-code-error .28s ease both;
  }

  html body #root .hydra-root .form-notice {
    animation: hydra-code-success .3s cubic-bezier(.2,.8,.2,1) both;
  }
}

@keyframes hydra-nav-active-pop {
  0% { transform: scale(.9); }
  55% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes hydra-nav-dot-in {
  0% { opacity: 0; transform: translateX(-50%) scale(.2); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}

@keyframes hydra-code-field-in {
  0% { opacity: 0; transform: translateY(8px) scale(.985); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes hydra-code-screen-in {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes hydra-code-error {
  0%, 100% { transform: translateX(0); opacity: 1; }
  30% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
}

@keyframes hydra-code-success {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}

.hydra-logout-transition {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: grid;
  place-items: center;
  padding: max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 82% 14%, rgba(239,136,59,.22), transparent 27%),
    radial-gradient(circle at 12% 88%, rgba(126,188,126,.15), transparent 31%),
    linear-gradient(155deg, #061f17 0%, #0a3828 52%, #0d4a34 100%);
  color: #f8f6ef;
  opacity: 0;
  transition: opacity .24s ease;
  overflow: hidden;
  isolation: isolate;
}

.hydra-logout-transition.is-visible {
  opacity: 1;
}

.hydra-logout-transition.is-leaving {
  opacity: 0;
}

.hydra-logout-transition::before,
.hydra-logout-transition::after {
  content: "";
  position: absolute;
  z-index: -1;
  border-radius: 999px;
  pointer-events: none;
}

.hydra-logout-transition::before {
  width: min(78vw, 420px);
  aspect-ratio: 1;
  right: -32%;
  top: -20%;
  border: 1px solid rgba(255,255,255,.09);
  box-shadow: inset 0 0 0 32px rgba(255,255,255,.018), inset 0 0 0 66px rgba(255,255,255,.012);
}

.hydra-logout-transition::after {
  width: 220px;
  height: 220px;
  left: -124px;
  bottom: 8%;
  background: rgba(239,136,59,.08);
}

.hydra-logout-transition-card {
  width: min(100%, 420px);
  text-align: center;
}

.hydra-logout-transition-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 15px;
  margin-bottom: 28px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 999px;
  background: rgba(255,255,255,.07);
  color: #b9d8c0;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .15em;
  text-transform: uppercase;
  backdrop-filter: blur(12px);
}

.hydra-logout-transition-kicker {
  margin: 0 0 8px;
  color: #f0a15d;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.hydra-logout-transition-name {
  margin: 0;
  color: #fffaf2;
  font-size: clamp(34px, 9vw, 50px);
  line-height: 1.02;
  letter-spacing: -.045em;
  font-weight: 760;
}

.hydra-logout-transition-copy {
  margin: 14px auto 0;
  max-width: 300px;
  color: rgba(244,248,243,.68);
  font-size: 14px;
  line-height: 1.5;
}

.hydra-logout-transition-loader {
  position: relative;
  width: 44px;
  height: 44px;
  margin: 30px auto 0;
  border: 2px solid rgba(255,255,255,.12);
  border-top-color: #f29a4b;
  border-radius: 999px;
  animation: hydra-logout-spin .8s linear infinite;
}

@keyframes hydra-logout-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .hydra-logout-transition,
  .hydra-logout-transition-loader {
    transition: none !important;
    animation: none !important;
  }
}
`;

const previousInteractionMotionStyle = document.getElementById(interactionMotionStyleId);
if (previousInteractionMotionStyle) previousInteractionMotionStyle.remove();
const interactionMotionStyle = document.createElement("style");
interactionMotionStyle.id = interactionMotionStyleId;
interactionMotionStyle.textContent = interactionMotionCss;
document.head.appendChild(interactionMotionStyle);

let logoutObserver: MutationObserver | null = null;
let logoutFallbackTimer: number | null = null;

function removeLogoutTransition(overlay: HTMLElement) {
  if (!overlay.isConnected) return;
  logoutObserver?.disconnect();
  logoutObserver = null;
  if (logoutFallbackTimer) window.clearTimeout(logoutFallbackTimer);
  logoutFallbackTimer = null;
  overlay.classList.add("is-leaving");
  window.setTimeout(() => overlay.remove(), 260);
}

function showLogoutTransition(name: string) {
  document.querySelector(".hydra-logout-transition")?.remove();
  logoutObserver?.disconnect();
  if (logoutFallbackTimer) window.clearTimeout(logoutFallbackTimer);

  const firstName = name.trim().split(/\s+/)[0] || "Produtor";
  const overlay = document.createElement("div");
  overlay.className = "hydra-logout-transition";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  const card = document.createElement("section");
  card.className = "hydra-logout-transition-card";

  const brand = document.createElement("span");
  brand.className = "hydra-logout-transition-brand";
  brand.textContent = "Hydra Agro";

  const kicker = document.createElement("p");
  kicker.className = "hydra-logout-transition-kicker";
  kicker.textContent = "Saindo da conta";

  const heading = document.createElement("h2");
  heading.className = "hydra-logout-transition-name";
  heading.textContent = `Até logo, ${firstName}`;

  const copy = document.createElement("p");
  copy.className = "hydra-logout-transition-copy";
  copy.textContent = "Encerrando sua sessão com segurança…";

  const loader = document.createElement("span");
  loader.className = "hydra-logout-transition-loader";
  loader.setAttribute("aria-hidden", "true");

  card.append(brand, kicker, heading, copy, loader);
  overlay.append(card);
  document.body.appendChild(overlay);
  window.requestAnimationFrame(() => overlay.classList.add("is-visible"));

  const finishWhenLoginAppears = () => {
    const authVisible = Boolean(document.querySelector("#root .auth-landing, #root .auth-shell"));
    if (!authVisible) return;
    window.setTimeout(() => removeLogoutTransition(overlay), 220);
  };

  logoutObserver = new MutationObserver(finishWhenLoginAppears);
  logoutObserver.observe(document.body, { childList: true, subtree: true });
  finishWhenLoginAppears();

  logoutFallbackTimer = window.setTimeout(() => removeLogoutTransition(overlay), 4200);
}

function handleLogoutConfirmation(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target.closest("button") : null;
  if (!(target instanceof HTMLButtonElement) || target.disabled) return;
  if (!target.closest(".confirm-action")) return;
  if (target.textContent?.trim().toLocaleLowerCase("pt-BR") !== "sair") return;

  const name = document.querySelector<HTMLElement>(".profile-screen .profile-hero h1")?.textContent?.trim();
  if (!name) return;
  showLogoutTransition(name);
}

document.addEventListener("click", handleLogoutConfirmation, true);

export {};
