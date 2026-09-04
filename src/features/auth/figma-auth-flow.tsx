"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, MailCheck, UserRound } from "lucide-react";
import { PropertyLocationFields } from "../../components/property-location-fields";
import { Field } from "../../components/ui";
import { isValidCep } from "../../lib/brazil-location";
import { emptyProperty, type AuthResult, type Property, type SignupPayload } from "../../lib/hydra-types";
import {
  openPasswordRecoveryLink,
  requestPasswordResetCode,
  requestSignupCode,
  verifyPasswordResetCode,
  verifySignupCode,
} from "../../services/auth-email-service";
import "./figma-auth-flow.css";

type Props = {
  onLogin: (email: string, password: string) => Promise<AuthResult>;
  onGoogleLogin: () => Promise<AuthResult>;
  onStaffLogin: (code: string) => Promise<AuthResult>;
  onSignup: (payload: SignupPayload) => Promise<AuthResult>;
  onResetPassword: (email: string) => Promise<AuthResult>;
};

type Screen = "welcome" | "login" | "signup" | "details" | "property" | "signupCode" | "recovery" | "recoveryCode" | "staff";

const WELCOME_ART = "https://www.figma.com/api/mcp/asset/52818267-c58a-4f5b-a301-996c1193f2ca.png";

function formatStaffCode(value: string) {
  let compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (compact && !compact.startsWith("HA")) compact = `HA${compact}`.slice(0, 14);
  const body = compact.startsWith("HA") ? compact.slice(2) : compact;
  const groups = body.match(/.{1,4}/g) ?? [];
  return compact ? `HA${groups.length ? `-${groups.join("-")}` : ""}` : "";
}

