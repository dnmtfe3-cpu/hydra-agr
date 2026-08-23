import { supabase } from "./services/supabase";

const submitBypass = new WeakSet<HTMLFormElement>();
const emailPattern = /^\S+@\S+\.\S+$/;

function removeInlineError(form: HTMLFormElement) {
  form.querySelector<HTMLElement>("[data-auth-validation-error]")?.remove();
}

function showInlineError(form: HTMLFormElement, message: string) {
  removeInlineError(form);
  const error = document.createElement("p");
  error.className = "form-error";
  error.dataset.authValidationError = "true";
  error.setAttribute("role", "alert");
  error.textContent = message;

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.before(error);
  else form.appendChild(error);
}

async function emailExists(email: string) {
  if (!supabase) return null;

  const { data, error } = await supabase.functions.invoke("auth-email-status", {
    body: { email: email.trim().toLowerCase() },
  });
  if (error) throw error;

  const response = data as { ok?: boolean; exists?: boolean; message?: string } | null;
  if (!response?.ok) throw new Error(response?.message || "Não foi possível verificar este e-mail agora.");
  return Boolean(response.exists);
}

function isOwnerLoginEmailStep(form: HTMLFormElement) {
  return Boolean(
    form.closest(".auth-card") &&
    form.querySelector(".staff-entry-button") &&
    form.querySelector('input[type="email"]') &&
    !form.querySelector('input[autocomplete="current-password"]'),
  );
}

function isSignupFirstStep(form: HTMLFormElement) {
  return Boolean(
    form.classList.contains("signup-panel") &&
    form.querySelector('input[autocomplete="name"]') &&
    form.querySelector('input[type="email"]'),
  );
}

async function validateEmailBeforeSubmit(event: SubmitEvent) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;

  if (submitBypass.has(form)) {
    submitBypass.delete(form);
    return;
  }

  const loginStep = isOwnerLoginEmailStep(form);
  const signupStep = isSignupFirstStep(form);
  if (!loginStep && !signupStep) return;

  const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
  const email = emailInput?.value.trim().toLowerCase() ?? "";
  if (!emailPattern.test(email) || !supabase) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  removeInlineError(form);

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const oldDisabled = submit?.disabled ?? false;
  if (submit) submit.disabled = true;

  try {
    const exists = await emailExists(email);

    if (loginStep && exists === false) {
      showInlineError(form, "E-mail não encontrado. Confira o endereço ou crie uma conta.");
      emailInput?.focus();
      return;
    }

    if (signupStep && exists === true) {
      showInlineError(form, "Este e-mail já está vinculado a uma conta. Entre na conta existente ou use outro e-mail.");
      emailInput?.focus();
      return;
    }

    submitBypass.add(form);
    form.requestSubmit();
  } catch {
    showInlineError(form, "Não foi possível verificar este e-mail agora. Tente novamente.");
  } finally {
    if (submit?.isConnected) submit.disabled = oldDisabled;
  }
}

function normalizeAuthMessages() {
  const passwordInput = document.querySelector<HTMLInputElement>('.auth-card input[autocomplete="current-password"]');
  if (passwordInput) {
    document.querySelectorAll<HTMLElement>(".auth-card .form-error").forEach((node) => {
      const message = node.textContent?.trim().toLowerCase() ?? "";
      if (message.includes("e-mail ou senha incorretos") || message.includes("invalid login credentials")) {
        node.textContent = "Senha incorreta. Tente novamente.";
      }
    });
  }

  document.querySelectorAll<HTMLElement>(".auth-card .signup-panel .form-error").forEach((node) => {
    const message = node.textContent?.trim().toLowerCase() ?? "";
    if (
      message.includes("já existe uma conta") ||
      message.includes("já está cadastrado") ||
      message.includes("already registered") ||
      message.includes("already been registered")
    ) {
      node.textContent = "Este e-mail já está vinculado a uma conta. Entre na conta existente ou use outro e-mail.";
    }
  });
}

document.addEventListener("submit", (event) => {
  void validateEmailBeforeSubmit(event);
}, true);

document.addEventListener("input", (event) => {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  if (input?.type === "email") {
    const form = input.closest("form");
    if (form) removeInlineError(form);
  }
}, true);

const observer = new MutationObserver(normalizeAuthMessages);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
normalizeAuthMessages();
