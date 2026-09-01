const submitBypass = new WeakSet<HTMLFormElement>();
const emailPattern = /^\S+@\S+\.\S+$/;

let lastLoginEmail = "";
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
  if (!passwordInput || !lastLoginEmail) return;

  pendingPasswordLogin = {
    email: lastLoginEmail,
    submittedAt: Date.now(),
    sawUnmount: false,
  };
}

function validateEmailBeforeSubmit(event: SubmitEvent) {
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
  if (!emailPattern.test(email)) return;

  // Não consultamos previamente se o e-mail existe. Essa checagem permitia
  // enumeração de contas. O servidor de autenticação permanece como fonte
  // de verdade e as mensagens mostradas ao usuário são deliberadamente neutras.
  if (loginStep) lastLoginEmail = email;
}

function normalizeAuthMessages() {
  const passwordInput = document.querySelector<HTMLInputElement>('.auth-card input[autocomplete="current-password"]');
  if (passwordInput) {
    document.querySelectorAll<HTMLElement>(".auth-card .form-error").forEach((node) => {
      const message = node.textContent?.trim().toLowerCase() ?? "";
      if (
        message.includes("e-mail ou senha incorretos") ||
        message.includes("senha incorreta") ||
        message.includes("invalid login credentials") ||
        message.includes("usuário não encontrado") ||
        message.includes("usuario nao encontrado")
      ) {
        node.textContent = "E-mail ou senha inválidos.";
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
      node.textContent = "Não foi possível concluir o cadastro com esses dados. Confira as informações ou tente entrar na sua conta.";
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

  if (document.querySelector(".bottom-nav, .profile-screen, .home-screen")) {
    pendingPasswordLogin = null;
    return;
  }

  const authCard = document.querySelector<HTMLElement>(".auth-card");
  const landing = document.querySelector<HTMLElement>(".auth-landing");

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

      setReactInputValue(passwordInput, "");
      passwordInput.setAttribute("aria-invalid", "true");
      showInlineError(form, "E-mail ou senha inválidos.");
      passwordInput.focus({ preventScroll: true });
      pendingPasswordLogin = null;
      return;
    }

    const emailForm = Array.from(document.querySelectorAll<HTMLFormElement>(".auth-card form")).find(isOwnerLoginEmailStep);
    if (emailForm) {
      const emailInput = emailForm.querySelector<HTMLInputElement>('input[type="email"]');
      if (!emailInput) return;
      setReactInputValue(emailInput, pending.email);
      lastLoginEmail = pending.email;
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
  validateEmailBeforeSubmit(event);
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
