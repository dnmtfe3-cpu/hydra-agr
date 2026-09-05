import React from "react";

const green = "#0f3727";

function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: "#e9ece8", display: "grid", placeItems: "center", padding: 24, fontFamily: "Manrope, sans-serif" }}>
      <section style={{ width: "min(390px, 100%)" }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#173a2b", fontSize: 13, fontWeight: 700 }}>
          <span>Hydra Agro · iOS preview</span>
          <a href="/" style={{ color: "inherit", textDecoration: "none", opacity: .72 }}>sair</a>
        </div>
        <div style={{ position: "relative", width: "100%", aspectRatio: "390 / 844", borderRadius: 48, overflow: "hidden", background: "#000", boxShadow: "0 24px 70px rgba(18,44,32,.22)", border: "8px solid #111" }}>
          <div style={{ position: "absolute", zIndex: 3, top: 10, left: "50%", transform: "translateX(-50%)", width: 112, height: 30, borderRadius: 20, background: "#090909", pointerEvents: "none" }} />
          {children}
        </div>
      </section>
    </main>
  );
}

export function IosAppPreview() {
  return (
    <DeviceFrame>
      <iframe title="Hydra Agro iOS" src="/?ios-preview=1" style={{ width: "100%", height: "100%", border: 0, display: "block", background: "#fff" }} />
    </DeviceFrame>
  );
}

export function IosSplashPreview() {
  return (
    <DeviceFrame>
      <div style={{ width: "100%", height: "100%", background: green, display: "grid", placeItems: "center" }}>
        <img src="/icon-512.png" alt="Hydra Agro" style={{ width: 120, height: 120, objectFit: "contain", display: "block" }} />
      </div>
    </DeviceFrame>
  );
}

export function renderIosPreviewRoute(pathname: string) {
  if (pathname === "/preview/ios/splash") return <IosSplashPreview />;
  if (pathname === "/preview/ios") return <IosAppPreview />;
  return null;
}
