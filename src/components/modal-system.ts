"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { appMessagePtBr } from "../lib/app-messages";
import { installHydraTapSounds, playHydraSound } from "../services/interaction-sounds";

type OverlayEntry = {
  token: symbol;
  requestClose?: () => void;
};

export type AppToast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
};

const overlays: OverlayEntry[] = [];
const overlayListeners = new Set<() => void>();
const toastListeners = new Set<() => void>();
let toasts: AppToast[] = [];
let toastId = 0;
let bodyOverflowBeforeOverlay = "";
let bodyScrollLocked = false;
const emptyToasts: AppToast[] = [];

if (typeof document !== "undefined") installHydraTapSounds();

function emitOverlayChange() {
  const active = overlays.length > 0;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("app-overlay-open", active);
    document.body.classList.toggle("app-overlay-open", active);
    if (active && !bodyScrollLocked) {
      bodyOverflowBeforeOverlay = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      bodyScrollLocked = true;
    } else if (!active && bodyScrollLocked) {
      document.body.style.overflow = bodyOverflowBeforeOverlay;
      bodyScrollLocked = false;
    }
  }
  overlayListeners.forEach((listener) => listener());
}

function registerOverlay(entry: OverlayEntry) {
  overlays.push(entry);
  emitOverlayChange();
  return () => {
    const index = overlays.findIndex((item) => item.token === entry.token);
    if (index >= 0) overlays.splice(index, 1);
    emitOverlayChange();
  };
}

function subscribeOverlay(listener: () => void) {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
}

function overlaySnapshot() {
  return overlays.length > 0;
}

export function useModalNavigation() {
  return useSyncExternalStore(subscribeOverlay, overlaySnapshot, () => false);
}

export function useAppOverlay(active: boolean, requestClose?: () => void) {
  const token = useRef(Symbol("hydra-overlay"));
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    if (!active) return;
    return registerOverlay({
      token: token.current,
      requestClose: () => closeRef.current?.(),
    });
  }, [active]);
}

export function requestCloseTopOverlay() {
  overlays.at(-1)?.requestClose?.();
}

function subscribeToasts(listener: () => void) {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function toastSnapshot() {
  return toasts;
}

function dismissToast(id: number) {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  toastListeners.forEach((listener) => listener());
}

export function showAppToast(message: string, tone: AppToast["tone"] = "success") {
  const displayMessage = appMessagePtBr(
    message,
    tone === "error" ? "Não foi possível concluir esta ação. Tente novamente." : "Tudo certo.",
  );
  const toast = { id: ++toastId, message: displayMessage, tone } satisfies AppToast;
  toasts = [...toasts, toast].slice(-3);
  toastListeners.forEach((listener) => listener());

  const normalized = displayMessage.toLocaleLowerCase("pt-BR");
  if (tone === "error") playHydraSound("error");
  else if (normalized.includes("nfc") || normalized.includes("tag")) playHydraSound("nfc");
  else if (tone === "success") playHydraSound("success");

  window.setTimeout(() => dismissToast(toast.id), tone === "error" ? 4300 : 2800);
  return toast.id;
}

export function useAppToasts() {
  return useSyncExternalStore(subscribeToasts, toastSnapshot, () => emptyToasts);
}
