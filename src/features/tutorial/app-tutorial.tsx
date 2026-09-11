import { createPortal } from "react-dom";
import { Check, ChevronRight, CircleHelp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { requireSupabase } from "../../services/supabase";
import "./app-tutorial.css";

type TutorialMode = "owner" | "staff" | "easy";
type TutorialStep = {
  title: string;
  body: string;
  navLabel?: string;
  target?: () => HTMLElement | null;
};

type FocusRect = { top: number; left: number; width: number; height: number };

function findNav(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".bottom-nav button")).find((button) =>
    button.textContent?.trim().toLocaleLowerCase("pt-BR").includes(label.toLocaleLowerCase("pt-BR")),
  ) ?? null;
}

function findEasyShortcut(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".easy-home .easy-shortcuts > div > button")).find((button) =>
    button.textContent?.trim().toLocaleLowerCase("pt-BR").includes(label.toLocaleLowerCase("pt-BR")),
  ) ?? null;
}

function openNav(label: string) {
  const button = findNav(label);
  if (!button || button.getAttribute("aria-current") === "page") return;
  button.click();
}

function detectMode(): TutorialMode {
  if (document.body.classList.contains("hydra-easy-mode") || document.querySelector(".easy-home")) return "easy";
  return findNav("Rebanho") ? "owner" : "staff";
}

function buildSteps(mode: TutorialMode): TutorialStep[] {
  if (mode === "easy") {
    return [
      {
        title: "Aprenda o básico em 1 minuto",
        body: "Vou mostrar onde ficam as funções principais. Você pode sair quando quiser e abrir este tutorial novamente nas Configurações.",
      },
      {
        title: "Tudo começa pelos atalhos",
        body: "No Modo Fácil, cada botão leva direto para uma função. Os textos são maiores e algumas telas também têm ajuda por áudio.",
        target: () => document.querySelector<HTMLElement>(".easy-home .easy-shortcuts"),
      },
      {
        title: "Animais",
        body: "Use Animais para ver o rebanho, consultar fichas e cadastrar novos animais.",
        target: () => findEasyShortcut("Animais"),
      },
      {
        title: "Água, clima e tarefas",
        body: "Esses atalhos ajudam a acompanhar a propriedade sem precisar procurar em vários menus.",
        target: () => document.querySelector<HTMLElement>(".easy-home .easy-shortcuts"),
      },
      {
        title: "Ler tag",
        body: "Aqui você usa a Hydra Tag. A identificação pode funcionar por QR, Hydra ID e NFC/RFID quando o aparelho tiver suporte.",
        target: () => findEasyShortcut("Ler tag"),
      },
      {
        title: "Configurações",
        body: "Aqui você pode alterar o Modo Fácil e abrir este tutorial novamente quando precisar.",
        target: () => findEasyShortcut("Configurações"),
      },
      {
        title: "Pronto",
        body: "Você já conhece o básico do Hydra Agro. Agora pode explorar o aplicativo no seu ritmo.",
      },
    ];
  }

  const managementStep: TutorialStep = mode === "owner"
    ? {
        title: "Rebanho",
        body: "Aqui ficam os animais, fichas, cadastros e informações ligadas ao rebanho.",
        navLabel: "Rebanho",
        target: () => findNav("Rebanho"),
      }
    : {
        title: "Rotina",
        body: "Aqui ficam as operações e tarefas disponíveis para sua função na propriedade.",
        navLabel: "Rotina",
        target: () => findNav("Rotina"),
      };

  return [
    {
      title: "Aprenda o básico em 1 minuto",
      body: "Vou mostrar as partes principais usando as telas reais do Hydra Agro. Você pode pular agora e refazer depois pelo Perfil.",
    },
    {
      title: "Início",
      body: "Esta é a visão rápida da propriedade. Aqui aparecem avisos, resumo do dia e os principais dados.",
      navLabel: "Início",
      target: () => document.querySelector<HTMLElement>(".home-screen .greeting-block") ?? document.querySelector<HTMLElement>(".home-screen"),
    },
    {
      title: "Clima e informações técnicas",
      body: "Toque neste resumo para abrir clima, chuva, conforto dos animais e informações úteis para a propriedade.",
      navLabel: "Início",
      target: () => document.querySelector<HTMLElement>(".home-science-summary"),
    },
    {
      title: "Atalhos do dia a dia",
      body: "Monitoramento, tarefas, assistente e produção ficam aqui para acesso rápido. Em Monitorar você também organiza os setores da propriedade.",
      navLabel: "Início",
      target: () => document.querySelector<HTMLElement>(".home-screen .shortcut-row"),
    },
    managementStep,
    {
      title: "Hydra Tag",
      body: "Use esta área para identificar animais. QR e Hydra ID também podem ser usados sem NFC quando necessário.",
      navLabel: "NFC",
      target: () => findNav("NFC"),
    },
    {
      title: "Perfil e configurações",
      body: "No Perfil ficam sua conta e as configurações. O botão “Tutorial do aplicativo” fica aqui para você rever este guia.",
      navLabel: "Perfil",
      target: () => document.querySelector<HTMLElement>(".profile-screen .profile-menu-card") ?? findNav("Perfil"),
    },
    {
      title: "Pronto",
      body: "Você já conhece o básico do Hydra Agro. O tutorial não bloqueia nenhuma função e pode ser aberto novamente quando quiser.",
    },
  ];
}

