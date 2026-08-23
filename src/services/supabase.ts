import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const backendConfigured =
  /^https:\/\/.+\.supabase\.co$/.test(supabaseUrl) &&
  supabaseKey.length > 20 &&
  !supabaseKey.includes("SUBSTITUA");

const authStorage = {
  async getItem(key: string) {
    return (await Preferences.get({ key })).value;
  },
  async setItem(key: string, value: string) {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string) {
    await Preferences.remove({ key });
  },
};

export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        // PKCE evita depender de tokens no fragmento (#) do deep link no Android.
        // O APK recebe um `code` e conclui a sessão com exchangeCodeForSession.
        flowType: "pkce",
        // No navegador o Supabase pode concluir o callback pela URL.
        // No APK o retorno chega pelo listener de deep link do Capacitor.
        detectSessionInUrl: !Capacitor.isNativePlatform(),
      },
      global: {
        headers: { "x-hydra-client": "hydra-agro-mobile/1.2.2" },
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Backend não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return supabase;
}

function authCallbackParts(url: string) {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const type = hash.get("type") || parsed.searchParams.get("type") || "";
  const hasCredentials = Boolean(
    parsed.searchParams.get("code") ||
    (hash.get("access_token") && hash.get("refresh_token")),
  );
  const recovery = type === "recovery" || parsed.pathname.includes("/auth/recovery");
  const callbackError =
    parsed.searchParams.get("error_description") ||
    hash.get("error_description") ||
    parsed.searchParams.get("error") ||
    hash.get("error");
  return { parsed, hash, type, hasCredentials, recovery, callbackError };
}

const callbackTasks = new Map<string, Promise<boolean>>();

async function processAuthCallbackUrl(url: string) {
  const client = requireSupabase();
  const { parsed, hash, recovery, callbackError } = authCallbackParts(url);

  if (callbackError) {
    throw new Error(decodeURIComponent(callbackError.replace(/\+/g, " ")));
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const code = parsed.searchParams.get("code");

  if (accessToken && refreshToken) {
    // Compatibilidade com APKs/links antigos que ainda retornem pelo fluxo implícito.
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  } else if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      // O Android pode entregar o mesmo deep link a mais de um listener. Se o
      // primeiro já concluiu a sessão, o segundo não deve derrubar o login.
      const { data } = await client.auth.getSession();
      if (!data.session?.user) throw error;
    }
  } else {
    throw new Error("Link de autenticação inválido ou expirado.");
  }

  // Só considera o retorno concluído quando a sessão realmente foi persistida.
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session?.user) throw new Error("O Google autenticou a conta, mas a sessão não foi concluída no aplicativo.");

  return recovery;
}

export function handleAuthCallbackUrl(url: string) {
  const pending = callbackTasks.get(url);
  if (pending) return pending;

  const task = processAuthCallbackUrl(url);
  callbackTasks.set(url, task);

  // Mantém callbacks concluídos em memória para que appUrlOpen + getLaunchUrl
  // não tentem reutilizar o mesmo código PKCE. Falhas são removidas e podem ser
  // tentadas novamente se o Android reenviar o deep link.
  void task.catch(() => {
    if (callbackTasks.get(url) === task) callbackTasks.delete(url);
  });

  if (callbackTasks.size > 12) {
    const oldest = callbackTasks.keys().next().value as string | undefined;
    if (oldest && oldest !== url) callbackTasks.delete(oldest);
  }

  return task;
}

/* Mantém esta função específica para o fluxo de recuperação usado pelo HydraApp. */
export function isAuthCallbackUrl(url: string) {
  try {
    const { hasCredentials, recovery } = authCallbackParts(url);
    return hasCredentials && recovery;
  } catch {
    return false;
  }
}

export function publicMediaUrl(bucket: "avatars" | "community-media", path?: string | null) {
  if (!path || !supabase) return undefined;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
