import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import {
  Check,
  ChevronRight,
  FileSpreadsheet,
  Moon,
  Palette,
  Sun,
} from "lucide-react";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/sora/latin-600.css";
import "@fontsource/sora/latin-700.css";
import "@fontsource/sora/latin-800.css";
import "./globals.css";
import "./hydra-dark-mode.css";
import "./hydra-dark-polish.css";
import "./notifications-theme.css";
import "./herd-highlight.css";
import "./herd-weight-history.css";
import "./public-animal.css";
import "./authentic-ui.css";
import "./interaction-polish.css";
import "./features/profile/profile-mobile-fix.css";
import "./features/profile/profile-ranking-runtime";
import "./features/profile/level10-vip-runtime";
import "./features/community/community-comment-runtime";
import HydraApp from "./hydra-app";
import type { HydraAccount } from "./lib/hydra-types";
import { loadAccount } from "./services/hydra-repository";
import { requireSupabase } from "./services/supabase";
import { HydraSpreadsheetPanel } from "./features/spreadsheets/hydra-spreadsheet-panel";

type ThemeMode = "light" | "dark";

const THEME_KEY = "hydra-agro.theme";

function savedTheme(): ThemeMode {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function openDailyBriefingPanelFromNotification() {
  let observer: MutationObserver | null = null;

  const tryOpen = () => {
    const homeButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".bottom-nav button"))
      .find((button) => button.textContent?.trim().includes("Início"));
    if (homeButton && !homeButton.classList.contains("active")) {
      homeButton.click();
      return false;
    }

    const briefingButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("O que fazer hoje"));
    if (!briefingButton) return false;

    briefingButton.click();
    observer?.disconnect();
    observer = null;
    return true;
  };

  if (tryOpen()) return;
  observer = new MutationObserver(() => { void tryOpen(); });
  observer.observe(document.body, { childList: true, subtree: true });
}

function HydraThemeRoot() {
  const [theme, setTheme] = useState<ThemeMode>(savedTheme);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileMenuTarget, setProfileMenuTarget] = useState<HTMLElement | null>(null);
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const [spreadsheetAccount, setSpreadsheetAccount] = useState<HydraAccount | null>(null);
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* armazenamento indisponível */ }
  }, [theme]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    void import("@capacitor/local-notifications").then(async ({ LocalNotifications }) => {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") await LocalNotifications.requestPermissions();
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    void import("@capacitor/local-notifications")
      .then(({ LocalNotifications }) => LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        if (action.notification.extra?.route === "today" && action.notification.extra?.source === "daily-briefing") {
          openDailyBriefingPanelFromNotification();
        }
      }))
      .then((listener) => { handle = listener; });
    return () => { void handle?.remove(); };
  }, []);

  useEffect(() => {
    function findProfileMenu() {
      const groups = Array.from(document.querySelectorAll<HTMLElement>(".profile-screen .profile-group"));
      const accountGroup = groups.find((group) => group.querySelector(".group-label")?.textContent?.trim() === "MINHA CONTA");
      const nextTarget = accountGroup?.querySelector<HTMLElement>(".profile-menu-card") ?? null;
      setProfileMenuTarget((current) => current === nextTarget ? current : nextTarget);
      if (!nextTarget) setAppearanceOpen(false);
    }

    findProfileMenu();
    const observer = new MutationObserver(findProfileMenu);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function chooseTheme(next: ThemeMode) {
    setTheme(next);
    setAppearanceOpen(false);
  }

  async function openSpreadsheet() {
    if (spreadsheetLoading) return;
    setSpreadsheetLoading(true);
    try {
      const client = requireSupabase();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const account = await loadAccount(user);
      setSpreadsheetAccount(account);
      setSpreadsheetOpen(true);
    } catch (error) {
      console.error("[Hydra Agro] Não foi possível abrir a Hydra Planilha:", error);
    } finally {
      setSpreadsheetLoading(false);
    }
  }

  const profileRows = profileMenuTarget ? createPortal(
    <>
      <button className="profile-menu-row profile-spreadsheet-row" onClick={() => void openSpreadsheet()} disabled={spreadsheetLoading}>
        <span className="profile-menu-icon"><FileSpreadsheet size={21} /></span>
        <div><strong>Hydra Planilha</strong><small>{spreadsheetLoading ? "Carregando dados…" : "Exportar dados para Excel ou WhatsApp"}</small></div>
        <ChevronRight size={19} />
      </button>
      <button className="profile-menu-row theme-menu-row" onClick={() => setAppearanceOpen(true)}>
        <span className="profile-menu-icon"><Palette size={21} /></span>
        <div><strong>Aparência</strong><small>{theme === "dark" ? "Modo escuro" : "Modo claro"}</small></div>
        <ChevronRight size={19} />
      </button>
    </>,
    profileMenuTarget,
  ) : null;

  return (
    <div className={`hydra-root theme-${theme}`}>
      <HydraApp />
      {profileRows}

      {spreadsheetAccount && (
        <HydraSpreadsheetPanel account={spreadsheetAccount} open={spreadsheetOpen} onClose={() => setSpreadsheetOpen(false)} />
      )}

      {appearanceOpen && (
        <div className="theme-dialog-backdrop" onMouseDown={() => setAppearanceOpen(false)}>
          <section className="theme-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="theme-dialog-kicker">APARÊNCIA</span>
            <h2 id="theme-dialog-title">Escolher tema</h2>
            <p>Use o visual que ficar mais confortável para você. A escolha fica salva neste aparelho.</p>
            <div className="theme-option-list">
              <button className={`theme-option ${theme === "light" ? "active" : ""}`} onClick={() => chooseTheme("light")}>
                <span><Sun size={21} /></span>
                <div><strong>Claro</strong><small>Visual original do Hydra Agro</small></div>
                {theme === "light" && <Check size={19} />}
              </button>
              <button className={`theme-option ${theme === "dark" ? "active" : ""}`} onClick={() => chooseTheme("dark")}>
                <span><Moon size={21} /></span>
                <div><strong>Escuro</strong><small>Verde profundo com contraste suave</small></div>
                {theme === "dark" && <Check size={19} />}
              </button>
            </div>
            <button className="theme-dialog-close" onClick={() => setAppearanceOpen(false)}>Cancelar</button>
          </section>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HydraThemeRoot />
  </React.StrictMode>,
);
