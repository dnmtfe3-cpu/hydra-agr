import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactDOM from "react-dom/client";
import {
  Beef as Cow,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Droplets,
  Moon,
  Palette,
  Presentation,
  RadioTower,
  ScanLine,
  Sun,
} from "lucide-react";
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
import "./demo-mode.css";
import "./project-results.css";
import "./public-animal.css";
import "./authentic-ui.css";
import "./features/profile/profile-ranking-runtime";
import HydraApp from "./hydra-app";
import { ProjectResultsPanel } from "./features/demo/project-results-panel";
import { supabase } from "./services/supabase";

type ThemeMode = "light" | "dark";
type DemoReadiness = {
  loading: boolean;
  error?: string;
  animals: number;
  identifiedAnimals: number;
  weightedAnimals: number;
  waterRecords: number;
  activities: number;
  monitoring: number;
};

const THEME_KEY = "hydra-agro.theme";
const DEMO_ACCOUNT_EMAIL = "projeto2026@gmail.com";
const EMPTY_DEMO_READINESS: DemoReadiness = { loading: false, animals: 0, identifiedAnimals: 0, weightedAnimals: 0, waterRecords: 0, activities: 0, monitoring: 0 };

function savedTheme(): ThemeMode {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function HydraThemeRoot() {
  const [theme, setTheme] = useState<ThemeMode>(savedTheme);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [signedInUserId, setSignedInUserId] = useState("");
  const [demoReadiness, setDemoReadiness] = useState<DemoReadiness>(EMPTY_DEMO_READINESS);
  const [profileMenuTarget, setProfileMenuTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* armazenamento indisponível */ }
  }, [theme]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedInEmail(data.session?.user.email ?? "");
      setSignedInUserId(data.session?.user.id ?? "");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedInEmail(session?.user.email ?? "");
      setSignedInUserId(session?.user.id ?? "");
      if (!session) setDemoReadiness(EMPTY_DEMO_READINESS);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function findProfileMenu() {
      const groups = Array.from(document.querySelectorAll<HTMLElement>(".profile-screen .profile-group"));
      const accountGroup = groups.find((group) => group.querySelector(".group-label")?.textContent?.trim() === "MINHA CONTA");
      const nextTarget = accountGroup?.querySelector<HTMLElement>(".profile-menu-card") ?? null;
      setProfileMenuTarget((current) => current === nextTarget ? current : nextTarget);
      if (!nextTarget) {
        setAppearanceOpen(false);
        setDemoOpen(false);
      }
    }

    findProfileMenu();
    const observer = new MutationObserver(findProfileMenu);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function chooseTheme(next: ThemeMode) {
    setTheme(next);
    setAppearanceOpen(false);
  }

  function openProfileDestination(title: string) {
    setDemoOpen(false);
    window.setTimeout(() => {
      const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".profile-screen .profile-menu-row"));
      const target = rows.find((row) => row.querySelector("strong")?.textContent?.trim() === title);
      target?.click();
    }, 180);
  }

  function openBottomTab(label: string) {
    setDemoOpen(false);
    window.setTimeout(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".bottom-nav button"));
      const target = buttons.find((button) => button.querySelector("small")?.textContent?.trim() === label);
      target?.click();
    }, 180);
  }

  async function refreshDemoReadiness() {
    const client = supabase;
    if (!client || !signedInUserId) return;
    setDemoReadiness((current) => ({ ...current, loading: true, error: undefined }));
    const [animalsResult, waterResult, activitiesResult, monitoringResult] = await Promise.all([
      client.from("animals").select("id,electronic_id,weight").eq("owner_user_id", signedInUserId),
      client.from("water_records").select("id").eq("owner_user_id", signedInUserId),
      client.from("activities").select("id").eq("owner_user_id", signedInUserId),
      client.from("monitoring_records").select("id").eq("owner_user_id", signedInUserId),
    ]);
    const failure = animalsResult.error || waterResult.error || activitiesResult.error || monitoringResult.error;
    if (failure) {
      setDemoReadiness((current) => ({ ...current, loading: false, error: "Não foi possível verificar todos os dados agora." }));
      return;
    }
    const animals = (animalsResult.data ?? []) as Array<{ electronic_id?: string | null; weight?: number | null }>;
    setDemoReadiness({
      loading: false,
      animals: animals.length,
      identifiedAnimals: animals.filter((item) => Boolean(item.electronic_id)).length,
      weightedAnimals: animals.filter((item) => Number(item.weight ?? 0) > 0).length,
      waterRecords: waterResult.data?.length ?? 0,
      activities: activitiesResult.data?.length ?? 0,
      monitoring: monitoringResult.data?.length ?? 0,
    });
  }

  const demoEnabled = signedInEmail.trim().toLowerCase() === DEMO_ACCOUNT_EMAIL;
  const demoChecks = [
    { label: "Animal cadastrado", detail: `${demoReadiness.animals} no rebanho`, ready: demoReadiness.animals > 0 },
    { label: "Etiqueta NFC vinculada", detail: `${demoReadiness.identifiedAnimals} identificado(s)`, ready: demoReadiness.identifiedAnimals > 0 },
    { label: "Pesagem pronta", detail: `${demoReadiness.weightedAnimals} com peso registrado`, ready: demoReadiness.weightedAnimals > 0 },
    { label: "Água registrada", detail: `${demoReadiness.waterRecords} registro(s)`, ready: demoReadiness.waterRecords > 0 },
    { label: "Atividade cadastrada", detail: `${demoReadiness.activities} atividade(s)`, ready: demoReadiness.activities > 0 },
    { label: "Monitoramento registrado", detail: `${demoReadiness.monitoring} registro(s)`, ready: demoReadiness.monitoring > 0 },
  ];
  const demoReadyCount = demoChecks.filter((item) => item.ready).length;

  const demoRow = profileMenuTarget && demoEnabled ? createPortal(
    <button className="profile-menu-row demo-menu-row" onClick={() => { setDemoOpen(true); void refreshDemoReadiness(); }}>
      <span className="profile-menu-icon"><Presentation size={21} /></span>
      <div><strong>Modo demonstração</strong><small>Roteiro rápido para a feira de ciências</small></div>
      <span className="demo-menu-badge">FEIRA</span>
      <ChevronRight size={19} />
    </button>,
    profileMenuTarget,
  ) : null;

  const appearanceRow = profileMenuTarget ? createPortal(
    <button className="profile-menu-row theme-menu-row" onClick={() => setAppearanceOpen(true)}>
      <span className="profile-menu-icon"><Palette size={21} /></span>
      <div><strong>Aparência</strong><small>{theme === "dark" ? "Modo escuro" : "Modo claro"}</small></div>
      <ChevronRight size={19} />
    </button>,
    profileMenuTarget,
  ) : null;

  return (
    <div className={`hydra-root theme-${theme}`}>
      <HydraApp />
      {demoRow}
      {appearanceRow}

      {demoOpen && demoEnabled && (
        <div className="demo-dialog-backdrop" onMouseDown={() => setDemoOpen(false)}>
          <section className="demo-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="demo-dialog-hero">
              <span className="demo-kicker"><Presentation size={15} /> FEIRA DE CIÊNCIAS</span>
              <h2 id="demo-dialog-title">Modo demonstração</h2>
              <p>Um roteiro curto para apresentar o Hydra Agro começando pela identificação real do animal com NFC.</p>
            </div>

            <div className="demo-readiness-card">
              <header><div><span>CHECKLIST DA APRESENTAÇÃO</span><strong>{demoReadiness.loading ? "Verificando dados…" : `${demoReadyCount}/${demoChecks.length} itens prontos`}</strong></div><button onClick={() => void refreshDemoReadiness()} disabled={demoReadiness.loading}>Atualizar</button></header>
              <div className="demo-check-grid">{demoChecks.map((item) => <div key={item.label} className={item.ready ? "ready" : ""}>{item.ready ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span><strong>{item.label}</strong><small>{item.detail}</small></span></div>)}</div>
              {demoReadiness.error && <p className="demo-readiness-error">{demoReadiness.error}</p>}
            </div>

            <ProjectResultsPanel userId={signedInUserId} />

            <div className="demo-guide-title"><strong>Roteiro de aproximadamente 1 minuto</strong><span>5 etapas</span></div>
            <div className="demo-step-list">
              <div className="demo-step"><span><ScanLine size={20} /></span><div><strong>1. Identifique pelo NFC</strong><small>Encoste a etiqueta no aparelho e mostre que o animal é encontrado pelo código eletrônico.</small></div></div>
              <div className="demo-step"><span><Cow size={20} /></span><div><strong>2. Abra o animal</strong><small>Mostre identificação, pesagem, gráfico e linha do tempo do rebanho.</small></div></div>
              <div className="demo-step"><span><ClipboardCheck size={20} /></span><div><strong>3. Mostre a rotina</strong><small>Explique alimentação, manejo, atividades e ocorrências registradas.</small></div></div>
              <div className="demo-step"><span><Droplets size={20} /></span><div><strong>4. Conecte com sustentabilidade</strong><small>Abra a área de Água e mostre como a propriedade acompanha os registros de consumo.</small></div></div>
              <div className="demo-step"><span><RadioTower size={20} /></span><div><strong>5. Feche com gestão</strong><small>Mostre monitoramentos, relatórios e como o proprietário acompanha a operação.</small></div></div>
            </div>

            <p className="demo-tip">Este modo não cria informações falsas nem altera os dados da propriedade. Para a demonstração NFC funcionar, vincule a etiqueta comprada a um animal na Central NFC/RFID.</p>

            <div className="demo-actions">
              <button className="demo-start-button" onClick={() => openProfileDestination("Central NFC/RFID")}><ScanLine size={18} /> Iniciar demonstração NFC</button>
              <button className="demo-secondary-button" onClick={() => openBottomTab("Rebanho")}><Cow size={18} /> Abrir Rebanho</button>
              <button className="demo-close-button" onClick={() => setDemoOpen(false)}>Fechar</button>
            </div>
          </section>
        </div>
      )}

      {appearanceOpen && (
        <div className="theme-dialog-backdrop" onMouseDown={() => setAppearanceOpen(false)}>
          <section className="theme-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="theme-dialog-kicker">APARÊNCIA</span>
            <h2 id="theme-dialog-title">Escolher tema</h2>
            <p>Use o visual que ficar mais confortável para você. A escolha fica salva neste aparelho.</p>
            <div className="theme-option-list">
              <button className={`theme-option ${theme === "light" ? "active" : ""}`} onClick={() => chooseTheme("light")}>
                <span><Sun size={21} /></span>
                <div><strong>Claro</strong><small>Visual original do Hydra Agro</small></div>
                {theme === "light" && <Check size={19} />}
              </button>
              <button className={`theme-option ${theme === "dark" ? "active" : ""}`} onClick={() => chooseTheme("dark")}>
                <span><Moon size={21} /></span>
                <div><strong>Escuro</strong><small>Verde profundo com contraste suave</small></div>
                {theme === "dark" && <Check size={19} />}
              </button>
            </div>
            <button className="theme-dialog-close" onClick={() => setAppearanceOpen(false)}>Cancelar</button>
          </section>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HydraThemeRoot />
  </React.StrictMode>,
);
