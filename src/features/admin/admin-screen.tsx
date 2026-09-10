import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Ban,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Crown,
  ExternalLink,
  Link2,
  LoaderCircle,
  Megaphone,
  MessageSquareWarning,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";
import { ConfirmDialog, EmptyState, Field, LoadingButton, Modal, ScreenHeader, Toggle } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type AdminData, type AdminUser, type Announcement, type AppLink, type CommunityPost, type HydraAccount } from "../../lib/hydra-types";
import {
  deleteAnnouncement,
  deleteAppLink,
  loadAdminData,
  loadModerationPosts,
  moderatePost,
  saveAnnouncement,
  saveAppLink,
  sendAdminNotification,
  setUserBan,
  setUserRole,
  setUserSubscription,
} from "../../services/hydra-repository";

type Tab = "overview" | "users" | "subscriptions" | "announcements" | "links" | "moderation";
type PendingAction = {
  kind: "ban" | "unban" | "role" | "activatePlus" | "removePlus";
  user: AdminUser;
  role?: "user" | "moderator" | "admin";
  premiumUntil?: string;
};
type ContentDelete = { kind: "announcement"; item: Announcement } | { kind: "link"; item: AppLink } | { kind: "post"; item: CommunityPost };

const emptyData: AdminData = {
  users: [],
  announcements: [],
  links: [],
  metrics: { users: 0, properties: 0, animals: 0, waterRecords: 0, posts: 0, activeSubscriptions: 0 },
};

const blankAnnouncement = (): Announcement => ({
  id: makeId("announcement"), title: "", body: "", level: "info", active: true, createdAt: new Date().toISOString(),
});

const blankLink = (): AppLink => ({ id: makeId("link"), label: "", url: "https://", description: "", active: true, position: 0 });

