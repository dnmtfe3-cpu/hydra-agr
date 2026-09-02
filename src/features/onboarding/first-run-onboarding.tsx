import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Beef, ClipboardCheck, MapPinned, Nfc, Radar, UsersRound, ArrowRight, Layers3 } from "lucide-react";
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
  visual: "welcome" | "management" | "tag";
};

const slides: Slide[] = [
  {
    eyebrow: "Hydra Agro",
    title: "Bem-vindo ao Hydra Agro",
    text: "Gerencie sua propriedade rural de forma simples, organizada e conectada em um só lugar.",
    visual: "welcome",
  },
  {
    eyebrow: "Sua propriedade",
    title: "Tudo que importa, mais perto",
    text: "Acompanhe animais, setores, atividades e monitoramentos sem transformar sua rotina em papelada.",
    visual: "management",
  },
  {
    eyebrow: "Hydra Tag + Comunidade",
    title: "Identifique, acompanhe e compartilhe",
    text: "Use a Hydra Tag para identificar animais e mantenha contato com outros produtores dentro da comunidade.",
    visual: "tag",
  },
];

function WelcomeVisual() {
  return <div className="hydra-onboarding__stage hydra-onboarding__stage--welcome" aria-hidden="true">
    <span className="hydra-onboarding__sun" />
    <div className="hydra-onboarding__welcome-mark"><HydraMark /></div>
    <span className="hydra-onboarding__farm-line" />
    <div className="hydra-onboarding__field-row">{Array.from({ length: 11 }, (_, index) => <span key={index} />)}</div>
  </div>;
}

function ManagementVisual() {
  return <div className="hydra-onboarding__stage hydra-onboarding__stage--management" aria-hidden="true">
    <div className="hydra-onboarding__dashboard">
      <div className="hydra-onboarding__dashboard-head"><strong>Minha propriedade</strong><span><MapPinned size={17} /></span></div>
      <div className="hydra-onboarding__dashboard-hero"><div><strong>Rotina organizada</strong><p>Informações principais em um só lugar</p></div><Radar size={32} /></div>
      <div className="hydra-onboarding__tiles">
        <div className="hydra-onboarding__tile"><Beef size={21} /><span>Animais</span></div>
        <div className="hydra-onboarding__tile"><Layers3 size={21} /><span>Setores</span></div>
        <div className="hydra-onboarding__tile"><ClipboardCheck size={21} /><span>Atividades</span></div>
      </div>
    </div>
  </div>;
}

function TagVisual() {
  return <div className="hydra-onboarding__stage hydra-onboarding__stage--tag" aria-hidden="true">
    <div className="hydra-onboarding__tag-card">
      <div className="hydra-onboarding__tag-top"><span className="hydra-onboarding__tag-icon"><Nfc size={30} /></span><span className="hydra-onboarding__tag-status">IDENTIFICADO</span></div>
      <div className="hydra-onboarding__tag-copy"><strong>Hydra Tag</strong><span>Identificação eletrônica integrada à ficha do animal.</span></div>
    </div>
    <div className="hydra-onboarding__community"><span><UsersRound size={18} /></span><span><Beef size={18} /></span><span><UsersRound size={18} /></span><b>Comunidade Hydra</b></div>
  </div>;
}

function SlideVisual({ visual }: { visual: Slide["visual"] }) {
  if (visual === "management") return <ManagementVisual />;
  if (visual === "tag") return <TagVisual />;
  return <WelcomeVisual />;
}

function FirstRunOnboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const pointerStart = useRef<number | null>(null);

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

  return <main
    className="hydra-onboarding"
    style={{ "--ob-step": step } as React.CSSProperties}
    onPointerDown={onPointerDown}
    onPointerUp={onPointerUp}
    onPointerCancel={() => { pointerStart.current = null; }}
    aria-label="Apresentação do Hydra Agro"
  >
    {step < slides.length - 1 && <button className="hydra-onboarding__skip" type="button" onClick={finish}>Pular</button>}
    <div className="hydra-onboarding__track">
      {slides.map((slide, index) => <section className={`hydra-onboarding__slide ${index === step ? "is-active" : ""}`} key={slide.title} aria-hidden={index !== step}>
        <div className="hydra-onboarding__visual"><SlideVisual visual={slide.visual} /></div>
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
      </section>)}
    </div>
  </main>;
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

  // Usuários que já chegam autenticados são usuários existentes; não interromper o app com onboarding retroativo.
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
