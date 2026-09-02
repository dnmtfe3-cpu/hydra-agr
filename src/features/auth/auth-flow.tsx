"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, MailCheck, MapPin, UsersRound } from "lucide-react";
import { HydraMark } from "../../components/brand";
import { PropertyLocationFields } from "../../components/property-location-fields";
import { Field } from "../../components/ui";
import { isValidCep } from "../../lib/brazil-location";
import { emptyProperty, type AuthResult, type Property, type SignupPayload } from "../../lib/hydra-types";
import {
  openPasswordRecoveryLink,
  requestLoginCode,
  requestPasswordResetCode,
  requestSignupCode,
  verifyLoginCode,
  verifyPasswordResetCode,
  verifySignupCode,
} from "../../services/auth-email-service";

type Props = {
  onLogin: (email: string, password: string) => Promise<AuthResult>;
  onGoogleLogin: () => Promise<AuthResult>;
  onStaffLogin: (code: string) => Promise<AuthResult>;
  onSignup: (payload: SignupPayload) => Promise<AuthResult>;
  onResetPassword: (email: string) => Promise<AuthResult>;
};

type LoginStep = "email" | "password" | "code" | "recovery" | "recoveryCode" | "staff";

function formatStaffCode(value: string) {
  let compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (compact && !compact.startsWith("HA")) compact = `HA${compact}`.slice(0, 14);
  const body = compact.startsWith("HA") ? compact.slice(2) : compact;
  const groups = body.match(/.{1,4}/g) ?? [];
  return compact ? `HA${groups.length ? `-${groups.join("-")}` : ""}` : "";
}

