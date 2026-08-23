"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, UsersRound } from "lucide-react";
import { HydraMark } from "../../components/brand";
import { MunicipalityPicker } from "../../components/municipality-picker";
import { Field } from "../../components/ui";
import { emptyProperty, type AuthResult, type Property, type SignupPayload } from "../../lib/hydra-types";
import { isSupportedMunicipality } from "../../lib/municipalities";
import "./auth-flow-v2.css";

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
  onGoogleLogin: () => Promise<AuthResult>;
  onStaffLogin: (code: string) => Promise<AuthResult>;
  onSignup: (payload: SignupPayload) => Promise<AuthResult>;
  onResetPassword: (email: string) => Promise<AuthResult>;
};

type LoginView = "main" | "recovery" | "staff";

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
  const [loginView, setLoginView] = useState<LoginView>("main");
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

  const firstName = useMemo(() => signup.name.trim().split(/\s+/)[0] || "Produtor", [signup.name]);
  const signupSteps = 7;

  function changeSignup(field: keyof typeof signup, value: string) {
    setSignup((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function changeProperty(field: keyof Property, value: string | string[]) {
    setProperty((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setLoginView("main");
    setError("");
    setNotice("");
    if (next === "signup") setSignupStep(0);
  }

  function openAuth(next: "login" | "signup", nextLoginView: LoginView = "main") {
    setMode(next);
    setLoginView(nextLoginView);
    setError("");
    setNotice("");
    if (next === "signup") setSignupStep(0);
    setView("auth");
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Digite um e-mail válido.");
      return;
    }
    if (!password) {
      setError("Digite sua senha.");
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await onLogin(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  async function submitGoogleLogin() {
    setError("");
    setNotice("");
    setSubmitting(true);
    const result = await onGoogleLogin();
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

  function validateSignupStep() {
    if (signupStep === 0) {
      if (signup.name.trim().length < 2) return "Informe seu nome completo.";
      if (!/^\S+@\S+\.\S+$/.test(signup.email)) return "Informe um e-mail válido.";
      if (signup.phone.replace(/\D/g, "").length < 10) return "Informe um telefone válido.";
    }
    if (signupStep === 1) {
      if (signup.password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
      if (signup.password !== signup.confirmPassword) return "As senhas não coincidem.";
    }
    if (signupStep === 2) {
      if (!property.name.trim()) return "Informe o nome da propriedade.";
      if (!property.municipality.trim()) return "Informe o município.";
      if (!isSupportedMunicipality(property.municipality)) return "Escolha Brejões ou um dos municípios vizinhos atendidos.";
    }
    if (signupStep === 3) {
      if (!property.area.trim()) return "Informe a área da propriedade.";
      const area = Number(property.area.replace(",", "."));
      if (!Number.isFinite(area) || area <= 0) return "Informe uma área válida, maior que zero.";
      if (!property.type) return "Selecione o tipo de propriedade.";
    }
    if (signupStep === 4 && !property.mainActivity) return "Selecione a principal atividade.";
    if (signupStep === 5 && property.approximateAnimals && (!/^\d+$/.test(property.approximateAnimals) || Number(property.approximateAnimals) < 0)) {
      return "Informe uma quantidade válida de animais.";
    }
    return "";
  }

  function nextSignup(event: FormEvent) {
    event.preventDefault();
    const message = validateSignupStep();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setSignupStep((current) => Math.min(current + 1, signupSteps - 1));
  }

  function previousSignup() {
    setError("");
    setSignupStep((current) => Math.max(0, current - 1));
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
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.needsEmailConfirmation) {
      setEmail(signup.email);
      setNotice(result.message);
      setMode("login");
      setLoginView("main");
    }
  }

  /* LANDING ORIGINAL — NÃO ALTERAR VISUAL NESTE BLOCO. */
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

  if (mode === "login") {
    return (
      <main className="auth-v2-shell auth-v2-login">
        <button className="auth-v2-back" type="button" aria-label="Voltar" onClick={() => {
          if (loginView === "main") setView("landing");
          else setLoginView("main");
          setError("");
          setNotice("");
        }}><ArrowLeft size={20} /></button>

        <section className="auth-v2-login-card">
          <span className="auth-v2-login-brand" aria-hidden="true"><HydraMark /></span>

          {loginView === "main" && (
            <form onSubmit={submitLogin}>
              <h1>Entrar no Hydra Agro</h1>
              <p className="auth-v2-login-copy">Acesse sua propriedade e continue de onde parou.</p>

              <button className="auth-v2-google" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}>
                <span className="auth-v2-google-g" aria-hidden="true">G</span>
                {submitting ? "Abrindo Google…" : "Continuar com Google"}
              </button>

              <div className="auth-v2-divider">ou entre com e-mail</div>

              <Field label="E-mail">
                <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="voce@email.com" autoComplete="email" />
              </Field>

              <Field label="Senha">
                <div className="auth-v2-password-wrap">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" />
                  <button className="auth-v2-password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>

              <button className="auth-v2-forgot" type="button" onClick={() => { setLoginView("recovery"); setError(""); setNotice(""); }}>Esqueci minha senha</button>
              {notice && <p className="form-notice" role="status">{notice}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="auth-v2-login-primary" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>

              <div className="auth-v2-login-links">
                <span>Ainda não tem conta? <button type="button" onClick={() => switchMode("signup")}>Criar conta</button></span>
                <button className="auth-v2-staff-link" type="button" onClick={() => { setLoginView("staff"); setError(""); }}><UsersRound size={17} /> Entrar como funcionário</button>
              </div>
            </form>
          )}

          {loginView === "recovery" && (
            <form onSubmit={submitPasswordReset}>
              <h1>Recuperar acesso</h1>
              <p className="auth-v2-login-copy">Informe o e-mail cadastrado para receber o link de recuperação.</p>
              <Field label="E-mail cadastrado">
                <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setNotice(""); }} placeholder="voce@email.com" autoComplete="email" autoFocus />
              </Field>
              {notice && <p className="form-notice" role="status">{notice}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="auth-v2-login-primary" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar link"}</button>
            </form>
          )}

          {loginView === "staff" && (
            <form onSubmit={submitStaffLogin}>
              <h1>Acesso de funcionário</h1>
              <p className="auth-v2-login-copy">Use o código fornecido pelo dono da propriedade.</p>
              <Field label="Código de acesso" hint="Exemplo: HA-7K3M-9Q2P-4RX8">
                <input className="staff-code-input" type="text" value={staffCode} onChange={(event) => { setStaffCode(formatStaffCode(event.target.value)); setError(""); }} placeholder="HA-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={17} autoFocus />
              </Field>
              <div className="staff-code-note"><KeyRound size={17} /><p><strong>Sem e-mail e senha</strong><small>O código identifica seu acesso e a propriedade.</small></p></div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="auth-v2-login-primary" type="submit" disabled={submitting}>{submitting ? "Entrando…" : "Entrar na propriedade"}</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  const progress = `${((signupStep + 1) / signupSteps) * 100}%`;

  return (
    <main className="auth-v2-shell auth-v2-signup">
      <div className="auth-v2-signup-inner">
        <header className="auth-v2-signup-top">
          <button className="auth-v2-back" type="button" aria-label="Voltar" onClick={() => {
            if (signupStep === 0) {
              setView("landing");
              setMode("login");
            } else {
              previousSignup();
            }
          }}><ArrowLeft size={20} /></button>
          <div className="auth-v2-progress" aria-label={`Etapa ${signupStep + 1} de ${signupSteps}`}><span style={{ width: progress }} /></div>
          <span className="auth-v2-step-count">{signupStep + 1}/{signupSteps}</span>
        </header>

        {signupStep === 0 && (
          <form className="auth-v2-question" onSubmit={nextSignup}>
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Sua conta</p>
              <h1>Quem vai usar o Hydra Agro?</h1>
              <p className="auth-v2-question-copy">Comece com seus dados básicos. Você poderá editar depois.</p>
            </div>

            <div className="auth-v2-question-google">
              <button className="auth-v2-google" type="button" onClick={() => void submitGoogleLogin()} disabled={submitting}>
                <span className="auth-v2-google-g" aria-hidden="true">G</span>
                {submitting ? "Abrindo Google…" : "Criar conta com Google"}
              </button>
            </div>

            <Field label="Nome completo"><input value={signup.name} onChange={(event) => changeSignup("name", event.target.value)} placeholder="Seu nome" autoComplete="name" /></Field>
            <Field label="E-mail"><input type="email" value={signup.email} onChange={(event) => changeSignup("email", event.target.value)} placeholder="voce@email.com" autoComplete="email" /></Field>
            <Field label="Telefone"><input type="tel" value={signup.phone} onChange={(event) => changeSignup("phone", event.target.value)} placeholder="(75) 99999-9999" autoComplete="tel" /></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="auth-v2-question-actions"><button className="auth-v2-question-back" type="button" onClick={() => setView("landing")}><ArrowLeft size={20} /></button><button className="auth-v2-question-primary" type="submit">Continuar <ArrowRight size={17} /></button></div>
          </form>
        )}

        {signupStep === 1 && (
          <form className="auth-v2-question" onSubmit={nextSignup}>
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Segurança</p>
              <h1>Como você quer proteger sua conta?</h1>
              <p className="auth-v2-question-copy">Use pelo menos 8 caracteres.</p>
            </div>
            <Field label="Crie uma senha"><input type="password" value={signup.password} onChange={(event) => changeSignup("password", event.target.value)} placeholder="Digite sua senha" autoComplete="new-password" /></Field>
            <Field label="Confirme a senha"><input type="password" value={signup.confirmPassword} onChange={(event) => changeSignup("confirmPassword", event.target.value)} placeholder="Repita sua senha" autoComplete="new-password" /></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <QuestionActions back={previousSignup} label="Continuar" />
          </form>
        )}

        {signupStep === 2 && (
          <form className="auth-v2-question" onSubmit={nextSignup}>
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Sua propriedade</p>
              <h1>Onde fica sua propriedade?</h1>
              <p className="auth-v2-question-copy">Essas informações formam a ficha inicial da propriedade.</p>
            </div>
            <Field label="Nome da propriedade"><input value={property.name} onChange={(event) => changeProperty("name", event.target.value)} placeholder="Ex.: Fazenda Boa Vista" /></Field>
            <div className="municipality-field-grid">
              <Field label="Município"><MunicipalityPicker value={property.municipality} onChange={(municipality) => changeProperty("municipality", municipality)} /></Field>
              <Field label="Estado"><div className="state-readonly" aria-label="Estado Bahia"><span>BA</span><strong>Bahia</strong></div></Field>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <QuestionActions back={previousSignup} label="Continuar" />
          </form>
        )}

        {signupStep === 3 && (
          <form className="auth-v2-question" onSubmit={nextSignup}>
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Tamanho e perfil</p>
              <h1>Como é a sua propriedade?</h1>
              <p className="auth-v2-question-copy">Informe a área aproximada e o tipo da propriedade.</p>
            </div>
            <div className="field-combo">
              <Field label="Área"><input inputMode="decimal" value={property.area} onChange={(event) => changeProperty("area", event.target.value)} placeholder="0" /></Field>
              <Field label="Unidade"><select value={property.areaUnit} onChange={(event) => changeProperty("areaUnit", event.target.value)}><option value="hectares">hectares</option><option value="tarefas">tarefas</option><option value="alqueires">alqueires</option></select></Field>
            </div>
            <Field label="Tipo da propriedade"><select value={property.type} onChange={(event) => changeProperty("type", event.target.value)}><option value="">Selecione</option><option>Familiar</option><option>Comercial</option><option>Assentamento</option><option>Cooperativa</option><option>Outra</option></select></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <QuestionActions back={previousSignup} label="Continuar" />
          </form>
        )}

        {signupStep === 4 && (
          <form className="auth-v2-question" onSubmit={nextSignup}>
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Produção</p>
              <h1>O que você produz por aí?</h1>
              <p className="auth-v2-question-copy">Escolha a atividade principal e marque outras atividades da rotina.</p>
            </div>
            <Field label="Principal atividade"><select value={property.mainActivity} onChange={(event) => changeProperty("mainActivity", event.target.value)}><option value="">Selecione</option>{activities.map((activity) => <option key={activity}>{activity}</option>)}</select></Field>
            <Field label="Outras atividades"><div className="choice-grid">{activities.filter((item) => item !== property.mainActivity).map((activity) => { const active = property.otherActivities.includes(activity); return <button type="button" key={activity} className={`choice-chip ${active ? "active" : ""}`} onClick={() => changeProperty("otherActivities", active ? property.otherActivities.filter((item) => item !== activity) : [...property.otherActivities, activity])}>{active && <Check size={14} />} {activity}</button>; })}</div></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <QuestionActions back={previousSignup} label="Continuar" />
          </form>
        )}

        {signupStep === 5 && (
          <form className="auth-v2-question" onSubmit={nextSignup}>
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Rebanho e água</p>
              <h1>Como é sua estrutura hoje?</h1>
              <p className="auth-v2-question-copy">Esses dados ajudam a preparar as áreas de Rebanho e Água.</p>
            </div>
            <Field label="Quantidade aproximada de animais" hint="Pode deixar em branco se não houver rebanho."><input inputMode="numeric" value={property.approximateAnimals} onChange={(event) => changeProperty("approximateAnimals", event.target.value)} placeholder="0" /></Field>
            <Field label="Fontes de água disponíveis"><div className="choice-grid">{waterKinds.map((kind) => { const active = property.waterKinds.includes(kind); return <button type="button" key={kind} className={`choice-chip ${active ? "active" : ""}`} onClick={() => changeProperty("waterKinds", active ? property.waterKinds.filter((item) => item !== kind) : [...property.waterKinds, kind])}>{active && <Check size={14} />} {kind}</button>; })}</div></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <QuestionActions back={previousSignup} label="Revisar" />
          </form>
        )}

        {signupStep === 6 && (
          <section className="auth-v2-question">
            <div className="auth-v2-question-head">
              <p className="auth-v2-question-kicker">Tudo certo</p>
              <h1>Pronto, {firstName}.</h1>
              <p className="auth-v2-question-copy">Confira os dados principais antes de criar a conta.</p>
            </div>
            <div className="auth-v2-review">
              <div className="auth-v2-review-row"><span>Conta</span><strong>{signup.name}<br />{signup.email}</strong></div>
              <div className="auth-v2-review-row"><span>Propriedade</span><strong>{property.name}<br />{property.municipality}, BA</strong></div>
              <div className="auth-v2-review-row"><span>Área</span><strong>{property.area} {property.areaUnit}</strong></div>
              <div className="auth-v2-review-row"><span>Atividade</span><strong>{property.mainActivity}</strong></div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="auth-v2-question-actions"><button className="auth-v2-question-back" type="button" onClick={previousSignup}><ArrowLeft size={20} /></button><button className="auth-v2-question-primary" type="button" onClick={() => void finishSignup()} disabled={submitting}>{submitting ? "Criando conta…" : "Criar minha conta"}</button></div>
          </section>
        )}
      </div>
    </main>
  );
}

function QuestionActions({ back, label }: { back: () => void; label: string }) {
  return (
    <div className="auth-v2-question-actions">
      <button className="auth-v2-question-back" type="button" onClick={back} aria-label="Voltar"><ArrowLeft size={20} /></button>
      <button className="auth-v2-question-primary" type="submit">{label} <ArrowRight size={17} /></button>
    </div>
  );
}
