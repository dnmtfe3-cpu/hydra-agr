import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ArrowRight } from "lucide-react";
import { HydraMark } from "../../components/brand";
import "./first-run-onboarding.css";

const ONBOARDING_KEY = "hydra-agro.onboarding.v1";

function hasCompletedOnboarding() {
  try { return window.localStorage.getItem(ONBOARDING_KEY) === "1"; }
  catch { return false; }
}

function persistOnboarding() {
  try { window.localStorage.setItem(ONBOARDING_KEY, "1"); }
  catch { /* armazenamento indisponível */ }
}

type Slide = {
  eyebrow: string;
  title: string;
  text: string;
  visual: "home" | "quick" | "community";
  caption: string;
};

const slides: Slide[] = [
  {
    eyebrow: "Hydra Agro",
    title: "Sua propriedade, mais simples de acompanhar",
    text: "Veja clima, destaques e o que precisa da sua atenção logo ao abrir o aplicativo.",
    visual: "home",
    caption: "Início do Hydra Agro",
  },
  {
    eyebrow: "Rotina organizada",
    title: "Registre o que acontece sem perder tempo",
    text: "Animais, atividades, setores, equipe e Hydra Tag ficam acessíveis em poucos toques.",
    visual: "quick",
    caption: "Ações rápidas do app",
  },
  {
    eyebrow: "Conectado à sua rotina",
    title: "Hydra Tag e comunidade no mesmo lugar",
    text: "Identifique animais, consulte informações e acompanhe a comunidade dentro do Hydra Agro.",
    visual: "community",
    caption: "Comunidade Hydra",
  },
];

function SlideVisual({ slide }: { slide: Slide }) {
  return (
    <div className={`hydra-onboarding__stage hydra-onboarding__stage--shot hydra-onboarding__stage--${slide.visual}`} aria-hidden="true">
      <div className="hydra-onboarding__shot-frame" />
      <div className="hydra-onboarding__shot-label"><HydraMark /><span>{slide.caption}</span></div>
    </div>
  );
}

function FirstRunOnboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const slide = slides[step];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  function finish() {
    persistOnboarding();
    onFinish();
  }

  function next() {
    if (step >= slides.length - 1) { finish(); return; }
    setStep((current) => Math.min(slides.length - 1, current + 1));
  }

  function previous() {
    setStep((current) => Math.max(0, current - 1));
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    pointerStart.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (pointerStart.current == null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) next(); else previous();
  }

  return (
    <main
      className="hydra-onboarding"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointerStart.current = null; }}
      aria-label="Apresentação do Hydra Agro"
    >
      {step < slides.length - 1 && <button className="hydra-onboarding__skip" type="button" onClick={finish}>Pular</button>}
      <div className="hydra-onboarding__track">
        <section className="hydra-onboarding__slide" key={slide.title}>
          <div className="hydra-onboarding__visual"><SlideVisual slide={slide} /></div>
          <div className="hydra-onboarding__content">
            <div className="hydra-onboarding__eyebrow">{slide.eyebrow}</div>
            <h1>{slide.title}</h1>
            <p>{slide.text}</p>
            <div className="hydra-onboarding__bottom">
              <div className="hydra-onboarding__pager" aria-label={`Etapa ${step + 1} de ${slides.length}`}>
                {slides.map((_, dot) => <button key={dot} className={dot === step ? "is-active" : ""} type="button" onClick={() => setStep(dot)} aria-label={`Ir para etapa ${dot + 1}`} />)}
              </div>
              <button className="hydra-onboarding__next" type="button" onClick={next}>{step === slides.length - 1 ? "Começar" : "Continuar"}<ArrowRight size={18} /></button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let scheduled = false;

function destroyOnboarding() {
  const currentRoot = root;
  const currentHost = host;
  root = null;
  host = null;
  window.setTimeout(() => {
    currentRoot?.unmount();
    currentHost?.remove();
  }, 0);
}

function syncFirstRunOnboarding() {
  scheduled = false;
  const authVisible = Boolean(document.querySelector(".auth-shell, .auth-landing"));
  const signedInAppVisible = Boolean(document.querySelector(".phone-app .bottom-nav, .phone-app .home-screen, .phone-app .staff-home-screen"));

  if (signedInAppVisible && !authVisible && !hasCompletedOnboarding()) persistOnboarding();

  if (!authVisible || hasCompletedOnboarding()) {
    if (root || host) destroyOnboarding();
    return;
  }

  if (root || host) return;
  host = document.createElement("div");
  host.id = "hydra-first-run-onboarding";
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(<FirstRunOnboarding onFinish={destroyOnboarding} />);
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(syncFirstRunOnboarding);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const start = () => {
    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
