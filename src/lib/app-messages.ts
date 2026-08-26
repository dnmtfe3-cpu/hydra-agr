export function appMessagePtBr(value: unknown, fallback = "Não foi possível concluir esta ação. Tente novamente.") {
  const raw = value instanceof Error ? value.message : typeof value === "string" ? value : value == null ? "" : String(value);
  const message = raw.trim();
  if (!message) return fallback;

  const normalized = message.toLocaleLowerCase("pt-BR");

  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (normalized.includes("already registered") || normalized.includes("already been registered") || normalized.includes("user already exists")) return "Já existe uma conta com este e-mail.";
  if (normalized.includes("password should be") || normalized.includes("password must be")) return "A senha não atende aos requisitos de segurança.";

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("network error") ||
    normalized.includes("load failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("err_internet_disconnected") ||
    normalized.includes("offline")
  ) return "Sem conexão com a internet. Confira sua rede e tente novamente.";

  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("etimedout")) {
    return "A conexão demorou mais que o esperado. Tente novamente.";
  }

  if (
    normalized.includes("jwt expired") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("session expired") ||
    normalized.includes("not authenticated") ||
    normalized.includes("unauthorized")
  ) return "Sua sessão expirou. Entre novamente para continuar.";

  if (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("insufficient privilege") ||
    normalized.includes("forbidden")
  ) return "Você não tem permissão para realizar esta ação.";

  if (
    normalized.includes("duplicate key") ||
    normalized.includes("unique constraint") ||
    normalized.includes("already exists")
  ) return "Este registro já existe.";

  if (normalized.includes("not found") || normalized === "404" || normalized.includes("status 404")) {
    return "Não encontramos o que você tentou acessar.";
  }

  if (normalized.includes("storage") && (normalized.includes("upload") || normalized.includes("bucket"))) {
    return "Não foi possível enviar o arquivo. Tente novamente.";
  }

  if (/^(error|erro)\s*[:.-]?\s*$/i.test(message)) return fallback;

  const looksTechnical =
    /\b(typeerror|referenceerror|syntaxerror|postgres|supabase|pgrst\d*|sqlstate|http status|status code|exception|stack trace)\b/i.test(message) ||
    /\b(400|401|403|404|409|422|429|500|502|503|504)\b/.test(message) && /\b(error|failed|request|response|status|http)\b/i.test(message) ||
    /\b(error|failed|failure|invalid|unauthorized|forbidden|unexpected|request)\b/i.test(message) && !/[áàâãéêíóôõúç]/i.test(message);

  return looksTechnical ? fallback : message;
}
