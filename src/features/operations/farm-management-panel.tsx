import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Beef,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Milk,
  Plus,
  ReceiptText,
  Sparkles,
  Sprout,
  Syringe,
  Trash2,
  WalletCards,
  Wheat,
} from "lucide-react";
import { showAppToast } from "../../components/modal-system";
import { Modal } from "../../components/ui";
import { makeId, type HydraAccount, type UpdateAccount } from "../../lib/hydra-types";
import type { StaffMember } from "../../services/staff-service";
import "./farm-management-panel.css";

type Props = {
  account: HydraAccount;
  updateAccount: UpdateAccount;
  staff: StaffMember[];
};

type View = "hub" | "vaccines" | "feeding" | "expenses" | "fixed" | "production" | "milk";
type FormKind = Exclude<View, "hub"> | null;

const PREFIX = {
  vaccine: "HYDRA_VACCINE",
  feeding: "HYDRA_FEED_PLAN",
  expense: "HYDRA_EXPENSE",
  fixed: "HYDRA_FIXED_COST",
  production: "HYDRA_PRODUCTION",
  milk: "HYDRA_MILK",
} as const;

const today = () => new Date().toISOString().slice(0, 10);
const tagged = (prefix: string, text?: string) => text?.startsWith(`${prefix}|`) ?? false;
const encode = (prefix: string, parts: Record<string, string>) => `${prefix}|${Object.entries(parts).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("|")}`;
const decode = (value?: string) => Object.fromEntries((value || "").split("|").slice(1).map((part) => {
  const at = part.indexOf("=");
  return at < 0 ? [part, ""] : [part.slice(0, at), decodeURIComponent(part.slice(at + 1))];
}));
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: FormDataEntryValue | null) => Number(String(value || "0").replace(",", "."));
const monthKey = (value: string) => value.slice(0, 7);

function responsibleName(account: HydraAccount, form: FormData) {
  return account.access.kind === "staff"
    ? account.profile.name
    : String(form.get("responsible") || account.profile.name).trim() || account.profile.name;
}

