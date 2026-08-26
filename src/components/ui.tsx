"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, Info, X } from "lucide-react";
import { createPortal } from "react-dom";
import { appMessagePtBr } from "../lib/app-messages";
import { useAppOverlay, useAppToasts } from "./modal-system";

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  onBack,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="screen-header">
      <div className="screen-header-row">
        {onBack && (
          <button className="icon-button quiet" onClick={onBack} aria-label="Voltar">
            <ChevronLeft size={23} strokeWidth={2.1} />
          </button>
        )}
        <div className="screen-heading">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="screen-action">{action}</div>}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  tall = false,
  centered = false,
  dismissible = true,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  tall?: boolean;
  centered?: boolean;
  dismissible?: boolean;
}) {
  const titleId = useId();
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const closeRequested = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => {
    if (closing || closeRequested.current || !dismissible) return;
    closeRequested.current = true;
    onClose();
  }, [closing, dismissible, onClose]);

  useEffect(() => {
    if (open) {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      closeRequested.current = false;
      setPresent(true);
      setClosing(false);
      return;
    }
    if (!present) {
      closeRequested.current = false;
      return;
    }
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setPresent(false);
      setClosing(false);
      closeRequested.current = false;
    }, 240);
  }, [open, present, closing]);

  useEffect(() => {
    if (!present) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible) requestClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [present, dismissible, requestClose]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  useAppOverlay(present, requestClose);

  useLayoutEffect(() => {
    if (!open || !present) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [open, present]);

  if (!present) return null;
  return createPortal(
    <div className={`modal-layer ${closing ? "is-closing" : ""}`} role="presentation" onMouseDown={() => { if (dismissible) requestClose(); }}>
      <section
        className={`modal-sheet ${wide ? "modal-wide" : ""} ${tall ? "modal-tall" : ""} ${centered ? "modal-centered" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={!dismissible}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow orange">{eyebrow}</span>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button" onClick={requestClose} aria-label="Fechar" disabled={!dismissible}>
            <X size={22} />
          </button>
        </div>
        <div className="modal-body" ref={bodyRef}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = "Confirmar",
  onCancel,
  onConfirm,
  busy = false,
  danger = true,
  error,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  danger?: boolean;
  error?: string;
}) {
  return (
    <Modal open={open} title={title} eyebrow="CONFIRMAÇÃO OBRIGATÓRIA" onClose={onCancel} dismissible={!busy}>
      <div className="confirm-action">
        <span><X size={27} /></span>
        <p>{text}</p>
        {error && <p className="form-error" role="alert">{appMessagePtBr(error)}</p>}
        <div className="modal-action-row">
          <button className="secondary-button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <LoadingButton className={danger ? "danger-button" : "primary-button"} onClick={() => void onConfirm()} loading={busy} loadingLabel={danger ? "Excluindo..." : "Confirmando..."}>{confirmLabel}</LoadingButton>
        </div>
      </div>
    </Modal>
  );
}

export function LoadingButton({
  loading = false,
  loadingLabel = "Salvando...",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button {...props} onClick={props.onClick} disabled={disabled || loading} aria-busy={loading}>
      {loading ? <><span className="button-spinner" aria-hidden="true" />{loadingLabel}</> : children}
    </button>
  );
}

export function AppToastRegion() {
  const toasts = useAppToasts();
  return (
    <div className="app-toast-region" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const title = toast.tone === "success" ? "Tudo certo" : toast.tone === "error" ? "Não foi possível concluir" : "Aviso";
        return (
          <div key={toast.id} className={`app-toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
            <span className="app-toast-icon" aria-hidden="true">{toast.tone === "success" ? <CheckCircle2 size={21} /> : toast.tone === "error" ? <AlertCircle size={21} /> : <Info size={21} />}</span>
            <span className="app-toast-copy"><strong>{title}</strong><small>{toast.message}</small></span>
          </div>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
