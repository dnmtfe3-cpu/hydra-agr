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
import "./seo-runtime";
import "./auth-no-carousel.css";
import "./hydra-dark-final.css";
import "./auth-landing-native.css";
import "./auth-signup-native.css";
import "./ui-premium-polish.css";
import "./native-screen-cleanup.css";
import "./auth-green-identity.css";
import "./auth-reference.css";
import "./desktop-phone-frame.css";
import "./maintenance-runtime";
import { HydraAppShell } from "./components/hydra-app-shell";
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
const preview = path === "/preview/ios/splash" ? null : renderIosPreviewRoute(path);
const desktopPhoneMode =
  typeof window !== "undefined" &&
  !Capacitor.isNativePlatform() &&
  window.innerWidth >= 1024 &&
  !path.startsWith("/preview/");

function DesktopPhonePresentation() {
  const mobileUrl = typeof window !== "undefined" ? window.location.href : "/";

  return (
    <main className="desktop-phone-stage" aria-label="Hydra Agro em visualização móvel">
      <aside className="desktop-phone-copy" aria-label="Informações da demonstração">
        <span className="desktop-phone-kicker">Demonstração exclusiva</span>
        <h1>Feira de Ciências</h1>
        <p className="desktop-phone-intro">
          Esta visualização foi preparada especialmente para apresentar o Hydra Agro em um computador durante a feira.
        </p>

        <div className="desktop-phone-info-list">
          <div>
            <strong>Aplicativo</strong>
            <span>Desenvolvido para uso em celulares.</span>
          </div>
          <div>
            <strong>Versão web</strong>
            <span>Disponível pelo navegador em hydraagro.sbs.</span>
          </div>
          <div>
            <strong>APK e IPA</strong>
            <span>Solicite gratuitamente ao responsável pelo projeto.</span>
          </div>
        </div>
      </aside>

      <div className="desktop-phone-device">
        <span className="desktop-phone-side-button desktop-phone-side-button-left" aria-hidden="true" />
        <span className="desktop-phone-side-button desktop-phone-side-button-right" aria-hidden="true" />
        <div className="desktop-phone-screen">
          <span className="desktop-phone-island" aria-hidden="true" />
          <iframe
            className="desktop-phone-iframe"
            src={mobileUrl}
            title="Hydra Agro — versão mobile"
            allow="clipboard-read; clipboard-write; camera; microphone"
          />
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {preview ?? (desktopPhoneMode ? <DesktopPhonePresentation /> : <HydraAppShell />)}
  </React.StrictMode>,
);
