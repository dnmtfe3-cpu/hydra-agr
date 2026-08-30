import { requestPasswordChangeCode, verifyPasswordChangeCode } from "./services/auth-email-service";
import { requireSupabase } from "./services/supabase";

type DialogResult = string | null;

function ensureStyles() {
  if (document.getElementById("hydra-password-code-style")) return;
  const style = document.createElement("style");
  style.id = "hydra-password-code-style";
  style.textContent = `
    .hydra-password-code-backdrop{position:fixed;z-index:2147483000;inset:0;padding:20px;display:grid;place-items:center;background:rgba(5,25,17,.58);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
    .hydra-password-code-card{width:min(100%,390px);padding:24px;border:1px solid rgba(19,70,49,.14);border-radius:24px;background:#fffefb;color:#153a2a;box-shadow:0 28px 80px rgba(5,25,17,.28);font-family:Manrope,system-ui,sans-serif}
    .hydra-password-code-card .mark{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:#eaf2ec;color:#0b5136;font-size:22px;font-weight:900}
    .hydra-password-code-card h2{margin:15px 0 7px;font-size:24px;line-height:1.15;letter-spacing:-.035em}
    .hydra-password-code-card p{margin:0;color:#66736b;font-size:13px;line-height:1.55}
    .hydra-password-code-card strong{color:#244c39;word-break:break-word}
    .hydra-password-code-card input{width:100%;height:58px;margin-top:20px;padding:0 14px;border:1px solid #d9dfda;border-radius:16px;background:#f8f8f4;color:#123827;text-align:center;font:800 27px/1 Sora,Manrope,system-ui,sans-serif;letter-spacing:.22em;outline:none}
    .hydra-password-code-card input:focus{border-color:#0b5136;box-shadow:0 0 0 3px rgba(11,81,54,.1)}
    .hydra-password-code-card .error{min-height:18px;margin-top:10px;color:#a8443b;font-size:12px;font-weight:650}
    .hydra-password-code-actions{margin-top:14px;display:grid;grid-template-columns:1fr 1.25fr;gap:10px}
    .hydra-password-code-actions button{min-height:46px;border:0;border-radius:14px;font:800 13px/1 Manrope,system-ui,sans-serif;cursor:pointer}
    .hydra-password-code-actions .cancel{background:#edf0ec;color:#496052}.hydra-password-code-actions .confirm{background:#0b5136;color:#fff}
    .hydra-password-code-actions button:disabled{opacity:.55;cursor:default}
    .hydra-root.theme-dark~.hydra-password-code-backdrop .hydra-password-code-card,.theme-dark .hydra-password-code-card{border-color:#294235;background:#0f2018;color:#eef4ef}.theme-dark .hydra-password-code-card p{color:#9aa9a0}.theme-dark .hydra-password-code-card strong{color:#dce9e0}.theme-dark .hydra-password-code-card input{border-color:#314c3c;background:#13291e;color:#f4f7f4}
  `;
  document.head.appendChild(style);
}

function codeDialog(email: string): Promise<DialogResult> {
  ensureStyles();
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "hydra-password-code-backdrop";
    backdrop.innerHTML = `<section class="hydra-password-code-card" role="dialog" aria-modal="true" aria-labelledby="hydra-password-code-title">
      <span class="mark" aria-hidden="true">✓</span>
      <h2 id="hydra-password-code-title">Confirme a troca de senha</h2>
      <p>Enviamos um código de 6 dígitos para <strong></strong>. Digite o código para autorizar a nova senha.</p>
      <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Código de verificação" />
      <div class="error" role="alert"></div>
      <div class="hydra-password-code-actions"><button class="cancel" type="button">Cancelar</button><button class="confirm" type="button">Confirmar código</button></div>
    </section>`;
    backdrop.querySelector("strong")!.textContent = email;
    const input = backdrop.querySelector<HTMLInputElement>("input")!;
    const error = backdrop.querySelector<HTMLElement>(".error")!;
    const confirm = backdrop.querySelector<HTMLButtonElement>(".confirm")!;
    const finish = (value: DialogResult) => { backdrop.remove(); resolve(value); };
    backdrop.querySelector<HTMLButtonElement>(".cancel")!.onclick = () => finish(null);
    backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) finish(null); });
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); error.textContent = ""; });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); confirm.click(); } });
    confirm.onclick = () => {
      if (input.value.length !== 6) { error.textContent = "Digite os 6 dígitos enviados ao seu e-mail."; return; }
      finish(input.value);
    };
    document.body.appendChild(backdrop);
    window.setTimeout(() => input.focus(), 60);
  });
}

function setReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function feedback(form: HTMLFormElement, message: string, tone: "notice" | "error") {
  form.querySelector(".hydra-password-security-feedback")?.remove();
  const node = document.createElement("p");
  node.className = `${tone === "error" ? "form-error" : "form-notice"} hydra-password-security-feedback`;
  node.setAttribute("role", tone === "error" ? "alert" : "status");
  node.textContent = message;
  const actions = form.querySelector(".modal-action-row");
  if (actions) form.insertBefore(node, actions);
  else form.appendChild(node);
}

let processing = false;

document.addEventListener("submit", async (event) => {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || processing || !form.querySelector(".security-session")) return;
  const passwordInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]'));
  if (passwordInputs.length < 2) return;
  const [password, confirmPassword] = passwordInputs;
  if (!password.value) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (password.value.length < 8) { feedback(form, "A nova senha precisa ter pelo menos 8 caracteres.", "error"); return; }
  if (password.value !== confirmPassword.value) { feedback(form, "As senhas não coincidem.", "error"); return; }

  processing = true;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const client = requireSupabase();
    const { data: userData, error: userError } = await client.auth.getUser();
    const email = userData.user?.email?.trim().toLowerCase();
    if (userError || !email) throw new Error("Sua sessão expirou. Entre novamente para trocar a senha.");

    feedback(form, "Enviando código de segurança para seu e-mail…", "notice");
    await requestPasswordChangeCode(email);
    const code = await codeDialog(email);
    if (!code) { feedback(form, "Troca de senha cancelada.", "notice"); return; }

    feedback(form, "Validando código…", "notice");
    const verificationToken = await verifyPasswordChangeCode(email, code);
    const { data, error } = await client.functions.invoke<{ ok?: boolean; message?: string }>("change-password-verified", {
      body: { newPassword: password.value, verificationToken },
    });
    if (error || !data?.ok) throw new Error(data?.message || "Não foi possível atualizar a senha agora.");

    const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
    const nextEmail = emailInput?.value.trim().toLowerCase();
    if (nextEmail && nextEmail !== email) {
      const { error: emailError } = await client.auth.updateUser({ email: nextEmail });
      if (emailError) throw emailError;
    }

    setReactInput(password, "");
    setReactInput(confirmPassword, "");
    feedback(form, nextEmail && nextEmail !== email ? "Senha atualizada. Confirme também o novo e-mail pela mensagem enviada." : "Senha atualizada com segurança.", "notice");
  } catch (caught) {
    feedback(form, caught instanceof Error ? caught.message : "Não foi possível atualizar a senha agora.", "error");
  } finally {
    processing = false;
    if (submit) submit.disabled = false;
  }
}, true);
