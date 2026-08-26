import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Copy, Database, Eye, EyeOff, LockKeyhole, LogOut, RefreshCw, Settings2, ShieldBan } from "lucide-react";
import { HydraWordmark } from "./brand";
import type { SyncStatus } from "../hooks/use-hydra-store";
import type { AuthResult } from "../lib/hydra-types";
import { appMessagePtBr } from "../lib/app-messages";
import "./system-feedback.css";

export function BackendSetupScreen() {
  const envText = "VITE_SUPABASE_URL=...\nVITE_SUPABASE_PUBLISHABLE_KEY=...";
  return <main className="system-screen"><section className="system-card"><HydraWordmark /><span className="system-icon"><Database size={28} /></span><h1>Conecte o banco do Hydra Agro</h1><p>O aplicativo foi compilado corretamente, mas ainda precisa das duas variáveis públicas do projeto Supabase. A chave de serviço nunca deve entrar no APK.</p><div className="system-code"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div><button className="primary-button full" onClick={() => void navigator.clipboard.writeText(envText)}><Copy size={17} /> Copiar nomes das variáveis</button><small><Settings2 size={14} /> Consulte o README para executar a migração e gerar o APK conectado.</small></section></main>;
}

export function BannedScreen({ reason, logout }: { reason?: string; logout: () => Promise<void> }) {
  return <main className="system-screen blocked"><section className="system-card"><HydraWordmark /><span className="system-icon danger"><ShieldBan size={29} /></span><h1>Acesso suspenso</h1><p>Esta conta foi bloqueada pela administração. As regras do banco impedem acesso aos dados privados enquanto o bloqueio estiver ativo.</p>{reason && <div className="ban-reason"><strong>Motivo informado</strong><span>{reason}</span></div>}<button className="primary-button full" onClick={() => void logout()}><LogOut size={17} /> Sair da conta</button></section></main>;
}

export function SyncBanner({ status, error, retry }: { status: SyncStatus; error?: string; retry: () => Promise<void> }) {
  if (status === "saved") return null;

  if (status === "saving") {
    return (
      <div className="sync-banner saving" role="status" aria-live="polite">
        <span className="sync-banner-icon"><i className="sync-banner-spinner" /></span>
        <span className="sync-banner-copy"><strong>Salvando alterações</strong><small>Atualizando seus dados com segurança.</small></span>
      </div>
    );
  }

  const offline = status === "offline";
  const message = offline
    ? "Seus registros continuam salvos neste aparelho e serão enviados quando a conexão voltar."
    : appMessagePtBr(error, "Seus dados continuam salvos. Tente sincronizar novamente.");

  return (
    <div className={`sync-banner ${status}`} role={offline ? "status" : "alert"} aria-live="polite">
      <span className="sync-banner-icon">{offline ? <CloudOff size={21} /> : <AlertTriangle size={21} />}</span>
      <span className="sync-banner-copy">
        <strong>{offline ? "Você está sem internet" : "Não foi possível sincronizar"}</strong>
        <small>{message}</small>
      </span>
      <button onClick={() => void retry()}><RefreshCw size={14} /> Tentar novamente</button>
    </div>
  );
}

export function PasswordRecoveryScreen({ save, logout }: { save: (password: string) => Promise<AuthResult>; logout: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setFeedback({ message: "A senha precisa ter pelo menos 8 caracteres.", ok: false }); return; }
    if (password !== confirm) { setFeedback({ message: "As senhas não coincidem.", ok: false }); return; }
    setWorking(true);
    const result = await save(password);
    setWorking(false);
    setFeedback({ message: result.message, ok: result.ok });
  }

  return <main className="system-screen"><section className="system-card recovery-card"><span className="system-icon"><LockKeyhole size={29} /></span><span className="eyebrow">RECUPERAÇÃO SEGURA</span><h1>Crie sua nova senha</h1><p>O link foi validado. Escolha uma senha exclusiva para o Hydra Agro.</p><form className="modal-form" onSubmit={submit}><label className="field"><span>Nova senha</span><div className="input-with-action"><input type={show ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setFeedback(null); }} autoComplete="new-password" /><button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><label className="field"><span>Confirmar senha</span><input type={show ? "text" : "password"} value={confirm} onChange={(event) => { setConfirm(event.target.value); setFeedback(null); }} autoComplete="new-password" /></label>{feedback && (feedback.ok ? <p className="form-notice" role="status"><CheckCircle2 size={15} /> {feedback.message}</p> : <p className="form-error" role="alert">{appMessagePtBr(feedback.message)}</p>)}<button className="primary-button full" type="submit" disabled={working}>{working ? "Salvando…" : "Atualizar senha"}</button></form><button className="text-button" onClick={() => void logout()}>Sair desta conta</button></section></main>;
}
