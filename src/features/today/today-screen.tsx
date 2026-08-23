import { Beef as Cow, CheckCircle2, CloudOff, FileDown, History, LayoutDashboard, RefreshCw, RadioTower, ScanLine, TriangleAlert, Wifi } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { ScreenHeader } from "../../components/ui";
import type { SyncStatus } from "../../hooks/use-hydra-store";
import type { AppRoute, HydraAccount } from "../../lib/hydra-types";
import { downloadPropertyReportPdf } from "../../services/property-report";

type Props = {
  account: HydraAccount;
  syncStatus: SyncStatus;
  lastError?: string;
  onBack: () => void;
  navigate: (route: AppRoute) => void;
  retrySync: () => Promise<void>;
};

function dayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function TodayScreen({ account, syncStatus, lastError, onBack, navigate, retrySync }: Props) {
  const summary = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const pending = account.activities.filter((activity) => !activity.done);
    const overdue = pending.filter((activity) => {
      const timestamp = new Date(activity.date).getTime();
      return Number.isFinite(timestamp) && timestamp < startToday;
    });
    const todayActivities = pending.filter((activity) => dayKey(activity.date) === today);
    const withoutNfc = account.animals.filter((animal) => !animal.electronicId);
    const withoutWeight = account.animals.filter((animal) => !animal.weight);
    const occurrences = account.monitoring.filter((record) => Boolean(record.occurrence?.trim()));
    const todayRecords =
      account.activities.filter((activity) => dayKey(activity.date) === today).length
      + account.monitoring.filter((record) => dayKey(record.date) === today).length
      + account.animals.reduce(
        (sum, animal) => sum + (animal.history ?? []).filter((entry) => dayKey(entry.date) === today).length,
        0,
      );
    const identified = account.animals.length - withoutNfc.length;
    const nfcCoverage = account.animals.length ? Math.round((identified / account.animals.length) * 100) : 0;
    const priorities: Array<{ title: string; detail: string; route: AppRoute; tone: "attention" | "info" }> = [];

    if (overdue.length) {
      priorities.push({
        title: countLabel(overdue.length, "atividade atrasada", "atividades atrasadas"),
        detail: overdue.length === 1 ? "A data dessa atividade já passou." : "As datas dessas atividades já passaram.",
        route: "activities",
        tone: "attention",
      });
    }
    if (withoutNfc.length) {
      priorities.push({
        title: countLabel(withoutNfc.length, "animal sem NFC/RFID", "animais sem NFC/RFID"),
        detail: withoutNfc.length === 1 ? "Falta vincular a identificação eletrônica." : "Falta vincular a identificação eletrônica desses animais.",
        route: "nfc",
        tone: "info",
      });
    }
    if (withoutWeight.length) {
      priorities.push({
        title: countLabel(withoutWeight.length, "animal sem peso", "animais sem peso"),
        detail: withoutWeight.length === 1 ? "Ainda não há uma pesagem registrada." : "Ainda não há pesagem registrada para esses animais.",
        route: "herd",
        tone: "info",
      });
    }
    if (occurrences.length) {
      priorities.push({
        title: countLabel(occurrences.length, "ocorrência registrada", "ocorrências registradas"),
        detail: occurrences.length === 1 ? "Há uma ocorrência para revisar." : "Há ocorrências para revisar.",
        route: "operations",
        tone: "attention",
      });
    }

    return { pending, overdue, todayActivities, withoutNfc, withoutWeight, occurrences, todayRecords, identified, nfcCoverage, priorities };
  }, [account]);

  const syncCopy = syncStatus === "saved"
    ? { title: "Sincronizado", detail: "As alterações deste aparelho estão salvas no servidor.", icon: Wifi, tone: "ok" }
    : syncStatus === "saving"
      ? { title: "Sincronizando", detail: "Salvando as últimas alterações.", icon: RefreshCw, tone: "saving" }
      : syncStatus === "offline"
        ? { title: "Sem conexão", detail: "As alterações ficam neste aparelho até a internet voltar.", icon: CloudOff, tone: "offline" }
        : { title: "Falha na sincronização", detail: lastError || "Seus dados continuam disponíveis. Tente novamente.", icon: TriangleAlert, tone: "error" };
  const SyncIcon = syncCopy.icon;

  return (
    <div className="screen page-enter today-screen">
      <ScreenHeader eyebrow="HOJE" title="Resumo do dia" subtitle="Tarefas, registros e situação da propriedade." onBack={onBack} />

      <section className="today-hero">
        <span className="today-hero-icon"><LayoutDashboard size={24} /></span>
        <div>
          <small>Propriedade</small>
          <strong>{account.property.name || "Minha propriedade"}</strong>
          <p>{summary.priorities.length ? countLabel(summary.priorities.length, "item para conferir", "itens para conferir") : "Tudo certo por aqui."}</p>
        </div>
        <button onClick={() => downloadPropertyReportPdf(account)}><FileDown size={17} /> PDF</button>
      </section>

      <div className="today-metrics">
        <article><ClipboardMetric icon={<CheckCircle2 size={18} />} value={summary.pending.length} label="pendentes" /></article>
        <article><ClipboardMetric icon={<TriangleAlert size={18} />} value={summary.overdue.length + summary.occurrences.length} label="atenções" /></article>
        <article><ClipboardMetric icon={<RadioTower size={18} />} value={summary.todayRecords} label="registros hoje" /></article>
        <article><ClipboardMetric icon={<ScanLine size={18} />} value={`${summary.nfcCoverage}%`} label="com NFC" /></article>
      </div>

      <section className={`today-sync-card ${syncCopy.tone}`}>
        <span><SyncIcon size={20} className={syncStatus === "saving" ? "spin" : ""} /></span>
        <div><strong>{syncCopy.title}</strong><small>{syncCopy.detail}</small></div>
        {(syncStatus === "offline" || syncStatus === "error") && <button onClick={() => void retrySync()}><RefreshCw size={15} /> Tentar</button>}
      </section>
      <p className="today-offline-note">Rebanho, tarefas e monitoramentos podem ficar pendentes no aparelho. Fotos e comunidade precisam de conexão.</p>

      <div className="today-section-title"><div><small>Prioridades</small><strong>Para conferir</strong></div><button onClick={() => navigate("assistant")}>Abrir assistente</button></div>
      <section className="today-priority-list">
        {summary.priorities.length ? summary.priorities.slice(0, 5).map((item) => (
          <button key={`${item.route}-${item.title}`} className={item.tone} onClick={() => navigate(item.route)}>
            <span>{item.tone === "attention" ? <TriangleAlert size={18} /> : item.route === "nfc" ? <ScanLine size={18} /> : <Cow size={18} />}</span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
          </button>
        )) : (
          <div className="today-calm"><CheckCircle2 size={21} /><div><strong>Sem pendências</strong><small>Nada precisa da sua atenção agora.</small></div></div>
        )}
      </section>

      <div className="today-section-title"><div><small>Agenda</small><strong>Tarefas de hoje</strong></div><button onClick={() => navigate("activities")}>Ver todas</button></div>
      {summary.todayActivities.length ? (
        <section className="today-activity-list">
          {summary.todayActivities.slice(0, 5).map((activity) => (
            <button key={activity.id} onClick={() => navigate("activities")}>
              <span>{activity.category}</span>
              <strong>{activity.title}</strong>
              <small>{new Date(activity.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
            </button>
          ))}
        </section>
      ) : <div className="today-empty">Nenhuma tarefa pendente marcada para hoje.</div>}

      <button className="today-history-link" onClick={() => navigate("history")}><History size={19} /><span><strong>Histórico da propriedade</strong><small>Ver registros por data</small></span></button>

      <section className="today-report-card"><span><FileDown size={22} /></span><div><strong>Relatório da propriedade</strong><small>PDF com rebanho, tarefas e monitoramentos cadastrados.</small></div><button onClick={() => downloadPropertyReportPdf(account)}>Gerar PDF</button></section>
    </div>
  );
}

function ClipboardMetric({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return <>{icon}<strong>{value}</strong><small>{label}</small></>;
}
