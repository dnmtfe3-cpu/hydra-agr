"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "../../product-polish.css";
import "../../nova-acao-tools.css";
import "./home-production-shortcut.css";
import "./home-production-notebook-card.css";
import "./home-profile-xp.css";
import {
  Bell,
  BellRing,
  ChevronRight,
  ClipboardCheck,
  Beef as Cow,
  FileSpreadsheet,
  HeartHandshake,
  History,
  Leaf,
  Map,
  MessageSquareText,
  NotebookTabs,
  Plus,
  RadioTower,
  Recycle,
  ScanLine,
  Sprout,
  UsersRound,
  X,
} from "lucide-react";
import type { Announcement, AppRoute, HydraAccount } from "../../lib/hydra-types";
import { farmExperience } from "../../lib/farm-xp";
import { refreshDailyBriefingCopy } from "../../services/daily-briefing";
import { currentMonthTotals, loadProductionNotebook } from "../../services/family-farming-repository";
import { requireSupabase } from "../../services/supabase";
import { DailyBriefingPanel } from "../daily-briefing/daily-briefing-panel";
import { NutriCicloPanel } from "../family-farming/nutriciclo-panel";
import { HydraSpreadsheetPanel } from "../spreadsheets/hydra-spreadsheet-panel";
import { WeatherWidget } from "./weather-widget";

type Props = { account: HydraAccount; navigate: (route: AppRoute) => void; onQuickAction: () => void; announcements: Announcement[] };

function welcomeMessage() { const hour = new Date().getHours(); if (hour < 5) return "Boa noite"; if (hour < 12) return "Bom dia"; if (hour < 18) return "Boa tarde"; return "Boa noite"; }
function countLabel(count: number, singular: string, plural: string) { return `${count} ${count === 1 ? singular : plural}`; }
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(value)); }

