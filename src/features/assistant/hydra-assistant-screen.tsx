import {
  Beef as Cow,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  FileDown,
  LoaderCircle,
  Nfc,
  RadioTower,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { showAppToast } from "../../components/modal-system";
import { ScreenHeader } from "../../components/ui";
import type { HydraAccount } from "../../lib/hydra-types";
import { downloadPropertyReportPdf } from "../../services/property-report";
import { supabase } from "../../services/supabase";

type Props = { account: HydraAccount; onBack: () => void };
type AssistantMessage = { id: string; role: "user" | "assistant"; text: string; mode?: "ai" | "local" | "action" };
type AssistantContext = {
  property: { name: string; municipality: string; state: string; area: string; areaUnit: string; mainActivity: string; otherActivities: string[] };
  herd: { total: number; identified: number; nfcCoverage: number; withoutWeight: number; attention: number; species: Record<string, number>; recentAnimals: Array<{ identification: string; name?: string; species: string; status: string; weight?: number; identified: boolean }> };
  activities: { total: number; pending: number; overdue: number; completed: number; completionRate: number; next: Array<{ title: string; category: string; date: string; done: boolean }> };
  monitoring: { total: number; last30Days: number; withOccurrence: number };
  dataQuality: { score: number; missingProperty: number; missingNfc: number; missingWeight: number; issues: string[] };
  priorities: string[];
  nfcReadCount: number;
};

const quickQuestions = [
  { label: "O que precisa de atenção hoje?", detail: "Pendências da propriedade", icon: TriangleAlert },
  { label: "Resuma minha propriedade", detail: "Rebanho, tarefas e registros", icon: Sparkles },
  { label: "O que falta cadastrar?", detail: "Campos que ainda estão vazios", icon: Database },
  { label: "Como está meu rebanho?", detail: "NFC, peso e observações", icon: Cow },
  { label: "Quais tarefas estão atrasadas?", detail: "Prazos que já passaram", icon: ClipboardCheck },
  { label: "Há ocorrências nos monitoramentos?", detail: "Registros para revisar", icon: RadioTower },
];

function dateOnly(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function contextFromAccount(account: HydraAccount): AssistantContext {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pending = account.activities.filter((activity) => !activity.done);
  const completed = account.activities.filter((activity) => activity.done);
  const overdue = pending.filter((activity) => {
    const date = dateOnly(activity.date);
    return Boolean(date && date < today);
  });
  const completionRate = account.activities.length ? Math.round((completed.length / account.activities.length) * 100) : 100;

  const species = account.animals.reduce<Record<string, number>>((result, animal) => {
    result[animal.species] = (result[animal.species] ?? 0) + 1;
    return result;
  }, {});
  const identified = account.animals.filter((animal) => Boolean(animal.electronicId)).length;
  const missingNfc = Math.max(0, account.animals.length - identified);
  const missingWeight = account.animals.filter((animal) => !animal.weight).length;
  const nfcCoverage = account.animals.length ? Math.round((identified / account.animals.length) * 100) : 0;
  const animalsInObservation = account.animals.filter((animal) => animal.status.toLocaleLowerCase("pt-BR").includes("observ")).length;

  const monitoring30 = account.monitoring.filter((record) => {
    const date = dateOnly(record.date);
    return Boolean(date && date >= thirtyDaysAgo);
  });
  const monitoringWithOccurrence = account.monitoring.filter((record) => Boolean(record.occurrence?.trim())).length;

  const missingPropertyFields = [
    account.property.name,
    account.property.municipality,
    account.property.area,
    account.property.mainActivity,
  ].filter((value) => !String(value ?? "").trim()).length;

  const issues: string[] = [];
  if (missingPropertyFields) issues.push(countLabel(missingPropertyFields, "campo principal da propriedade incompleto", "campos principais da propriedade incompletos"));
  if (missingNfc) issues.push(countLabel(missingNfc, "animal sem NFC/RFID", "animais sem NFC/RFID"));
  if (missingWeight) issues.push(countLabel(missingWeight, "animal sem peso registrado", "animais sem peso registrado"));
  if (account.sectors.length === 0) issues.push("nenhum setor cadastrado");

  const deductions = missingPropertyFields * 10 + Math.min(25, missingNfc * 3) + Math.min(20, missingWeight * 2) + (account.sectors.length ? 0 : 5);
  const dataQualityScore = Math.max(0, Math.min(100, 100 - deductions));

  const priorities: string[] = [];
  if (overdue.length) priorities.push(countLabel(overdue.length, "tarefa atrasada", "tarefas atrasadas"));
  if (animalsInObservation) priorities.push(countLabel(animalsInObservation, "animal em observação", "animais em observação"));
  if (missingNfc) priorities.push(countLabel(missingNfc, "animal sem NFC/RFID", "animais sem NFC/RFID"));
  if (missingWeight) priorities.push(countLabel(missingWeight, "animal sem peso", "animais sem peso"));
  if (monitoringWithOccurrence) priorities.push(countLabel(monitoringWithOccurrence, "ocorrência registrada", "ocorrências registradas"));

  return {
    property: {
      name: account.property.name,
      municipality: account.property.municipality,
      state: account.property.state,
      area: account.property.area,
      areaUnit: account.property.areaUnit,
      mainActivity: account.property.mainActivity,
      otherActivities: account.property.otherActivities,
    },
    herd: {
      total: account.animals.length,
      identified,
      nfcCoverage,
      withoutWeight: missingWeight,
      attention: animalsInObservation,
      species,
      recentAnimals: account.animals.slice(0, 12).map((animal) => ({
        identification: animal.identification,
        name: animal.name,
        species: animal.species,
        status: animal.status,
        weight: animal.weight,
        identified: Boolean(animal.electronicId),
      })),
    },
    activities: {
      total: account.activities.length,
      pending: pending.length,
      overdue: overdue.length,
      completed: completed.length,
      completionRate,
      next: pending
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 8)
        .map((activity) => ({ title: activity.title, category: activity.category, date: activity.date, done: activity.done })),
    },
    monitoring: {
      total: account.monitoring.length,
      last30Days: monitoring30.length,
      withOccurrence: monitoringWithOccurrence,
    },
    dataQuality: { score: dataQualityScore, missingProperty: missingPropertyFields, missingNfc, missingWeight, issues },
    priorities: priorities.slice(0, 5),
    nfcReadCount: account.nfcReadCount,
  };
}

function localAnswer(question: string, context: AssistantContext) {
  const normalized = question.toLocaleLowerCase("pt-BR");
  const lines: string[] = [];

  if (/doen|doente|rem[eé]dio|medic|vacina|tratamento|dose|ração|racao|alimenta[cç][aã]o.*quant|quanto.*comer/.test(normalized)) {
    return "Posso organizar os registros e mostrar quais animais precisam de acompanhamento, mas não faço diagnóstico nem indico medicamentos, doses ou quantidades de alimentação. Para decisões de saúde ou nutrição, confirme com um profissional responsável.";
  }

  if (/água|agua|consumo.*agua|fonte.*agua/.test(normalized)) {
    return "A gestão de água não faz parte da versão atual do Hydra Agro. Posso ajudar com rebanho, NFC, tarefas, setores, equipe e monitoramentos.";
  }

  if (/falta cadastrar|dados incomplet|qualidade|cadastro/.test(normalized)) {
    if (context.dataQuality.issues.length) lines.push(`Vale revisar: ${context.dataQuality.issues.slice(0, 3).join("; ")}.`);
    else lines.push("Os principais dados da propriedade estão preenchidos.");
  } else if (/resum|visão geral|visao geral|propriedade/.test(normalized)) {
    lines.push(`${context.property.name || "A propriedade"} tem ${countLabel(context.herd.total, "animal", "animais")}, ${context.herd.nfcCoverage}% do rebanho com NFC/RFID e ${countLabel(context.activities.pending, "tarefa pendente", "tarefas pendentes")}.`);
    lines.push(`Nos últimos 30 dias foram feitos ${countLabel(context.monitoring.last30Days, "monitoramento", "monitoramentos")}.`);
    if (context.priorities.length) lines.push(`Para conferir agora: ${context.priorities.slice(0, 3).join("; ")}.`);
  } else if (/rebanho|animal|gado|peso|nfc|brinco/.test(normalized)) {
    lines.push(`O rebanho tem ${countLabel(context.herd.total, "animal", "animais")}; ${countLabel(context.herd.identified, "está identificado", "estão identificados")} por NFC/RFID.`);
    if (context.herd.withoutWeight > 0) lines.push(`${countLabel(context.herd.withoutWeight, "animal está", "animais estão")} sem peso registrado.`);
    if (context.herd.attention > 0) lines.push(`${countLabel(context.herd.attention, "animal está", "animais estão")} em observação.`);
    if (context.herd.total > context.herd.identified) lines.push(`Falta identificar ${countLabel(context.herd.total - context.herd.identified, "animal", "animais")} por NFC/RFID.`);
  } else if (/atividade|tarefa|pendente|atrasad|hoje|prioridade|aten[cç][aã]o/.test(normalized)) {
    lines.push(`Há ${countLabel(context.activities.pending, "tarefa pendente", "tarefas pendentes")}; ${countLabel(context.activities.overdue, "está atrasada", "estão atrasadas")}.`);
    if (context.activities.next.length > 0) lines.push(`A próxima tarefa é “${context.activities.next[0].title}”.`);
    if (context.priorities.length) lines.push(`Também vale conferir: ${context.priorities.slice(0, 3).join("; ")}.`);
  } else if (/monitor|ocorr[eê]ncia|setor/.test(normalized)) {
    lines.push(`O histórico tem ${countLabel(context.monitoring.total, "monitoramento", "monitoramentos")}; ${countLabel(context.monitoring.last30Days, "foi feito", "foram feitos")} nos últimos 30 dias.`);
    if (context.monitoring.withOccurrence > 0) lines.push(`${countLabel(context.monitoring.withOccurrence, "registro tem", "registros têm")} ocorrência anotada.`);
  } else {
    lines.push(`${context.property.name || "A propriedade"} tem ${countLabel(context.herd.total, "animal", "animais")} e ${countLabel(context.activities.pending, "tarefa pendente", "tarefas pendentes")}.`);
    if (context.priorities.length) lines.push(`O primeiro ponto para conferir é: ${context.priorities[0]}.`);
    else lines.push("Não há nenhuma pendência importante nos registros atuais.");
  }
  return lines.join(" ");
}

export function HydraAssistantScreen({ account, onBack }: Props) {
  const context = useMemo(() => contextFromAccount(account), [account]);
  const storageKey = `hydra.assistant.chat.${account.id}`;
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) as AssistantMessage[] : [];
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(-24);
    } catch { /* armazenamento indisponível */ }
    return [{ id: "welcome", role: "assistant", text: `Posso consultar os registros de ${account.property.name || "sua propriedade"} e ajudar a encontrar o que precisa de atenção.`, mode: "local" }];
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-24))); } catch { /* armazenamento indisponível */ }
  }, [messages, storageKey]);

  function clearConversation() {
    const welcome: AssistantMessage = { id: `welcome-${Date.now()}`, role: "assistant", text: "Conversa limpa. Pode mandar uma nova pergunta.", mode: "action" };
    setMessages([welcome]);
    showAppToast("Conversa limpa");
  }

  async function copyLastAnswer() {
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.text);
      showAppToast("Resposta copiada");
    } catch {
      showAppToast("Não foi possível copiar a resposta.", "error");
    }
  }

  function runActionCommand(text: string) {
    const normalized = text.toLocaleLowerCase("pt-BR");
    if (/gerar.*relat|baixar.*relat|relat[oó]rio.*pdf|gerar.*pdf/.test(normalized)) {
      downloadPropertyReportPdf(account);
      setMessages((current) => [...current, { id: `action-${Date.now()}`, role: "assistant", text: "Relatório da propriedade gerado.", mode: "action" }]);
      return true;
    }
    if (/limpar.*conversa|apagar.*conversa/.test(normalized)) {
      clearConversation();
      return true;
    }
    return false;
  }

  async function ask(value: string) {
    const text = value.trim().slice(0, 600);
    if (!text || busy) return;
    setQuestion("");
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text }]);
    if (runActionCommand(text)) return;

    setBusy(true);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const canUseHostedApi = window.location.protocol === "https:" || window.location.hostname === "localhost";
      if (token && canUseHostedApi) {
        const response = await fetch("/api/hydra-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question: text, context }),
        });
        if (response.ok) {
          const data = await response.json() as { answer?: string };
          if (data.answer?.trim()) {
            setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: data.answer!.trim(), mode: "ai" }]);
            return;
          }
        }
      }
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: localAnswer(text, context), mode: "local" }]);
    } catch {
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: localAnswer(text, context), mode: "local" }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const qualityTone = context.dataQuality.score >= 80 ? "good" : context.dataQuality.score >= 55 ? "medium" : "attention";

  return (
    <div className="screen page-enter assistant-screen assistant-v2">
      <ScreenHeader eyebrow="ASSISTENTE" title="Hydra" subtitle="Consulte os registros da propriedade e encontre pendências." onBack={onBack} />

      <section className="assistant-hero assistant-v2-hero">
        <div className="assistant-v2-hero-top">
          <span className="assistant-v2-orb"><Sparkles size={23} /></span>
          <div className="assistant-hero-copy">
            <span className="assistant-hero-kicker">RESUMO DA PROPRIEDADE</span>
            <h2>{account.property.name || "Sua propriedade"}</h2>
            <p>{context.priorities.length ? countLabel(context.priorities.length, "item para conferir", "itens para conferir") : "Tudo certo nos registros atuais."}</p>
          </div>
          <span className={`assistant-quality-score ${qualityTone}`}><strong>{context.dataQuality.score}</strong><small>cadastro</small></span>
        </div>

        <div className="assistant-hero-metrics">
          <div><Cow size={17} /><span><strong>{context.herd.total}</strong><small>animais</small></span></div>
          <div><Nfc size={17} /><span><strong>{context.herd.nfcCoverage}%</strong><small>com NFC</small></span></div>
          <div><ClipboardCheck size={17} /><span><strong>{context.activities.overdue}</strong><small>atrasadas</small></span></div>
          <div><RadioTower size={17} /><span><strong>{context.monitoring.withOccurrence}</strong><small>ocorrências</small></span></div>
        </div>
      </section>

      <section className="assistant-insight-grid">
        <button className="assistant-insight-card priority" onClick={() => void ask("O que precisa de atenção hoje?")}>
          <span><TriangleAlert size={18} /></span>
          <div><small>PENDÊNCIAS</small><strong>{context.priorities.length || 0}</strong><p>{context.priorities[0] || "Nada urgente"}</p></div>
          <ChevronRight size={17} />
        </button>
        <button className="assistant-insight-card" onClick={() => void ask("O que falta cadastrar?")}>
          <span><Database size={18} /></span>
          <div><small>CADASTRO</small><strong>{context.dataQuality.score}%</strong><p>{context.dataQuality.issues[0] || "Principais campos preenchidos"}</p></div>
          <ChevronRight size={17} />
        </button>
        <button className="assistant-insight-card" onClick={() => void ask("Há ocorrências nos monitoramentos?")}>
          <span><RadioTower size={18} /></span>
          <div><small>MONITORAMENTOS</small><strong>{context.monitoring.withOccurrence}</strong><p>{context.monitoring.withOccurrence ? "Ocorrências registradas" : "Nenhuma ocorrência anotada"}</p></div>
          <ChevronRight size={17} />
        </button>
      </section>

      <section className="assistant-section-block">
        <div className="assistant-section-title"><div><span>ATALHOS</span><strong>Perguntas frequentes</strong></div><button className="assistant-report-shortcut" onClick={() => downloadPropertyReportPdf(account)}><FileDown size={15} /> PDF</button></div>
        <div className="assistant-quick-grid assistant-v2-quick-grid">
          {quickQuestions.map(({ label, detail, icon: Icon }) => (
            <button key={label} onClick={() => void ask(label)} disabled={busy}>
              <span className="assistant-quick-icon"><Icon size={17} /></span>
              <span className="assistant-quick-copy"><strong>{label}</strong><small>{detail}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <section className="assistant-conversation assistant-v2-conversation">
        <header className="assistant-conversation-head">
          <div><span className="assistant-online-dot" /><span><strong>Conversa</strong><small>Usa os registros disponíveis na conta</small></span></div>
          <div className="assistant-chat-tools">
            <button onClick={() => void copyLastAnswer()} aria-label="Copiar última resposta"><Copy size={15} /></button>
            <button onClick={clearConversation} aria-label="Limpar conversa"><Trash2 size={15} /></button>
          </div>
        </header>

        <div className="assistant-chat" aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={`assistant-message ${message.role}`}>
              {message.role === "assistant" && <span className="assistant-avatar"><Bot size={17} /></span>}
              <div className="assistant-bubble">
                <p>{message.text}</p>
                {message.role === "assistant" && <small>{message.mode === "ai" ? "Hydra · online" : message.mode === "action" ? "Ação concluída" : "Hydra · local"}</small>}
              </div>
            </article>
          ))}
          {busy && <article className="assistant-message assistant"><span className="assistant-avatar is-thinking"><LoaderCircle size={17} className="spin" /></span><div className="assistant-bubble assistant-thinking"><span /><span /><span /></div></article>}
          <div ref={chatEndRef} />
        </div>

        <form className="assistant-composer" onSubmit={submit}>
          <div className="assistant-composer-field"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunte sobre rebanho, NFC, tarefas, setores ou monitoramentos…" maxLength={600} rows={2} /><small>{question.length}/600</small></div>
          <button type="submit" disabled={busy || !question.trim()} aria-label="Enviar pergunta"><Send size={19} /></button>
        </form>
      </section>

      <div className="assistant-data-strip"><span><Nfc size={15} /> {context.herd.identified}/{context.herd.total} com NFC</span><span><CheckCircle2 size={15} /> {context.activities.completionRate}% concluídas</span><span><RadioTower size={15} /> {context.monitoring.withOccurrence} ocorrências</span></div>
      <div className="assistant-boundaries"><ShieldCheck size={18} /><p><strong>Limites do assistente</strong><small>O Hydra ajuda a consultar e organizar registros. Não faz diagnóstico e não indica medicamentos, doses ou tratamento.</small></p></div>
    </div>
  );
}
