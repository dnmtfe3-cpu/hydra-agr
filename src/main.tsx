import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
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
import "./auth-landing-ranking-cleanup.css";
import "./auth-email-code.css";
import "./interaction-polish.css";
import "./ios-native-polish.css";
import "./features/profile/profile-mobile-fix.css";
import "./features/profile/profile-ranking-runtime";
import "./features/profile/profile-ranking-spacing-fix.css";
import "./features/profile/level10-vip-runtime";
import "./features/community/community-comment-runtime";
import "./features/admin/admin-screen-polish.css";
import "./mobile-typography-compact.css";
import "./bottom-nav-final-runtime";
import "./admin-panel-runtime";
import "./admin-user-management-polish-runtime";
import "./admin-user-cleanup-runtime";
import "./interaction-motion-runtime";
import "./native-notifications-runtime";
import { HydraAppShell } from "./components/hydra-app-shell";

if (typeof document !== "undefined") {
  const platform = Capacitor.getPlatform();
  document.documentElement.classList.toggle("capacitor-ios", platform === "ios");
  document.documentElement.classList.toggle("capacitor-android", platform === "android");
  document.documentElement.classList.toggle("capacitor-native", Capacitor.isNativePlatform());
}

// Entrada principal do app.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HydraAppShell />
  </React.StrictMode>,
);
