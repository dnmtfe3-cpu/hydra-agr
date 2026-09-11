import { Accessibility } from "lucide-react";
import { Toggle } from "../../components/ui";
import { AudioHelp, useEasyMode } from "./easy-mode";

export function EasyModeSetting() {
  const { enabled, setEnabled } = useEasyMode();
  const help = "Modo Fácil. Ative para usar botões maiores, menos informação por vez, ajuda em voz alta e ditado. Quando aparecer o microfone, toque e fale para preencher sem escrever. O recurso de ditado depende do serviço de voz disponível no aparelho.";
  return <div className={`easy-setting ${enabled ? "is-enabled" : ""}`}><span className="easy-setting-icon"><Accessibility size={24} /></span><div><strong>Modo Fácil</strong><small>Botões maiores, leitura em voz alta e ditado</small>{enabled && <em>Ativado</em>}</div><AudioHelp text={help} /><Toggle checked={enabled} onChange={setEnabled} label="Modo Fácil" /></div>;
}