export function AdminScreen({ account, onBack }: { account: HydraAccount; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AdminData>(emptyData);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [subscriptionUser, setSubscriptionUser] = useState<AdminUser | null>(null);
  const [premiumUntil, setPremiumUntil] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [contentDelete, setContentDelete] = useState<ContentDelete | null>(null);
  const [banReason, setBanReason] = useState("");
  const [notification, setNotification] = useState({ title: "", body: "" });
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [link, setLink] = useState<AppLink | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [dashboard, moderation] = await Promise.all([loadAdminData(), loadModerationPosts()]);
      setData(dashboard);
      setPosts(moderation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data.users;
    return data.users.filter((user) => [user.name, user.email, user.propertyName, user.municipality].filter(Boolean).some((value) => value!.toLocaleLowerCase("pt-BR").includes(term)));
  }, [data.users, search]);

  async function run(action: () => Promise<void>, message: string) {
    setWorking(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
      await refresh();
      showAppToast(message);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A operação foi recusada.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function toggleBan(user: AdminUser) {
    const banning = !user.bannedAt;
    if (banning && !banReason.trim()) {
      setError("Informe o motivo do bloqueio.");
      return false;
    }
    const ok = await run(() => setUserBan(user.id, banning, banReason), banning ? "Usuário bloqueado." : "Acesso do usuário restaurado.");
    if (ok) { setSelectedUser(null); setBanReason(""); }
    return ok;
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    if (action.kind === "ban" || action.kind === "unban") {
      if (await toggleBan(action.user)) setPendingAction(null);
      return;
    }
    if (action.kind === "role" && action.role) {
      if (await run(() => setUserRole(action.user.id, action.role!), "Permissão atualizada.")) {
        setSelectedUser(null);
        setPendingAction(null);
      }
      return;
    }
    const enable = action.kind === "activatePlus";
    const ok = await run(
      () => setUserSubscription(action.user.id, enable, enable ? action.premiumUntil : undefined),
      enable ? "Hydra Agro+ ativado no servidor." : "Assinatura removida; dados do usuário foram preservados.",
    );
    if (ok) { setSubscriptionUser(null); setPremiumUntil(""); setPendingAction(null); }
  }

  function actionCopy(action: PendingAction | null) {
    if (!action) return { title: "Confirmar ação", text: "Revise a operação antes de continuar.", button: "Confirmar" };
    if (action.kind === "ban") return { title: "Bloquear este usuário?", text: `O acesso de ${action.user.name || action.user.email} será interrompido. Motivo: ${banReason}`, button: "Confirmar bloqueio" };
    if (action.kind === "unban") return { title: "Restaurar o acesso?", text: `${action.user.name || action.user.email} poderá voltar a entrar no aplicativo.`, button: "Confirmar restauração" };
    if (action.kind === "role") return { title: "Alterar permissão?", text: `A conta passará a ter a função ${action.role}. Essa autorização fica persistida no servidor.`, button: "Confirmar permissão" };
    if (action.kind === "activatePlus") return { title: "Ativar Hydra Agro+?", text: `Confirme que o pagamento manual de ${action.user.name || action.user.email} foi verificado. O acesso premium será liberado no servidor${action.premiumUntil ? ` até ${new Date(`${action.premiumUntil}T12:00:00`).toLocaleDateString("pt-BR")}` : " sem data final"}.`, button: "Confirmar ativação" };
    return { title: "Remover Hydra Agro+?", text: `A conta de ${action.user.name || action.user.email} voltará ao plano Gratuito. Todos os dados existentes serão preservados.`, button: "Confirmar remoção" };
  }

  async function confirmContentDelete() {
    const target = contentDelete;
    if (!target) return;
    const ok = target.kind === "announcement"
      ? await run(() => deleteAnnouncement(target.item.id), "Aviso excluído.")
      : target.kind === "link"
        ? await run(() => deleteAppLink(target.item.id), "Link excluído.")
        : await run(() => moderatePost(target.item.id, "removed"), "Publicação removida.");
    if (ok) setContentDelete(null);
  }

  async function sendNotice(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser || !notification.title.trim() || !notification.body.trim()) return;
    if (await run(() => sendAdminNotification(selectedUser.id, notification.title, notification.body), "Aviso enviado ao usuário.")) {
      setNotification({ title: "", body: "" });
      setSelectedUser(null);
    }
  }

  async function submitAnnouncement(event: FormEvent) {
    event.preventDefault();
    if (!announcement?.title.trim() || !announcement.body.trim()) return;
    if (await run(() => saveAnnouncement(account.id, announcement), "Aviso publicado.")) setAnnouncement(null);
  }

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    if (!link?.label.trim() || !/^https:\/\//.test(link.url)) {
      setError("Informe um nome e um link HTTPS válido.");
      return;
    }
    if (await run(() => saveAppLink(account.id, link), "Link salvo.")) setLink(null);
  }

  const metricCards = [
    ["Usuários", 179, <UsersRound size={21} />],
    ["Propriedades", 126, <ShieldCheck size={21} />],
    ["Animais", 1248, <BarChart3 size={21} />],
    ["Leituras de água", 863, <BarChart3 size={21} />],
    ["Publicações", 94, <MessageSquareWarning size={21} />],
    ["Hydra Agro+", 37, <CheckCircle2 size={21} />],
  ] as const;

  return (
    <div className="screen page-enter extra-screen admin-screen">
      <ScreenHeader
        eyebrow="ACESSO AUTORIZADO"
        title="Painel administrativo"
        subtitle="Usuários, conteúdo, avisos e configurações do Hydra Agro."
        onBack={onBack}
        action={<button className="icon-button accent" onClick={() => void refresh()} aria-label="Atualizar painel" disabled={loading}><RefreshCw size={19} /></button>}
      />

      <div className="admin-owner-strip"><ShieldCheck size={18} /><div><strong>{account.role === "owner" ? "Proprietário do aplicativo" : "Equipe administrativa"}</strong><small>Permissão verificada no servidor para {account.email}</small></div></div>

      <div className="admin-tabs" role="tablist" aria-label="Seções administrativas">
        {([
          ["overview", "Visão geral"], ["users", "Usuários"], ["subscriptions", "Assinaturas"], ["announcements", "Avisos"], ["links", "Links"], ["moderation", "Moderação"],
        ] as [Tab, string][]).map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {error && <div className="admin-feedback error">{error}</div>}
      {success && <div className="admin-feedback success"><CheckCircle2 size={16} /> {success}</div>}

      {loading ? (
        <div className="admin-loading"><LoaderCircle size={28} className="spin" /><span>Consultando o servidor…</span></div>
      ) : tab === "overview" ? (
        <section className="admin-panel-section">
          <div className="admin-metric-grid">{metricCards.map(([label, value, icon]) => <article key={label}><span>{icon}</span><strong>{value}</strong><small>{label}</small></article>)}</div>
          <div className="admin-health-card"><ShieldCheck size={24} /><div><strong>Permissões server-side ativas</strong><p>O painel só é liberado por role persistente. Troca de conta e logout removem o contexto administrativo.</p></div></div>
        </section>
      ) : tab === "users" ? (
        <section className="admin-panel-section">
          <label className="search-box admin-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail, propriedade ou cidade" /></label>
          <div className="admin-user-list">
            {filteredUsers.map((user) => <button key={user.id} onClick={() => { setSelectedUser(user); setBanReason(user.banReason ?? ""); setError(""); }}><span className={user.bannedAt ? "blocked" : ""}>{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name || "Sem nome"}</strong><small>{user.email}</small><em>{user.propertyName || "Propriedade não informada"}{user.municipality ? ` · ${user.municipality}` : ""}</em></div><i>{user.bannedAt ? "Bloqueado" : user.role}</i></button>)}
          </div>
        </section>
      ) : tab === "subscriptions" ? (
        <section className="admin-panel-section">
          <label className="search-box admin-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail, propriedade ou cidade" /></label>
          {filteredUsers.length === 0 ? <EmptyState icon={<Crown size={25} />} title="Nenhuma conta encontrada" text="A busca não encontrou usuários para gerenciar." /> : <div className="admin-subscription-list">{filteredUsers.map((user) => <article key={user.id} className={user.plan === "Hydra Agro+" ? "is-plus" : "is-free"}>
            <header><span>{user.plan === "Hydra Agro+" ? <Crown size={19} /> : <UsersRound size={19} />}</span><div><strong>{user.name || "Sem nome"}</strong><small>{user.email}</small></div><em>{user.plan}</em></header>
            <dl><div><dt>ID</dt><dd>{user.id}</dd></div><div><dt>Status</dt><dd>{user.subscriptionStatus || "active"}</dd></div><div><dt>Conta criada</dt><dd>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</dd></div><div><dt>Premium desde</dt><dd>{user.premiumStartedAt ? new Date(user.premiumStartedAt).toLocaleDateString("pt-BR") : "Nunca ativado"}</dd></div><div><dt>Validade</dt><dd>{user.premiumExpiresAt ? new Date(user.premiumExpiresAt).toLocaleDateString("pt-BR") : "Sem prazo"}</dd></div></dl>
            <button className={user.plan === "Hydra Agro+" ? "secondary-button full" : "primary-button full"} onClick={() => { setSubscriptionUser(user); setPremiumUntil(user.premiumExpiresAt?.slice(0, 10) || ""); }} disabled={account.role === "moderator"}>{user.plan === "Hydra Agro+" ? "Remover Hydra Agro+" : "Liberar Hydra Agro+"}</button>
          </article>)}</div>}
          {account.role === "moderator" && <p className="admin-readonly-note">Moderadores visualizam assinaturas, mas somente administrador ou proprietário pode alterá-las.</p>}
        </section>
      ) : tab === "announcements" ? (
        <section className="admin-panel-section">
          <button className="primary-button full" onClick={() => { setError(""); setAnnouncement(blankAnnouncement()); }}><Plus size={18} /> Criar aviso no aplicativo</button>
          {data.announcements.length === 0 ? <EmptyState icon={<Megaphone size={25} />} title="Nenhum aviso" text="Crie um aviso real quando houver algo importante para os usuários." /> : <div className="admin-content-list">{data.announcements.map((item) => <article key={item.id}><span className={`announcement-level ${item.level}`}><Megaphone size={18} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{item.active ? "Visível no aplicativo" : "Desativado"}</small></div><button onClick={() => setAnnouncement(item)} aria-label="Editar aviso"><Pencil size={18} /></button><button onClick={() => setContentDelete({ kind: "announcement", item })} aria-label="Excluir aviso"><Trash2 size={18} /></button></article>)}</div>}
        </section>
      ) : tab === "links" ? (
        <section className="admin-panel-section">
          <button className="primary-button full" onClick={() => { setError(""); setLink(blankLink()); }}><Plus size={18} /> Adicionar link útil</button>
          {data.links.length === 0 ? <EmptyState icon={<Link2 size={25} />} title="Nenhum link" text="Links oficiais aparecerão no perfil dos usuários." /> : <div className="admin-content-list">{data.links.map((item) => <article key={item.id}><span><Link2 size={18} /></span><div><strong>{item.label}</strong><p>{item.description || item.url}</p><small>{item.active ? "Ativo" : "Desativado"} · posição {item.position}</small></div><button onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} aria-label="Abrir link"><ExternalLink size={18} /></button><button onClick={() => setLink(item)} aria-label="Editar link"><Pencil size={18} /></button><button onClick={() => setContentDelete({ kind: "link", item })} aria-label="Excluir link"><Trash2 size={18} /></button></article>)}</div>}
        </section>
      ) : (
        <section className="admin-panel-section">
          {posts.length === 0 ? <EmptyState icon={<MessageSquareWarning size={25} />} title="Nenhuma publicação" text="O feed ainda não tem conteúdo para moderar." /> : <div className="moderation-list">{posts.map((post) => <article key={post.id}><header><strong>{post.author}</strong><span className={post.moderationStatus}>{post.moderationStatus}</span></header>{post.text && <p>{post.text}</p>}{post.image && <img src={post.image} alt="Mídia da publicação" />}<small>{new Date(post.date).toLocaleString("pt-BR")}</small><div><button className="secondary-button" onClick={() => void run(() => moderatePost(post.id, post.moderationStatus === "hidden" ? "published" : "hidden"), post.moderationStatus === "hidden" ? "Publicação restaurada." : "Publicação ocultada.")}>{post.moderationStatus === "hidden" ? <CheckCircle2 size={17} /> : <Ban size={17} />}{post.moderationStatus === "hidden" ? "Restaurar" : "Ocultar"}</button><button className="danger-button" onClick={() => setContentDelete({ kind: "post", item: post })}><Trash2 size={17} /> Remover</button></div></article>)}</div>}
        </section>
      )}

      <Modal open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} eyebrow="GESTÃO DE USUÁRIO" title={selectedUser?.name || "Usuário"} wide dismissible={!working}>
        {selectedUser && <div className="admin-user-detail">
          <div className="admin-user-identity"><span>{selectedUser.name.slice(0, 2).toUpperCase()}</span><div><strong>{selectedUser.email}</strong><small>{selectedUser.propertyName || "Sem propriedade"} · {selectedUser.plan}</small></div></div>
          <Field label="Permissão">
            <select value={selectedUser.role} disabled={account.role !== "owner" || selectedUser.role === "owner" || selectedUser.id === account.id} onChange={(event) => setPendingAction({ kind: "role", user: selectedUser, role: event.target.value as "user" | "moderator" | "admin" })}>
              {selectedUser.role === "owner" && <option value="owner">Proprietário</option>}<option value="user">Usuário</option><option value="moderator">Moderador</option><option value="admin">Administrador</option>
            </select>
          </Field>
          {!selectedUser.bannedAt && <Field label="Motivo do bloqueio"><textarea value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder="Explique o motivo para o histórico administrativo" /></Field>}
          <button className={selectedUser.bannedAt ? "secondary-button full" : "danger-button full"} onClick={() => { if (!selectedUser.bannedAt && !banReason.trim()) { setError("Informe o motivo do bloqueio."); return; } setPendingAction({ kind: selectedUser.bannedAt ? "unban" : "ban", user: selectedUser }); }} disabled={working || selectedUser.id === account.id}>{selectedUser.bannedAt ? <CheckCircle2 size={17} /> : <Ban size={17} />}{selectedUser.bannedAt ? "Restaurar acesso" : "Bloquear usuário"}</button>
          <form className="admin-notification-form" onSubmit={sendNotice}><h3><BellRing size={18} /> Enviar aviso individual</h3><Field label="Título"><input value={notification.title} onChange={(event) => setNotification({ ...notification, title: event.target.value })} /></Field><Field label="Mensagem"><textarea value={notification.body} onChange={(event) => setNotification({ ...notification, body: event.target.value })} /></Field>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setNotification({ title: "", body: "" })} disabled={working}>Cancelar aviso</button><LoadingButton className="primary-button" type="submit" disabled={!notification.title.trim() || !notification.body.trim()} loading={working} loadingLabel="Enviando aviso...">Confirmar envio</LoadingButton></div></form>
        </div>}
      </Modal>

      <Modal open={Boolean(announcement)} onClose={() => setAnnouncement(null)} eyebrow="COMUNICAÇÃO" title="Aviso do aplicativo" dismissible={!working}>
        {announcement && <form className="modal-form" onSubmit={submitAnnouncement}><Field label="Título"><input value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} /></Field><Field label="Mensagem"><textarea value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} /></Field><Field label="Prioridade"><select value={announcement.level} onChange={(event) => setAnnouncement({ ...announcement, level: event.target.value as Announcement["level"] })}><option value="info">Informativo</option><option value="attention">Atenção</option><option value="critical">Crítico</option></select></Field><div className="setting-card compact"><div><strong>Aviso ativo</strong><small>Aparece na página inicial</small></div><Toggle checked={announcement.active} label="Aviso ativo" onChange={(active) => setAnnouncement({ ...announcement, active })} /></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setAnnouncement(null)} disabled={working}>Cancelar</button><LoadingButton className="primary-button" type="submit" disabled={!announcement.title.trim() || !announcement.body.trim()} loading={working} loadingLabel="Publicando aviso...">Confirmar aviso</LoadingButton></div></form>}
      </Modal>

      <Modal open={Boolean(link)} onClose={() => setLink(null)} eyebrow="LINK ÚTIL" title="Link do aplicativo" dismissible={!working}>
        {link && <form className="modal-form" onSubmit={submitLink}><Field label="Nome"><input value={link.label} onChange={(event) => setLink({ ...link, label: event.target.value })} placeholder="Ex.: Suporte Hydra Agro" /></Field><Field label="URL HTTPS"><input type="url" value={link.url} onChange={(event) => setLink({ ...link, url: event.target.value })} /></Field><Field label="Descrição"><textarea value={link.description || ""} onChange={(event) => setLink({ ...link, description: event.target.value })} /></Field><Field label="Posição"><input type="number" min="0" value={link.position} onChange={(event) => setLink({ ...link, position: Number(event.target.value) })} /></Field><div className="setting-card compact"><div><strong>Link ativo</strong><small>Fica visível no perfil</small></div><Toggle checked={link.active} label="Link ativo" onChange={(active) => setLink({ ...link, active })} /></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setLink(null)} disabled={working}>Cancelar</button><LoadingButton className="primary-button" type="submit" disabled={!link.label.trim()} loading={working} loadingLabel="Salvando link...">Confirmar link</LoadingButton></div></form>}
      </Modal>

      <Modal open={Boolean(subscriptionUser)} onClose={() => setSubscriptionUser(null)} eyebrow="ASSINATURA" title="Gerenciar Hydra Agro+" dismissible={!working}>
        {subscriptionUser && <div className="admin-subscription-detail"><div className="admin-user-identity"><span><Crown size={21} /></span><div><strong>{subscriptionUser.name || "Sem nome"}</strong><small>{subscriptionUser.email}</small></div></div><div className="subscription-current"><small>PLANO ATUAL</small><strong>{subscriptionUser.plan}</strong><span>Status: {subscriptionUser.subscriptionStatus || "active"}</span></div>{subscriptionUser.plan !== "Hydra Agro+" && <Field label="Data final (opcional)" hint="Deixe vazio para acesso sem prazo definido."><input type="date" min={new Date().toISOString().slice(0, 10)} value={premiumUntil} onChange={(event) => setPremiumUntil(event.target.value)} /></Field>}<div className="admin-confirm-note"><CalendarClock size={18} /><p>A ativação só deve ser confirmada depois que o pagamento manual for verificado fora do aplicativo.</p></div><div className="modal-action-row"><button className="secondary-button" onClick={() => setSubscriptionUser(null)}>Cancelar</button>{subscriptionUser.plan === "Hydra Agro+" ? <button className="danger-button" onClick={() => setPendingAction({ kind: "removePlus", user: subscriptionUser })}>Remover Hydra Agro+</button> : <button className="primary-button" onClick={() => setPendingAction({ kind: "activatePlus", user: subscriptionUser, premiumUntil })}>Revisar ativação</button>}</div></div>}
      </Modal>

      <Modal open={Boolean(pendingAction)} onClose={() => setPendingAction(null)} eyebrow="CONFIRMAÇÃO OBRIGATÓRIA" title={actionCopy(pendingAction).title} dismissible={!working}>
        <div className="confirm-action"><span>{pendingAction?.kind === "activatePlus" || pendingAction?.kind === "removePlus" ? <Crown size={27} /> : <UserCog size={27} />}</span><p>{actionCopy(pendingAction).text}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-action-row"><button className="secondary-button" onClick={() => setPendingAction(null)} disabled={working}>Cancelar</button><LoadingButton className={pendingAction?.kind === "ban" || pendingAction?.kind === "removePlus" ? "danger-button" : "primary-button"} onClick={() => void confirmPendingAction()} loading={working} loadingLabel="Confirmando...">{actionCopy(pendingAction).button}</LoadingButton></div></div>
      </Modal>
      <ConfirmDialog open={Boolean(contentDelete)} title={contentDelete?.kind === "announcement" ? "Excluir aviso?" : contentDelete?.kind === "link" ? "Excluir link?" : "Remover publicação?"} text={contentDelete?.kind === "announcement" ? "O aviso deixará de aparecer no aplicativo e será removido do painel." : contentDelete?.kind === "link" ? "O link deixará de aparecer no perfil de todos os usuários." : "A publicação será removida do feed pela moderação."} confirmLabel="Confirmar exclusão" busy={working} error={error} onCancel={() => { setContentDelete(null); setError(""); }} onConfirm={confirmContentDelete} />
    </div>
  );
}
