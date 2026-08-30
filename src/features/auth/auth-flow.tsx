"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, MailCheck, MapPin, UserRound, UsersRound } from "lucide-react";
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
  const [view, setView] = useState<"landing" | "auth">("landing");
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

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = window.setInterval(() => setCodeCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeCooldown > 0]);

  function changeSignup(field: keyof typeof signup, value: string) {
    setSignup((current) => ({ ...current, [field]: value }));
    setError("");
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

  function switchMode(next: "login" | "signup") {
    setMode(next); setLoginStep("email"); setLoginCode(""); setRecoveryCode(""); setSignupCode(""); setCodeCooldown(0); setError(""); setNotice("");
  }

  function openAuth(next: "login" | "signup", step: "email" | "staff" = "email") {
    switchMode(next); setLoginStep(step); setView("auth");
  }

  if (view === "landing") {
    return <main className="auth-landing"><div className="auth-landing-mosaic" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div><div className="auth-landing-shade" aria-hidden="true" /><section className="auth-landing-content"><span className="auth-landing-mark-wrap"><HydraMark className="auth-landing-mark" /></span><p className="auth-landing-kicker">Gestão rural em um só lugar</p><h1>Água, rebanho e rotina.<br /><strong>Juntos.</strong></h1><p className="auth-landing-copy">Use o Hydra Agro no Android, iPhone, iPad ou computador.</p><div className="auth-landing-actions"><button className="auth-landing-primary" type="button" onClick={() => openAuth("login")}>Entrar</button><button className="auth-landing-secondary" type="button" onClick={() => openAuth("signup")}>Criar conta</button></div><button className="auth-landing-staff" type="button" onClick={() => openAuth("login", "staff")}><UsersRound size={17} /> Acesso de funcionário</button></section></main>;
  }

  return (
    <main className={`auth-shell auth-shell-motion ${mode === "signup" ? "auth-shell-signup" : ""} ${loginStep === "staff" ? "auth-shell-staff" : ""}`}>
      <div className="signup-motion-bg" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <section className={`auth-card ${mode === "signup" ? "auth-card-wide" : ""}`}>
        {mode === "login" && loginStep === "email" && <button className="auth-home-back" type="button" onClick={() => { setView("landing"); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button>}
        <span className="auth-form-mark" aria-hidden="true"><HydraMark /></span>

        {mode === "login" ? <div className="auth-content auth-enter" key={loginStep}>
          {loginStep === "email" ? <form onSubmit={goToPassword}><div className="auth-icon"><UserRound size={22} /></div><h1>Bem-vindo de volta</h1><p className="auth-subtitle">Entre para acessar sua propriedade.</p><button className="google-auth-button" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}><span className="google-g" aria-hidden="true">G</span>{submitting ? "Abrindo Google…" : "Continuar com Google"}</button><div className="auth-divider"><span>ou entre com seu e-mail</span></div><Field label="E-mail"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus /></Field>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>Avançar <ArrowRight size={18} /></button><button className="staff-entry-button" type="button" onClick={() => { setLoginStep("staff"); setError(""); setNotice(""); }}><UsersRound size={18} /><span><strong>Entrar como funcionário</strong><small>Use o código fornecido pelo dono</small></span><ArrowRight size={17} /></button><p className="auth-switch">Ainda não tem conta? <button type="button" onClick={() => switchMode("signup")}>Criar conta</button></p></form>
          : loginStep === "staff" ? <form onSubmit={submitStaffLogin}><button className="auth-back" type="button" onClick={() => { setView("landing"); setLoginStep("email"); setError(""); }}><ArrowLeft size={17} /> Voltar</button><div className="auth-icon"><KeyRound size={22} /></div><h1>Acesso de funcionário</h1><p className="auth-subtitle">Digite o código que o dono da propriedade gerou para você.</p><Field label="Código de acesso" hint="Exemplo: HA-7K3M-9Q2P-4RX8"><input className="staff-code-input" type="text" value={staffCode} onChange={(event) => { setStaffCode(formatStaffCode(event.target.value)); setError(""); }} placeholder="HA-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={17} autoFocus /></Field><div className="staff-code-note"><UsersRound size={17} /><p><strong>Não precisa de Gmail nem senha.</strong><small>O código identifica seu acesso e a propriedade em que você trabalha.</small></p></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar na propriedade"}</button></form>
          : loginStep === "password" ? <form onSubmit={submitLogin}><button className="auth-back" type="button" onClick={() => { setLoginStep("email"); setError(""); }}><ArrowLeft size={17} /> Voltar</button><div className="auth-icon"><LockKeyhole size={22} /></div><h1>Digite sua senha</h1><button className="identity-chip" type="button" onClick={() => setLoginStep("email")}><span>{email.charAt(0).toUpperCase()}</span>{email}</button><Field label="Senha"><div className="input-with-action"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" autoFocus /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></Field><button className="text-button align-left" type="button" onClick={() => { setLoginStep("recovery"); setError(""); setNotice(""); }}>Esqueci minha senha</button>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button><div className="auth-divider"><span>ou</span></div><button className="secondary-button full" type="button" onClick={() => void sendLoginCode()} disabled={submitting}><MailCheck size={18} /> {submitting ? "Enviando código…" : "Entrar com código"}</button></form>
          : loginStep === "code" ? <form onSubmit={submitLoginCode}><button className="auth-back" type="button" onClick={() => { setLoginStep("password"); setLoginCode(""); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button><div className="auth-icon"><MailCheck size={22} /></div><h1>Código de acesso</h1><p className="auth-subtitle">Digite o código que enviamos para seu e-mail.</p><button className="identity-chip" type="button" onClick={() => setLoginStep("email")}><span>{email.charAt(0).toUpperCase()}</span>{email}</button><Field label="Código" hint="O código é de uso único e expira automaticamente."><input className="login-code-input" type="text" inputMode="numeric" pattern="[0-9]*" value={loginCode} onChange={(event) => { setLoginCode(event.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }} placeholder="000000" autoComplete="one-time-code" maxLength={10} autoFocus /></Field>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Validando…" : "Confirmar código"}</button><button className="text-button" type="button" onClick={() => void resendLoginCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `Reenviar código em ${codeCooldown}s` : "Reenviar código"}</button></form>
          : loginStep === "recovery" ? <form onSubmit={submitPasswordReset}><button className="auth-back" type="button" onClick={() => { setLoginStep("password"); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button><div className="auth-icon"><LockKeyhole size={22} /></div><h1>Recuperar acesso</h1><p className="auth-subtitle">Antes de trocar a senha, vamos confirmar seu e-mail com um código de 6 dígitos.</p><Field label="E-mail cadastrado"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus /></Field>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Enviando código…" : "Enviar código"}</button></form>
          : <form onSubmit={submitPasswordResetCode}><button className="auth-back" type="button" onClick={() => { setLoginStep("recovery"); setRecoveryCode(""); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button><div className="auth-icon"><MailCheck size={22} /></div><h1>Confirme o código</h1><p className="auth-subtitle">Digite o código enviado para liberar a criação de uma nova senha.</p><Field label="Código"><input className="login-code-input" type="text" inputMode="numeric" pattern="[0-9]*" value={recoveryCode} onChange={(event) => { setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} placeholder="000000" autoComplete="one-time-code" maxLength={6} autoFocus /></Field>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Validando…" : "Confirmar e trocar senha"}</button><button className="text-button" type="button" onClick={() => void resendRecoveryCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `Reenviar código em ${codeCooldown}s` : "Reenviar código"}</button></form>}
        </div> : <div className="signup-flow auth-enter">
          <div className="signup-topline"><button className="auth-back" type="button" onClick={() => { setView("landing"); switchMode("login"); }}><ArrowLeft size={17} /> Voltar</button><div className="step-dots" aria-label={`Etapa ${signupStep + 1} de 5`}>{[0,1,2,3,4].map((step) => <span key={step} className={`${step === signupStep ? "active" : ""} ${step < signupStep ? "done" : ""}`} />)}</div></div>
          {signupStep === 0 && <form onSubmit={nextSignup} className="signup-panel"><span className="eyebrow">DADOS PESSOAIS</span><h1>Vamos criar sua conta</h1><p className="auth-subtitle">Comece com as informações básicas.</p><button className="google-auth-button" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}><span className="google-g" aria-hidden="true">G</span>{submitting ? "Abrindo Google…" : "Criar conta com Google"}</button><div className="auth-divider"><span>ou preencha seus dados</span></div><div className="form-grid"><Field label="Nome completo"><input value={signup.name} onChange={(e) => changeSignup("name", e.target.value)} placeholder="Seu nome" autoComplete="name" /></Field><Field label="E-mail"><input type="email" value={signup.email} onChange={(e) => changeSignup("email", e.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit">Continuar <ArrowRight size={18} /></button></form>}
          {signupStep === 1 && <form onSubmit={nextSignup} className="signup-panel"><span className="eyebrow">SEGURANÇA</span><h1>Proteja seu acesso</h1><p className="auth-subtitle">Crie uma senha segura para sua propriedade.</p><div className="form-grid"><Field label="Senha" hint="Use pelo menos 8 caracteres."><input type="password" value={signup.password} onChange={(e) => changeSignup("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" /></Field><Field label="Confirmar senha"><input type="password" value={signup.confirmPassword} onChange={(e) => changeSignup("confirmPassword", e.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(0)}>Voltar</button><button className="primary-button" type="submit">Continuar <ArrowRight size={18} /></button></div></form>}
          {signupStep === 2 && <form onSubmit={nextSignup} className="signup-panel"><span className="eyebrow">SUA PROPRIEDADE</span><h1>Onde fica sua propriedade?</h1><p className="auth-subtitle">Informe apenas UF, CEP e nome. O município será identificado automaticamente.</p><PropertyLocationFields property={property} onChange={(next) => { setProperty(next); setError(""); }} onError={setError} />{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(1)}>Voltar</button><button className="primary-button" type="submit">Revisar <ArrowRight size={18} /></button></div></form>}
          {signupStep === 3 && <div className="signup-panel review-panel"><span className="eyebrow">TUDO CERTO</span><h1>Sua base está pronta, {firstName}</h1><p className="auth-subtitle">Antes de criar a conta, vamos confirmar que o e-mail informado pertence a você.</p><div className="review-card"><div className="review-icon"><MapPin size={23} /></div><div><strong>{property.name}</strong><span>{property.municipality}, {property.state}</span><small>CEP {property.postalCode}</small></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(2)}>Voltar</button><button className="primary-button" type="button" onClick={() => void startSignupVerification()} disabled={submitting}>{submitting ? "Enviando código…" : "Confirmar e-mail"}</button></div></div>}
          {signupStep === 4 && <form onSubmit={submitSignupCode} className="signup-panel"><span className="eyebrow">VERIFICAÇÃO</span><h1>Confirme seu e-mail</h1><p className="auth-subtitle">Digite o código de 6 dígitos enviado para {signup.email}.</p><Field label="Código de verificação" hint="O código expira em 10 minutos."><input className="login-code-input" type="text" inputMode="numeric" pattern="[0-9]*" value={signupCode} onChange={(event) => { setSignupCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} placeholder="000000" autoComplete="one-time-code" maxLength={6} autoFocus /></Field>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Confirmando…" : "Confirmar e criar conta"}</button><button className="text-button" type="button" onClick={() => void resendSignupCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `Reenviar código em ${codeCooldown}s` : "Reenviar código"}</button><button className="text-button" type="button" onClick={() => { setSignupStep(3); setSignupCode(""); setError(""); setNotice(""); }}>Alterar dados</button></form>}
        </div>}
      </section>
    </main>
  );
}
