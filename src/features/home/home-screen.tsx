"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "../../product-polish.css";
import "./home-production-shortcut.css";
import "./home-profile-xp.css";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  Beef as Cow,
  History,
  Leaf,
  Map,
  MapPin,
  MessageSquareText,
  NotebookTabs,
  Plus,
  RadioTower,
  Recycle,
  ScanLine,
  Sprout,
  UsersRound,
} from "lucide-react";
import type { Announcement, AppRoute, HydraAccount } from "../../lib/hydra-types";
import { farmExperience } from "../../lib/farm-xp";
import { refreshDailyBriefingCopy } from "../../services/daily-briefing";
import { requireSupabase } from "../../services/supabase";
import { NutriCicloPanel } from "../family-farming/nutriciclo-panel";
import { WeatherWidget } from "./weather-widget";

type Props = { account: HydraAccount; navigate: (route: AppRoute) => void; onQuickAction: () => void; announcements: Announcement[] };

function welcomeMessage() { const hour = new Date().getHours(); if (hour < 5) return "Boa noite"; if (hour < 12) return "Bom dia"; if (hour < 18) return "Boa tarde"; return "Boa noite"; }
function countLabel(count: number, singular: string, plural: string) { return `${count} ${count === 1 ? singular : plural}`; }

export function HomeScreen({ account, navigate, announcements }: Props) {
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [nutriCicloOpen, setNutriCicloOpen] = useState(false);
  const firstName = account.profile.name.split(/\s+/)[0] || "Produtor";
  const welcome = welcomeMessage();
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const pendingActivities = account.activities.filter((activity) => !activity.done);
  const propertyReady = Boolean(account.property.name && account.property.municipality && account.property.state);
  const identifiedAnimals = account.animals.filter((animal) => animal.electronicId).length;
  const farmXp = farmExperience(account);
  const profileInitials = account.profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";

  useEffect(() => {
    let active = true; const client = requireSupabase();
    async function refreshUnread() { const { count, error } = await client.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_user_id", account.id).is("read_at", null); if (active && !error) setHasUnreadNotifications((count ?? 0) > 0); }
    void refreshUnread();
    const channel = client.channel(`hydra-home-notifications-${account.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${account.id}` }, () => { void refreshUnread(); }).subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [account.id]);

  useEffect(() => { void refreshDailyBriefingCopy(account).catch(() => undefined); }, [account.id]);

  const pendingSetup = [account.animals.length === 0 && { label: "Cadastrar o primeiro animal", icon: <Cow size={21} />, route: "herd" as AppRoute }, account.sectors.length === 0 && { label: "Criar o primeiro setor", icon: <Map size={21} />, route: "monitor" as AppRoute }].filter(Boolean) as { label: string; icon: ReactNode; route: AppRoute }[];

  return <div className="screen home-screen page-enter">
    <div className="home-brandbar profile-brandbar">
      <div className="home-brand-copy">
        <strong>Hydra Agro</strong>
        <span>{farmXp.xp.toLocaleString("pt-BR")} XP · nível {farmXp.level}</span>
      </div>
      <div className="home-brand-actions">
        <button className="icon-button bare" onClick={() => navigate("notifications")} aria-label="Notificações"><Bell size={21} />{hasUnreadNotifications && <span className="notification-dot" />}</button>
        <button className="home-profile-progress" onClick={() => navigate("profile")} aria-label={`Abrir perfil. Nível ${farmXp.level}, ${farmXp.xp} XP da fazenda`} title="Abrir perfil" style={{ "--profile-progress": `${farmXp.progress}%` } as CSSProperties}><span className="home-profile-avatar">{account.profile.avatarUrl ? <img src={account.profile.avatarUrl} alt="" /> : profileInitials}</span><span className="home-profile-level" aria-hidden="true">{farmXp.level}</span></button>
      </div>
    </div>

    <section className="greeting-block">
      <div className="home-greeting-copy">
        <h1><span className="greeting-time">{welcome}, </span><strong className="greeting-name">{firstName}</strong></h1>
        <p className="capitalize">{today}</p>
        <button className="home-property-line" onClick={() => navigate("property")}>
          <MapPin size={15} />
          <span>{account.property.name || "Cadastrar propriedade"}{propertyReady ? ` · ${account.property.municipality}, ${account.property.state}` : ""}</span>
          <ChevronRight size={16} />
        </button>
      </div>
      <WeatherWidget municipality={account.property.municipality} state={account.property.state} onCompleteProperty={() => navigate("property")} />
    </section>

    {announcements.length > 0 && <section className="home-announcements" aria-label="Avisos do Hydra Agro">{announcements.slice(0, 3).map((announcement) => <article key={announcement.id} className={announcement.level}><span>{announcement.level === "critical" ? "IMPORTANTE" : announcement.level === "attention" ? "ATENÇÃO" : "AVISO"}</span><strong>{announcement.title}</strong><p>{announcement.body}</p></article>)}</section>}

    <div className="home-section-title"><div><small>ACESSO RÁPIDO</small><h2>Gestão da fazenda</h2></div></div>
    <div className="shortcut-row home-shortcuts-five" aria-label="Atalhos">
      <button onClick={() => setNutriCicloOpen(true)} aria-label="Hydra NutriCiclo" title="Hydra NutriCiclo"><span><Recycle size={22} /></span><small>NutriCiclo</small></button>
      <button onClick={() => navigate("monitor")} aria-label="Monitorar" title="Monitorar"><span><RadioTower size={22} /></span><small>Monitorar</small></button>
      <button onClick={() => navigate("activities")} aria-label="Tarefas" title="Tarefas"><span><ClipboardCheck size={22} /></span><small>Tarefas</small></button>
      <button onClick={() => navigate("assistant")} aria-label="Assistente" title="Assistente"><span><MessageSquareText size={22} /></span><small>Assistente</small></button>
      <button className="production-shortcut" onClick={() => navigate("production")} aria-label="Caderno da Produção" title="Agricultura familiar"><span><NotebookTabs size={22} /></span><small>Produção</small></button>
    </div>

    <div className="home-dashboard-grid">
      <div className="home-dashboard-primary">
        <button className="nfc-banner" onClick={() => navigate("nfc")}><span className="nfc-banner-icon"><ScanLine size={26} /></span><span className="nfc-banner-copy"><small>HYDRA TAG · NFC / RFID</small><strong>Ler identificação do animal</strong><em>{countLabel(identifiedAnimals, "identificado", "identificados")} · {countLabel(account.nfcReadCount, "leitura", "leituras")}</em></span><ChevronRight size={20} /></button>

        <section className="property-hero"><div className="property-hero-top"><div><span className="property-kicker">PROPRIEDADE</span><h2>{account.property.name || "Propriedade não cadastrada"}</h2><p>{propertyReady ? `${account.property.mainActivity ? `${account.property.mainActivity} · ` : ""}${account.property.municipality}, ${account.property.state}` : "Complete a localização da propriedade"}</p></div><button onClick={() => navigate("property")} aria-label="Editar propriedade"><Sprout size={20} /></button></div><div className="property-metrics"><div><UsersRound size={19} /><span><strong>Equipe</strong><small>gestão e operações</small></span></div><div><Cow size={19} /><span><strong>{account.animals.length}</strong><small>{account.animals.length === 1 ? "animal" : "animais"}</small></span></div><div><ClipboardCheck size={19} /><span><strong>{pendingActivities.length}</strong><small>{pendingActivities.length === 1 ? "tarefa pendente" : "tarefas pendentes"}</small></span></div></div><button className="property-link" onClick={() => navigate("property")}>Ver detalhes <ChevronRight size={17} /></button></section>
      </div>

      <section className="home-section home-summary-section"><button className="history-home-row" onClick={() => navigate("history")}><span><History size={19} /></span><div><strong>Histórico da propriedade</strong><small>Tarefas, rebanho, produção e monitoramentos</small></div><ChevronRight size={18} /></button>
        {!propertyReady && <button className="first-action-card" onClick={() => navigate("property")}><span><Plus size={24} /></span><div><strong>Complete a localização da propriedade</strong><p>UF, CEP e nome da propriedade.</p></div><ChevronRight size={21} /></button>}
        {pendingActivities.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>{pendingActivities.length === 1 ? "Tarefa pendente" : "Tarefas pendentes"}</strong><span>{pendingActivities.length}</span></div>{pendingActivities.slice(0, 3).map((activity) => <button key={activity.id} onClick={() => navigate("activities")}><span>{activity.category}</span><strong>{activity.title}</strong><ChevronRight size={19} /></button>)}</div>}
        {pendingActivities.length === 0 && pendingSetup.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>Primeiros passos</strong><span>{pendingSetup.length}</span></div>{pendingSetup.map((item) => <button key={item.label} onClick={() => navigate(item.route)}>{item.icon}<strong>{item.label}</strong><ChevronRight size={19} /></button>)}</div>}
        {pendingActivities.length === 0 && pendingSetup.length === 0 && <div className="calm-state"><Leaf size={22} /><div><strong>Sem tarefas pendentes</strong><span>Os registros estão em dia.</span></div></div>}
      </section>
    </div>

    <NutriCicloPanel account={account} open={nutriCicloOpen} onClose={() => setNutriCicloOpen(false)} />
  </div>;
}
