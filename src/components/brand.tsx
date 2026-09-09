import { useEffect, useRef, useState } from "react";
import splashLogo from "../../splash-reference/hydra-splash-logo.png";
import "./splash-stability.css";
import "./splash-animation-fix.css";

export function HydraMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="18" fill="#174c36" />
      <path
        d="M17 35c0-10 7-18 15-24 0 14 8 18 8 29 0 8-5 14-12 14-6 0-11-4-11-10 0-5 3-9 8-13-1 7 1 12 6 15"
        fill="#f49a31"
      />
      <path
        d="M39 14c8 2 12 8 10 17-7-1-12-5-13-12 4 4 7 6 11 7"
        fill="#83ba5b"
      />
      <path
        d="M23 46c4 4 11 4 16-1"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".9"
      />
    </svg>
  );
}

export function HydraWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`wordmark ${compact ? "wordmark-compact" : ""}`}>
      <HydraMark className="wordmark-mark" />
      <div className="wordmark-copy" aria-label="Hydra Agro">
        <span>Hydra</span>
        <strong>Agro</strong>
      </div>
    </div>
  );
}

export function SplashBrand() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const screen = rootRef.current?.closest(".splash-screen") as HTMLElement | null;
    if (!screen) return;

    screen.dataset.phase = ready ? "entering" : "loading";
    if (!ready) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (screen.isConnected) screen.dataset.phase = "exiting";
    }, reduced ? 150 : 1250);

    return () => window.clearTimeout(timer);
  }, [ready]);

  return (
    <div ref={rootRef} className="splash-brand hydra-launch__center" role="status" aria-label="Abrindo Hydra Agro">
      <img
        className="hydra-launch__mark"
        src={splashLogo}
        alt=""
        aria-hidden="true"
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
      />
    </div>
  );
}
