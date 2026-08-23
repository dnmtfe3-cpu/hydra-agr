"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  ClipboardCheck,
  LoaderCircle,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { EmptyState, ScreenHeader, Toggle } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { HydraAccount, UpdateAccount } from "../../lib/hydra-types";
import { requireSupabase } from "../../services/supabase";

type Props = {
  account: HydraAccount;
  updateAccount: UpdateAccount;
  onBack: () => void;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
};

function notificationIcon(kind: string) {
  const normalized = kind.toLowerCase();
  if (normalized.includes("activity") || normalized.includes("task") || normalized.includes("atividade") || normalized.includes("tarefa")) return <ClipboardCheck size={19} />;
  if (normalized.includes("monitor") || normalized.includes("occurrence") || normalized.includes("ocorr")) return <RadioTower size={19} />;
  if (normalized.includes("community") || normalized.includes("comunidade")) return <UsersRound size={19} />;
  if (normalized.includes("admin")) return <ShieldCheck size={19} />;
  return <BellRing size={19} />;
}

function notificationKindLabel(kind: string) {
  const normalized = kind.toLowerCase();
  if (normalized.includes("activity") || normalized.includes("task") || normalized.includes("atividade") || normalized.includes("tarefa")) return "Tarefa";
  if (normalized.includes("monitor") || normalized.includes("occurrence") || normalized.includes("ocorr")) return "Monitoramento";
  if (normalized.includes("community") || normalized.includes("comunidade")) return "Comunidade";
  if (normalized.includes("admin")) return "Hydra Agro";
  return "Aviso";
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return `Hoje, ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(" de ", " ");
}

export function NotificationsScreen({ account, updateAccount, onBack }: Props) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const client = requireSupabase();
      const { data, error: requestError } = await client
        .from("notifications")
        .select("id,title,body,kind,read_at,created_at")
        .eq("recipient_user_id", account.id)
        .order("created_at", { ascending: false });
      if (requestError) throw requestError;
      setItems((data ?? []) as NotificationRow[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account.id]);

  useEffect(() => {
    void loadNotifications();
    const client = requireSupabase();
    const channel = client
      .channel(`hydra-notifications-${account.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${account.id}` },
        () => { void loadNotifications(true); },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [account.id, loadNotifications]);

  async function markRead(item: NotificationRow) {
    if (item.read_at || busyId) return;
    setBusyId(item.id);
    try {
      const readAt = new Date().toISOString();
      const client = requireSupabase();
      const { error: requestError } = await client
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", item.id)
        .eq("recipient_user_id", account.id);
      if (requestError) throw requestError;
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
    } catch (caught) {
      showAppToast(caught instanceof Error ? caught.message : "Não foi possível marcar a notificação como lida.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const readAt = new Date().toISOString();
      const client = requireSupabase();
      const { error: requestError } = await client
        .from("notifications")
        .update({ read_at: readAt })
        .eq("recipient_user_id", account.id)
        .is("read_at", null);
      if (requestError) throw requestError;
      setItems((current) => current.map((entry) => entry.read_at ? entry : { ...entry, read_at: readAt }));
      showAppToast("Todas as notificações foram marcadas como lidas");
    } catch (caught) {
      showAppToast(caught instanceof Error ? caught.message : "Não foi possível atualizar as notificações.", "error");
    } finally {
      setMarkingAll(false);
    }
  }

  async function changePushNotifications(pushNotifications: boolean) {
    setSettingsBusy(true);
    try {
      await updateAccount((current) => ({ ...current, settings: { ...current.settings, pushNotifications } }), { requireRemote: true });
      showAppToast(pushNotifications ? "Avisos do aplicativo ativados" : "Avisos do aplicativo pausados");
    } catch (caught) {
      showAppToast(caught instanceof Error ? caught.message : "Não foi possível salvar a preferência.", "error");
    } finally {
      setSettingsBusy(false);
    }
  }

  return (
    <div className="screen page-enter extra-screen notifications-screen">
      <ScreenHeader
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? "aviso não lido" : "avisos não lidos"}` : "Nenhum aviso novo."}
        onBack={onBack}
        action={<button className="icon-button notification-refresh" onClick={() => void loadNotifications(true)} disabled={refreshing} aria-label="Atualizar notificações">{refreshing ? <LoaderCircle size={19} className="spin" /> : <RefreshCw size={19} />}</button>}
      />

      <section className="notification-preferences" aria-label="Preferências de notificação">
        <div className="notification-preference-row">
          <span className="notification-preference-icon"><Bell size={20} /></span>
          <div><strong>Avisos do aplicativo</strong><small>Tarefas, monitoramentos, comunidade e avisos da conta.</small></div>
          <Toggle checked={account.settings.pushNotifications} label="Avisos do aplicativo" onChange={(value) => void changePushNotifications(value)} />
          {settingsBusy && <LoaderCircle size={15} className="spin notification-setting-loader" />}
        </div>
      </section>

      <div className="notification-list-head">
        <div><span>RECENTES</span><strong>Seus avisos</strong></div>
        {unreadCount > 0 && <button onClick={() => void markAllRead()} disabled={markingAll}>{markingAll ? <LoaderCircle size={15} className="spin" /> : <CheckCheck size={16} />} Marcar todas</button>}
      </div>

      {error && <div className="notification-error"><Bell size={18} /><span>{error}</span><button onClick={() => void loadNotifications()}>Tentar novamente</button></div>}

      {loading ? (
        <div className="notification-loading" role="status"><LoaderCircle size={25} className="spin" /><span>Carregando avisos…</span></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell size={26} />} title="Nenhuma notificação" text="Quando houver algo importante, o aviso aparece aqui." />
      ) : (
        <div className="notification-list notification-list-v2">
          {items.map((item) => {
            const unread = !item.read_at;
            return (
              <button key={item.id} className={`notification-item ${unread ? "unread" : "read"}`} onClick={() => void markRead(item)} disabled={busyId === item.id}>
                <span className={`notification-item-icon kind-${item.kind.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{notificationIcon(item.kind)}</span>
                <span className="notification-item-copy">
                  <span className="notification-item-meta"><em>{notificationKindLabel(item.kind)}</em><time>{dateLabel(item.created_at)}</time></span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </span>
                <span className="notification-item-state">{busyId === item.id ? <LoaderCircle size={15} className="spin" /> : unread ? <i aria-label="Não lida" /> : <CheckCheck size={15} />}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