export function HomeScreen({ account, navigate, announcements }: Props) {
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [productionResult, setProductionResult] = useState<number | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [nutriCicloOpen, setNutriCicloOpen] = useState(false);
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const [dailyBriefingOpen, setDailyBriefingOpen] = useState(false);
  const firstName = account.profile.name.split(/\s+/)[0] || "Produtor";
  const welcome = welcomeMessage();
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const pendingActivities = account.activities.filter((activity) => !activity.done);
  const propertyReady = Boolean(account.property.municipality && account.property.mainActivity);
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

  useEffect(() => {
    void refreshDailyBriefingCopy(account).catch(() => undefined);
  }, [account.id]);

  useEffect(() => {
    let active = true;
    void loadProductionNotebook(account).then((notebook) => { const hasRecords = notebook.production.length + notebook.sales.length + notebook.expenses.length + notebook.familyWork.length > 0; if (active) setProductionResult(hasRecords ? currentMonthTotals(notebook).result : null); }).catch(() => { if (active) setProductionResult(null); });
    return () => { active = false; };
  }, [account.id, account.access.ownerUserId, account.property.id]);

  useEffect(() => {
    if (!toolsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [toolsOpen]);

  const pendingSetup = [account.animals.length === 0 && { label: "Cadastrar o primeiro animal", icon: <Cow size={21} />, route: "herd" as AppRoute }, account.sectors.length === 0 && { label: "Criar o primeiro setor", icon: <Map size={21} />, route: "monitor" as AppRoute }].filter(Boolean) as { label: string; icon: ReactNode; route: AppRoute }[];

  const closeToolsAnd = (action: () => void) => {
    setToolsOpen(false);
    window.setTimeout(action, 0);
  };

  return <div className="screen home-screen page-enter">
    <div className="home-brandbar profile-brandbar">
      <button className="home-profile-progress" onClick={() => navigate("profile")} aria-label={`Abrir perfil. Nível ${farmXp.level}, ${farmXp.xp} XP da fazenda`} title="Abrir perfil" style={{ "--profile-progress": `${farmXp.progress}%` } as CSSProperties}><span className="home-profile-avatar">{account.profile.avatarUrl ? <img src={account.profile.avatarUrl} alt="" /> : profileInitials}</span><span className="home-profile-level" aria-hidden="true">{farmXp.level}</span></button>
      <div className="home-farm-xp" aria-label={`${farmXp.xp} XP da fazenda`}><strong>{farmXp.xp.toLocaleString("pt-BR")} XP</strong><span>{farmXp.lifetimeVip ? "Nível 10 · VIP vitalício" : `XP da fazenda · nível ${farmXp.level}`}</span></div>
      <button className="icon-button bare" onClick={() => navigate("notifications")} aria-label="Notificações"><Bell size={23} />{hasUnreadNotifications && <span className="notification-dot" />}</button>
    </div>

    <section className="greeting-block"><div><h1><span className="greeting-time">{welcome},</span> <strong className="greeting-name">{firstName}</strong></h1><p className="capitalize">{today}</p></div><WeatherWidget municipality={account.property.municipality} onCompleteProperty={() => navigate("property")} /></section>
    {announcements.length > 0 && <section className="home-announcements" aria-label="Avisos do Hydra Agro">{announcements.slice(0, 3).map((announcement) => <article key={announcement.id} className={announcement.level}><span>{announcement.level === "critical" ? "IMPORTANTE" : announcement.level === "attention" ? "ATENÇÃO" : "AVISO"}</span><strong>{announcement.title}</strong><p>{announcement.body}</p></article>)}</section>}

    <div className="shortcut-row home-shortcuts-five" aria-label="Atalhos">
      <button onClick={() => navigate("community")} aria-label="Comunidade" title="Comunidade"><span><HeartHandshake size={23} /></span></button>
      <button onClick={() => navigate("monitor")} aria-label="Monitorar" title="Monitorar"><span><RadioTower size={23} /></span></button>
      <button onClick={() => navigate("activities")} aria-label="Tarefas" title="Tarefas"><span><ClipboardCheck size={23} /></span></button>
      <button onClick={() => navigate("assistant")} aria-label="Assistente" title="Assistente"><span><MessageSquareText size={23} /></span></button>
      <button className="production-shortcut" onClick={() => navigate("production")} aria-label="Caderno da Produção" title="Produção"><span><NotebookTabs size={23} /></span></button>
    </div>

    <button className="nfc-banner" onClick={() => navigate("nfc")}><span className="nfc-banner-icon"><ScanLine size={27} /></span><span className="nfc-banner-copy"><small>NFC / RFID</small><strong>Ler identificação do animal</strong><em>{countLabel(identifiedAnimals, "identificado", "identificados")} · {countLabel(account.nfcReadCount, "leitura", "leituras")}</em></span><ChevronRight size={22} /></button>

    <button className="home-spreadsheet-card" style={{ marginTop: 18 }} onClick={() => setDailyBriefingOpen(true)}><span><BellRing size={21} /></span><span><small>HYDRA AVISOS</small><strong>O que fazer hoje</strong><em>{pendingActivities.length ? countLabel(pendingActivities.length, "tarefa pendente", "tarefas pendentes") : "Tudo em dia na propriedade"}</em></span><ChevronRight size={18} /></button>

    <section className="property-hero"><div className="property-hero-top"><div><span className="property-kicker">Propriedade</span><h2>{account.property.name || "Propriedade não cadastrada"}</h2><p>{propertyReady ? `${account.property.mainActivity} · ${account.property.municipality}, ${account.property.state}` : "Complete a ficha da propriedade"}</p></div><button onClick={() => navigate("property")} aria-label="Editar propriedade"><Sprout size={20} /></button></div><div className="property-metrics"><div><UsersRound size={20} /><span><strong>Equipe</strong><small>gestão e operações</small></span></div><div><Cow size={20} /><span><strong>{account.animals.length}</strong><small>{account.animals.length === 1 ? "animal" : "animais"}</small></span></div><div><ClipboardCheck size={20} /><span><strong>{pendingActivities.length}</strong><small>{pendingActivities.length === 1 ? "tarefa pendente" : "tarefas pendentes"}</small></span></div></div><button className="property-link" onClick={() => navigate("property")}>Ver ficha <ChevronRight size={18} /></button></section>

    <section className="home-section home-summary-section"><button className="history-home-row" onClick={() => navigate("history")}><span><History size={19} /></span><div><strong>Histórico da propriedade</strong><small>Tarefas, rebanho, produção e monitoramentos</small></div><ChevronRight size={18} /></button>
      {!propertyReady && <button className="first-action-card" onClick={() => navigate("property")}><span><Plus size={24} /></span><div><strong>Complete a ficha da propriedade</strong><p>Localização, área e atividade principal.</p></div><ChevronRight size={21} /></button>}
      {pendingActivities.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>{pendingActivities.length === 1 ? "Tarefa pendente" : "Tarefas pendentes"}</strong><span>{pendingActivities.length}</span></div>{pendingActivities.slice(0, 3).map((activity) => <button key={activity.id} onClick={() => navigate("activities")}><span>{activity.category}</span><strong>{activity.title}</strong><ChevronRight size={19} /></button>)}</div>}
      {pendingActivities.length === 0 && pendingSetup.length > 0 && <div className="task-card"><div className="task-card-title"><ClipboardCheck size={21} /><strong>Primeiros passos</strong><span>{pendingSetup.length}</span></div>{pendingSetup.map((item) => <button key={item.label} onClick={() => navigate(item.route)}>{item.icon}<strong>{item.label}</strong><ChevronRight size={19} /></button>)}</div>}
      {pendingActivities.length === 0 && pendingSetup.length === 0 && <div className="calm-state"><Leaf size={22} /><div><strong>Sem tarefas pendentes</strong><span>Os registros estão em dia.</span></div></div>}
    </section>

    <button className="home-fab-label" onClick={() => setToolsOpen(true)}><Plus size={19} /> Nova ação</button>

    {toolsOpen && <div className="quick-layer nova-action-layer" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setToolsOpen(false); }}>
      <section className="quick-sheet nova-action-sheet" role="dialog" aria-modal="true" aria-label="Nova ação">
        <header className="nova-action-head">
          <div><h2>Nova ação</h2></div>
          <button className="icon-button nova-action-close" onClick={() => setToolsOpen(false)} aria-label="Fechar"><X size={23} /></button>
        </header>
        <div className="nova-action-list">
          <button className="nova-action-row" onClick={() => closeToolsAnd(() => navigate("production"))}><span><NotebookTabs size={21} /></span><div><small>AGRICULTURA FAMILIAR</small><strong>{productionResult === null ? "Caderno da Produção" : `${productionResult >= 0 ? "+ " : "− "}${money(productionResult)} este mês`}</strong></div><ChevronRight size={19} /></button>
          <button className="nova-action-row" onClick={() => closeToolsAnd(() => setNutriCicloOpen(true))}><span><Recycle size={21} /></span><div><small>DIFERENCIAL HYDRA</small><strong>Hydra NutriCiclo</strong><em>Aproveitamento da produção.</em></div><ChevronRight size={19} /></button>
          <button className="nova-action-row" onClick={() => closeToolsAnd(() => setSpreadsheetOpen(true))}><span><FileSpreadsheet size={21} /></span><div><small>HYDRA PLANILHA</small><strong>Exportar dados</strong><em>Excel ou WhatsApp.</em></div><ChevronRight size={19} /></button>
          <button className="nova-action-row" onClick={() => closeToolsAnd(() => navigate("monitor"))}><span><RadioTower size={21} /></span><div><strong>Monitoramento</strong><em>Setores e inspeções da propriedade</em></div><ChevronRight size={19} /></button>
          <button className="nova-action-row" onClick={() => closeToolsAnd(() => navigate("community"))}><span><HeartHandshake size={21} /></span><div><strong>Comunidade</strong><em>Publicações de produtores</em></div><ChevronRight size={19} /></button>
        </div>
      </section>
    </div>}

    <NutriCicloPanel account={account} open={nutriCicloOpen} onClose={() => setNutriCicloOpen(false)} /><DailyBriefingPanel account={account} open={dailyBriefingOpen} onClose={() => setDailyBriefingOpen(false)} /><HydraSpreadsheetPanel account={account} open={spreadsheetOpen} onClose={() => setSpreadsheetOpen(false)} />
  </div>;
}