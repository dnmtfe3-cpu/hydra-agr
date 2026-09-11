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
import "./features/nfc/remote-tag-scanner-runtime";
import "./features/tutorial/app-tutorial-runtime";
import "./mobile-typography-compact.css";
import "./bottom-nav-final-runtime";
import "./admin-panel-runtime";
import "./admin-user-management-polish-runtime";
import "./admin-user-cleanup-runtime";
import "./interaction-motion-runtime";
import "./native-notifications-runtime";
import "./seo-runtime";
import "./auth-no-carousel.css";
import "./hydra-dark-final.css";
import "./auth-landing-native.css";
import "./auth-signup-native.css";
import "./ui-premium-polish.css";
import "./native-screen-cleanup.css";
import "./auth-green-identity.css";
import "./auth-reference.css";
import "./product-finish.css";
import "./desktop-layout.css";
import "./desktop-bottom-bar.css";
import "./desktop-organized-polish.css";
import "./desktop-mobile-like-final.css";
import "./desktop-screenshot-polish.css";
import "./maintenance-runtime";
import { HydraAppShell } from "./components/hydra-app-shell";
import { PublicTagLookup } from "./features/herd/public-tag-lookup";
import { setupPushNotifications } from "./services/push-notifications";
import { renderIosPreviewRoute } from "./ios-preview";

if (typeof document !== "undefined") {
  const platform = Capacitor.getPlatform();
  document.documentElement.classList.toggle("capacitor-ios", platform === "ios");
  document.documentElement.classList.toggle("capacitor-android", platform === "android");
  document.documentElement.classList.toggle("capacitor-native", Capacitor.isNativePlatform());
  if (Capacitor.isNativePlatform()) void setupPushNotifications();
}

const path = typeof window !== "undefined" ? window.location.pathname : "";
const publicTagMode = path === "/tag" || path.startsWith("/tag/");
const publicAnimalQuery =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pa") === "1";
const standalonePublicMode = publicTagMode || publicAnimalQuery;
const preview = path === "/preview/ios/splash" ? null : renderIosPreviewRoute(path);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {preview ?? (standalonePublicMode ? <PublicTagLookup /> : <HydraAppShell />)}
  </React.StrictMode>,
);
