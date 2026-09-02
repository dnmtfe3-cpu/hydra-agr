"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "../../product-polish.css";
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
  Plus,
  ScanLine,
  Sprout,
} from "lucide-react";
import type { Announcement, AppRoute, HydraAccount } from "../../lib/hydra-types";
import { farmExperience } from "../../lib/farm-xp";
import { refreshDailyBriefingCopy } from "../../services/daily-briefing";
import { requireSupabase } from "../../services/supabase";
import { WeatherWidget } from "./weather-widget";

type Props = { account: HydraAccount; navigate: (route: AppRoute) => void; onQuickAction: () => void; announcements: Announcement[] };

function welcomeMessage() { const hour = new Date().getHours(); if (hour < 5) return "Boa noite"; if (hour < 12) return "Bom dia"; if (hour < 18) return "Boa tarde"; return "Boa noite"; }
function countLabel(count: number, singular: string, plural: string) { return `${count} ${count === 1 ? singular : plural}`; }

export function HomeScreen({ account, navigate, announcements }: Props) {
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const firstName = account.profile.name.split(/\s+/)[0] || "Produtor";
  const welcome = welcomeMessage();
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const pendingActivities = account.activities.filter((activity) => !activity.done);
  const propertyReady = Boolean(account.property.name && account.property.municipality && account.property.state);
  const identifiedAnimals = account.animals.filter((animal) => animal.electronicId).length;
  const farmXp = farmExperience(account);
  const profileInitials = account.profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
  const featuredAnimal = account.animals.find((animal) => animal.photoUrl) ?? account.animals[0];

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
        <span>{account.property.name || "Gestão da propriedade"}</span>
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

    <div className="home-section-title home-feature-title"><div><small>DESTAQUES</small><h2>Sua propriedade hoje</h2></div></div>
    <div className="home-feature-grid">
      <button className={`home-feature-card ${account.property.coverUrl ? "has-photo" : ""}`} onClick={() => navigate("property")}>
        <span className="home-feature-media">{account.property.coverUrl ? <img src={account.property.coverUrl} alt="" /> : <Sprout size={34} />}</span>
        <span className="home-feature-copy"><small>PROPRIEDADE</small><strong>{account.property.name || "Complete sua propriedade"}</strong><em>{propertyReady ? `${account.property.municipality}, ${account.property.state}` : "Adicionar localização"}</em></span>
      </button>
      <button className={`home-feature-card ${featuredAnimal?.photoUrl ? "has-photo" : ""}`} onClick={() => navigate("herd")}>
        <span className="home-feature-media">{featuredAnimal?.photoUrl ? <img src={featuredAnimal.photoUrl} alt="" /> : <Cow size={34} />}</span>
        <span className="home-feature-copy"><small>REBANHO</small><strong>{featuredAnimal ? (featuredAnimal.name || featuredAnimal.identification) : "Cadastrar animais"}</strong><em>{countLabel(account.animals.length, "animal", "animais")} na propriedade</em></span>
      </button>
    </div>

    <div className="home-dashboard-grid">
      <div className="home-dashboard-primary">
        <button className="nfc-banner" onClick={() => navigate("nfc")}><span className="nfc-banner-icon"><ScanLine size={26} /></span><span className="nfc-banner-copy"><small>HYDRA TAG · NFC / RFID</small><strong>Ler identificação do animal</strong><em>{countLabel(identifiedAnimals, "identificado", "identificados")} · {countLabel(account.nfcReadCount, "leitura", "leituras")}</em></span><ChevronRight size={20} /></button>
      </div>

      <section className="home-section home-summary-section"><button className="history-home-row" onClick={() => navigate("history")}><span><History size={19} /></span><div><strong>Histórico da propriedade</strong><small>Tarefas, rebanho, produção e monitoramentos</small></div><ChevronRight size={18} /></button>
        {!propertyReady && <button className="first-action-card" onClick={() => navigate("property")}><span><Plus size={24} /></span><div><strong>Complete a localização da propriedade</strong><p>UF, CEP e nome da propriedade.</p></div><ChevronRight size={21} /></button>}
        {pendingActivities.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>{pendingActivities.length === 1 ? "Tarefa pendente" : "Tarefas pendentes"}</strong><span>{pendingActivities.length}</span></div>{pendingActivities.slice(0, 3).map((activity) => <button key={activity.id} onClick={() => navigate("activities")}><span>{activity.category}</span><strong>{activity.title}</strong><ChevronRight size={19} /></button>)}</div>}
        {pendingActivities.length === 0 && pendingSetup.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>Primeiros passos</strong><span>{pendingSetup.length}</span></div>{pendingSetup.map((item) => <button key={item.label} onClick={() => navigate(item.route)}>{item.icon}<strong>{item.label}</strong><ChevronRight size={19} /></button>)}</div>}
        {pendingActivities.length === 0 && pendingSetup.length === 0 && <div className="calm-state"><Leaf size={22} /><div><strong>Sem tarefas pendentes</strong><span>Os registros estão em dia.</span></div></div>}
      </section>
    </div>
  </div>;
}