export function AuthFlow({ onLogin, onGoogleLogin, onStaffLogin, onSignup }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginStep, setLoginStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [staffCode, setStaffCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupStep, setSignupStep] = useState(0);
  const [signup, setSignup] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [property, setProperty] = useState<Property>({ ...emptyProperty });

  const firstName = useMemo(() => signup.name.trim().split(/\s+/)[0] || "Produtor", [signup.name]);
  const isCodeScreen = mode === "login" && (loginStep === "code" || loginStep === "recoveryCode");
  const showModeTabs = !isCodeScreen && !(mode === "login" && ["recovery", "staff"].includes(loginStep));

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = window.setInterval(() => setCodeCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeCooldown > 0]);

  function changeSignup(field: keyof typeof signup, value: string) {
    setSignup((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setLoginStep("email");
    setSignupStep(0);
    setLoginCode("");
    setRecoveryCode("");
    setSignupCode("");
    setCodeCooldown(0);
    setError("");
    setNotice("");
  }

  function validLoginEmail() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Digite um e-mail válido para continuar.");
      return false;
    }
    return true;
  }

  function goToPassword(event: FormEvent) {
    event.preventDefault();
    if (!validLoginEmail()) return;
    setError("");
    setNotice("");
    setLoginStep("password");
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!password) { setError("Digite sua senha."); return; }
    setSubmitting(true);
    const result = await onLogin(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  async function sendLoginCode() {
    if (!validLoginEmail()) return;
    setError(""); setNotice(""); setSubmitting(true);
    try {
      await requestLoginCode(email);
      setLoginCode(""); setCodeCooldown(60); setLoginStep("code");
      setNotice("Enviamos um código de acesso para seu e-mail.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o código agora.");
    } finally { setSubmitting(false); }
  }

  async function submitLoginCode(event: FormEvent) {
    event.preventDefault();
    const cleanCode = loginCode.replace(/\D/g, "");
    if (cleanCode.length < 6) { setError("Digite o código completo enviado ao seu e-mail."); return; }
    setError(""); setSubmitting(true);
    try { await verifyLoginCode(email, cleanCode); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível validar o código agora."); setSubmitting(false); }
  }

  async function resendLoginCode() {
    if (codeCooldown > 0 || submitting) return;
    setError(""); setNotice(""); setSubmitting(true);
    try { await requestLoginCode(email); setCodeCooldown(60); setNotice("Um novo código foi enviado para seu e-mail."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível reenviar o código agora."); }
    finally { setSubmitting(false); }
  }

  async function submitGoogleLogin() {
    setError(""); setSubmitting(true);
    const result = await onGoogleLogin();
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  async function submitStaffLogin(event: FormEvent) {
    event.preventDefault();
    const compact = staffCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^HA[A-Z2-9]{12}$/.test(compact)) { setError("Digite o código completo fornecido pelo dono da propriedade."); return; }
    setError(""); setSubmitting(true);
    const result = await onStaffLogin(staffCode);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  function validateStep() {
    if (signupStep === 0) {
      if (signup.name.trim().length < 2) return "Informe seu nome completo.";
      if (!/^\S+@\S+\.\S+$/.test(signup.email)) return "Informe um e-mail válido.";
    }
    if (signupStep === 1) {
      if (signup.password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
      if (signup.password !== signup.confirmPassword) return "As senhas não coincidem.";
    }
    if (signupStep === 2) {
      if (!property.state) return "Selecione a UF da propriedade.";
      if (!isValidCep(property.postalCode)) return "Digite um CEP completo no formato 00000-000.";
      if (!property.municipality.trim()) return "Aguarde a identificação do município pelo CEP ou tente consultar novamente.";
      if (!property.name.trim()) return "Informe o nome da propriedade.";
    }
    return "";
  }

  function nextSignup(event: FormEvent) {
    event.preventDefault();
    const message = validateStep();
    if (message) { setError(message); return; }
    setError("");
    setSignupStep((current) => Math.min(current + 1, 3));
  }

  async function startSignupVerification() {
    setError(""); setNotice(""); setSubmitting(true);
    try {
      await requestSignupCode(signup.email);
      setSignupCode(""); setCodeCooldown(60); setSignupStep(4);
      setNotice("Enviamos um código para confirmar seu e-mail antes de criar a conta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o código agora.");
    } finally { setSubmitting(false); }
  }

  async function submitSignupCode(event: FormEvent) {
    event.preventDefault();
    if (signupCode.replace(/\D/g, "").length !== 6) { setError("Digite o código de 6 dígitos enviado ao seu e-mail."); return; }
    setError(""); setSubmitting(true);
    try {
      await verifySignupCode(signup.email, signupCode);
      const result = await onSignup({ name: signup.name, email: signup.email, phone: "", password: signup.password, property });
      if (!result.ok) { setError(result.message); return; }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível confirmar o cadastro agora.");
    } finally { setSubmitting(false); }
  }

  async function resendSignupCode() {
    if (codeCooldown > 0 || submitting) return;
    setError(""); setSubmitting(true);
    try { await requestSignupCode(signup.email); setCodeCooldown(60); setNotice("Um novo código foi enviado para seu e-mail."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível reenviar o código agora."); }
    finally { setSubmitting(false); }
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Digite o e-mail cadastrado para recuperar o acesso."); return; }
    setError(""); setNotice(""); setSubmitting(true);
    try {
      await requestPasswordResetCode(email);
      setRecoveryCode(""); setCodeCooldown(60); setLoginStep("recoveryCode");
      setNotice("Enviamos um código para confirmar que este e-mail é seu.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o código de recuperação agora.");
    } finally { setSubmitting(false); }
  }

  async function submitPasswordResetCode(event: FormEvent) {
    event.preventDefault();
    if (recoveryCode.replace(/\D/g, "").length !== 6) { setError("Digite o código de 6 dígitos enviado ao seu e-mail."); return; }
    setError(""); setSubmitting(true);
    try {
      const actionLink = await verifyPasswordResetCode(email, recoveryCode);
      await openPasswordRecoveryLink(actionLink);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível validar o código agora.");
      setSubmitting(false);
    }
  }

  async function resendRecoveryCode() {
    if (codeCooldown > 0 || submitting) return;
    setError(""); setSubmitting(true);
    try { await requestPasswordResetCode(email); setCodeCooldown(60); setNotice("Um novo código foi enviado para seu e-mail."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível reenviar o código agora."); }
    finally { setSubmitting(false); }
  }

  return (
    <main className={`auth-shell auth-reference-shell ${mode === "signup" ? "auth-shell-signup" : ""} ${isCodeScreen ? "auth-code-shell" : ""}`}>
      <section className={`auth-card auth-reference-card ${mode === "signup" ? "auth-card-wide" : ""}`}>
        <div className="auth-reference-brand"><HydraMark /><span>Hydra Agro</span></div>

        {showModeTabs && (
          <div className="auth-mode-tabs" role="tablist" aria-label="Acesso">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Login</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Criar conta</button>
          </div>
        )}

        {mode === "login" ? (
          <div className="auth-content auth-enter" key={loginStep}>
            {loginStep === "email" ? (
              <form onSubmit={goToPassword}>
                <div className="auth-reference-heading"><h1>Bem-vindo de volta</h1><p>Entre para acessar sua propriedade.</p></div>
                <Field label="E-mail"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus /></Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>Avançar <ArrowRight size={18} /></button>
                <div className="auth-divider"><span>ou continue com</span></div>
                <button className="google-auth-button" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}><span className="google-g" aria-hidden="true">G</span>{submitting ? "Abrindo Google…" : "Google"}</button>
                <button className="staff-entry-button" type="button" onClick={() => { setLoginStep("staff"); setError(""); setNotice(""); }}><UsersRound size={18} /><span><strong>Acesso de funcionário</strong><small>Entre com o código da propriedade</small></span><ArrowRight size={17} /></button>
              </form>
            ) : loginStep === "password" ? (
              <form onSubmit={submitLogin}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("email"); setError(""); }}><ArrowLeft size={17} /> Voltar</button>
                <div className="auth-reference-heading"><h1>Digite sua senha</h1><p>{email}</p></div>
                <Field label="Senha"><div className="input-with-action"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" autoFocus /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></Field>
                <button className="text-button align-left" type="button" onClick={() => { setLoginStep("recovery"); setError(""); setNotice(""); }}>Esqueci minha senha</button>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
                <button className="secondary-button full auth-code-entry" type="button" onClick={() => void sendLoginCode()} disabled={submitting}><MailCheck size={18} /> {submitting ? "Enviando código…" : "Entrar com código"}</button>
              </form>
            ) : loginStep === "code" ? (
              <form className="auth-verification-panel" onSubmit={submitLoginCode}>
                <button className="auth-back auth-code-back" type="button" onClick={() => { setLoginStep("password"); setLoginCode(""); setError(""); setNotice(""); }}><ArrowLeft size={17} /></button>
                <div className="auth-verification-visual"><MailCheck size={38} /></div>
                <h1>Digite o código</h1><p className="auth-subtitle">Enviamos um código para {email}.</p>
                <Field label="Código"><input className="login-code-input" type="text" inputMode="numeric" pattern="[0-9]*" value={loginCode} onChange={(event) => { setLoginCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} placeholder="000000" autoComplete="one-time-code" maxLength={6} autoFocus /></Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
                <button className="text-button auth-resend" type="button" onClick={() => void resendLoginCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `Reenviar em ${codeCooldown}s` : "Reenviar código"}</button>
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Validando…" : "Confirmar"}</button>
              </form>
            ) : loginStep === "recovery" ? (
              <form onSubmit={submitPasswordReset}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("password"); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button>
                <div className="auth-reference-heading"><h1>Recuperar acesso</h1><p>Vamos confirmar seu e-mail antes de trocar a senha.</p></div>
                <Field label="E-mail"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus /></Field>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar código"}</button>
              </form>
            ) : loginStep === "recoveryCode" ? (
              <form className="auth-verification-panel" onSubmit={submitPasswordResetCode}>
                <button className="auth-back auth-code-back" type="button" onClick={() => { setLoginStep("recovery"); setRecoveryCode(""); setError(""); setNotice(""); }}><ArrowLeft size={17} /></button>
                <div className="auth-verification-visual"><LockKeyhole size={38} /></div>
                <h1>Confirme o código</h1><p className="auth-subtitle">Digite o código enviado para seu e-mail.</p>
                <Field label="Código"><input className="login-code-input" type="text" inputMode="numeric" pattern="[0-9]*" value={recoveryCode} onChange={(event) => { setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} placeholder="000000" autoComplete="one-time-code" maxLength={6} autoFocus /></Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
                <button className="text-button auth-resend" type="button" onClick={() => void resendRecoveryCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `Reenviar em ${codeCooldown}s` : "Reenviar código"}</button>
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Validando…" : "Confirmar e trocar senha"}</button>
              </form>
            ) : (
              <form onSubmit={submitStaffLogin}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("email"); setError(""); }}><ArrowLeft size={17} /> Voltar</button>
                <div className="auth-reference-heading"><span className="auth-staff-icon"><KeyRound size={22} /></span><h1>Acesso de funcionário</h1><p>Use o código fornecido pelo dono da propriedade.</p></div>
                <Field label="Código de acesso" hint="Exemplo: HA-7K3M-9Q2P-4RX8"><input className="staff-code-input" type="text" value={staffCode} onChange={(event) => { setStaffCode(formatStaffCode(event.target.value)); setError(""); }} placeholder="HA-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={17} autoFocus /></Field>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar na propriedade"}</button>
              </form>
            )}
          </div>
        ) : (
          <div className="signup-flow auth-enter">
            <div className="signup-topline"><div className="step-dots" aria-label={`Etapa ${signupStep + 1} de 5`}>{[0,1,2,3,4].map((step) => <span key={step} className={`${step === signupStep ? "active" : ""} ${step < signupStep ? "done" : ""}`} />)}</div></div>
            {signupStep === 0 && <form onSubmit={nextSignup} className="signup-panel"><div className="auth-reference-heading"><h1>Crie sua conta</h1><p>Comece com seus dados principais.</p></div><div className="form-grid"><Field label="Nome completo"><input value={signup.name} onChange={(e) => changeSignup("name", e.target.value)} placeholder="Seu nome" autoComplete="name" /></Field><Field label="E-mail"><input type="email" value={signup.email} onChange={(e) => changeSignup("email", e.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit">Continuar <ArrowRight size={18} /></button><div className="auth-divider"><span>ou continue com</span></div><button className="google-auth-button" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}><span className="google-g" aria-hidden="true">G</span>{submitting ? "Abrindo Google…" : "Google"}</button></form>}
            {signupStep === 1 && <form onSubmit={nextSignup} className="signup-panel"><button className="auth-back" type="button" onClick={() => setSignupStep(0)}><ArrowLeft size={17} /> Voltar</button><div className="auth-reference-heading"><h1>Crie uma senha</h1><p>Use pelo menos 8 caracteres.</p></div><div className="form-grid"><Field label="Senha"><input type="password" value={signup.password} onChange={(e) => changeSignup("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" /></Field><Field label="Confirmar senha"><input type="password" value={signup.confirmPassword} onChange={(e) => changeSignup("confirmPassword", e.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit">Continuar <ArrowRight size={18} /></button></form>}
            {signupStep === 2 && <form onSubmit={nextSignup} className="signup-panel"><button className="auth-back" type="button" onClick={() => setSignupStep(1)}><ArrowLeft size={17} /> Voltar</button><div className="auth-reference-heading"><h1>Sua propriedade</h1><p>Informe UF, CEP e nome da propriedade.</p></div><PropertyLocationFields property={property} onChange={(next) => { setProperty(next); setError(""); }} onError={setError} />{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit">Revisar <ArrowRight size={18} /></button></form>}
            {signupStep === 3 && <div className="signup-panel review-panel"><button className="auth-back" type="button" onClick={() => setSignupStep(2)}><ArrowLeft size={17} /> Voltar</button><div className="auth-reference-heading"><h1>Quase pronto, {firstName}</h1><p>Confira a propriedade antes de confirmar seu e-mail.</p></div><div className="review-card"><div className="review-icon"><MapPin size={23} /></div><div><strong>{property.name}</strong><span>{property.municipality}, {property.state}</span><small>CEP {property.postalCode}</small></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="button" onClick={() => void startSignupVerification()} disabled={submitting}>{submitting ? "Enviando código…" : "Confirmar e-mail"}</button></div>}
            {signupStep === 4 && <form onSubmit={submitSignupCode} className="signup-panel auth-verification-panel"><button className="auth-back auth-code-back" type="button" onClick={() => { setSignupStep(3); setSignupCode(""); setError(""); setNotice(""); }}><ArrowLeft size={17} /></button><div className="auth-verification-visual"><MailCheck size={38} /></div><h1>Confirme seu e-mail</h1><p className="auth-subtitle">Digite o código enviado para {signup.email}.</p><Field label="Código"><input className="login-code-input" type="text" inputMode="numeric" pattern="[0-9]*" value={signupCode} onChange={(event) => { setSignupCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} placeholder="000000" autoComplete="one-time-code" maxLength={6} autoFocus /></Field>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="text-button auth-resend" type="button" onClick={() => void resendSignupCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `Reenviar em ${codeCooldown}s` : "Reenviar código"}</button><button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Confirmando…" : "Confirmar e criar conta"}</button></form>}
          </div>
        )}
      </section>
    </main>
  );
}
