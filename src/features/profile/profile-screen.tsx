import { useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Bell,
  BellRing,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Crown,
  ExternalLink,
  FileText,
  HeartHandshake,
  Instagram,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Palette,
  Pencil,
  Presentation,
  ShieldCheck,
  Sprout,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Field, LoadingButton, Modal, Toggle } from "../../components/ui";
import { MunicipalityPicker } from "../../components/municipality-picker";
import { showAppToast } from "../../components/modal-system";
import type { AppLink, AppRoute, AuthResult, HydraAccount, UpdateAccount } from "../../lib/hydra-types";
import { isSupportedMunicipality } from "../../lib/municipalities";
import { hydraSupport } from "../../lib/support";
import { ProfileInformation, type ProfileInformationKind } from "./profile-information";

type Props = {
  account: HydraAccount;
  links: AppLink[];
  updateAccount: UpdateAccount;
  navigate: (route: AppRoute) => void;
  logout: () => Promise<void>;
  saveAvatar: (file?: File) => Promise<boolean>;
  savePropertyCover: (file?: File) => Promise<boolean>;
  changeCredentials: (values: { email?: string; password?: string }) => Promise<AuthResult>;
};

type ProfileDraft = {
  name: string;
  phone: string;
  bio: string;
  propertyName: string;
  municipality: string;
  state: string;
  locationDetails: string;
};

function draftFromAccount(account: HydraAccount): ProfileDraft {
  return {
    name: account.profile.name,
    phone: account.phone,
    bio: account.profile.bio || "",
    propertyName: account.property.name,
    municipality: account.property.municipality,
    state: account.property.state || "BA",
    locationDetails: account.property.locationDetails || "",
  };
}

function MenuRow({ icon, title, subtitle, onClick, end }: { icon: ReactNode; title: string; subtitle?: string; onClick?: () => void; end?: ReactNode }) {
  const content = <><span className="profile-menu-icon">{icon}</span><div><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>{end || <ChevronRight size={19} />}</>;
  if (end) return <div className="profile-menu-row static-row">{content}</div>;
  return <button className="profile-menu-row" onClick={onClick}>{content}</button>;
}

