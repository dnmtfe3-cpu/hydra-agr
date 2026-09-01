import { Capacitor } from "@capacitor/core";
import { clearPendingSignupProof, requireSupabase, setPendingSignupProof } from "./supabase";

type ChallengePurpose = "signup" | "password_reset" | "password_change";

type AuthEmailResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  retryAfter?: number;
  verificationToken?: string;
  actionLink?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function friendlyFunctionError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message || "");
    if (message.toLowerCase().includes("failed to fetch")) return "Sem conexão. Verifique sua internet e tente novamente.";
  }
  return fallback;
}

async function invokeAuthEmail(body: Record<string, unknown>) {
  const { data, error } = await requireSupabase().functions.invoke<AuthEmailResponse>("auth-email", { body });
  if (error) throw new Error(friendlyFunctionError(error, "Não foi possível concluir a verificação agora. Tente novamente."));
  if (!data?.ok) throw new Error(data?.message || "Não foi possível concluir a verificação agora. Tente novamente.");
  return data;
}

async function requestChallenge(purpose: ChallengePurpose, email: string) {
  if (purpose === "signup") clearPendingSignupProof();
  return invokeAuthEmail({
    action: "request",
    purpose,
    email: normalizeEmail(email),
    platform: Capacitor.isNativePlatform() ? "native" : "web",
  });
}

async function verifyChallenge(purpose: ChallengePurpose, email: string, code: string) {
  const token = code.replace(/\D/g, "").slice(0, 6);
  if (token.length !== 6) throw new Error("Digite o código de 6 dígitos enviado ao seu e-mail.");
  return invokeAuthEmail({
    action: "verify",
    purpose,
    email: normalizeEmail(email),
    code: token,
    platform: Capacitor.isNativePlatform() ? "native" : "web",
  });
}

export async function requestLoginCode(email: string) {
  await invokeAuthEmail({
    action: "request",
    purpose: "login_code",
    email: normalizeEmail(email),
    platform: Capacitor.isNativePlatform() ? "native" : "web",
  });
}

export async function verifyLoginCode(email: string, code: string) {
  const token = code.replace(/\D/g, "").slice(0, 10);
  if (token.length < 6) throw new Error("Digite o código completo enviado ao seu e-mail.");
  const { data, error } = await requireSupabase().auth.verifyOtp({
    email: normalizeEmail(email),
    token,
    type: "email",
  });
  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("token")) {
      throw new Error("Código inválido ou expirado. Solicite um novo código e tente novamente.");
    }
    throw new Error("Não foi possível validar o código agora. Tente novamente.");
  }
  if (!data.session || !data.user) throw new Error("Não foi possível iniciar sua sessão. Solicite um novo código.");
  return data;
}

export async function requestSignupCode(email: string) {
  await requestChallenge("signup", email);
}

export async function verifySignupCode(email: string, code: string) {
  const result = await verifyChallenge("signup", email, code);
  if (!result.verificationToken) throw new Error("Não foi possível confirmar seu e-mail agora.");
  setPendingSignupProof(result.verificationToken);
  return result.verificationToken;
}

export async function requestPasswordResetCode(email: string) {
  await requestChallenge("password_reset", email);
}

export async function verifyPasswordResetCode(email: string, code: string) {
  const result = await verifyChallenge("password_reset", email, code);
  if (!result.actionLink) throw new Error("Não foi possível iniciar a troca de senha agora.");
  return result.actionLink;
}

export async function openPasswordRecoveryLink(actionLink: string) {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: actionLink, toolbarColor: "#0B5136" });
    return;
  }
  window.location.assign(actionLink);
}

export async function requestPasswordChangeCode(email: string) {
  await requestChallenge("password_change", email);
}

export async function verifyPasswordChangeCode(email: string, code: string) {
  const result = await verifyChallenge("password_change", email, code);
  if (!result.verificationToken) throw new Error("Não foi possível confirmar a troca de senha agora.");
  return result.verificationToken;
}