function ManagementCard({ icon, title, text, value, onClick }: { icon: ReactNode; title: string; text: string; value: string; onClick: () => void }) {
  return <button className="farm-management-card" onClick={onClick}><span className="farm-management-icon">{icon}</span><div><strong>{title}</strong><small>{text}</small></div><b>{value}</b><ChevronRight size={18} /></button>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="farm-management-empty"><Sprout size={22} /><span>{children}</span></div>;
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map((cell) => escape(String(cell))).join(";")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function FarmManagementPanel({ account, updateAccount, staff }: Props) {
  const [view, setView] = useState<View>("hub");
  const [formOpen, setFormOpen] = useState<FormKind>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const canManage = account.access.kind === "owner" || account.access.staffRole === "manager";
  const activeStaff = staff.filter((member) => member.active);
  const currentMonth = monthKey(today());

  const vaccines = useMemo(() => account.activities.filter((item) => tagged(PREFIX.vaccine, item.note)), [account.activities]);
  const feedingPlans = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.feeding, item.note)), [account.monitoring]);
  const expenses = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.expense, item.note)), [account.monitoring]);
  const fixedCosts = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.fixed, item.note)), [account.monitoring]);
  const production = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.production, item.note)), [account.monitoring]);
  const milkRecords = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.milk, item.note)), [account.monitoring]);

  const monthExpenses = expenses.filter((item) => monthKey(item.date) === currentMonth).reduce((sum, item) => sum + Number(decode(item.note).amount || 0), 0);
  const monthlyFixed = fixedCosts.reduce((sum, item) => sum + Number(decode(item.note).amount || 0), 0);
  const monthMilk = milkRecords.filter((item) => monthKey(item.date) === currentMonth).reduce((sum, item) => sum + Number(decode(item.note).liters || 0), 0);
  const pendingVaccines = vaccines.filter((item) => !item.done).length;

  async function addVaccine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const animalId = String(form.get("animalId") || "");
    const vaccine = String(form.get("vaccine") || "").trim();
    const date = String(form.get("date") || today());
    if (!animalId || !vaccine) return;
    const responsible = responsibleName(account, form);
    await updateAccount((current) => ({
      ...current,
      activities: [{
        id: makeId("vaccine"),
        title: vaccine,
        category: "Vacinação",
        date,
        animalId,
        note: encode(PREFIX.vaccine, {
          animalId,
          vaccine,
          dose: String(form.get("dose") || "").trim(),
          responsible,
        }),
        done: false,
      }, ...current.activities],
    }), { requireRemote: true });
    setFormOpen(null);
    showAppToast("Vacina adicionada ao calendário");
  }

  async function toggleVaccine(id: string) {
    await updateAccount((current) => ({
      ...current,
      activities: current.activities.map((item) => item.id === id ? { ...item, done: !item.done } : item),
    }), { requireRemote: true });
  }

  async function addFeeding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const responsible = responsibleName(account, form);
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("feed"), date: today(), type: "Plano de alimentação",
        note: encode(PREFIX.feeding, {
          title,
          group: String(form.get("group") || "Rebanho geral"),
          food: String(form.get("food") || "").trim(),
          quantity: String(form.get("quantity") || "").trim(),
          frequency: String(form.get("frequency") || "Diariamente"),
          responsible,
          notes: String(form.get("notes") || "").trim(),
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    setFormOpen(null);
    showAppToast("Plano de alimentação salvo");
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = number(form.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) { showAppToast("Informe um valor de gasto válido.", "error"); return; }
    const responsible = responsibleName(account, form);
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("expense"), date: String(form.get("date") || today()), type: "Gasto da propriedade",
        note: encode(PREFIX.expense, {
          category: String(form.get("category") || "Outros"),
          description: String(form.get("description") || "").trim(),
          amount: amount.toFixed(2),
          payment: String(form.get("payment") || "Outro"),
          responsible,
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    setFormOpen(null);
    showAppToast("Gasto adicionado à planilha");
  }

  async function addFixedCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const form = new FormData(event.currentTarget);
    const amount = number(form.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) { showAppToast("Informe um custo mensal válido.", "error"); return; }
    const responsible = responsibleName(account, form);
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("fixed"), date: today(), type: "Custo fixo",
        note: encode(PREFIX.fixed, {
          category: String(form.get("category") || "Outros"),
          description: String(form.get("description") || "").trim(),
          amount: amount.toFixed(2),
          dueDay: String(form.get("dueDay") || "1"),
          responsible,
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    setFormOpen(null);
    showAppToast("Custo fixo salvo");
  }

  async function addProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = number(form.get("quantity"));
    const product = String(form.get("product") || "").trim();
    if (!product || !Number.isFinite(quantity) || quantity <= 0) { showAppToast("Informe produto e quantidade válidos.", "error"); return; }
    const responsible = responsibleName(account, form);
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("production"), date: String(form.get("date") || today()), type: "Produção",
        note: encode(PREFIX.production, {
          product,
          quantity: String(quantity),
          unit: String(form.get("unit") || "kg"),
          destination: String(form.get("destination") || "Uso próprio"),
          responsible,
          notes: String(form.get("notes") || "").trim(),
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    setFormOpen(null);
    showAppToast("Produção registrada");
  }

  async function addMilk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const liters = number(form.get("liters"));
    const cows = Math.max(0, Math.round(number(form.get("cows"))));
    const price = Math.max(0, number(form.get("price")) || 0);
    if (!Number.isFinite(liters) || liters <= 0) { showAppToast("Informe a quantidade de leite produzida.", "error"); return; }
    const responsible = responsibleName(account, form);
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("milk"), date: String(form.get("date") || today()), type: "Produção de leite",
        note: encode(PREFIX.milk, {
          liters: liters.toFixed(2),
          cows: String(cows),
          shift: String(form.get("shift") || "Total do dia"),
          destination: String(form.get("destination") || "Venda"),
          price: price.toFixed(2),
          responsible,
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    setFormOpen(null);
    showAppToast("Produção de leite registrada");
  }

  async function removeMonitoring(id: string) {
    if (!canManage) return;
    await updateAccount((current) => ({ ...current, monitoring: current.monitoring.filter((item) => item.id !== id) }), { requireRemote: true });
    showAppToast("Registro removido");
  }

  async function removeVaccine(id: string) {
    if (!canManage) return;
    await updateAccount((current) => ({ ...current, activities: current.activities.filter((item) => item.id !== id) }), { requireRemote: true });
    showAppToast("Vacina removida do calendário");
  }

  const responsibleField = account.access.kind === "staff"
    ? <label>Responsável<input value={account.profile.name} readOnly /></label>
    : <label>Responsável<select name="responsible"><option>{account.profile.name}</option>{activeStaff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>;

  const monthDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthDate);
  const firstWeekday = monthDate.getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const calendarPrefix = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-`;

  const productionGroups = Array.from(production.reduce((map, item) => {
    const meta = decode(item.note); const key = `${meta.product}|${meta.unit}`;
    map.set(key, (map.get(key) || 0) + Number(meta.quantity || 0)); return map;
  }, new Map<string, number>()).entries());

  const milkMonthRecords = milkRecords.filter((item) => monthKey(item.date) === currentMonth);
  const milkRevenue = milkMonthRecords.reduce((sum, item) => { const meta = decode(item.note); return sum + Number(meta.liters || 0) * Number(meta.price || 0); }, 0);
  const milkCows = milkMonthRecords.reduce((max, item) => Math.max(max, Number(decode(item.note).cows || 0)), 0);
  const litersPerCow = milkCows > 0 ? monthMilk / milkCows : 0;

  if (view === "hub") return <div className="farm-management-hub">
    <section className="farm-management-hero"><div><span className="eyebrow">GESTÃO INTEGRADA</span><h2>Produção e custos</h2><p>Vacinas, alimentação, despesas e produção conectadas à equipe da propriedade.</p></div><span><Sparkles size={24} /></span></section>
    <div className="farm-management-grid">
      <ManagementCard icon={<Syringe size={22} />} title="Calendário de vacinas" text="Agendamentos por animal e responsável" value={`${pendingVaccines} pendentes`} onClick={() => setView("vaccines")} />
      <ManagementCard icon={<Wheat size={22} />} title="Plano de alimentação" text="Rotina, quantidade e responsável" value={`${feedingPlans.length} planos`} onClick={() => setView("feeding")} />
      <ManagementCard icon={<WalletCards size={22} />} title="Planilha de gastos" text="Despesas variáveis do mês" value={currency(monthExpenses)} onClick={() => setView("expenses")} />
      <ManagementCard icon={<ReceiptText size={22} />} title="Custos fixos" text="Compromissos mensais da propriedade" value={currency(monthlyFixed)} onClick={() => setView("fixed")} />
      <ManagementCard icon={<Sprout size={22} />} title="Ajuda na produção" text="Registros e visão operacional" value={`${production.length} registros`} onClick={() => setView("production")} />
      <ManagementCard icon={<Milk size={22} />} title="Produtores de leite" text="Litros, vacas, turno e receita" value={`${monthMilk.toLocaleString("pt-BR")} L`} onClick={() => setView("milk")} />
    </div>
    <div className="farm-management-team-note"><Beef size={19} /><div><strong>Ligado à equipe</strong><small>Cada registro pode ficar associado ao produtor, gerente ou funcionário responsável.</small></div></div>
  </div>;

  return <div className="farm-management-view">
    <header className="farm-management-view-header"><button className="icon-button" onClick={() => setView("hub")}><ArrowLeft size={20} /></button><div><span className="eyebrow">PRODUÇÃO E CUSTOS</span><h2>{view === "vaccines" ? "Calendário de vacinas" : view === "feeding" ? "Plano de alimentação" : view === "expenses" ? "Planilha de gastos" : view === "fixed" ? "Custos fixos" : view === "production" ? "Ajuda na produção" : "Produtores de leite"}</h2></div><button className="primary-button compact" onClick={() => setFormOpen(view)} disabled={view === "fixed" && !canManage}><Plus size={17} /> Adicionar</button></header>

    {view === "vaccines" && <>
      <section className="vaccine-calendar"><div className="vaccine-calendar-toolbar"><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><strong>{monthLabel}</strong><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div><div className="vaccine-weekdays">{["D","S","T","Q","Q","S","S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="vaccine-days">{calendarCells.map((day, index) => { if (!day) return <span className="is-empty" key={`empty-${index}`} />; const key = `${calendarPrefix}${String(day).padStart(2, "0")}`; const items = vaccines.filter((item) => item.date === key); return <div key={key} className={`${items.length ? "has-vaccine" : ""} ${key === today() ? "is-today" : ""}`}><b>{day}</b>{items.slice(0, 2).map((item) => <small key={item.id} className={item.done ? "done" : ""}>{item.title}</small>)}{items.length > 2 && <em>+{items.length - 2}</em>}</div>; })}</div></section>
      <section className="farm-management-list">{vaccines.length ? vaccines.sort((a,b) => a.date.localeCompare(b.date)).map((item) => { const meta = decode(item.note); const animal = account.animals.find((a) => a.id === meta.animalId); return <article key={item.id} className={item.done ? "is-done" : ""}><button className="record-check" onClick={() => void toggleVaccine(item.id)}>{item.done ? <CheckCircle2 size={19} /> : <span />}</button><div><strong>{item.title}</strong><small>{item.date} · {animal?.name || animal?.identification || "Animal"}{meta.dose ? ` · ${meta.dose}` : ""}</small><em>{meta.responsible}</em></div>{canManage && <button className="record-delete" onClick={() => void removeVaccine(item.id)} aria-label="Excluir vacina"><Trash2 size={16} /></button>}</article>; }) : <Empty>Nenhuma vacina agendada.</Empty>}</section>
    </>}

    {view === "feeding" && <section className="farm-management-list">{feedingPlans.length ? feedingPlans.map((item) => { const meta = decode(item.note); return <article key={item.id}><span className="record-icon"><Wheat size={20} /></span><div><strong>{meta.title}</strong><small>{meta.group} · {meta.food || "Alimento não informado"}</small><em>{meta.quantity || "Quantidade livre"} · {meta.frequency} · {meta.responsible}</em>{meta.notes && <p>{meta.notes}</p>}</div>{canManage && <button className="record-delete" onClick={() => void removeMonitoring(item.id)}><Trash2 size={16} /></button>}</article>; }) : <Empty>Nenhum plano de alimentação cadastrado.</Empty>}</section>}

    {view === "expenses" && <><section className="sheet-summary"><div><span>Gastos neste mês</span><strong>{currency(monthExpenses)}</strong></div><button onClick={() => exportCsv("hydra-agro-gastos.csv", ["Data","Categoria","Descrição","Valor","Pagamento","Responsável"], expenses.map((item) => { const meta = decode(item.note); return [item.date, meta.category, meta.description, meta.amount, meta.payment, meta.responsible]; }))}><Download size={17} /> CSV</button></section><div className="management-sheet"><div className="management-sheet-head"><span>Data</span><span>Categoria</span><span>Descrição</span><span>Valor</span><span>Responsável</span><span /></div>{expenses.length ? expenses.map((item) => { const meta = decode(item.note); return <div className="management-sheet-row" key={item.id}><span data-label="Data">{item.date}</span><span data-label="Categoria">{meta.category}</span><span data-label="Descrição">{meta.description || "—"}</span><strong data-label="Valor">{currency(Number(meta.amount || 0))}</strong><span data-label="Responsável">{meta.responsible}</span>{canManage ? <button onClick={() => void removeMonitoring(item.id)}><Trash2 size={15} /></button> : <span />}</div>; }) : <Empty>Nenhum gasto registrado.</Empty>}</div></>}

    {view === "fixed" && <><section className="sheet-summary"><div><span>Total fixo mensal</span><strong>{currency(monthlyFixed)}</strong></div><button onClick={() => exportCsv("hydra-agro-custos-fixos.csv", ["Categoria","Descrição","Valor mensal","Dia do vencimento","Responsável"], fixedCosts.map((item) => { const meta = decode(item.note); return [meta.category, meta.description, meta.amount, meta.dueDay, meta.responsible]; }))}><Download size={17} /> CSV</button></section><div className="management-sheet"><div className="management-sheet-head"><span>Categoria</span><span>Descrição</span><span>Valor/mês</span><span>Vence dia</span><span>Responsável</span><span /></div>{fixedCosts.length ? fixedCosts.map((item) => { const meta = decode(item.note); return <div className="management-sheet-row" key={item.id}><span data-label="Categoria">{meta.category}</span><span data-label="Descrição">{meta.description || "—"}</span><strong data-label="Valor/mês">{currency(Number(meta.amount || 0))}</strong><span data-label="Vence dia">{meta.dueDay}</span><span data-label="Responsável">{meta.responsible}</span>{canManage ? <button onClick={() => void removeMonitoring(item.id)}><Trash2 size={15} /></button> : <span />}</div>; }) : <Empty>Nenhum custo fixo cadastrado.</Empty>}</div></>}

    {view === "production" && <><section className="production-insights"><div><Sparkles size={20} /><span><strong>Visão da produção</strong><small>{production.length === 0 ? "Comece registrando o que a propriedade produz." : `${production.length} registros ajudam a comparar volume, destino e responsáveis.`}</small></span></div>{monthExpenses + monthlyFixed > 0 && production.length === 0 && <p>Você já possui custos registrados. Adicionar a produção ajuda a enxergar melhor a relação entre gasto e resultado.</p>}{feedingPlans.length === 0 && account.animals.length > 0 && <p>Há animais cadastrados, mas nenhum plano de alimentação salvo. Você pode criar um plano nesta mesma área.</p>}</section><div className="production-totals">{productionGroups.length ? productionGroups.map(([key, total]) => { const [product, unit] = key.split("|"); return <div key={key}><Sprout size={19} /><span><strong>{total.toLocaleString("pt-BR")} {unit}</strong><small>{product}</small></span></div>; }) : <Empty>Nenhuma produção registrada ainda.</Empty>}</div><section className="farm-management-list">{production.map((item) => { const meta = decode(item.note); return <article key={item.id}><span className="record-icon"><Sprout size={20} /></span><div><strong>{meta.product} · {Number(meta.quantity || 0).toLocaleString("pt-BR")} {meta.unit}</strong><small>{item.date} · {meta.destination}</small><em>{meta.responsible}</em>{meta.notes && <p>{meta.notes}</p>}</div>{canManage && <button className="record-delete" onClick={() => void removeMonitoring(item.id)}><Trash2 size={16} /></button>}</article>; })}</section></>}

    {view === "milk" && <><section className="milk-dashboard"><div><Milk size={22} /><span><small>Produção no mês</small><strong>{monthMilk.toLocaleString("pt-BR")} L</strong></span></div><div><Beef size={22} /><span><small>Vacas informadas</small><strong>{milkCows || "—"}</strong></span></div><div><CircleDollarSign size={22} /><span><small>Receita estimada</small><strong>{currency(milkRevenue)}</strong></span></div><div><Sparkles size={22} /><span><small>Média por vaca*</small><strong>{litersPerCow ? `${litersPerCow.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L` : "—"}</strong></span></div></section><p className="milk-note">*A média usa os registros informados no mês e serve apenas para acompanhamento da propriedade.</p><section className="farm-management-list">{milkRecords.length ? milkRecords.map((item) => { const meta = decode(item.note); return <article key={item.id}><span className="record-icon"><Milk size={20} /></span><div><strong>{Number(meta.liters || 0).toLocaleString("pt-BR")} L · {meta.shift}</strong><small>{item.date} · {meta.cows || "0"} vacas · {meta.destination}</small><em>{meta.responsible}{Number(meta.price || 0) > 0 ? ` · ${currency(Number(meta.price))}/L` : ""}</em></div>{canManage && <button className="record-delete" onClick={() => void removeMonitoring(item.id)}><Trash2 size={16} /></button>}</article>; }) : <Empty>Nenhuma produção de leite registrada.</Empty>}</section></>}

    <Modal open={formOpen === "vaccines"} onClose={() => setFormOpen(null)} title="Agendar vacina"><form className="operations-form" onSubmit={addVaccine}><label>Animal<select name="animalId" required><option value="">Selecione</option>{account.animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name || animal.identification} · {animal.identification}</option>)}</select></label><label>Vacina<input name="vaccine" required placeholder="Nome da vacina" /></label><label>Data<input type="date" name="date" defaultValue={today()} required /></label><label>Dose / observação<input name="dose" placeholder="Ex.: reforço, 2ª dose" /></label>{responsibleField}<button className="primary-button" type="submit">Adicionar ao calendário</button></form></Modal>

    <Modal open={formOpen === "feeding"} onClose={() => setFormOpen(null)} title="Novo plano de alimentação"><form className="operations-form" onSubmit={addFeeding}><label>Nome do plano<input name="title" required placeholder="Ex.: Lote de engorda" /></label><label>Grupo / lote<input name="group" placeholder="Ex.: Bezerros, lote 2" /></label><label>Alimento principal<input name="food" placeholder="Ex.: pasto, silagem, ração" /></label><label>Quantidade por fornecimento<input name="quantity" placeholder="Ex.: 3 kg por animal" /></label><label>Frequência<select name="frequency"><option>Diariamente</option><option>2 vezes ao dia</option><option>3 vezes ao dia</option><option>Semanalmente</option><option>Conforme manejo</option></select></label>{responsibleField}<label>Observações<textarea name="notes" placeholder="Horários, lote, armazenamento ou lembretes" /></label><button className="primary-button" type="submit">Salvar plano</button></form></Modal>

    <Modal open={formOpen === "expenses"} onClose={() => setFormOpen(null)} title="Adicionar gasto"><form className="operations-form" onSubmit={addExpense}><label>Data<input type="date" name="date" defaultValue={today()} /></label><label>Categoria<select name="category"><option>Alimentação</option><option>Saúde animal</option><option>Combustível</option><option>Manutenção</option><option>Mão de obra</option><option>Água e energia</option><option>Transporte</option><option>Insumos</option><option>Outros</option></select></label><label>Descrição<input name="description" required placeholder="O que foi comprado ou pago?" /></label><label>Valor (R$)<input name="amount" inputMode="decimal" required placeholder="0,00" /></label><label>Pagamento<select name="payment"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Boleto</option><option>Outro</option></select></label>{responsibleField}<button className="primary-button" type="submit">Adicionar gasto</button></form></Modal>

    <Modal open={formOpen === "fixed" && canManage} onClose={() => setFormOpen(null)} title="Novo custo fixo"><form className="operations-form" onSubmit={addFixedCost}><label>Categoria<select name="category"><option>Energia</option><option>Internet</option><option>Salários</option><option>Aluguel</option><option>Financiamento</option><option>Contabilidade</option><option>Manutenção contratada</option><option>Outros</option></select></label><label>Descrição<input name="description" required /></label><label>Valor mensal (R$)<input name="amount" inputMode="decimal" required placeholder="0,00" /></label><label>Dia do vencimento<input name="dueDay" type="number" min="1" max="31" defaultValue="10" /></label>{responsibleField}<button className="primary-button" type="submit">Salvar custo fixo</button></form></Modal>

    <Modal open={formOpen === "production"} onClose={() => setFormOpen(null)} title="Registrar produção"><form className="operations-form" onSubmit={addProduction}><label>Data<input type="date" name="date" defaultValue={today()} /></label><label>Produto<input name="product" required placeholder="Ex.: milho, café, ovos, mel" /></label><label>Quantidade<input name="quantity" inputMode="decimal" required /></label><label>Unidade<select name="unit"><option>kg</option><option>t</option><option>sacas</option><option>unidades</option><option>caixas</option><option>litros</option></select></label><label>Destino<select name="destination"><option>Venda</option><option>Uso próprio</option><option>Armazenamento</option><option>Beneficiamento</option><option>Outro</option></select></label>{responsibleField}<label>Observações<textarea name="notes" placeholder="Lote, qualidade, comprador ou outro detalhe" /></label><button className="primary-button" type="submit">Registrar produção</button></form></Modal>

    <Modal open={formOpen === "milk"} onClose={() => setFormOpen(null)} title="Registrar produção de leite"><form className="operations-form" onSubmit={addMilk}><label>Data<input type="date" name="date" defaultValue={today()} /></label><label>Litros produzidos<input name="liters" inputMode="decimal" required placeholder="0,0" /></label><label>Vacas em produção<input name="cows" type="number" min="0" defaultValue="0" /></label><label>Turno<select name="shift"><option>Total do dia</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label><label>Destino<select name="destination"><option>Venda</option><option>Consumo</option><option>Queijo e derivados</option><option>Outro</option></select></label><label>Preço por litro (opcional)<input name="price" inputMode="decimal" placeholder="0,00" /></label>{responsibleField}<button className="primary-button" type="submit">Salvar produção de leite</button></form></Modal>
  </div>;
}