export function FigmaAuthFlow({ onLogin, onStaffLogin, onSignup }: Props) {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [property, setProperty] = useState<Property>({ ...emptyProperty });
  const [signupCode, setSignupCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = window.setInterval(() => setCodeCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeCooldown]);

  function go(next: Screen) {
    setError("");
    setNotice("");
    setScreen(next);
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Digite um e-mail válido."); return; }
    if (!password) { setError("Digite sua senha."); return; }
    setSubmitting(true);
    const result = await onLogin(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  function submitSignupStart(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Digite um e-mail válido."); return; }
    if (password.length < 8) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    go("details");
  }

  function submitDetails(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) { setError("Informe seu nome completo."); return; }
    go("property");
  }

  async function submitProperty(event: FormEvent) {
    event.preventDefault();
    if (!property.state) { setError("Selecione a UF da propriedade."); return; }
    if (!isValidCep(property.postalCode)) { setError("Digite um CEP completo no formato 00000-000."); return; }
    if (!property.municipality.trim()) { setError("Aguarde a identificação do município pelo CEP."); return; }
    if (!property.name.trim()) { setError("Informe o nome da propriedade."); return; }

    setSubmitting(true);
    setError("");
    try {
      await requestSignupCode(email.trim());
      setSignupCode("");
      setCodeCooldown(60);
      setNotice("Enviamos um código para confirmar seu e-mail.");
      setScreen("signupCode");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o código agora.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignupCode(event: FormEvent) {
    event.preventDefault();
    const code = signupCode.replace(/\D/g, "");
    if (code.length !== 6) { setError("Digite o código de 6 dígitos."); return; }
    setSubmitting(true);
    setError("");
    try {
      await verifySignupCode(email.trim(), code);
      const result = await onSignup({ name: name.trim(), email: email.trim(), phone: "", password, property });
      if (!result.ok) setError(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível confirmar o cadastro agora.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendSignupCode() {
    if (submitting || codeCooldown > 0) return;
    setSubmitting(true);
    try {
      await requestSignupCode(email.trim());
      setCodeCooldown(60);
      setNotice("Um novo código foi enviado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível reenviar o código.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRecovery(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Digite o e-mail cadastrado."); return; }
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordResetCode(email.trim());
      setRecoveryCode("");
      setCodeCooldown(60);
      setNotice("Enviamos um código de recuperação para seu e-mail.");
      setScreen("recoveryCode");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o código agora.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRecoveryCode(event: FormEvent) {
    event.preventDefault();
    const code = recoveryCode.replace(/\D/g, "");
    if (code.length !== 6) { setError("Digite o código de 6 dígitos."); return; }
    setSubmitting(true);
    setError("");
    try {
      const actionLink = await verifyPasswordResetCode(email.trim(), code);
      await openPasswordRecoveryLink(actionLink);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível validar o código agora.");
      setSubmitting(false);
    }
  }

  async function submitStaff(event: FormEvent) {
    event.preventDefault();
    const compact = staffCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^HA[A-Z2-9]{12}$/.test(compact)) { setError("Digite o código completo fornecido pelo dono da propriedade."); return; }
    setSubmitting(true);
    const result = await onStaffLogin(staffCode);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  const decorative = <><span className="figma-shape figma-shape-top-a" /><span className="figma-shape figma-shape-top-b" /><span className="figma-square figma-square-a" /><span className="figma-square figma-square-b" /></>;

  if (screen === "welcome") {
    return (
      <main className="figma-auth figma-auth-welcome" data-figma-node="1:2">
        {decorative}
        <div className="figma-welcome-art" aria-hidden="true"><img src={WELCOME_ART} alt="" /></div>
        <section className="figma-welcome-copy">
          <h1>Bem-vindo !<br />ao Hydra Agro</h1>
          <p>tecnologia e praticidade para cuidar melhor da sua produção</p>
        </section>
        <div className="figma-welcome-actions">
          <button className="figma-primary figma-half" type="button" onClick={() => go("login")}>Login</button>
          <button className="figma-plain figma-half" type="button" onClick={() => go("signup")}>Criar Conta</button>
        </div>
      </main>
    );
  }

  if (screen === "login") {
    return (
      <main className="figma-auth figma-auth-form" data-figma-node="3:13">
        {decorative}
        <button className="figma-back" type="button" onClick={() => go("welcome")} aria-label="Voltar"><ArrowLeft size={22} /></button>
        <header className="figma-form-header">
          <h1>bem-vindo de volta !</h1>
          <p>entre na sua conta para continuar</p>
        </header>
        <form className="figma-form" onSubmit={submitLogin}>
          <input className="figma-input is-active" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="Email" autoComplete="email" />
          <div className="figma-password-wrap">
            <input className="figma-input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="senha" autoComplete="current-password" />
            <button type="button" className="figma-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <button className="figma-forgot" type="button" onClick={() => go("recovery")}>Esqueceu sua senha ?</button>
          {notice && <p className="figma-notice">{notice}</p>}
          {error && <p className="figma-error">{error}</p>}
          <button className="figma-primary figma-full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
          <button className="figma-account-switch" type="button" onClick={() => go("signup")}>ainda não tem uma conta? criar conta</button>
          <button className="figma-staff-link" type="button" onClick={() => go("staff")}>acesso de funcionário</button>
        </form>
      </main>
    );
  }

  if (screen === "signup") {
    return (
      <main className="figma-auth figma-auth-form" data-figma-node="203:84">
        {decorative}
        <button className="figma-back" type="button" onClick={() => go("welcome")} aria-label="Voltar"><ArrowLeft size={22} /></button>
        <header className="figma-form-header figma-register-header"><h1>comece agora a usar o hydra agro !</h1></header>
        <form className="figma-form figma-register-form" onSubmit={submitSignupStart}>
          <input className="figma-input is-active" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="Email" autoComplete="email" />
          <input className="figma-input" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Senha" autoComplete="new-password" />
          <input className="figma-input" type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} placeholder="Confirmar a senha" autoComplete="new-password" />
          {error && <p className="figma-error">{error}</p>}
          <button className="figma-primary figma-full" type="submit">Criar Conta</button>
          <button className="figma-account-switch" type="button" onClick={() => go("login")}>já possui uma conta? entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="figma-auth figma-auth-form figma-auth-extra">
      {decorative}
      <button className="figma-back" type="button" onClick={() => {
        if (screen === "details") go("signup");
        else if (screen === "property") go("details");
        else if (screen === "signupCode") go("property");
        else if (screen === "recovery") go("login");
        else if (screen === "recoveryCode") go("recovery");
        else if (screen === "staff") go("login");
      }} aria-label="Voltar"><ArrowLeft size={22} /></button>

      {screen === "details" && <section className="figma-extra-card"><div className="figma-extra-icon"><UserRound size={24} /></div><h1>seus dados</h1><p>falta só identificar quem vai cuidar da propriedade.</p><form onSubmit={submitDetails}><Field label="Nome completo"><input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Seu nome" autoFocus /></Field>{error && <p className="figma-error">{error}</p>}<button className="figma-primary figma-full" type="submit">Continuar</button></form></section>}

      {screen === "property" && <section className="figma-extra-card figma-extra-wide"><div className="figma-extra-icon"><UserRound size={24} /></div><h1>sua propriedade</h1><p>informe UF, CEP e nome da propriedade.</p><form onSubmit={submitProperty}><PropertyLocationFields property={property} onChange={(next) => { setProperty(next); setError(""); }} onError={setError} />{error && <p className="figma-error">{error}</p>}<button className="figma-primary figma-full" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Continuar"}</button></form></section>}

      {screen === "signupCode" && <section className="figma-extra-card"><div className="figma-extra-icon"><MailCheck size={24} /></div><h1>confirme seu e-mail</h1><p>digite o código de 6 dígitos enviado para {email}.</p><form onSubmit={submitSignupCode}><input className="figma-input figma-code" value={signupCode} onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />{notice && <p className="figma-notice">{notice}</p>}{error && <p className="figma-error">{error}</p>}<button className="figma-primary figma-full" type="submit" disabled={submitting}>{submitting ? "Confirmando…" : "Confirmar"}</button><button className="figma-account-switch" type="button" onClick={() => void resendSignupCode()} disabled={submitting || codeCooldown > 0}>{codeCooldown > 0 ? `reenviar em ${codeCooldown}s` : "reenviar código"}</button></form></section>}

      {screen === "recovery" && <section className="figma-extra-card"><div className="figma-extra-icon"><MailCheck size={24} /></div><h1>recuperar acesso</h1><p>digite o e-mail cadastrado para receber um código.</p><form onSubmit={submitRecovery}><input className="figma-input is-active" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" />{error && <p className="figma-error">{error}</p>}<button className="figma-primary figma-full" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar código"}</button></form></section>}

      {screen === "recoveryCode" && <section className="figma-extra-card"><div className="figma-extra-icon"><KeyRound size={24} /></div><h1>código de recuperação</h1><p>digite o código enviado para {email}.</p><form onSubmit={submitRecoveryCode}><input className="figma-input figma-code" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />{notice && <p className="figma-notice">{notice}</p>}{error && <p className="figma-error">{error}</p>}<button className="figma-primary figma-full" type="submit" disabled={submitting}>{submitting ? "Validando…" : "Continuar"}</button></form></section>}

      {screen === "staff" && <section className="figma-extra-card"><div className="figma-extra-icon"><KeyRound size={24} /></div><h1>acesso de funcionário</h1><p>use o código fornecido pelo dono da propriedade.</p><form onSubmit={submitStaff}><input className="figma-input is-active figma-staff-code" value={staffCode} onChange={(e) => { setStaffCode(formatStaffCode(e.target.value)); setError(""); }} placeholder="HA-7K3M-9Q2P-4RX8" autoCapitalize="characters" />{error && <p className="figma-error">{error}</p>}<button className="figma-primary figma-full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button></form></section>}
    </main>
  );
}
