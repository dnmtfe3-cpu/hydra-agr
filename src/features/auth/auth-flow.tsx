"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MapPin,
  UserRound,
  UsersRound,
} from "lucide-react";
import { HydraMark } from "../../components/brand";
import { PropertyLocationFields } from "../../components/property-location-fields";
import { Field } from "../../components/ui";
import { isValidCep } from "../../lib/brazil-location";
import { emptyProperty, type AuthResult, type Property, type SignupPayload } from "../../lib/hydra-types";

type Props = {
  onLogin: (email: string, password: string) => Promise<AuthResult>;
  onGoogleLogin: () => Promise<AuthResult>;
  onStaffLogin: (code: string) => Promise<AuthResult>;
  onSignup: (payload: SignupPayload) => Promise<AuthResult>;
  onResetPassword: (email: string) => Promise<AuthResult>;
};

function formatStaffCode(value: string) {
  let compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (compact && !compact.startsWith("HA")) compact = `HA${compact}`.slice(0, 14);
  const body = compact.startsWith("HA") ? compact.slice(2) : compact;
  const groups = body.match(/.{1,4}/g) ?? [];
  return compact ? `HA${groups.length ? `-${groups.join("-")}` : ""}` : "";
}

export function AuthFlow({ onLogin, onGoogleLogin, onStaffLogin, onSignup, onResetPassword }: Props) {
  const [view, setView] = useState<"landing" | "auth">("landing");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginStep, setLoginStep] = useState<"email" | "password" | "recovery" | "staff">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupStep, setSignupStep] = useState(0);
  const [signup, setSignup] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [property, setProperty] = useState<Property>({ ...emptyProperty });

  const firstName = useMemo(() => signup.name.trim().split(/\s+/)[0] || "Produtor", [signup.name]);

  function changeSignup(field: keyof typeof signup, value: string) {
    setSignup((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function goToPassword(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Digite um e-mail válido para continuar."); return; }
    setError("");
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

  async function submitGoogleLogin() {
    setError("");
    setSubmitting(true);
    const result = await onGoogleLogin();
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  async function submitStaffLogin(event: FormEvent) {
    event.preventDefault();
    const compact = staffCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^HA[A-Z2-9]{12}$/.test(compact)) { setError("Digite o código completo fornecido pelo dono da propriedade."); return; }
    setError("");
    setSubmitting(true);
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

  async function finishSignup() {
    const message = validateStep();
    if (signupStep === 2 && message) { setError(message); return; }
    setSubmitting(true);
    const result = await onSignup({ name: signup.name, email: signup.email, phone: "", password: signup.password, property });
    setSubmitting(false);
    if (!result.ok) setError(result.message);
    else if (result.needsEmailConfirmation) {
      setEmail(signup.email);
      setNotice(result.message);
      setMode("login");
      setLoginStep("email");
    }
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Digite o e-mail cadastrado para recuperar o acesso."); return; }
    setError(""); setNotice(""); setSubmitting(true);
    const result = await onResetPassword(email);
    setSubmitting(false);
    if (result.ok) setNotice(result.message); else setError(result.message);
  }

  function switchMode(next: "login" | "signup") {
    setMode(next); setLoginStep("email"); setError(""); setNotice("");
  }

  function openAuth(next: "login" | "signup", step: "email" | "staff" = "email") {
    switchMode(next); setLoginStep(step); setView("auth");
  }

  if (view === "landing") {
    return (
      <main className="auth-landing">
        <div className="auth-landing-mosaic" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
        <div className="auth-landing-shade" aria-hidden="true" />
        <section className="auth-landing-content">
          <span className="auth-landing-mark-wrap"><HydraMark className="auth-landing-mark" /></span>
          <p className="auth-landing-kicker">Gestão rural em um só lugar</p>
          <h1>Água, rebanho e rotina.<br /><strong>Juntos.</strong></h1>
          <p className="auth-landing-copy">Use o Hydra Agro no Android, iPhone, iPad ou computador.</p>
          <div className="auth-landing-actions">
            <button className="auth-landing-primary" type="button" onClick={() => openAuth("login")}>Entrar</button>
            <button className="auth-landing-secondary" type="button" onClick={() => openAuth("signup")}>Criar conta</button>
          </div>
          <button className="auth-landing-staff" type="button" onClick={() => openAuth("login", "staff")}><UsersRound size={17} /> Acesso de funcionário</button>
        </section>
      </main>
    );
  }

  return (
    <main className={`auth-shell auth-shell-motion ${mode === "signup" ? "auth-shell-signup" : ""} ${loginStep === "staff" ? "auth-shell-staff" : ""}`}>
      <div className="signup-motion-bg" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <section className={`auth-card ${mode === "signup" ? "auth-card-wide" : ""}`}>
        {mode === "login" && loginStep === "email" && <button className="auth-home-back" type="button" onClick={() => { setView("landing"); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button>}
        <span className="auth-form-mark" aria-hidden="true"><HydraMark /></span>

        {mode === "login" ? (
          <div className="auth-content auth-enter" key={loginStep}>
            {loginStep === "email" ? (
              <form onSubmit={goToPassword}>
                <div className="auth-icon"><UserRound size={22} /></div>
                <h1>Bem-vindo de volta</h1>
                <p className="auth-subtitle">Entre para acessar sua propriedade.</p>
                <button className="google-auth-button" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}><span className="google-g" aria-hidden="true">G</span>{submitting ? "Abrindo Google…" : "Continuar com Google"}</button>
                <div className="auth-divider"><span>ou entre com seu e-mail</span></div>
                <Field label="E-mail"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus /></Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>Avançar <ArrowRight size={18} /></button>
                <button className="staff-entry-button" type="button" onClick={() => { setLoginStep("staff"); setError(""); setNotice(""); }}><UsersRound size={18} /><span><strong>Entrar como funcionário</strong><small>Use o código fornecido pelo dono</small></span><ArrowRight size={17} /></button>
                <p className="auth-switch">Ainda não tem conta? <button type="button" onClick={() => switchMode("signup")}>Criar conta</button></p>
              </form>
            ) : loginStep === "staff" ? (
              <form onSubmit={submitStaffLogin}>
                <button className="auth-back" type="button" onClick={() => { setView("landing"); setLoginStep("email"); setError(""); }}><ArrowLeft size={17} /> Voltar</button>
                <div className="auth-icon"><KeyRound size={22} /></div>
                <h1>Acesso de funcionário</h1>
                <p className="auth-subtitle">Digite o código que o dono da propriedade gerou para você.</p>
                <Field label="Código de acesso" hint="Exemplo: HA-7K3M-9Q2P-4RX8"><input className="staff-code-input" type="text" value={staffCode} onChange={(event) => { setStaffCode(formatStaffCode(event.target.value)); setError(""); }} placeholder="HA-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={17} autoFocus /></Field>
                <div className="staff-code-note"><UsersRound size={17} /><p><strong>Não precisa de Gmail nem senha.</strong><small>O código identifica seu acesso e a propriedade em que você trabalha.</small></p></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar na propriedade"}</button>
              </form>
            ) : loginStep === "password" ? (
              <form onSubmit={submitLogin}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("email"); setError(""); }}><ArrowLeft size={17} /> Voltar</button>
                <div className="auth-icon"><LockKeyhole size={22} /></div>
                <h1>Digite sua senha</h1>
                <button className="identity-chip" type="button" onClick={() => setLoginStep("email")}><span>{email.charAt(0).toUpperCase()}</span>{email}</button>
                <Field label="Senha"><div className="input-with-action"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" autoFocus /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></Field>
                <button className="text-button align-left" type="button" onClick={() => { setLoginStep("recovery"); setError(""); setNotice(""); }} disabled={submitting}>Esqueci minha senha</button>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
              </form>
            ) : (
              <form onSubmit={submitPasswordReset}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("password"); setError(""); setNotice(""); }}><ArrowLeft size={17} /> Voltar</button>
                <div className="auth-icon"><LockKeyhole size={22} /></div>
                <h1>Recuperar acesso</h1>
                <p className="auth-subtitle">Enviaremos um link seguro para você criar uma nova senha.</p>
                <Field label="E-mail cadastrado"><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setNotice(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus /></Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Enviando link…" : "Enviar link de recuperação"}</button>
                <p className="auth-switch">Lembrou a senha? <button type="button" onClick={() => { setLoginStep("password"); setError(""); setNotice(""); }}>Voltar para entrar</button></p>
              </form>
            )}
          </div>
        ) : (
          <div className="signup-flow auth-enter">
            <div className="signup-topline">
              <button className="auth-back" type="button" onClick={() => { setView("landing"); switchMode("login"); }}><ArrowLeft size={17} /> Voltar</button>
              <div className="step-dots" aria-label={`Etapa ${signupStep + 1} de 4`}>{[0, 1, 2, 3].map((step) => <span key={step} className={`${step === signupStep ? "active" : ""} ${step < signupStep ? "done" : ""}`} />)}</div>
            </div>

            {signupStep === 0 && (
              <form onSubmit={nextSignup} className="signup-panel">
                <span className="eyebrow">DADOS PESSOAIS</span><h1>Vamos criar sua conta</h1><p className="auth-subtitle">Comece com as informações básicas.</p>
                <button className="google-auth-button" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}><span className="google-g" aria-hidden="true">G</span>{submitting ? "Abrindo Google…" : "Criar conta com Google"}</button>
                <div className="auth-divider"><span>ou preencha seus dados</span></div>
                <div className="form-grid"><Field label="Nome completo"><input value={signup.name} onChange={(e) => changeSignup("name", e.target.value)} placeholder="Seu nome" autoComplete="name" /></Field><Field label="E-mail"><input type="email" value={signup.email} onChange={(e) => changeSignup("email", e.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit">Continuar <ArrowRight size={18} /></button>
              </form>
            )}

            {signupStep === 1 && (
              <form onSubmit={nextSignup} className="signup-panel">
                <span className="eyebrow">SEGURANÇA</span><h1>Proteja seu acesso</h1><p className="auth-subtitle">Crie uma senha segura para sua propriedade.</p>
                <div className="form-grid"><Field label="Senha" hint="Use pelo menos 8 caracteres e evite reutilizar senhas."><input type="password" value={signup.password} onChange={(e) => changeSignup("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" /></Field><Field label="Confirmar senha"><input type="password" value={signup.confirmPassword} onChange={(e) => changeSignup("confirmPassword", e.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></Field></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(0)}>Voltar</button><button className="primary-button" type="submit">Continuar <ArrowRight size={18} /></button></div>
              </form>
            )}

            {signupStep === 2 && (
              <form onSubmit={nextSignup} className="signup-panel">
                <span className="eyebrow">SUA PROPRIEDADE</span><h1>Onde fica sua propriedade?</h1><p className="auth-subtitle">Informe apenas UF, CEP e nome. O município será identificado automaticamente.</p>
                <PropertyLocationFields property={property} onChange={(next) => { setProperty(next); setError(""); }} onError={setError} />
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(1)}>Voltar</button><button className="primary-button" type="submit">Revisar <ArrowRight size={18} /></button></div>
              </form>
            )}

            {signupStep === 3 && (
              <div className="signup-panel review-panel">
                <span className="eyebrow">TUDO CERTO</span><h1>Sua base está pronta, {firstName}</h1><p className="auth-subtitle">Os demais detalhes da propriedade podem ser preenchidos depois.</p>
                <div className="review-card"><div className="review-icon"><MapPin size={23} /></div><div><strong>{property.name}</strong><span>{property.municipality}, {property.state}</span><small>CEP {property.postalCode}{property.municipalityIbgeCode ? ` · IBGE ${property.municipalityIbgeCode}` : ""}</small></div></div>
                <div className="preview-note">A localização identificada pelo CEP será salva de forma estruturada e associada somente à sua propriedade.</div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(2)}>Voltar</button><button className="primary-button" type="button" onClick={finishSignup} disabled={submitting}>{submitting ? "Criando conta…" : "Confirmar e criar conta"}</button></div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
