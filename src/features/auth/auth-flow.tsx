"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MapPin,
  UserRound,
  UsersRound,
} from "lucide-react";
import { HydraMark } from "../../components/brand";
import { MunicipalityPicker } from "../../components/municipality-picker";
import { Field } from "../../components/ui";
import { emptyProperty, type AuthResult, type Property, type SignupPayload } from "../../lib/hydra-types";
import { isSupportedMunicipality } from "../../lib/municipalities";

const activities = [
  "Pecuária",
  "Agricultura",
  "Cacau",
  "Café",
  "Fruticultura",
  "Apicultura",
  "Avicultura",
  "Outras atividades",
];

const waterKinds = [
  "Poço",
  "Cisterna",
  "Nascente",
  "Açude",
  "Reservatório",
  "Rede",
  "Outra",
];

type Props = {
  onLogin: (email: string, password: string) => Promise<AuthResult>;
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

export function AuthFlow({ onLogin, onStaffLogin, onSignup, onResetPassword }: Props) {
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
  const [signup, setSignup] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [property, setProperty] = useState<Property>({ ...emptyProperty });

  const firstName = useMemo(
    () => signup.name.trim().split(/\s+/)[0] || "Produtor",
    [signup.name],
  );

  function changeSignup(field: keyof typeof signup, value: string) {
    setSignup((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function changeProperty(field: keyof Property, value: string | string[]) {
    setProperty((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function goToPassword(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Digite um e-mail válido para continuar.");
      return;
    }
    setError("");
    setLoginStep("password");
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Digite sua senha.");
      return;
    }
    setSubmitting(true);
    const result = await onLogin(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  async function submitStaffLogin(event: FormEvent) {
    event.preventDefault();
    const compact = staffCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^HA[A-Z2-9]{12}$/.test(compact)) {
      setError("Digite o código completo fornecido pelo dono da propriedade.");
      return;
    }
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
      if (signup.phone.replace(/\D/g, "").length < 10) return "Informe um telefone válido.";
      if (signup.password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
      if (signup.password !== signup.confirmPassword) return "As senhas não coincidem.";
    }
    if (signupStep === 1) {
      if (!property.name.trim()) return "Informe o nome da propriedade.";
      if (!property.municipality.trim()) return "Informe o município.";
      if (!isSupportedMunicipality(property.municipality)) return "Escolha Brejões ou um dos municípios vizinhos atendidos.";
      if (!property.area.trim()) return "Informe a área da propriedade.";
      const area = Number(property.area.replace(",", "."));
      if (!Number.isFinite(area) || area <= 0) return "Informe uma área válida, maior que zero.";
      if (!property.type) return "Selecione o tipo de propriedade.";
    }
    if (signupStep === 2) {
      if (!property.mainActivity) return "Selecione a principal atividade.";
      if (property.approximateAnimals && (!/^\d+$/.test(property.approximateAnimals) || Number(property.approximateAnimals) < 0)) return "Informe uma quantidade válida de animais.";
    }
    return "";
  }

  function nextSignup(event: FormEvent) {
    event.preventDefault();
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setSignupStep((current) => Math.min(current + 1, 3));
  }

  async function finishSignup() {
    setSubmitting(true);
    const result = await onSignup({
      name: signup.name,
      email: signup.email,
      phone: signup.phone,
      password: signup.password,
      property,
    });
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
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Digite o e-mail cadastrado para recuperar o acesso.");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    const result = await onResetPassword(email);
    setSubmitting(false);
    if (result.ok) setNotice(result.message);
    else setError(result.message);
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setLoginStep("email");
    setError("");
    setNotice("");
  }

  function openAuth(next: "login" | "signup", step: "email" | "staff" = "email") {
    switchMode(next);
    setLoginStep(step);
    setView("auth");
  }

  if (view === "landing") {
    return (
      <main className="auth-landing">
        <div className="auth-landing-mosaic" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
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
                <Field label="E-mail">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); setError(""); }}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    autoFocus
                  />
                </Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>
                  Avançar <ArrowRight size={18} />
                </button>
                <button className="staff-entry-button" type="button" onClick={() => { setLoginStep("staff"); setError(""); setNotice(""); }}>
                  <UsersRound size={18} /><span><strong>Entrar como funcionário</strong><small>Use o código fornecido pelo dono</small></span><ArrowRight size={17} />
                </button>
                <p className="auth-switch">
                  Ainda não tem conta?{" "}
                  <button type="button" onClick={() => switchMode("signup")}>Criar conta</button>
                </p>
              </form>
            ) : loginStep === "staff" ? (
              <form onSubmit={submitStaffLogin}>
                <button className="auth-back" type="button" onClick={() => { setView("landing"); setLoginStep("email"); setError(""); }}>
                  <ArrowLeft size={17} /> Voltar
                </button>
                <div className="auth-icon"><KeyRound size={22} /></div>
                <h1>Acesso de funcionário</h1>
                <p className="auth-subtitle">Digite o código que o dono da propriedade gerou para você.</p>
                <Field label="Código de acesso" hint="Exemplo: HA-7K3M-9Q2P-4RX8">
                  <input
                    className="staff-code-input"
                    type="text"
                    value={staffCode}
                    onChange={(event) => { setStaffCode(formatStaffCode(event.target.value)); setError(""); }}
                    placeholder="HA-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={17}
                    autoFocus
                  />
                </Field>
                <div className="staff-code-note"><UsersRound size={17} /><p><strong>Não precisa de Gmail nem senha.</strong><small>O código identifica seu acesso e a propriedade em que você trabalha.</small></p></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>
                  {submitting ? "Entrando…" : "Entrar na propriedade"}
                </button>
              </form>
            ) : loginStep === "password" ? (
              <form onSubmit={submitLogin}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("email"); setError(""); }}>
                  <ArrowLeft size={17} /> Voltar
                </button>
                <div className="auth-icon"><LockKeyhole size={22} /></div>
                <h1>Digite sua senha</h1>
                <button className="identity-chip" type="button" onClick={() => setLoginStep("email")}>
                  <span>{email.charAt(0).toUpperCase()}</span>{email}
                </button>
                <Field label="Senha">
                  <div className="input-with-action">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); setError(""); }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </Field>
                <button className="text-button align-left" type="button" onClick={() => { setLoginStep("recovery"); setError(""); setNotice(""); }} disabled={submitting}>
                  Esqueci minha senha
                </button>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
              </form>
            ) : (
              <form onSubmit={submitPasswordReset}>
                <button className="auth-back" type="button" onClick={() => { setLoginStep("password"); setError(""); setNotice(""); }}>
                  <ArrowLeft size={17} /> Voltar
                </button>
                <div className="auth-icon"><LockKeyhole size={22} /></div>
                <h1>Recuperar acesso</h1>
                <p className="auth-subtitle">Enviaremos um link seguro para você criar uma nova senha.</p>
                <Field label="E-mail cadastrado">
                  <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setNotice(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus />
                </Field>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit" disabled={submitting}>
                  {submitting ? "Enviando link…" : "Enviar link de recuperação"}
                </button>
                <p className="auth-switch">Lembrou a senha? <button type="button" onClick={() => { setLoginStep("password"); setError(""); setNotice(""); }}>Voltar para entrar</button></p>
              </form>
            )}
          </div>
        ) : (
          <div className="signup-flow auth-enter">
            <div className="signup-topline">
              <button className="auth-back" type="button" onClick={() => { setView("landing"); switchMode("login"); }}><ArrowLeft size={17} /> Voltar</button>
              <div className="step-dots" aria-label={`Etapa ${signupStep + 1} de 4`}>
                {[0, 1, 2, 3].map((step) => <span key={step} className={`${step === signupStep ? "active" : ""} ${step < signupStep ? "done" : ""}`} />)}
              </div>
            </div>

            {signupStep === 0 && (
              <form onSubmit={nextSignup} className="signup-panel">
                <span className="eyebrow">DADOS PESSOAIS</span><h1>Vamos criar sua conta</h1><p className="auth-subtitle">Seus dados ficam separados dos demais usuários.</p>
                <div className="form-grid">
                  <Field label="Nome completo"><input value={signup.name} onChange={(e) => changeSignup("name", e.target.value)} placeholder="Seu nome" autoComplete="name" /></Field>
                  <Field label="E-mail"><input type="email" value={signup.email} onChange={(e) => changeSignup("email", e.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field>
                  <Field label="Telefone"><input type="tel" value={signup.phone} onChange={(e) => changeSignup("phone", e.target.value)} placeholder="(75) 99999-9999" autoComplete="tel" /></Field>
                  <Field label="Senha" hint="Use pelo menos 8 caracteres e evite reutilizar senhas."><input type="password" value={signup.password} onChange={(e) => changeSignup("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" /></Field>
                  <Field label="Confirmar senha"><input type="password" value={signup.confirmPassword} onChange={(e) => changeSignup("confirmPassword", e.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></Field>
                </div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button full" type="submit">Continuar <ArrowRight size={18} /></button>
              </form>
            )}

            {signupStep === 1 && (
              <form onSubmit={nextSignup} className="signup-panel">
                <span className="eyebrow">SUA PROPRIEDADE</span><h1>Conte sobre sua terra</h1><p className="auth-subtitle">Esses dados já formarão a ficha da propriedade.</p>
                <div className="form-grid">
                  <Field label="Nome da propriedade"><input value={property.name} onChange={(e) => changeProperty("name", e.target.value)} placeholder="Ex.: Fazenda Boa Vista" /></Field>
                  <div className="municipality-field-grid">
                    <Field label="Município"><MunicipalityPicker value={property.municipality} onChange={(municipality) => changeProperty("municipality", municipality)} /></Field>
                    <Field label="Estado"><div className="state-readonly" aria-label="Estado Bahia"><span>BA</span><strong>Bahia</strong></div></Field>
                  </div>
                  <div className="field-combo">
                    <Field label="Área"><input inputMode="decimal" value={property.area} onChange={(e) => changeProperty("area", e.target.value)} placeholder="0" /></Field>
                    <Field label="Unidade"><select value={property.areaUnit} onChange={(e) => changeProperty("areaUnit", e.target.value)}><option value="hectares">hectares</option><option value="tarefas">tarefas</option><option value="alqueires">alqueires</option></select></Field>
                  </div>
                  <Field label="Tipo da propriedade"><select value={property.type} onChange={(e) => changeProperty("type", e.target.value)}><option value="">Selecione</option><option>Familiar</option><option>Comercial</option><option>Assentamento</option><option>Cooperativa</option><option>Outra</option></select></Field>
                </div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(0)}>Voltar</button><button className="primary-button" type="submit">Continuar <ArrowRight size={18} /></button></div>
              </form>
            )}

            {signupStep === 2 && (
              <form onSubmit={nextSignup} className="signup-panel">
                <span className="eyebrow">PRODUÇÃO E RECURSOS</span><h1>O que acontece por aí?</h1><p className="auth-subtitle">Escolha a atividade principal e tudo que fizer parte da rotina.</p>
                <Field label="Principal atividade"><select value={property.mainActivity} onChange={(e) => changeProperty("mainActivity", e.target.value)}><option value="">Selecione</option>{activities.map((activity) => <option key={activity}>{activity}</option>)}</select></Field>
                <Field label="Outras atividades"><div className="choice-grid">{activities.filter((item) => item !== property.mainActivity).map((activity) => { const active = property.otherActivities.includes(activity); return <button type="button" key={activity} className={`choice-chip ${active ? "active" : ""}`} onClick={() => changeProperty("otherActivities", active ? property.otherActivities.filter((item) => item !== activity) : [...property.otherActivities, activity])}>{active && <Check size={14} />} {activity}</button>; })}</div></Field>
                <Field label="Quantidade aproximada de animais" hint="Pode deixar em branco se não houver rebanho."><input inputMode="numeric" value={property.approximateAnimals} onChange={(e) => changeProperty("approximateAnimals", e.target.value)} placeholder="0" /></Field>
                <Field label="Fontes de água disponíveis"><div className="choice-grid">{waterKinds.map((kind) => { const active = property.waterKinds.includes(kind); return <button type="button" key={kind} className={`choice-chip ${active ? "active" : ""}`} onClick={() => changeProperty("waterKinds", active ? property.waterKinds.filter((item) => item !== kind) : [...property.waterKinds, kind])}>{active && <Check size={14} />} {kind}</button>; })}</div></Field>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSignupStep(1)}>Voltar</button><button className="primary-button" type="submit">Revisar <ArrowRight size={18} /></button></div>
              </form>
            )}

            {signupStep === 3 && (
              <div className="signup-panel review-panel">
                <span className="eyebrow">TUDO CERTO</span><h1>Sua base está pronta, {firstName}</h1><p className="auth-subtitle">Você poderá editar tudo depois no perfil.</p>
                <div className="review-card"><div className="review-icon"><MapPin size={23} /></div><div><strong>{property.name}</strong><span>{property.municipality}, {property.state}</span><small>{property.area} {property.areaUnit} · {property.mainActivity}</small></div></div>
                <div className="preview-note">Seus dados serão associados à sua conta e isolados dos demais produtores pelo servidor.</div>
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
