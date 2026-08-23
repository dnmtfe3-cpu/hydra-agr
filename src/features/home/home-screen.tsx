"use client";

import { useEffect, useState, type ReactNode } from "react";
import "../../product-polish.css";
import "./home-production-shortcut.css";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  Beef as Cow,
  HeartHandshake,
  History,
  Leaf,
  Map,
  MessageSquareText,
  Plus,
  RadioTower,
  ScanLine,
  Sprout,
  UsersRound,
} from "lucide-react";
import { HydraWordmark } from "../../components/brand";
import type { Announcement, AppRoute, HydraAccount } from "../../lib/hydra-types";
import { requireSupabase } from "../../services/supabase";
import { WeatherWidget } from "./weather-widget";

type Props = {
  account: HydraAccount;
  navigate: (route: AppRoute) => void;
  onQuickAction: () => void;
  announcements: Announcement[];
};

function welcomeMessage() {
  const hour = new Date().getHours();
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeScreen({ account, navigate, onQuickAction, announcements }: Props) {
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const firstName = account.profile.name.split(/\s+/)[0] || "Produtor";
  const welcome = welcomeMessage();
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const pendingActivities = account.activities.filter((activity) => !activity.done);
  const propertyReady = Boolean(account.property.municipality && account.property.mainActivity);

  useEffect(() => {
    let active = true;
    const client = requireSupabase();

    async function refreshUnread() {
      const { count, error } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", account.id)
        .is("read_at", null);
      if (active && !error) setHasUnreadNotifications((count ?? 0) > 0);
    }

    void refreshUnread();
    const channel = client
      .channel(`hydra-home-notifications-${account.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${account.id}` },
        () => { void refreshUnread(); },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [account.id]);

  const pendingSetup = [
    account.animals.length === 0 && { label: "Cadastrar o primeiro animal", icon: <Cow size={21} />, route: "herd" as AppRoute },
    account.sectors.length === 0 && { label: "Criar o primeiro setor", icon: <Map size={21} />, route: "monitor" as AppRoute },
  ].filter(Boolean) as { label: string; icon: ReactNode; route: AppRoute }[];

  return (
    <div className="screen home-screen page-enter">
      <div className="home-brandbar">
        <HydraWordmark />
        <button className="icon-button bare" onClick={() => navigate("notifications")} aria-label="Notificações"><Bell size={23} />{hasUnreadNotifications && <span className="notification-dot" />}</button>
      </div>

      <section className="greeting-block"><div><h1><span className="greeting-time">{welcome},</span> <strong className="greeting-name">{firstName}</strong></h1><p className="capitalize">{today}</p></div><WeatherWidget municipality={account.property.municipality} onCompleteProperty={() => navigate("property")} /></section>

      {announcements.length > 0 && <section className="home-announcements" aria-label="Avisos do Hydra Agro">{announcements.slice(0, 3).map((announcement) => <article key={announcement.id} className={announcement.level}><span>{announcement.level === "critical" ? "IMPORTANTE" : announcement.level === "attention" ? "ATENÇÃO" : "AVISO"}</span><strong>{announcement.title}</strong><p>{announcement.body}</p></article>)}</section>}

      <div className="shortcut-row home-shortcuts-five" aria-label="Atalhos">
        <button onClick={() => navigate("community")} aria-label="Comunidade" title="Comunidade"><span><HeartHandshake size={23} /></span></button>
        <button onClick={() => navigate("monitor")} aria-label="Monitorar" title="Monitorar"><span><RadioTower size={23} /></span></button>
        <button onClick={() => navigate("activities")} aria-label="Tarefas" title="Tarefas"><span><ClipboardCheck size={23} /></span></button>
        <button onClick={() => navigate("assistant")} aria-label="Assistente" title="Assistente"><span><MessageSquareText size={23} /></span></button>
        <button onClick={() => navigate("property")} aria-label="Propriedade" title="Propriedade"><span><Sprout size={23} /></span></button>
      </div>

      <button className="nfc-banner" onClick={() => navigate("nfc")}><span className="nfc-banner-icon"><ScanLine size={27} /></span><span className="nfc-banner-copy"><small>NFC / RFID</small><strong>Ler identificação do animal</strong><em>{account.animals.filter((animal) => animal.electronicId).length} identificados · {account.nfcReadCount} leituras</em></span><ChevronRight size={22} /></button>

      <section className="property-hero">
        <div className="property-hero-top"><div><span className="property-kicker">Propriedade</span><h2>{account.property.name || "Propriedade não cadastrada"}</h2><p>{propertyReady ? `${account.property.mainActivity} · ${account.property.municipality}, ${account.property.state}` : "Complete a ficha da propriedade"}</p></div><button onClick={() => navigate("property")} aria-label="Editar propriedade"><Sprout size={20} /></button></div>
        <div className="property-metrics"><div><UsersRound size={20} /><span><strong>Equipe</strong><small>gestão e operações</small></span></div><div><Cow size={20} /><span><strong>{account.animals.length}</strong><small>animais</small></span></div><div><ClipboardCheck size={20} /><span><strong>{pendingActivities.length}</strong><small>tarefas pendentes</small></span></div></div>
        <button className="property-link" onClick={() => navigate("property")}>Ver ficha <ChevronRight size={18} /></button>
      </section>

      <section className="home-section home-summary-section">
        <button className="history-home-row" onClick={() => navigate("history")}><span><History size={19} /></span><div><strong>Histórico da propriedade</strong><small>Atividades, rebanho, produção e monitoramentos</small></div><ChevronRight size={18} /></button>

        {!propertyReady && <button className="first-action-card" onClick={() => navigate("property")}><span><Plus size={24} /></span><div><strong>Complete a ficha da propriedade</strong><p>Localização, área e atividade principal.</p></div><ChevronRight size={21} /></button>}

        {pendingActivities.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>Atividades pendentes</strong><span>{pendingActivities.length}</span></div>{pendingActivities.slice(0, 3).map((activity) => <button key={activity.id} onClick={() => navigate("activities")}><span>{activity.category}</span><strong>{activity.title}</strong><ChevronRight size={19} /></button>)}</div>}

        {pendingActivities.length === 0 && pendingSetup.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>Primeiros passos</strong><span>{pendingSetup.length}</span></div>{pendingSetup.map((item) => <button key={item.label} onClick={() => navigate(item.route)}>{item.icon}<strong>{item.label}</strong><ChevronRight size={19} /></button>)}</div>}

        {pendingActivities.length === 0 && pendingSetup.length === 0 && <div className="calm-state"><Leaf size={22} /><div><strong>Sem atividades pendentes</strong><span>Os registros atuais estão em dia.</span></div></div>}
      </section>

      <button className="home-fab-label" onClick={onQuickAction}><Plus size={19} /> Nova ação</button>
    </div>
  );
}
