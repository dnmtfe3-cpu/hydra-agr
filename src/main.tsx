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
import "./product-finish.css";
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
      <aside className="desktop-phone-side-copy desktop-phone-side-copy-left" aria-label="Informações da demonstração">
        <span className="desktop-phone-kicker">Demonstração exclusiva</span>
        <h1><span>Feira de</span> Ciências</h1>
        <p>
          Esta versão foi preparada especialmente para demonstrar o Hydra Agro em computador durante a Feira de Ciências.
        </p>
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

      <aside className="desktop-phone-side-copy desktop-phone-side-copy-right" aria-label="Disponibilidade do Hydra Agro">
        <div className="desktop-phone-side-item">
          <strong>Teste ao vivo</strong>
          <span>Use o mouse do Chromebook para navegar e testar o Hydra Agro.</span>
        </div>
        <div className="desktop-phone-side-item">
          <strong>Aplicativo mobile</strong>
          <span>O aplicativo completo foi desenvolvido para celulares.</span>
        </div>
        <div className="desktop-phone-side-item">
          <strong>Versão web</strong>
          <span>Acesse pelo navegador em hydraagro.sbs.</span>
        </div>
        <div className="desktop-phone-side-item">
          <strong>APK e IPA</strong>
          <span>Solicite gratuitamente os arquivos de instalação ao responsável pelo Hydra Agro.</span>
        </div>
      </aside>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {preview ?? (desktopPhoneMode ? <DesktopPhonePresentation /> : <HydraAppShell />)}
  </React.StrictMode>,
);
