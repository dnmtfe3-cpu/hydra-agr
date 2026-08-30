import { Capacitor } from "@capacitor/core";
import { requireSupabase } from "./supabase";

type AuthEmailResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  retryAfter?: number;
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

async function requestAuthEmail(purpose: "login_code" | "password_recovery", email: string) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<AuthEmailResponse>("auth-email", {
    body: {
      purpose,
      email: normalizeEmail(email),
      platform: Capacitor.isNativePlatform() ? "native" : "web",
    },
  });
  if (error) throw new Error(friendlyFunctionError(error, "Não foi possível enviar o e-mail agora. Tente novamente."));
  if (!data?.ok) throw new Error(data?.message || "Não foi possível enviar o e-mail agora. Tente novamente.");
  return data;
}

export async function requestLoginCode(email: string) {
  await requestAuthEmail("login_code", email);
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

export async function requestBrandedPasswordRecovery(email: string) {
  await requestAuthEmail("password_recovery", email);
}
