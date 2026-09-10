import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { Beef, ClipboardCheck, Droplets, ScanLine, Settings, Volume2 } from "lucide-react";
import type { AppRoute } from "../../lib/hydra-types";
import "./easy-mode.css";

const EasyContext = createContext({ enabled: false, setEnabled: (_value: boolean) => {} });
export const useEasyMode = () => useContext(EasyContext);

export function EasyModeProvider({ children, accountId }: { children: ReactNode; accountId: string }) {
  const key = `hydra-easy-mode:${accountId}`;
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem(key) === "true"; } catch { return false; } });
  useEffect(() => {
    document.body.classList.toggle("hydra-easy-mode", enabled);
    try { localStorage.setItem(key, String(enabled)); } catch { /* Preference still works in memory. */ }
    return () => { document.body.classList.remove("hydra-easy-mode"); window.speechSynthesis?.cancel(); };
  }, [enabled, key]);
  return <EasyContext.Provider value={{ enabled, setEnabled }}>{children}</EasyContext.Provider>;
}

export function AudioHelp({ text }: { text: string }) {
  const [error, setError] = useState("");
  return <><button type="button" className="easy-audio secondary-button" aria-label={`Ouvir: ${text}`} onClick={() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { setError("Áudio indisponível neste aparelho."); return; }
    setError(""); window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text); speech.lang = "pt-BR"; speech.rate = 0.85;
    speech.onerror = (event) => { if (event.error !== "interrupted" && event.error !== "canceled") setError("Não foi possível reproduzir o áudio."); };
    window.speechSynthesis.speak(speech);
  }}><Volume2 size={22} /></button>{error && <small role="status">{error}</small>}</>;
}

const shortcuts = [
  { route: "herd", title: "Animais", text: "Animais. Veja seus animais ou toque no mais para cadastrar um animal.", icon: Beef },
  { route: "water", title: "Água", text: "Água. Veja de onde vem a água e anote a quantidade usada.", icon: Droplets },
  { route: "activities", title: "Tarefas", text: "Tarefas. Veja o que precisa fazer. Toque no mais para criar uma tarefa.", icon: ClipboardCheck },
  { route: "nfc", title: "Ler tag", text: "Ler tag. Aproxime o celular da identificação do animal para abrir sua ficha. Isso não rastreia o animal.", icon: ScanLine },
  { route: "profile", title: "Configurações", text: "Configurações. Abra o menu do perfil para ligar ou desligar o Modo Fácil.", icon: Settings },
] satisfies { route: AppRoute; title: string; text: string; icon: typeof Beef }[];

export function EasyHome({ navigate }: { navigate: (route: AppRoute) => void }) {
  return <section className="screen easy-home"><h1>O que você quer fazer?</h1><div className="easy-shortcuts">{shortcuts.map(({ route, title, text, icon: Icon }) => <div key={route}><button className="secondary-button" onClick={() => navigate(route)}><Icon size={32} /><strong>{title}</strong></button><AudioHelp text={text} /></div>)}</div></section>;
}

// Keep the original controlled fields and submit handler; only change presentation.
export function GuidedForm({ children, onSubmit, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const { enabled } = useEasyMode();
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLFormElement>(null);
  const nodes = Children.toArray(children);
  const fields = nodes.filter(node => isValidElement<{ className?: string }>(node) && (typeof node.type === "function" || node.props.className === "field-combo"));
  const rest = nodes.filter(node => !fields.includes(node));
  const current = Math.min(step, fields.length);
  useEffect(() => { if (enabled) ref.current?.querySelector<HTMLElement>("[data-easy-step]:not([hidden]) input, [data-easy-step]:not([hidden]) select, [data-easy-step]:not([hidden]) textarea")?.focus(); }, [current, enabled]);
  if (!enabled) return <form {...props} onSubmit={onSubmit}>{children}</form>;
  return <form {...props} ref={ref} onSubmit={event => {
    if (current < fields.length) { event.preventDefault(); setStep(current + 1); } else onSubmit?.(event);
  }}><div className="easy-step-heading"><strong>{current < fields.length ? `Passo ${current + 1} de ${fields.length}` : "Tudo pronto?"}</strong><AudioHelp text={current < fields.length ? "Preencha as informações deste passo. Depois toque em Continuar. Você pode voltar para corrigir." : "Toque em salvar para confirmar. Se quiser corrigir, toque em Voltar."} /></div>
    {fields.map((field, index) => <fieldset key={index} data-easy-step hidden={index !== current} disabled={index !== current}>{field}</fieldset>)}
    {current < fields.length ? <div className="modal-action-row">{current > 0 && <button className="secondary-button" type="button" onClick={() => setStep(current - 1)}>Voltar</button>}<button type="submit" className="primary-button">Continuar</button></div> : <><button className="secondary-button" type="button" onClick={() => setStep(Math.max(0, current - 1))}>Voltar</button>{rest}</>}
  </form>;
}