function storageKey(userId: string) {
  return `hydra-agro.tutorial.v1:${userId}`;
}

export function AppTutorial() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<TutorialMode>("owner");
  const [userId, setUserId] = useState("");
  const [profileTarget, setProfileTarget] = useState<HTMLElement | null>(null);
  const [easySettingsTarget, setEasySettingsTarget] = useState<HTMLElement | null>(null);
  const [focusRect, setFocusRect] = useState<FocusRect | null>(null);
  const autoStarted = useRef(false);
  const autoTimer = useRef<number | null>(null);
  const steps = useMemo(() => buildSteps(mode), [mode]);

  const startTutorial = useCallback(() => {
    setMode(detectMode());
    setStep(0);
    setOpen(true);
  }, []);

  const finishTutorial = useCallback(() => {
    if (userId) {
      try { window.localStorage.setItem(storageKey(userId), "done"); } catch { /* Local storage may be blocked. */ }
    }
    setOpen(false);
    setStep(0);
    setFocusRect(null);
  }, [userId]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const resolveUser = async () => {
      try {
        const { data } = await requireSupabase().auth.getUser();
        if (active) setUserId(data.user?.id ?? "");
      } catch {
        if (active) setUserId("");
      }
    };

    void resolveUser();
    try {
      const { data } = requireSupabase().auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setUserId(session?.user?.id ?? "");
        if (!session?.user) {
          autoStarted.current = false;
          setOpen(false);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch { /* Preview without backend. */ }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    function refreshTargets() {
      const groups = Array.from(document.querySelectorAll<HTMLElement>(".profile-screen .profile-group"));
      const accountGroup = groups.find((group) => group.querySelector(".group-label")?.textContent?.trim() === "MINHA CONTA");
      const nextProfile = accountGroup?.querySelector<HTMLElement>(".profile-menu-card") ?? null;
      const nextEasy = document.querySelector<HTMLElement>(".easy-settings-screen") ?? null;
      setProfileTarget((current) => current === nextProfile ? current : nextProfile);
      setEasySettingsTarget((current) => current === nextEasy ? current : nextEasy);
    }

    refreshTargets();
    const observer = new MutationObserver(refreshTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!userId || autoStarted.current) return;

    const maybeStart = () => {
      if (autoStarted.current || open) return;
      const appReady = Boolean(document.querySelector(".phone-app .app-content"));
      const tutorialReady = Boolean(document.querySelector(".bottom-nav") || document.querySelector(".easy-home"));
      if (!appReady || !tutorialReady) return;

      try {
        if (window.localStorage.getItem(storageKey(userId)) === "done") {
          autoStarted.current = true;
          return;
        }
      } catch { /* Continue and show the guide when storage is unavailable. */ }

      autoStarted.current = true;
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      autoTimer.current = window.setTimeout(() => {
        autoTimer.current = null;
        startTutorial();
      }, 850);
    };

    maybeStart();
    const observer = new MutationObserver(maybeStart);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
  }, [open, startTutorial, userId]);

  useEffect(() => {
    if (!open) return;
    const current = steps[Math.min(step, steps.length - 1)];
    if (current.navLabel) openNav(current.navLabel);

    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const element = current.target?.() ?? null;
      if (!element) {
        setFocusRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const pad = 7;
      setFocusRect({
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
        height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
      });
    };

    const timers = [0, 160, 380, 760].map((delay) => window.setTimeout(update, delay));
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step, steps]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishTutorial();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [finishTutorial, open]);

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  const focusStyle = focusRect ? ({
    top: focusRect.top,
    left: focusRect.left,
    width: focusRect.width,
    height: focusRect.height,
  } as CSSProperties) : undefined;
  const cardStyle = focusRect
    ? focusRect.top > window.innerHeight * 0.54
      ? ({ bottom: Math.max(18, window.innerHeight - focusRect.top + 18) } as CSSProperties)
      : ({ top: Math.min(window.innerHeight - 250, focusRect.top + focusRect.height + 18) } as CSSProperties)
    : undefined;

  const profileRow = profileTarget ? createPortal(
    <button className="profile-menu-row tutorial-profile-row" onClick={startTutorial}>
      <span className="profile-menu-icon"><CircleHelp size={21} /></span>
      <div><strong>Tutorial do aplicativo</strong><small>Rever como usar o Hydra Agro</small></div>
      <ChevronRight size={19} />
    </button>,
    profileTarget,
  ) : null;

  const easyRow = easySettingsTarget ? createPortal(
    <button className="tutorial-easy-row secondary-button" onClick={startTutorial}>
      <CircleHelp size={22} />
      <span><strong>Tutorial do aplicativo</strong><small>Ver o guia novamente</small></span>
      <ChevronRight size={20} />
    </button>,
    easySettingsTarget,
  ) : null;

  return <>
    {profileRow}
    {easyRow}
    {open && <div className="app-tutorial-layer" role="dialog" aria-modal="true" aria-labelledby="app-tutorial-title">
      {focusRect && <div className="app-tutorial-focus" style={focusStyle} aria-hidden="true" />}
      {!focusRect && <div className="app-tutorial-dim" aria-hidden="true" />}
      <section className={`app-tutorial-card ${focusRect ? "is-guided" : "is-centered"}`} style={cardStyle}>
        <div className="app-tutorial-topline">
          <span>{isLast ? "CONCLUÍDO" : `PASSO ${step + 1} DE ${steps.length}`}</span>
          <button onClick={finishTutorial} aria-label="Fechar tutorial"><X size={20} /></button>
        </div>
        {isLast && <span className="app-tutorial-done"><Check size={23} /></span>}
        <h2 id="app-tutorial-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="app-tutorial-progress" aria-hidden="true">
          {steps.map((_, index) => <i key={index} className={index <= step ? "active" : ""} />)}
        </div>
        <div className="app-tutorial-actions">
          {step === 0 ? <button className="tutorial-skip" onClick={finishTutorial}>Pular</button> : <button className="tutorial-back" onClick={() => setStep((value) => Math.max(0, value - 1))}>Voltar</button>}
          <button className="tutorial-next" onClick={() => isLast ? finishTutorial() : setStep((value) => Math.min(steps.length - 1, value + 1))}>
            {isLast ? "Começar a usar" : step === 0 ? "Começar" : "Próximo"}
            {!isLast && <ChevronRight size={18} />}
          </button>
        </div>
      </section>
    </div>}
  </>;
}
