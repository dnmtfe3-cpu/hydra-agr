import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { ArrowLeft, Beef, ChevronRight, ClipboardCheck, CloudSun, Droplets, MessageCircle, Mic, ScanLine, Settings, Volume2 } from "lucide-react";
import type { AppRoute } from "../../lib/hydra-types";
import "./easy-mode.css";

const EasyContext = createContext({ enabled: false, setEnabled: (_value: boolean) => {} });
export const useEasyMode = () => useContext(EasyContext);

export function StandardNavigation({ children }: { children: ReactNode }) {
  const { enabled } = useEasyMode();
  return enabled ? null : <>{children}</>;
}

export function EasyRoute({ route, onHome, settings, children }: { route: AppRoute; onHome: () => void; settings: ReactNode; children: ReactNode }) {
  const { enabled } = useEasyMode();
  if (!enabled || route === "home") return <>{children}</>;
  return <div className="easy-route"><div className="easy-route-back"><button className="secondary-button" onClick={onHome}><ArrowLeft size={20} /> Voltar aos atalhos</button></div>{route === "profile" ? <section className="screen easy-settings-screen"><h1>Configurações</h1>{settings}</section> : children}</div>;
}

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

function speak(text: string, rate = 0.82) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return null;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "pt-BR";
  speech.rate = rate;
  window.speechSynthesis.speak(speech);
  return speech;
}

export function AudioHelp({ text }: { text: string }) {
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  return <><button type="button" className={`easy-audio secondary-button ${speaking ? "is-speaking" : ""}`} aria-label={speaking ? "Parar áudio" : `Ouvir: ${text}`} onClick={() => {
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { setError("Áudio indisponível neste aparelho."); return; }
    setError("");
    const speech = speak(text);
    if (!speech) return;
    setSpeaking(true);
    speech.onend = () => setSpeaking(false);
    speech.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== "interrupted" && event.error !== "canceled") setError("Não foi possível reproduzir o áudio.");
    };
  }}><Volume2 size={22} /></button>{error && <small className="easy-assist-error" role="status">{error}</small>}</>;
}

type VoiceAlternative = { transcript: string };
type VoiceResult = { [index: number]: VoiceAlternative; length: number };
type VoiceResultEvent = { results: { [index: number]: VoiceResult; length: number } };
type VoiceErrorEvent = { error?: string };
type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: VoiceResultEvent) => void) | null;
  onerror: ((event: VoiceErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type VoiceRecognitionConstructor = new () => VoiceRecognition;
type VoiceWindow = Window & {
  SpeechRecognition?: VoiceRecognitionConstructor;
  webkitSpeechRecognition?: VoiceRecognitionConstructor;
};

type DictationTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function normalizeVoiceText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function setNativeValue(target: DictationTarget, value: string) {
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : target instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(target, value);
  else target.value = value;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  target.focus();
}

function findDictationTarget(button: HTMLButtonElement) {
  const container = button.closest(".easy-field");
  if (!container) return null;
  const candidates = Array.from(container.querySelectorAll<DictationTarget>("input, textarea, select"));
  return candidates.find((target) => {
    if (target.disabled) return false;
    if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return true;
    if (target.readOnly) return false;
    return ["text", "search", "tel", "number"].includes(target.type || "text");
  }) || null;
}

function applyTranscript(target: DictationTarget, transcript: string) {
  if (target instanceof HTMLSelectElement) {
    const said = normalizeVoiceText(transcript);
    const options = Array.from(target.options);
    const match = options.find((option) => {
      const optionText = normalizeVoiceText(option.textContent || option.label || option.value);
      return optionText === said || optionText.includes(said) || said.includes(optionText);
    });
    if (!match) return { ok: false, value: transcript };
    setNativeValue(target, match.value);
    return { ok: true, value: match.textContent || match.label || match.value };
  }

  if (target instanceof HTMLInputElement && target.type === "number") {
    const numeric = transcript.replace(/[^0-9,.-]/g, "").replace(",", ".");
    if (!numeric || !/[0-9]/.test(numeric)) return { ok: false, value: transcript };
    setNativeValue(target, numeric);
    return { ok: true, value: numeric };
  }

  const cleaned = transcript.trim();
  if (!cleaned) return { ok: false, value: transcript };
  setNativeValue(target, cleaned);
  return { ok: true, value: cleaned };
}

export function VoiceDictationButton({ label }: { label: string }) {
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return <><button type="button" className={`easy-dictation secondary-button ${listening ? "is-listening" : ""}`} aria-label={listening ? `Ouvindo ${label}` : `Falar para preencher ${label}`} onClick={(event) => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const target = findDictationTarget(event.currentTarget);
    if (!target) {
      setError("Este campo não aceita ditado por voz.");
      speak("Este campo não aceita ditado por voz.");
      return;
    }

    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Ditado por voz não disponível neste aparelho.");
      speak("O ditado por voz não está disponível neste aparelho.");
      return;
    }

    window.speechSynthesis?.cancel();
    setError("");
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (resultEvent) => {
      const transcript = resultEvent.results[0]?.[0]?.transcript?.trim() || "";
      const result = applyTranscript(target, transcript);
      if (!result.ok) {
        const message = target instanceof HTMLSelectElement ? "Não encontrei essa opção. Fale uma das opções mostradas na tela." : "Não entendi esse valor. Toque no microfone e fale de novo.";
        setError(message);
        speak(message);
        return;
      }
      setError("");
      speak(`Eu entendi: ${result.value}. Se estiver errado, toque no microfone e fale de novo.`, 0.78);
    };
    recognition.onerror = (voiceEvent) => {
      setListening(false);
      const message = voiceEvent.error === "not-allowed" || voiceEvent.error === "service-not-allowed"
        ? "Permita o uso do microfone para ditar."
        : voiceEvent.error === "no-speech"
          ? "Não ouvi sua voz. Toque no microfone e tente de novo."
          : "Não foi possível usar o ditado agora.";
      setError(message);
      speak(message);
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Não foi possível iniciar o microfone.");
    }
  }}><Mic size={22} /></button>{error && <small className="easy-assist-error" role="status">{error}</small>}</>;
}

