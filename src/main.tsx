import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
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
import "./auth-email-code.css";
import "./interaction-polish.css";
import "./features/profile/profile-mobile-fix.css";
import "./hydra-agro-visual-system.css";
import "./features/profile/level10-vip-runtime";
import "./features/profile/profile-cover-runtime";
import "./features/community/community-comment-runtime";
import HydraApp from "./hydra-app";
import type { HydraAccount } from "./lib/hydra-types";
import { loadAccount } from "./services/hydra-repository";
import { requireSupabase } from "./services/supabase";
import { HydraSpreadsheetPanel } from "./features/spreadsheets/hydra-spreadsheet-panel";
import "./dribbble-agriculture-reference.css";
import "./dribbble-agriculture-fidelity.css";
import "./hydra-identity-final.css";
import "./hydra-reference-all-screens.css";
import "./hydra-final-functional-polish.css";
import "./home-quick-neutral-icons.css";
import "./features/profile/profile-final-polish.css";
import "./bottom-nav-dribbble-reference.css";
import "./hydra-green-sync-final.css";
import "./hydra-motion-nav-final.css";

type ThemeMode = "light" | "dark";
const THEME_KEY = "hydra-agro.theme";
function savedTheme(): ThemeMode { try { return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; } }

function openDailyBriefingPanelFromNotification() {
  let observer: MutationObserver | null = null;
  const tryOpen = () => {
    const notificationButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.getAttribute("aria-label") === "Notificações");
    const briefingButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("O que fazer hoje"));
    if (!briefingButton && notificationButton) { notificationButton.click(); return false; }
    if (!briefingButton) return false;
    briefingButton.click(); observer?.disconnect(); observer = null; return true;
  };
  if (tryOpen()) return;
  observer = new MutationObserver(() => { void tryOpen(); });
  observer.observe(document.body, { childList: true, subtree: true });
}

function openNotificationsScreen() {
  window.focus();
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.getAttribute("aria-label") === "Notificações");
  button?.click();
}

function HydraThemeRoot() {
  const [theme] = useState<ThemeMode>(savedTheme);
  const [profileMenuTarget, setProfileMenuTarget] = useState<HTMLElement | null>(null);
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const [spreadsheetAccount, setSpreadsheetAccount] = useState<HydraAccount | null>(null);
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);

  useEffect(() => { try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* armazenamento indisponível */ } }, [theme]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || typeof window === "undefined" || !("Notification" in window)) return;
    const client = requireSupabase();
    let channel: ReturnType<typeof client.channel> | null = null;
    let active = true;
    const subscribeForUser = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!active || !user) return;
      channel = client.channel(`hydra-web-system-notifications-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` }, (payload) => {
        if (Notification.permission !== "granted") return;
        const row = payload.new as { title?: string; body?: string; id?: string };
        const notification = new Notification(row.title || "Hydra Agro", { body: row.body || "Você recebeu um novo aviso.", tag: row.id || undefined, icon: "/icons/icon-192.png" });
        notification.onclick = () => { notification.close(); openNotificationsScreen(); };
      }).subscribe();
    };
    void subscribeForUser();
    return () => { active = false; if (channel) void client.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    void import("@capacitor/local-notifications").then(async ({ LocalNotifications }) => { const permission = await LocalNotifications.checkPermissions(); if (permission.display !== "granted") await LocalNotifications.requestPermissions(); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    void import("@capacitor/local-notifications").then(({ LocalNotifications }) => LocalNotifications.addListener("localNotificationActionPerformed", (action) => { if (action.notification.extra?.route === "today" && action.notification.extra?.source === "daily-briefing") openDailyBriefingPanelFromNotification(); })).then((listener) => { handle = listener; });
    return () => { void handle?.remove(); };
  }, []);

  useEffect(() => {
    function findProfileMenu() {
      const groups = Array.from(document.querySelectorAll<HTMLElement>(".profile-screen .profile-group"));
      const accountGroup = groups.find((group) => group.querySelector(".group-label")?.textContent?.trim() === "MINHA CONTA");
      const nextTarget = accountGroup?.querySelector<HTMLElement>(".profile-menu-card") ?? null;
      setProfileMenuTarget((current) => current === nextTarget ? current : nextTarget);
    }
    findProfileMenu();
    const observer = new MutationObserver(findProfileMenu);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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
    <button className="profile-menu-row profile-spreadsheet-row" onClick={() => void openSpreadsheet()} disabled={spreadsheetLoading}>
      <span className="profile-menu-icon"><FileSpreadsheet size={21} /></span>
      <div><strong>Hydra Planilha</strong><small>{spreadsheetLoading ? "Carregando dados…" : "Exportar dados para Excel ou WhatsApp"}</small></div>
      <ChevronRight size={19} />
    </button>, profileMenuTarget) : null;

  return <div className={`hydra-root theme-${theme}`}><HydraApp />{profileRows}{spreadsheetAccount && <HydraSpreadsheetPanel account={spreadsheetAccount} open={spreadsheetOpen} onClose={() => setSpreadsheetOpen(false)} />}</div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><HydraThemeRoot /></React.StrictMode>);
