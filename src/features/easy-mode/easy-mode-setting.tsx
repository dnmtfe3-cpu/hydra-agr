import { Hand } from "lucide-react";
import { Toggle } from "../../components/ui";
import { AudioHelp, useEasyMode } from "./easy-mode";
export function EasyModeSetting() {
  const { enabled, setEnabled } = useEasyMode();
  return <div className="easy-setting"><Hand size={24} /><div><strong>Modo Fácil</strong><small>Botões maiores e ajuda por áudio</small></div><AudioHelp text="Modo Fácil. Ative para usar botões maiores e ouvir ajuda. Você pode desligar quando quiser." /><Toggle checked={enabled} onChange={setEnabled} label="Modo Fácil" /></div>;
}