export function ProfileScreen({ account, links, updateAccount, navigate, logout, saveAvatar, savePropertyCover, changeCredentials }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [info, setInfo] = useState<ProfileInformationKind | null>(null);
  const [profile, setProfile] = useState<ProfileDraft>(() => draftFromAccount(account));
  const [notificationDraft, setNotificationDraft] = useState({ pushNotifications: account.settings.pushNotifications });
  const [security, setSecurity] = useState({ email: account.email, password: "", confirmPassword: "" });
  const [securityFeedback, setSecurityFeedback] = useState<{ tone: "error" | "notice"; message: string } | null>(null);
  const [preferenceError, setPreferenceError] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [saving, setSaving] = useState<"profile" | "notifications" | "security" | "logout" | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const initials = account.profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "HA";
  const isPlus = account.profile.plan === "Hydra Agro+";
  const isDemoAccount = account.email.trim().toLowerCase() === "projeto2026@gmail.com";
  const ownPosts = account.posts.filter((post) => post.authorId === account.id).length;
  const heroStyle = account.property.coverUrl
    ? { backgroundImage: `linear-gradient(145deg, rgba(9,58,40,.89), rgba(5,38,26,.94)), url("${account.property.coverUrl}")` } as CSSProperties
    : undefined;

  function openEditor() {
    setProfile(draftFromAccount(account));
    setError("");
    setEditOpen(true);
  }

  function openInjectedMenu(selector: ".theme-menu-row" | ".demo-menu-row") {
    setSettingsOpen(false);
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(selector)?.click(), 180);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profile.name.trim()) { setError("Informe o seu nome."); return; }
    if (!profile.propertyName.trim()) { setError("Informe o nome da propriedade."); return; }
    if (!isSupportedMunicipality(profile.municipality)) { setError("Escolha Brejões ou um município vizinho atendido."); return; }
    setSaving("profile");
    setError("");
    try {
      await updateAccount((current) => ({
        ...current,
        phone: profile.phone.trim(),
        profile: { ...current.profile, name: profile.name.trim(), bio: profile.bio.trim() || undefined },
        property: {
          ...current.property,
          name: profile.propertyName.trim(),
          municipality: profile.municipality,
          state: "BA",
          locationDetails: profile.locationDetails.trim() || undefined,
        },
      }), { requireRemote: true });
      setEditOpen(false);
      showAppToast("Perfil e propriedade atualizados");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(null);
    }
  }

  async function chooseAvatar(file?: File) {
    setUploading("avatar");
    setError("");
    try {
      const changed = await saveAvatar(file);
      if (changed) showAppToast("Foto do perfil atualizada");
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Não foi possível atualizar a foto.";
      setError(reason);
      showAppToast(reason, "error");
    } finally {
      setUploading(null);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  }

  async function chooseCover(file?: File) {
    setUploading("cover");
    setError("");
    try {
      const changed = await savePropertyCover(file);
      if (changed) showAppToast("Capa da propriedade atualizada");
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Não foi possível atualizar a capa.";
      setError(reason);
      showAppToast(reason, "error");
    } finally {
      setUploading(null);
      if (coverFileRef.current) coverFileRef.current.value = "";
    }
  }

  async function saveSecurity(event: FormEvent) {
    event.preventDefault();
    setSecurityFeedback(null);
    if (!/^\S+@\S+\.\S+$/.test(security.email.trim())) { setSecurityFeedback({ tone: "error", message: "Informe um e-mail válido." }); return; }
    if (security.password && security.password.length < 8) { setSecurityFeedback({ tone: "error", message: "A nova senha precisa ter pelo menos 8 caracteres." }); return; }
    if (security.password !== security.confirmPassword) { setSecurityFeedback({ tone: "error", message: "As senhas não coincidem." }); return; }
    const values: { email?: string; password?: string } = {};
    if (security.email.trim().toLowerCase() !== account.email.toLowerCase()) values.email = security.email.trim();
    if (security.password) values.password = security.password;
    if (!values.email && !values.password) { setSecurityFeedback({ tone: "error", message: "Altere o e-mail ou informe uma nova senha antes de confirmar." }); return; }
    setSaving("security");
    try {
      const result = await changeCredentials(values);
      if (!result.ok) { setSecurityFeedback({ tone: "error", message: result.message }); return; }
      setSecurityOpen(false);
      showAppToast(result.message);
    } finally {
      setSaving(null);
    }
  }

  function openNotificationPreferences() {
    setNotificationDraft({ pushNotifications: account.settings.pushNotifications });
    setPreferenceError("");
    setNotificationsOpen(true);
  }

  async function saveNotificationPreferences() {
    setSaving("notifications");
    setPreferenceError("");
    try {
      await updateAccount((current) => ({
        ...current,
        settings: {
          ...current.settings,
          pushNotifications: notificationDraft.pushNotifications,
        },
      }), { requireRemote: true });
      setNotificationsOpen(false);
      showAppToast("Preferências de notificação salvas");
    } catch (caught) {
      setPreferenceError(caught instanceof Error ? caught.message : "Não foi possível salvar as preferências.");
    } finally {
      setSaving(null);
    }
  }

  async function confirmLogout() {
    setSaving("logout");
    try { await logout(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível sair da conta."); setSaving(null); }
  }

  function openInstagram(subject: "plus" | "support") {
    const text = subject === "plus"
      ? "Olá! Quero ativar o Hydra Agro+ por R$ 6/mês."
      : "Olá! Quero apoiar voluntariamente o desenvolvimento do Hydra Agro.";
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    window.open(hydraSupport.instagramUrl, "_blank", "noopener,noreferrer");
  }

  function openSupportEmail(subject = "Suporte Hydra Agro") {
    window.location.href = `mailto:${hydraSupport.email}?subject=${encodeURIComponent(subject)}`;
  }

  async function copySupportMessage() {
    const text = "Olá! Quero apoiar voluntariamente o desenvolvimento do Hydra Agro.";
    try {
      await navigator.clipboard.writeText(text);
      showAppToast("Mensagem de apoio copiada");
    } catch {
      showAppToast("Não foi possível copiar. Use o Instagram ou e-mail.", "error");
    }
  }

  const isAdmin = ["moderator", "admin", "owner"].includes(account.role);

  return (
    <div className="screen profile-screen page-enter">
      <section className="profile-hero" style={heroStyle}>
        <div className="profile-rings" />
        <button className="profile-top-edit" onClick={openEditor} aria-label="Editar perfil"><Pencil size={18} /></button>
        <button className="profile-settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Abrir menu do perfil"><Menu size={20} /></button>
        <div className="profile-avatar-wrap">
          {account.profile.avatarUrl ? <img className="profile-avatar image" src={account.profile.avatarUrl} alt={`Foto de ${account.profile.name}`} /> : <span className="profile-avatar">{initials}</span>}
          <button className="avatar-edit-button" onClick={() => Capacitor.isNativePlatform() ? void chooseAvatar() : avatarFileRef.current?.click()} aria-label="Alterar foto do perfil" disabled={uploading === "avatar"}>{uploading === "avatar" ? <LoaderCircle size={17} className="spin" /> : <Camera size={17} />}</button>
          <input ref={avatarFileRef} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseAvatar(event.target.files?.[0])} />
        </div>
        <h1>{account.profile.name}</h1>
        <strong>{account.property.name || "Propriedade não cadastrada"}</strong>
        <p>{account.property.municipality ? `${account.property.locationDetails ? `${account.property.locationDetails} · ` : ""}${account.property.municipality}, ${account.property.state}` : "Localização não informada"}</p>
        {account.profile.bio && <small className="profile-bio">{account.profile.bio}</small>}
      </section>

      <nav className="profile-social-tabs" aria-label="Áreas do perfil">
        <button className="active" aria-current="page"><UserRound size={19} /><span>Perfil</span></button>
        <button onClick={() => navigate("community")}><UsersRound size={19} /><span>Comunidade</span>{ownPosts > 0 && <small>{ownPosts}</small>}</button>
      </nav>

      <section className={`plan-card ${isPlus ? "is-plus" : "is-free"}`}>
        <div className="plan-mark">{isPlus ? <Crown size={24} /> : <Sprout size={24} />}</div>
        <div><span>PLANO ATUAL</span><strong>{account.profile.plan}</strong><small>{isPlus ? "Hydra Agro+ ativo" : "Conheça o Hydra Agro+ · R$ 6 por mês"}</small></div>
        <button onClick={() => navigate("plus")}>{isPlus ? "Abrir painel" : "Conhecer"}</button>
      </section>

      {isAdmin && <section className="profile-group"><span className="group-label">ADMINISTRAÇÃO</span><div className="profile-menu-card admin-access-card"><MenuRow icon={<ShieldCheck size={21} />} title="Painel administrativo" subtitle="Acesso autorizado" onClick={() => navigate("admin")} /></div></section>}

      <section className="profile-group">
        <span className="group-label">MINHA CONTA</span>
        <div className="profile-menu-card">
          <MenuRow icon={<UserRound size={21} />} title="Dados pessoais" subtitle={account.email} onClick={openEditor} />
          <MenuRow icon={<Sprout size={21} />} title="Minha propriedade" subtitle="Dados, produção e tecnologia" onClick={() => navigate("property")} />
          <MenuRow icon={<UsersRound size={21} />} title="Equipe e operações" subtitle="Funcionários, relatórios e ocorrências" onClick={() => navigate("operations" as AppRoute)} />
        </div>
      </section>

      <button className="logout-button" onClick={() => setLogoutConfirm(true)}><LogOut size={19} /> Sair desta conta</button>
      <p className="profile-version">Hydra Agro · versão 1.2.2</p>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} eyebrow="PERFIL" title="Menu e configurações" wide>
        <div className="profile-settings-sheet">
          <div className="profile-menu-card">
            <MenuRow icon={<Palette size={21} />} title="Aparência" subtitle="Modo claro ou escuro" onClick={() => openInjectedMenu(".theme-menu-row")} />
            <MenuRow icon={<Bell size={21} />} title="Notificações" subtitle="Avisos da conta e da propriedade" onClick={() => { setSettingsOpen(false); openNotificationPreferences(); }} />
            <MenuRow icon={<LockKeyhole size={21} />} title="Segurança" subtitle="Alterar e-mail ou senha" onClick={() => { setSettingsOpen(false); setSecurity({ email: account.email, password: "", confirmPassword: "" }); setSecurityFeedback(null); setSecurityOpen(true); }} />
            {isDemoAccount && <MenuRow icon={<Presentation size={21} />} title="Modo demonstração" subtitle="Roteiro da apresentação" onClick={() => openInjectedMenu(".demo-menu-row")} />}
          </div>

          <span className="profile-settings-label">INFORMAÇÕES</span>
          <div className="profile-menu-card">
            <MenuRow icon={<FileText size={21} />} title="Termos de uso" onClick={() => { setSettingsOpen(false); setInfo("terms"); }} />
            <MenuRow icon={<ShieldCheck size={21} />} title="Política de privacidade" onClick={() => { setSettingsOpen(false); setInfo("privacy"); }} />
            <MenuRow icon={<CircleHelp size={21} />} title="Créditos" subtitle="Projeto, desenvolvimento e tecnologias" onClick={() => { setSettingsOpen(false); setInfo("credits"); }} />
            <MenuRow icon={<Sprout size={21} />} title="Sobre o Hydra Agro" onClick={() => { setSettingsOpen(false); setInfo("about"); }} />
          </div>

          <span className="profile-settings-label">SUPORTE</span>
          <div className="profile-menu-card">
            <MenuRow icon={<HeartHandshake size={21} />} title="Apoie o Hydra Agro" onClick={() => { setSettingsOpen(false); setSupportOpen(true); }} />
            <MenuRow icon={<Mail size={21} />} title="Suporte por e-mail" subtitle={hydraSupport.email} onClick={() => openSupportEmail()} />
            <MenuRow icon={<Instagram size={21} />} title="Instagram" subtitle={hydraSupport.instagramHandle} onClick={() => window.open(hydraSupport.instagramUrl, "_blank", "noopener,noreferrer")} />
            {links.map((link) => <MenuRow key={link.id} icon={<ExternalLink size={21} />} title={link.label} subtitle={link.description} onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")} />)}
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} eyebrow="PERFIL" title="Editar seus dados" wide dismissible={saving !== "profile" && !uploading}>
        <form className="modal-form" onSubmit={saveProfile}>
          <div className="profile-media-editor">
            <button type="button" onClick={() => Capacitor.isNativePlatform() ? void chooseAvatar() : avatarFileRef.current?.click()} disabled={Boolean(uploading)}><span>{account.profile.avatarUrl ? <img src={account.profile.avatarUrl} alt="Foto atual" /> : initials}</span><div><strong>Foto de perfil</strong><small>JPG, PNG ou WebP</small></div><Camera size={18} /></button>
            <button type="button" onClick={() => Capacitor.isNativePlatform() ? void chooseCover() : coverFileRef.current?.click()} disabled={Boolean(uploading)}><span className="cover-thumb">{account.property.coverUrl ? <img src={account.property.coverUrl} alt="Capa atual" /> : <Sprout size={21} />}</span><div><strong>Capa da propriedade</strong><small>Imagem da sua conta</small></div>{uploading === "cover" ? <LoaderCircle size={18} className="spin" /> : <Camera size={18} />}</button>
            <input ref={coverFileRef} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseCover(event.target.files?.[0])} />
          </div>
          <Field label="Nome"><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
          <Field label="Sobre você (opcional)"><textarea value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} placeholder="Uma breve apresentação para a comunidade" maxLength={180} /></Field>
          <Field label="Telefone (opcional)"><input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="(75) 99999-9999" /></Field>
          <Field label="Nome da propriedade"><input value={profile.propertyName} onChange={(event) => setProfile({ ...profile, propertyName: event.target.value })} /></Field>
          <Field label="Localização ou referência (opcional)"><input value={profile.locationDetails} onChange={(event) => setProfile({ ...profile, locationDetails: event.target.value })} placeholder="Ex.: Comunidade Lagoa Nova" /></Field>
          <div className="municipality-field-grid"><Field label="Cidade"><MunicipalityPicker value={profile.municipality} onChange={(municipality) => { setProfile({ ...profile, municipality }); setError(""); }} /></Field><Field label="Estado"><div className="state-readonly"><span>BA</span><strong>Bahia</strong></div></Field></div>
          <Field label="E-mail" hint="Altere o e-mail em Segurança."><input value={account.email} disabled /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setEditOpen(false)} disabled={saving === "profile" || Boolean(uploading)}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving === "profile"} loadingLabel="Salvando perfil…" disabled={Boolean(uploading)}>Salvar alterações</LoadingButton></div>
        </form>
      </Modal>

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} eyebrow="PREFERÊNCIAS" title="Notificações do aplicativo" dismissible={saving !== "notifications"}>
        <div className="preference-modal">
          <p className="preference-intro">Escolha se deseja receber avisos do Hydra Agro.</p>
          <div className="preference-status"><CheckCircle2 size={19} /><span><strong>Notificações</strong><small>Os avisos também ficam disponíveis na central de notificações.</small></span></div>
          <div className="preference-options">
            <div>
              <span className="preference-option-icon"><BellRing size={21} /></span>
              <span><strong>Avisos do aplicativo</strong><small>Propriedade, administração, tarefas e monitoramentos.</small></span>
              <Toggle checked={notificationDraft.pushNotifications} label="Avisos do aplicativo" onChange={(pushNotifications) => setNotificationDraft({ ...notificationDraft, pushNotifications })} />
            </div>
          </div>
          {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
          <button className="wide-outline-button" onClick={() => { setNotificationsOpen(false); window.setTimeout(() => navigate("notifications"), 240); }} disabled={saving === "notifications"}>Ver notificações</button>
          <div className="modal-action-row"><button className="secondary-button" onClick={() => setNotificationsOpen(false)} disabled={saving === "notifications"}>Cancelar</button><LoadingButton className="primary-button" onClick={() => void saveNotificationPreferences()} loading={saving === "notifications"} loadingLabel="Salvando preferências…">Salvar</LoadingButton></div>
        </div>
      </Modal>

      <Modal open={securityOpen} onClose={() => setSecurityOpen(false)} eyebrow="SEGURANÇA" title="E-mail e senha" dismissible={saving !== "security"}>
        <form className="modal-form" onSubmit={saveSecurity}>
          <div className="security-session"><ShieldCheck size={22} /><span><strong>Conta autenticada</strong><small>{account.email}</small></span></div>
          <p className="security-intro">Você pode alterar o e-mail, a senha ou os dois. Uma confirmação pode ser enviada ao novo endereço.</p>
          <Field label="Novo e-mail"><input type="email" value={security.email} onChange={(event) => { setSecurity({ ...security, email: event.target.value }); setSecurityFeedback(null); }} autoComplete="email" /></Field>
          <Field label="Nova senha" hint="Deixe em branco para manter a atual. Use no mínimo 8 caracteres."><input type="password" value={security.password} onChange={(event) => { setSecurity({ ...security, password: event.target.value }); setSecurityFeedback(null); }} autoComplete="new-password" /></Field>
          <Field label="Confirmar nova senha"><input type="password" value={security.confirmPassword} onChange={(event) => { setSecurity({ ...security, confirmPassword: event.target.value }); setSecurityFeedback(null); }} autoComplete="new-password" /></Field>
          {securityFeedback && <p className={securityFeedback.tone === "error" ? "form-error" : "form-notice"} role={securityFeedback.tone === "error" ? "alert" : "status"}>{securityFeedback.message}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setSecurityOpen(false)} disabled={saving === "security"}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving === "security"} loadingLabel="Atualizando…">Salvar alterações</LoadingButton></div>
        </form>
      </Modal>

      <Modal open={supportOpen} onClose={() => setSupportOpen(false)} eyebrow="APOIO VOLUNTÁRIO" title="Apoie o Hydra Agro">
        <div className="support-modal">
          <span><HeartHandshake size={31} /></span>
          <h3>Ajude o projeto a continuar</h3>
          <p>O apoio voluntário contribui com manutenção, testes e novas ferramentas para o Hydra Agro.</p>
          <div className="support-separation-note"><Crown size={18} /><span><strong>Apoio não é assinatura</strong><small>A contribuição é opcional, não libera o Hydra Agro+ e não bloqueia funções gratuitas.</small></span></div>
          <div className="support-channel-grid">
            <button onClick={() => openInstagram("support")}><Instagram size={21} /><span><strong>Quero apoiar o projeto</strong><small>Conversar no Instagram · {hydraSupport.instagramHandle}</small></span><ExternalLink size={16} /></button>
            <button onClick={() => openSupportEmail("Quero apoiar o Hydra Agro")}><Mail size={21} /><span><strong>Falar por e-mail</strong><small>{hydraSupport.email}</small></span><ExternalLink size={16} /></button>
          </div>
          <button className="wide-outline-button" onClick={() => void copySupportMessage()}>Copiar mensagem de apoio</button>
          <button className="secondary-button full" onClick={() => setSupportOpen(false)}>Agora não</button>
        </div>
      </Modal>

      <Modal open={Boolean(info)} onClose={() => setInfo(null)} eyebrow="HYDRA AGRO" title={info === "terms" ? "Termos de uso" : info === "privacy" ? "Política de privacidade" : info === "credits" ? "Créditos" : "Sobre o Hydra Agro"} wide>
        {info && <ProfileInformation kind={info} onClose={() => setInfo(null)} onEmail={() => openSupportEmail(info === "privacy" ? "Privacidade e dados — Hydra Agro" : "Informações — Hydra Agro")} onInstagram={() => openInstagram("support")} />}
      </Modal>

      <Modal open={logoutConfirm} onClose={() => setLogoutConfirm(false)} eyebrow="CONFIRMAÇÃO" title="Finalizar sessão" centered dismissible={saving !== "logout"}>
        <div className="confirm-action"><span><LogOut size={27} /></span><p>Deseja sair desta conta?</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-action-row"><button className="secondary-button" onClick={() => setLogoutConfirm(false)} disabled={saving === "logout"}>Cancelar</button><LoadingButton className="danger-button" onClick={() => void confirmLogout()} loading={saving === "logout"} loadingLabel="Saindo…">Sair</LoadingButton></div></div>
      </Modal>
    </div>
  );
}
