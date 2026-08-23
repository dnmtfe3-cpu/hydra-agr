import { supabase } from "./services/supabase";

const submitBypass = new WeakSet<HTMLFormElement>();
const emailPattern = /^\S+@\S+\.\S+$/;

let lastVerifiedLoginEmail = "";
let pendingPasswordLogin: { email: string; submittedAt: number; sawUnmount: boolean } | null = null;
let restoreBusy = false;

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

function rememberPasswordAttempt(form: HTMLFormElement) {
  const passwordInput = form.querySelector<HTMLInputElement>('input[autocomplete="current-password"]');
  if (!passwordInput || !lastVerifiedLoginEmail) return;

  pendingPasswordLogin = {
    email: lastVerifiedLoginEmail,
    submittedAt: Date.now(),
    sawUnmount: false,
  };
}

async function validateEmailBeforeSubmit(event: SubmitEvent) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;

  rememberPasswordAttempt(form);

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
      lastVerifiedLoginEmail = "";
      showInlineError(form, "E-mail não encontrado. Confira o endereço ou crie uma conta.");
      emailInput?.focus();
      return;
    }

    if (signupStep && exists === true) {
      showInlineError(form, "Este e-mail já está vinculado a uma conta. Entre na conta existente ou use outro e-mail.");
      emailInput?.focus();
      return;
    }

    if (loginStep) lastVerifiedLoginEmail = email;

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
        passwordInput.setAttribute("aria-invalid", "true");
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

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function restorePasswordScreenAfterFailedLogin() {
  const pending = pendingPasswordLogin;
  if (!pending || restoreBusy) return;

  if (Date.now() - pending.submittedAt > 6000) {
    pendingPasswordLogin = null;
    return;
  }

  // Login concluído: não existe nada para restaurar.
  if (document.querySelector(".bottom-nav, .profile-screen, .home-screen")) {
    pendingPasswordLogin = null;
    return;
  }

  const authCard = document.querySelector<HTMLElement>(".auth-card");
  const landing = document.querySelector<HTMLElement>(".auth-landing");

  // Durante a tentativa o store desmonta temporariamente a autenticação.
  // Só restauramos depois de confirmar esse unmount, evitando falso erro antes da resposta.
  if (!authCard && !landing) {
    pending.sawUnmount = true;
    return;
  }

  if (!pending.sawUnmount) return;

  restoreBusy = true;
  try {
    const passwordInput = document.querySelector<HTMLInputElement>('.auth-card input[autocomplete="current-password"]');
    if (passwordInput) {
      const form = passwordInput.closest("form");
      if (!form) return;

      // Mantém o usuário exatamente na etapa da senha, preserva o e-mail e
      // limpa somente a senha incorreta para que ele possa tentar outra vez.
      setReactInputValue(passwordInput, "");
      passwordInput.setAttribute("aria-invalid", "true");
      showInlineError(form, "Senha incorreta. Tente novamente.");
      passwordInput.focus({ preventScroll: true });
      pendingPasswordLogin = null;
      return;
    }

    const emailForm = Array.from(document.querySelectorAll<HTMLFormElement>(".auth-card form")).find(isOwnerLoginEmailStep);
    if (emailForm) {
      const emailInput = emailForm.querySelector<HTMLInputElement>('input[type="email"]');
      if (!emailInput) return;
      setReactInputValue(emailInput, pending.email);
      lastVerifiedLoginEmail = pending.email;
      submitBypass.add(emailForm);
      emailForm.requestSubmit();
      return;
    }

    const enterButton = document.querySelector<HTMLButtonElement>(".auth-landing-primary");
    if (enterButton) enterButton.click();
  } finally {
    restoreBusy = false;
  }
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
  if (input?.autocomplete === "current-password") {
    input.removeAttribute("aria-invalid");
    const form = input.closest("form");
    if (form) removeInlineError(form);
  }
}, true);

const observer = new MutationObserver(() => {
  normalizeAuthMessages();
  restorePasswordScreenAfterFailedLogin();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
normalizeAuthMessages();
restorePasswordScreenAfterFailedLogin();