const shortcuts = [
  { route: "herd", title: "Animais", text: "Animais. Veja seus animais ou toque no mais para cadastrar um animal.", icon: Beef },
  { route: "water", title: "Água", text: "Água. Veja de onde vem a água e anote a quantidade usada.", icon: Droplets },
  { route: "climate", title: "Clima", text: "Clima. Veja se pode chover, o calor e os avisos para a propriedade.", icon: CloudSun },
  { route: "activities", title: "Tarefas", text: "Tarefas. Veja o que precisa fazer. Toque no mais para criar uma tarefa.", icon: ClipboardCheck },
  { route: "community", title: "Comunidade", text: "Comunidade. Registre um problema, encontre informações da região ou publique um aviso. Nos campos de texto, toque no microfone para falar em vez de escrever.", icon: MessageCircle },
  { route: "nfc", title: "Ler tag", text: "Ler tag. Aproxime o celular da identificação do animal para abrir sua ficha. Isso não rastreia o animal.", icon: ScanLine },
  { route: "profile", title: "Configurações", text: "Configurações. Abra para ligar ou desligar o Modo Fácil.", icon: Settings },
] satisfies { route: AppRoute; title: string; text: string; icon: typeof Beef }[];

export function EasyHome({ navigate }: { navigate: (route: AppRoute) => void }) {
  const intro = "Modo Fácil. Escolha uma função. O botão com alto-falante lê as informações. Quando aparecer um microfone ao lado de um campo, toque nele e fale para preencher sem precisar escrever.";
  return <section className="screen easy-home"><header className="easy-home-header"><div className="easy-home-title-row"><div><span>MODO FÁCIL</span><h1>O que você quer fazer?</h1><p>Ícones grandes, ajuda por áudio e ditado por voz.</p></div><AudioHelp text={intro} /></div><div className="easy-voice-tip"><Mic size={19} /><div><strong>Você pode falar em vez de escrever</strong><small>Quando o microfone aparecer em um campo, toque e fale normalmente.</small></div></div></header><div className="easy-shortcuts">{shortcuts.map(({ route, title, text, icon: Icon }) => <div key={route}><button className="secondary-button" onClick={() => navigate(route)}><span className="easy-shortcut-icon"><Icon size={29} /></span><strong>{title}</strong><ChevronRight className="easy-shortcut-arrow" size={22} /></button><AudioHelp text={text} /></div>)}</div></section>;
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
  }}><div className="easy-step-heading"><div><strong>{current < fields.length ? `Passo ${current + 1} de ${fields.length}` : "Tudo pronto?"}</strong><small>{current < fields.length ? "Preencha só esta parte. Use o microfone se preferir falar." : "Confira e salve."}</small></div><AudioHelp text={current < fields.length ? "Preencha só esta informação. Se aparecer um microfone, você pode tocar nele e falar. Depois toque em Continuar." : "Tudo pronto. Toque em salvar para confirmar. Se quiser corrigir, toque em Voltar."} /></div>
    {fields.map((field, index) => <fieldset key={index} data-easy-step hidden={index !== current} disabled={index !== current}>{field}</fieldset>)}
    {current < fields.length ? <div className="modal-action-row">{current > 0 && <button className="secondary-button" type="button" onClick={() => setStep(current - 1)}>Voltar</button>}<button type="submit" className="primary-button">Continuar</button></div> : <><button className="secondary-button" type="button" onClick={() => setStep(Math.max(0, current - 1))}>Voltar</button>{rest}</>}
  </form>;
}
