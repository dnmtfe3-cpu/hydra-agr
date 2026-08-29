import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { handleAuthCallbackUrl } from "./services/supabase";

const AUTH_PREFIX = "br.com.hydraagro.app://auth/";
const seenAuthUrls = new Set<string>();

async function receiveNativeAuthUrl(url?: string) {
  if (!Capacitor.isNativePlatform() || !url?.startsWith(AUTH_PREFIX) || seenAuthUrls.has(url)) return;
  seenAuthUrls.add(url);

  try {
    const recovery = await handleAuthCallbackUrl(url);
    await Browser.close().catch(() => undefined);
    window.dispatchEvent(new CustomEvent("hydra-native-auth-complete", { detail: { recovery } }));
  } catch (error) {
    seenAuthUrls.delete(url);
    const message = error instanceof Error ? error.message : "Não foi possível concluir o acesso com Google.";
    console.error("[Hydra Agro] Falha ao concluir autenticação nativa:", message);
    window.dispatchEvent(new CustomEvent("hydra-native-auth-error", { detail: { message } }));
  }
}

if (Capacitor.isNativePlatform()) {
  void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
    void receiveNativeAuthUrl(url);
  });

  void CapacitorApp.getLaunchUrl().then((result) => {
    void receiveNativeAuthUrl(result?.url);
  });

  void CapacitorApp.addListener("resume", () => {
    void CapacitorApp.getLaunchUrl().then((result) => {
      void receiveNativeAuthUrl(result?.url);
    });
  });
}

function installCompactTypography() {
  if (document.getElementById("hydra-global-type-fix")) return;
  const style = document.createElement("style");
  style.id = "hydra-global-type-fix";
  style.textContent = `
    .hydra-root {
      --type-display: 30px;
      --type-section: 18px;
      --type-card: 13px;
      --type-body: 12px;
      --type-control: 11px;
      --type-caption: 9.5px;
      --type-eyebrow: 9px;
      --type-nav: 8.5px;
    }

    .hydra-root .field input,
    .hydra-root .field select,
    .hydra-root .field textarea {
      font-size: var(--type-body) !important;
    }

    .hydra-root .auth-shell-motion .auth-content h1,
    .hydra-root .auth-shell-motion .signup-panel h1 {
      font-size: clamp(26px, 6vw, 32px) !important;
    }

    .hydra-root .auth-shell-motion .auth-subtitle,
    .hydra-root .auth-shell-motion .form-notice,
    .hydra-root .auth-shell-motion .form-error {
      font-size: var(--type-body) !important;
    }

    .hydra-root .auth-shell-motion .field > span,
    .hydra-root .auth-shell-motion .eyebrow {
      font-size: var(--type-eyebrow) !important;
    }

    .hydra-root .auth-shell-motion button:not(.icon-button),
    .hydra-root .google-auth-button {
      font-size: var(--type-control) !important;
    }

    .hydra-root .auth-shell-motion .auth-divider span,
    .hydra-root .auth-shell-motion .auth-switch,
    .hydra-root .auth-shell-motion .staff-entry-button span small,
    .hydra-root .auth-shell-motion .review-card small,
    .hydra-root .auth-shell-motion .preview-note {
      font-size: var(--type-caption) !important;
    }

    .hydra-root .auth-shell-motion .staff-entry-button span strong {
      font-size: var(--type-card) !important;
    }

    .hydra-root .auth-landing-kicker {
      font-size: var(--type-eyebrow) !important;
    }

    .hydra-root .auth-landing-copy {
      font-size: var(--type-body) !important;
    }

    .hydra-root .auth-landing-content h1 {
      font-size: clamp(30px, 8vw, 48px) !important;
    }

    .hydra-root .auth-landing-primary,
    .hydra-root .auth-landing-secondary,
    .hydra-root .auth-landing-staff {
      font-size: var(--type-control) !important;
    }

    @media (max-width: 370px) {
      .hydra-root {
        --type-display: 28px;
        --type-section: 17px;
        --type-card: 12.5px;
        --type-body: 11.5px;
        --type-control: 10.5px;
        --type-caption: 9px;
        --type-eyebrow: 8.5px;
        --type-nav: 8px;
      }
    }
  `;
  document.head.appendChild(style);
}

function initialsFromName(name?: string | null) {
  return (name || "Produtor")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

function replaceBrokenProfileImage(image: HTMLImageElement) {
  if (image.dataset.hydraAvatarFallback === "done") return;

  if (image.matches(".home-profile-avatar img")) {
    const holder = image.closest<HTMLElement>(".home-profile-avatar");
    if (!holder) return;
    image.dataset.hydraAvatarFallback = "done";
    const name = document.querySelector<HTMLElement>(".greeting-name")?.textContent;
    holder.replaceChildren(document.createTextNode(initialsFromName(name)));
    return;
  }

  if (image.matches("img.profile-avatar.image")) {
    image.dataset.hydraAvatarFallback = "done";
    const name = image.closest(".profile-hero")?.querySelector<HTMLElement>("h1")?.textContent;
    const fallback = document.createElement("span");
    fallback.className = "profile-avatar";
    fallback.textContent = initialsFromName(name);
    image.replaceWith(fallback);
  }
}

function installAvatarFallbacks() {
  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) replaceBrokenProfileImage(event.target);
  }, true);
}

function installSplashVisibilityLock() {
  let splashSeen = false;
  const html = document.documentElement;
  html.classList.add("hydra-splash-active");

  const sync = () => {
    const hasSplash = Boolean(document.querySelector(".splash-screen"));
    if (hasSplash) splashSeen = true;
    if (hasSplash || !splashSeen) html.classList.add("hydra-splash-active");
    else html.classList.remove("hydra-splash-active");
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sync();
}

let lastSplashState: boolean | null = null;
async function syncNativeStatusBarWithSplash() {
  if (!Capacitor.isNativePlatform()) return;
  const hasSplash = Boolean(document.querySelector(".splash-screen"));
  if (hasSplash === lastSplashState) return;
  lastSplashState = hasSplash;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    if (hasSplash) {
      await StatusBar.hide();
      return;
    }

    await StatusBar.show();
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#f8f6ef" });
    }
  } catch {
    // A interface continua utilizável mesmo se o sistema negar controle da status bar.
  }
}

function installSplashStatusBarSync() {
  if (!Capacitor.isNativePlatform()) return;
  const observer = new MutationObserver(() => { void syncNativeStatusBarWithSplash(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  void syncNativeStatusBarWithSplash();
}

installCompactTypography();
installAvatarFallbacks();
installSplashVisibilityLock();
installSplashStatusBarSync();
