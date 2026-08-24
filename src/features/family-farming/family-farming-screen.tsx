"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Coins,
  Droplets,
  HandCoins,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Sprout,
  Trash2,
  UsersRound,
} from "lucide-react";
import { ConfirmDialog, EmptyState, Field, LoadingButton, Modal, ScreenHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type FamilyWorkRecord, type HydraAccount, type ProductionExpense, type ProductionNotebook, type ProductionRecord, type SaleRecord } from "../../lib/hydra-types";
import {
  currentMonthTotals,
  deleteFamilyWorkRecord,
  deleteProductionExpense,
  deleteProductionRecord,
  deleteSaleRecord,
  loadProductionNotebook,
  productionStock,
  saveFamilyWorkRecord,
  saveProductionExpense,
  saveProductionRecord,
  saveSaleRecord,
} from "../../services/family-farming-repository";
import "./family-farming.css";

type Props = { account: HydraAccount; onBack: () => void };
type Tab = "summary" | "production" | "sales" | "expenses" | "work";
type DeleteTarget = { kind: "production" | "sale" | "expense" | "work"; id: string; label: string } | null;

const today = () => new Date().toISOString().slice(0, 10);
const units = ["kg", "saco", "caixa", "litro", "unidade", "dúzia", "arroba", "tonelada", "outro"];
const saleTypes = ["Feira", "Mercado", "Atravessador", "Cooperativa", "Venda direta", "Outro"];
const expenseCategories = ["Sementes", "Ração", "Adubo", "Ferramentas", "Combustível", "Medicamentos veterinários", "Manutenção", "Transporte", "Outros"];
const commonProducts = ["Mandioca", "Milho", "Feijão", "Hortaliças", "Frutas", "Café", "Leite", "Ovos", "Mel"];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function monthPrefix(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function blankProduction(): ProductionRecord {
  return { id: "", product: "", quantity: 0, unit: "kg", date: today() };
}
function blankSale(): SaleRecord {
  return { id: "", product: "", quantity: 0, unit: "kg", unitPrice: 0, saleType: "Venda direta", date: today() };
}
function blankExpense(): ProductionExpense {
  return { id: "", description: "", category: "Sementes", amount: 0, date: today() };
}
function blankWork(): FamilyWorkRecord {
  return { id: "", activityName: "", participants: [], date: today() };
}

export function FamilyFarmingScreen({ account, onBack }: Props) {
  const [notebook, setNotebook] = useState<ProductionNotebook>({ production: [], sales: [], expenses: [], familyWork: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(monthPrefix());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [productionForm, setProductionForm] = useState<ProductionRecord | null>(null);
  const [saleForm, setSaleForm] = useState<SaleRecord | null>(null);
  const [expenseForm, setExpenseForm] = useState<ProductionExpense | null>(null);
  const [workForm, setWorkForm] = useState<FamilyWorkRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const canEdit = account.access.kind === "owner" || account.access.staffRole === "manager";

  async function refresh() {
    setLoading(true);
    setLoadError("");
    try { setNotebook(await loadProductionNotebook(account)); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o caderno."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [account.id, account.access.ownerUserId, account.property.id]);

  const stock = useMemo(() => productionStock(notebook), [notebook]);
  const totals = useMemo(() => currentMonthTotals(notebook), [notebook]);
  const availableByProductUnit = useMemo(() => new Map(stock.map((item) => [`${item.product.toLocaleLowerCase("pt-BR")}::${item.unit}`, item.available])), [stock]);
  const monthProduction = notebook.production.filter((item) => item.date.startsWith(month));
  const monthSales = notebook.sales.filter((item) => item.date.startsWith(month));
  const monthExpenses = notebook.expenses.filter((item) => item.date.startsWith(month));
  const monthWork = notebook.familyWork.filter((item) => item.date.startsWith(month));
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

  const productSummary = useMemo(() => {
    const map = new Map<string, { product: string; produced: number; sold: number; revenue: number; units: Set<string> }>();
    for (const item of monthProduction) {
      const key = item.product.toLocaleLowerCase("pt-BR");
      const row = map.get(key) ?? { product: item.product, produced: 0, sold: 0, revenue: 0, units: new Set<string>() };
      row.produced += item.quantity; row.units.add(item.unit); map.set(key, row);
    }
    for (const item of monthSales) {
      const key = item.product.toLocaleLowerCase("pt-BR");
      const row = map.get(key) ?? { product: item.product, produced: 0, sold: 0, revenue: 0, units: new Set<string>() };
      row.sold += item.quantity; row.revenue += item.quantity * item.unitPrice; row.units.add(item.unit); map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.produced - a.produced);
  }, [monthProduction, monthSales]);

  function productWaterEfficiency(product: string, produced: number) {
    if (produced <= 0) return null;
    const key = product.toLocaleLowerCase("pt-BR");
    const water = account.waterRecords
      .filter((record) => record.date.startsWith(month) && `${record.purpose} ${record.note ?? ""}`.toLocaleLowerCase("pt-BR").includes(key))
      .reduce((total, record) => total + record.amount, 0);
    return water > 0 ? { water, perUnit: water / produced } : null;
  }

  async function submitProduction(event: FormEvent) {
    event.preventDefault();
    if (!productionForm || !canEdit) return;
    if (!productionForm.product.trim() || productionForm.quantity <= 0 || !productionForm.date) { setFormError("Informe produto, quantidade e data."); return; }
    const item = { ...productionForm, id: productionForm.id || makeId("production") };
    setBusy(true); setFormError("");
    try { await saveProductionRecord(account, item); await refresh(); setProductionForm(null); showAppToast("Produção registrada"); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function submitSale(event: FormEvent) {
    event.preventDefault();
    if (!saleForm || !canEdit) return;
    if (!saleForm.product.trim() || saleForm.quantity <= 0 || saleForm.unitPrice < 0 || !saleForm.date) { setFormError("Informe produto, quantidade, valor e data."); return; }
    const key = `${saleForm.product.trim().toLocaleLowerCase("pt-BR")}::${saleForm.unit}`;
    const existing = saleForm.id ? notebook.sales.find((item) => item.id === saleForm.id) : undefined;
    const available = (availableByProductUnit.get(key) ?? 0) + (existing && existing.product.trim().toLocaleLowerCase("pt-BR") === saleForm.product.trim().toLocaleLowerCase("pt-BR") && existing.unit === saleForm.unit ? existing.quantity : 0);
    if (saleForm.quantity > available) { setFormError(`Estoque insuficiente. Disponível: ${number(available)} ${saleForm.unit}.`); return; }
    const item = { ...saleForm, id: saleForm.id || makeId("sale") };
    setBusy(true); setFormError("");
    try { await saveSaleRecord(account, item); await refresh(); setSaleForm(null); showAppToast("Venda registrada"); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    if (!expenseForm || !canEdit) return;
    if (!expenseForm.description.trim() || expenseForm.amount < 0 || !expenseForm.date) { setFormError("Informe descrição, valor e data."); return; }
    const item = { ...expenseForm, id: expenseForm.id || makeId("expense") };
    setBusy(true); setFormError("");
    try { await saveProductionExpense(account, item); await refresh(); setExpenseForm(null); showAppToast("Gasto registrado"); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function submitWork(event: FormEvent) {
    event.preventDefault();
    if (!workForm || !canEdit) return;
    if (!workForm.activityName.trim() || workForm.participants.length === 0 || !workForm.date) { setFormError("Informe a atividade, pelo menos um participante e a data."); return; }
    const item = { ...workForm, id: workForm.id || makeId("family-work") };
    setBusy(true); setFormError("");
    try { await saveFamilyWorkRecord(account, item); await refresh(); setWorkForm(null); showAppToast("Mão de obra familiar registrada"); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget || !canEdit) return;
    setBusy(true); setFormError("");
    try {
      if (deleteTarget.kind === "production") await deleteProductionRecord(deleteTarget.id);
      if (deleteTarget.kind === "sale") await deleteSaleRecord(deleteTarget.id);
      if (deleteTarget.kind === "expense") await deleteProductionExpense(deleteTarget.id);
      if (deleteTarget.kind === "work") await deleteFamilyWorkRecord(deleteTarget.id);
      setDeleteTarget(null); await refresh(); showAppToast("Registro excluído");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  }

  return (
    <div className="screen page-enter extra-screen family-farming-screen">
      <ScreenHeader eyebrow="AGRICULTURA FAMILIAR" title="Caderno da Produção" subtitle="Produção, vendas, gastos e trabalho da família em um só lugar." onBack={onBack} />

      <div className="production-toolbar">
        <label className="production-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou registro" /></label>
        <input className="production-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Mês" />
      </div>

      <div className="production-tabs" role="tablist">
        <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}><BarChart3 size={17} />Resumo</button>
        <button className={tab === "production" ? "active" : ""} onClick={() => setTab("production")}><Sprout size={17} />Produção</button>
        <button className={tab === "sales" ? "active" : ""} onClick={() => setTab("sales")}><HandCoins size={17} />Vendas</button>
        <button className={tab === "expenses" ? "active" : ""} onClick={() => setTab("expenses")}><Coins size={17} />Gastos</button>
        <button className={tab === "work" ? "active" : ""} onClick={() => setTab("work")}><UsersRound size={17} />Família</button>
      </div>

      {loading ? <div className="production-loading"><LoaderCircle className="spin" size={25} /><span>Carregando registros…</span></div> : loadError ? <div className="production-error"><strong>Não foi possível carregar</strong><span>{loadError}</span><button className="secondary-button" onClick={() => void refresh()}>Tentar novamente</button></div> : (
        <>
          {tab === "summary" && <Summary account={account} notebook={notebook} stock={stock} productSummary={productSummary} totals={totals} monthExpenses={monthExpenses} monthWork={monthWork} waterEfficiency={productWaterEfficiency} onOpen={setTab} />}

          {tab === "production" && <RecordSection title="Produção" action={canEdit ? <button className="primary-button compact" onClick={() => { setFormError(""); setProductionForm(blankProduction()); }}><Plus size={17} /> Registrar</button> : undefined}>
            {monthProduction.filter((item) => !normalizedSearch || `${item.product} ${item.note ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).length === 0 ? <EmptyState icon={<Sprout size={25} />} title="Nenhuma produção neste período" text="Registre colheitas e outras produções reais da propriedade." /> : monthProduction.filter((item) => !normalizedSearch || `${item.product} ${item.note ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).map((item) => <MovementRow key={item.id} icon={<Sprout size={19} />} title={item.product} subtitle={`${number(item.quantity)} ${item.unit} · ${formatDate(item.date)}${sectorName(account, item.sectorId) ? ` · ${sectorName(account, item.sectorId)}` : ""}`} onEdit={canEdit ? () => { setFormError(""); setProductionForm({ ...item }); } : undefined} onDelete={canEdit ? () => setDeleteTarget({ kind: "production", id: item.id, label: item.product }) : undefined} />)}
          </RecordSection>}

          {tab === "sales" && <RecordSection title="Vendas" action={canEdit ? <button className="primary-button compact" onClick={() => { setFormError(""); setSaleForm(blankSale()); }}><Plus size={17} /> Registrar</button> : undefined}>
            {monthSales.filter((item) => !normalizedSearch || `${item.product} ${item.buyer ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).length === 0 ? <EmptyState icon={<HandCoins size={25} />} title="Nenhuma venda neste período" text="As vendas registradas aparecem aqui e reduzem o estoque automaticamente." /> : monthSales.filter((item) => !normalizedSearch || `${item.product} ${item.buyer ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).map((item) => <MovementRow key={item.id} icon={<HandCoins size={19} />} title={item.product} value={money(item.quantity * item.unitPrice)} subtitle={`${number(item.quantity)} ${item.unit} × ${money(item.unitPrice)} · ${item.saleType} · ${formatDate(item.date)}`} onEdit={canEdit ? () => { setFormError(""); setSaleForm({ ...item }); } : undefined} onDelete={canEdit ? () => setDeleteTarget({ kind: "sale", id: item.id, label: `Venda de ${item.product}` }) : undefined} />)}
          </RecordSection>}

          {tab === "expenses" && <RecordSection title="Gastos da produção" action={canEdit ? <button className="primary-button compact" onClick={() => { setFormError(""); setExpenseForm(blankExpense()); }}><Plus size={17} /> Registrar</button> : undefined}>
            {monthExpenses.filter((item) => !normalizedSearch || `${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).length === 0 ? <EmptyState icon={<Coins size={25} />} title="Nenhum gasto neste período" text="Registre apenas custos relacionados à produção da propriedade." /> : monthExpenses.filter((item) => !normalizedSearch || `${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).map((item) => <MovementRow key={item.id} icon={<Coins size={19} />} title={item.description} value={money(item.amount)} subtitle={`${item.category} · ${formatDate(item.date)}`} onEdit={canEdit ? () => { setFormError(""); setExpenseForm({ ...item }); } : undefined} onDelete={canEdit ? () => setDeleteTarget({ kind: "expense", id: item.id, label: item.description }) : undefined} />)}
          </RecordSection>}

          {tab === "work" && <RecordSection title="Mão de obra familiar" action={canEdit ? <button className="primary-button compact" onClick={() => { setFormError(""); setWorkForm(blankWork()); }}><Plus size={17} /> Registrar</button> : undefined}>
            {monthWork.filter((item) => !normalizedSearch || `${item.activityName} ${item.participants.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).length === 0 ? <EmptyState icon={<UsersRound size={25} />} title="Nenhum trabalho familiar registrado" text="Registre quem participou das atividades, sem transformar isso em folha de pagamento." /> : monthWork.filter((item) => !normalizedSearch || `${item.activityName} ${item.participants.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)).map((item) => <MovementRow key={item.id} icon={<UsersRound size={19} />} title={item.activityName} subtitle={`${item.participants.join(", ")}${item.durationHours ? ` · ${number(item.durationHours)} h` : ""} · ${formatDate(item.date)}`} onEdit={canEdit ? () => { setFormError(""); setWorkForm({ ...item }); } : undefined} onDelete={canEdit ? () => setDeleteTarget({ kind: "work", id: item.id, label: item.activityName }) : undefined} />)}
          </RecordSection>}
        </>
      )}

      <Modal open={Boolean(productionForm)} onClose={() => { if (!busy) setProductionForm(null); }} eyebrow="CADERNO" title={productionForm?.id ? "Editar produção" : "Registrar produção"} wide dismissible={!busy}>
        {productionForm && <form className="modal-form" onSubmit={submitProduction}>
          <ProductField value={productionForm.product} onChange={(product) => setProductionForm({ ...productionForm, product })} />
          <div className="field-combo"><Field label="Quantidade"><input type="number" min="0.01" step="0.01" value={productionForm.quantity || ""} onChange={(event) => setProductionForm({ ...productionForm, quantity: Number(event.target.value) })} /></Field><Field label="Unidade"><select value={productionForm.unit} onChange={(event) => setProductionForm({ ...productionForm, unit: event.target.value })}>{units.map((item) => <option key={item}>{item}</option>)}</select></Field></div>
          <div className="field-combo"><Field label="Data"><input type="date" value={productionForm.date} onChange={(event) => setProductionForm({ ...productionForm, date: event.target.value })} /></Field><Field label="Setor / local"><select value={productionForm.sectorId ?? ""} onChange={(event) => setProductionForm({ ...productionForm, sectorId: event.target.value || undefined })}><option value="">Sem setor</option>{account.sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></Field></div>
          <Field label="Animal relacionado (opcional)"><select value={productionForm.animalId ?? ""} onChange={(event) => setProductionForm({ ...productionForm, animalId: event.target.value || undefined })}><option value="">Nenhum</option>{account.animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name || animal.identification}</option>)}</select></Field>
          <Field label="Atividade relacionada (opcional)"><select value={productionForm.activityId ?? ""} onChange={(event) => setProductionForm({ ...productionForm, activityId: event.target.value || undefined })}><option value="">Nenhuma</option>{account.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></Field>
          <Field label="Observação (opcional)"><textarea value={productionForm.note ?? ""} onChange={(event) => setProductionForm({ ...productionForm, note: event.target.value })} rows={3} /></Field>
          {formError && <p className="form-error">{formError}</p>}<LoadingButton className="primary-button full" type="submit" loading={busy} loadingLabel="Salvando…">Salvar produção</LoadingButton>
        </form>}
      </Modal>

      <Modal open={Boolean(saleForm)} onClose={() => { if (!busy) setSaleForm(null); }} eyebrow="CADERNO" title={saleForm?.id ? "Editar venda" : "Registrar venda"} wide dismissible={!busy}>
        {saleForm && <form className="modal-form" onSubmit={submitSale}>
          <ProductField value={saleForm.product} onChange={(product) => setSaleForm({ ...saleForm, product })} />
          <div className="field-combo"><Field label="Quantidade"><input type="number" min="0.01" step="0.01" value={saleForm.quantity || ""} onChange={(event) => setSaleForm({ ...saleForm, quantity: Number(event.target.value) })} /></Field><Field label="Unidade"><select value={saleForm.unit} onChange={(event) => setSaleForm({ ...saleForm, unit: event.target.value })}>{units.map((item) => <option key={item}>{item}</option>)}</select></Field></div>
          <div className="field-combo"><Field label="Valor por unidade"><input type="number" min="0" step="0.01" value={saleForm.unitPrice || ""} onChange={(event) => setSaleForm({ ...saleForm, unitPrice: Number(event.target.value) })} /></Field><Field label="Data"><input type="date" value={saleForm.date} onChange={(event) => setSaleForm({ ...saleForm, date: event.target.value })} /></Field></div>
          <div className="sale-total-preview"><span>Receita</span><strong>{money(saleForm.quantity * saleForm.unitPrice)}</strong></div>
          <Field label="Tipo de venda"><select value={saleForm.saleType} onChange={(event) => setSaleForm({ ...saleForm, saleType: event.target.value })}>{saleTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Comprador (opcional)"><input value={saleForm.buyer ?? ""} onChange={(event) => setSaleForm({ ...saleForm, buyer: event.target.value })} /></Field>
          {formError && <p className="form-error">{formError}</p>}<LoadingButton className="primary-button full" type="submit" loading={busy} loadingLabel="Salvando…">Salvar venda</LoadingButton>
        </form>}
      </Modal>

      <Modal open={Boolean(expenseForm)} onClose={() => { if (!busy) setExpenseForm(null); }} eyebrow="CADERNO" title={expenseForm?.id ? "Editar gasto" : "Registrar gasto"} wide dismissible={!busy}>
        {expenseForm && <form className="modal-form" onSubmit={submitExpense}>
          <Field label="Descrição"><input value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="Ex.: Adubo para milho" /></Field>
          <div className="field-combo"><Field label="Categoria"><select value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })}>{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Valor"><input type="number" min="0" step="0.01" value={expenseForm.amount || ""} onChange={(event) => setExpenseForm({ ...expenseForm, amount: Number(event.target.value) })} /></Field></div>
          <Field label="Data"><input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} /></Field>
          <Field label="Produção relacionada (opcional)"><select value={expenseForm.productionId ?? ""} onChange={(event) => setExpenseForm({ ...expenseForm, productionId: event.target.value || undefined })}><option value="">Nenhuma</option>{notebook.production.map((item) => <option key={item.id} value={item.id}>{item.product} · {formatDate(item.date)}</option>)}</select></Field>
          {formError && <p className="form-error">{formError}</p>}<LoadingButton className="primary-button full" type="submit" loading={busy} loadingLabel="Salvando…">Salvar gasto</LoadingButton>
        </form>}
      </Modal>

      <Modal open={Boolean(workForm)} onClose={() => { if (!busy) setWorkForm(null); }} eyebrow="AGRICULTURA FAMILIAR" title={workForm?.id ? "Editar participação" : "Registrar mão de obra"} wide dismissible={!busy}>
        {workForm && <form className="modal-form" onSubmit={submitWork}>
          <Field label="Atividade"><input value={workForm.activityName} onChange={(event) => setWorkForm({ ...workForm, activityName: event.target.value })} placeholder="Ex.: Colheita de mandioca" /></Field>
          <Field label="Participantes"><input value={workForm.participants.join(", ")} onChange={(event) => setWorkForm({ ...workForm, participants: event.target.value.split(",").map((name) => name.trim()).filter(Boolean) })} placeholder="Daniel, Maria, João" /></Field>
          <div className="field-combo"><Field label="Duração em horas"><input type="number" min="0" step="0.5" value={workForm.durationHours ?? ""} onChange={(event) => setWorkForm({ ...workForm, durationHours: event.target.value ? Number(event.target.value) : undefined })} /></Field><Field label="Data"><input type="date" value={workForm.date} onChange={(event) => setWorkForm({ ...workForm, date: event.target.value })} /></Field></div>
          <Field label="Atividade do Hydra (opcional)"><select value={workForm.activityId ?? ""} onChange={(event) => setWorkForm({ ...workForm, activityId: event.target.value || undefined })}><option value="">Nenhuma</option>{account.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></Field>
          <Field label="Observação (opcional)"><textarea rows={3} value={workForm.note ?? ""} onChange={(event) => setWorkForm({ ...workForm, note: event.target.value })} /></Field>
          {formError && <p className="form-error">{formError}</p>}<LoadingButton className="primary-button full" type="submit" loading={busy} loadingLabel="Salvando…">Salvar participação</LoadingButton>
        </form>}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Excluir registro?" text={deleteTarget ? `${deleteTarget.label} será removido do Caderno da Produção.` : ""} confirmLabel="Excluir" onCancel={() => { if (!busy) setDeleteTarget(null); }} onConfirm={confirmDelete} busy={busy} error={formError || undefined} />
    </div>
  );
}

function Summary({ account, notebook, stock, productSummary, totals, monthExpenses, monthWork, waterEfficiency, onOpen }: {
  account: HydraAccount;
  notebook: ProductionNotebook;
  stock: ReturnType<typeof productionStock>;
  productSummary: { product: string; produced: number; sold: number; revenue: number; units: Set<string> }[];
  totals: ReturnType<typeof currentMonthTotals>;
  monthExpenses: ProductionExpense[];
  monthWork: FamilyWorkRecord[];
  waterEfficiency: (product: string, produced: number) => { water: number; perUnit: number } | null;
  onOpen: (tab: Tab) => void;
}) {
  const hasRecords = notebook.production.length + notebook.sales.length + notebook.expenses.length + notebook.familyWork.length > 0;
  if (!hasRecords) return <EmptyState icon={<ClipboardList size={27} />} title="Seu caderno está vazio" text="Comece registrando algo que foi produzido na propriedade." action={<button className="primary-button" onClick={() => onOpen("production")}><Plus size={17} /> Registrar produção</button>} />;
  const resultPositive = totals.result >= 0;
  return <div className="production-summary">
    <section className="production-result-card"><div><span>Este mês</span><strong className={resultPositive ? "positive" : "negative"}>{resultPositive ? "+ " : "− "}{money(Math.abs(totals.result))}</strong><small>resultado da produção</small></div><CircleDollarSign size={30} /></section>
    <div className="production-money-grid"><button onClick={() => onOpen("sales")}><span>Receitas</span><strong>{money(totals.revenue)}</strong><ChevronRight size={17} /></button><button onClick={() => onOpen("expenses")}><span>Gastos</span><strong>{money(totals.expenses)}</strong><ChevronRight size={17} /></button></div>

    <section className="production-block"><div className="production-block-head"><div><span>MINHA PRODUÇÃO</span><h2>Produtos do mês</h2></div><Sprout size={21} /></div>{productSummary.length === 0 ? <p className="production-muted">Nenhuma produção ou venda neste mês.</p> : <div className="product-summary-list">{productSummary.slice(0, 6).map((item) => <div key={item.product}><div><strong>{item.product}</strong><small>{number(item.produced)} produzido · {number(item.sold)} vendido</small></div><span>{item.revenue > 0 ? money(item.revenue) : "—"}</span></div>)}</div>}</section>

    <section className="production-block"><div className="production-block-head"><div><span>ESTOQUE</span><h2>Disponível</h2></div><PackageOpen size={21} /></div>{stock.length === 0 ? <p className="production-muted">Registre uma produção para começar o estoque.</p> : <div className="stock-list">{stock.slice(0, 7).map((item) => <div key={`${item.product}-${item.unit}`}><strong>{item.product}</strong><span>{number(item.available)} {item.unit}</span><small>{number(item.produced)} produzido · {number(item.sold)} vendido</small></div>)}</div>}</section>

    <section className="production-block"><div className="production-block-head"><div><span>USO CONSCIENTE</span><h2>Eficiência da produção</h2></div><Droplets size={21} /></div>{productSummary.length === 0 ? <p className="production-muted">Registre produção e consumo de água para acompanhar este indicador.</p> : <div className="efficiency-list">{productSummary.slice(0, 4).map((item) => { const efficiency = waterEfficiency(item.product, item.produced); return <div key={item.product}><div><strong>{item.product}</strong><small>{number(item.produced)} produzidos</small></div>{efficiency ? <span><b>{number(efficiency.perUnit)} L</b><small>por unidade produzida</small></span> : <em>Dados insuficientes</em>}</div>; })}</div>}<p className="production-footnote">O indicador usa apenas registros de água cujo uso/observação menciona o produto.</p></section>

    <section className="production-block"><div className="production-block-head"><div><span>FAMÍLIA</span><h2>Trabalho registrado</h2></div><UsersRound size={21} /></div><div className="family-work-summary"><strong>{monthWork.length}</strong><span>{monthWork.length === 1 ? "atividade familiar no mês" : "atividades familiares no mês"}</span><small>{monthExpenses.length > 0 ? `${monthExpenses.length} gastos de produção registrados` : "Sem gastos registrados no período"}</small></div></section>
  </div>;
}

function RecordSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="production-record-section"><div className="production-record-head"><h2>{title}</h2>{action}</div><div className="production-record-list">{children}</div></section>;
}

function MovementRow({ icon, title, subtitle, value, onEdit, onDelete }: { icon: React.ReactNode; title: string; subtitle: string; value?: string; onEdit?: () => void; onDelete?: () => void }) {
  return <article className="production-movement"><span className="production-movement-icon">{icon}</span><div><strong>{title}</strong><small>{subtitle}</small>{value && <b>{value}</b>}</div>{(onEdit || onDelete) && <div className="production-row-actions">{onEdit && <button onClick={onEdit} aria-label="Editar"><Pencil size={16} /></button>}{onDelete && <button className="danger" onClick={onDelete} aria-label="Excluir"><Trash2 size={16} /></button>}</div>}</article>;
}

function ProductField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Field label="Produto"><input list="hydra-production-products" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ex.: Mandioca" /><datalist id="hydra-production-products">{commonProducts.map((item) => <option key={item} value={item} />)}</datalist></Field>;
}

function sectorName(account: HydraAccount, id?: string) { return id ? account.sectors.find((item) => item.id === id)?.name ?? "" : ""; }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`)) : ""; }
