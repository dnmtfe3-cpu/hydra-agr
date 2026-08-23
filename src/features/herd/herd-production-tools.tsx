import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, ChevronRight, ClipboardCheck, Milk, Plus, Sprout, Syringe, Wheat } from "lucide-react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type HydraAccount, type UpdateAccount } from "../../lib/hydra-types";
import "./herd-production-tools.css";

type Props = { account: HydraAccount; updateAccount: UpdateAccount };
type Tool = "vaccines" | "feeding" | "milk" | "production" | null;

const PREFIX = {
  vaccine: "HYDRA_VACCINE",
  feeding: "HYDRA_FEED_PLAN",
  milk: "HYDRA_MILK",
  production: "HYDRA_PRODUCTION",
} as const;

const today = () => new Date().toISOString().slice(0, 10);
const tagged = (prefix: string, text?: string) => text?.startsWith(`${prefix}|`) ?? false;
const encode = (prefix: string, parts: Record<string, string>) => `${prefix}|${Object.entries(parts).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("|")}`;
const decode = (value?: string) => Object.fromEntries((value || "").split("|").slice(1).map((part) => { const at = part.indexOf("="); return at < 0 ? [part, ""] : [part.slice(0, at), decodeURIComponent(part.slice(at + 1))]; }));
const number = (value: FormDataEntryValue | null) => Number(String(value || "0").replace(",", "."));

function ToolCard({ icon, title, text, value, onClick }: { icon: ReactNode; title: string; text: string; value: string; onClick: () => void }) {
  return <button className="herd-production-card" type="button" onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div><b>{value}</b><ChevronRight size={18} /></button>;
}

export function HerdProductionTools({ account, updateAccount }: Props) {
  const [open, setOpen] = useState<Tool>(null);
  const activityText = [account.property.mainActivity, ...(account.property.otherActivities || [])].join(" ").toLocaleLowerCase("pt-BR");
  const animalSpecies = account.animals.map((animal) => animal.species.toLocaleLowerCase("pt-BR"));
  const hasLivestock = account.animals.length > 0 || /(pecu|animal|gado|bov|capr|ovin|suí|suin|avic|leite)/.test(activityText);

  const vaccines = useMemo(() => account.activities.filter((item) => tagged(PREFIX.vaccine, item.note)), [account.activities]);
  const feedingPlans = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.feeding, item.note)), [account.monitoring]);
  const milkRecords = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.milk, item.note)), [account.monitoring]);
  const productionRecords = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.production, item.note)), [account.monitoring]);

  const dairySpecies = animalSpecies.some((species) => species.includes("bov") || species.includes("capr"));
  const dairyActivity = /(leite|leiteir|latic|pecu)/.test(activityText);
  const showMilk = milkRecords.length > 0 || (dairySpecies && dairyActivity);
  const pendingVaccines = vaccines.filter((item) => !item.done);
  const month = today().slice(0, 7);
  const milkMonth = milkRecords.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + Number(decode(item.note).liters || 0), 0);
  const latestFeed = feedingPlans[0] ? decode(feedingPlans[0].note) : null;
  const profileLabel = account.property.mainActivity || (account.animals.length ? "Produção animal" : "Rebanho");

  if (!hasLivestock && account.animals.length === 0) {
    return <section className="herd-production-context is-empty"><Sprout size={21} /><div><strong>Gestão da produção animal</strong><small>Os atalhos de vacinas, alimentação e leite aparecem conforme o rebanho e a atividade cadastrada.</small></div></section>;
  }

  const responsible = account.profile.name;

  async function addVaccine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const animalId = String(form.get("animalId") || "");
    const vaccine = String(form.get("vaccine") || "").trim();
    const date = String(form.get("date") || today());
    if (!animalId || !vaccine) return;
    await updateAccount((current) => ({ ...current, activities: [{ id: makeId("vaccine"), title: vaccine, category: "Vacinação", date, animalId, note: encode(PREFIX.vaccine, { animalId, vaccine, dose: String(form.get("dose") || "").trim(), responsible }), done: false }, ...current.activities] }), { requireRemote: true });
    showAppToast("Vacina adicionada ao calendário");
    setOpen(null);
  }

  async function toggleVaccine(id: string) {
    await updateAccount((current) => ({ ...current, activities: current.activities.map((item) => item.id === id ? { ...item, done: !item.done } : item) }), { requireRemote: true });
  }

  async function addFeeding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    await updateAccount((current) => ({ ...current, monitoring: [{ id: makeId("feed"), date: today(), type: "Plano de alimentação", note: encode(PREFIX.feeding, { title, group: String(form.get("group") || "Rebanho geral"), food: String(form.get("food") || "").trim(), quantity: String(form.get("quantity") || "").trim(), frequency: String(form.get("frequency") || "Diariamente"), responsible, notes: String(form.get("notes") || "").trim() }) }, ...current.monitoring] }), { requireRemote: true });
    showAppToast("Plano de alimentação salvo");
    setOpen(null);
  }

  async function addMilk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const liters = number(form.get("liters"));
    const animals = Math.max(0, Math.round(number(form.get("cows"))));
    const price = Math.max(0, number(form.get("price")) || 0);
    if (!Number.isFinite(liters) || liters <= 0) { showAppToast("Informe a quantidade produzida.", "error"); return; }
    await updateAccount((current) => ({ ...current, monitoring: [{ id: makeId("milk"), date: String(form.get("date") || today()), type: "Produção de leite", note: encode(PREFIX.milk, { liters: liters.toFixed(2), cows: String(animals), shift: String(form.get("shift") || "Total do dia"), destination: String(form.get("destination") || "Venda"), price: price.toFixed(2), responsible }) }, ...current.monitoring] }), { requireRemote: true });
    showAppToast("Produção de leite registrada");
    setOpen(null);
  }

  async function addProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = number(form.get("quantity"));
    const product = String(form.get("product") || "").trim();
    if (!product || !Number.isFinite(quantity) || quantity <= 0) { showAppToast("Informe produto e quantidade válidos.", "error"); return; }
    await updateAccount((current) => ({ ...current, monitoring: [{ id: makeId("production"), date: String(form.get("date") || today()), type: "Produção", note: encode(PREFIX.production, { product, quantity: String(quantity), unit: String(form.get("unit") || "kg"), destination: String(form.get("destination") || "Uso próprio"), responsible, notes: String(form.get("notes") || "").trim() }) }, ...current.monitoring] }), { requireRemote: true });
    showAppToast("Produção registrada");
    setOpen(null);
  }

  return <>
    <section className="herd-production-context">
      <header><div><span>PRODUÇÃO DO REBANHO</span><h2>{profileLabel}</h2><p>Ferramentas exibidas conforme os animais e a produção cadastrada.</p></div><b>{account.animals.length} animais</b></header>
      <div className={`herd-production-grid ${showMilk ? "has-milk" : ""}`}>
        <ToolCard icon={<Syringe size={21} />} title="Vacinas" text="Calendário por animal" value={`${pendingVaccines.length} pendentes`} onClick={() => setOpen("vaccines")} />
        <ToolCard icon={<Wheat size={21} />} title="Alimentação" text={latestFeed?.title || "Plano do rebanho"} value={`${feedingPlans.length} planos`} onClick={() => setOpen("feeding")} />
        {showMilk && <ToolCard icon={<Milk size={21} />} title="Produção de leite" text="Registros da atividade leiteira" value={`${milkMonth.toLocaleString("pt-BR")} L/mês`} onClick={() => setOpen("milk")} />}
        <ToolCard icon={<ClipboardCheck size={21} />} title="Produção animal" text="Acompanhe o que foi produzido" value={`${productionRecords.length} registros`} onClick={() => setOpen("production")} />
      </div>
    </section>

    <Modal open={open === "vaccines"} onClose={() => setOpen(null)} eyebrow="REBANHO" title="Calendário de vacinas" wide>
      <div className="herd-production-modal">
        <div className="herd-production-list">{vaccines.length ? vaccines.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((item) => { const animal = account.animals.find((entry) => entry.id === item.animalId); return <button key={item.id} className={item.done ? "is-done" : ""} onClick={() => void toggleVaccine(item.id)}><span><CalendarDays size={18} /></span><div><strong>{item.title}</strong><small>{animal?.name || animal?.identification || "Animal"} · {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div><b>{item.done ? "Feita" : "Pendente"}</b></button>; }) : <p className="herd-production-empty">Nenhuma vacina agendada.</p>}</div>
        <form className="herd-production-form" onSubmit={addVaccine}><h3><Plus size={17}/> Agendar vacina</h3><label>Animal<select name="animalId" required defaultValue=""><option value="" disabled>Selecione</option>{account.animals.map((item) => <option key={item.id} value={item.id}>{item.name || item.identification}</option>)}</select></label><label>Vacina<input name="vaccine" required placeholder="Nome da vacina" /></label><div><label>Data<input name="date" type="date" defaultValue={today()} required /></label><label>Dose / observação<input name="dose" placeholder="Opcional" /></label></div><button className="primary-button" type="submit">Salvar no calendário</button><small className="herd-health-note">Use o calendário para organização dos registros. O protocolo e as datas devem seguir a orientação do veterinário e as regras sanitárias da sua região.</small></form>
      </div>
    </Modal>

    <Modal open={open === "feeding"} onClose={() => setOpen(null)} eyebrow="REBANHO" title="Plano de alimentação" wide>
      <div className="herd-production-modal"><div className="herd-production-list">{feedingPlans.length ? feedingPlans.map((item) => { const meta = decode(item.note); return <article key={item.id}><span><Wheat size={18}/></span><div><strong>{meta.title}</strong><small>{meta.group} · {meta.food || "Alimento não informado"} · {meta.frequency}</small></div><b>{meta.quantity || "Ativo"}</b></article>; }) : <p className="herd-production-empty">Nenhum plano cadastrado.</p>}</div><form className="herd-production-form" onSubmit={addFeeding}><h3><Plus size={17}/> Novo plano</h3><label>Nome do plano<input name="title" required placeholder="Ex.: Lote de matrizes" /></label><label>Grupo / lote<input name="group" defaultValue={account.animals.length ? "Rebanho geral" : "Produção"} /></label><label>Alimento<input name="food" placeholder="Ex.: pasto + suplementação" /></label><div><label>Quantidade<input name="quantity" placeholder="Ex.: 3 kg/animal" /></label><label>Frequência<select name="frequency"><option>Diariamente</option><option>2x ao dia</option><option>3x ao dia</option><option>Semanalmente</option></select></label></div><label>Observações<textarea name="notes" placeholder="Horários, lote, ajustes..." /></label><button className="primary-button" type="submit">Salvar plano</button></form></div>
    </Modal>

    <Modal open={open === "milk"} onClose={() => setOpen(null)} eyebrow="PRODUÇÃO" title="Produção de leite" wide>
      <div className="herd-production-modal"><div className="herd-production-list">{milkRecords.length ? milkRecords.slice(0,8).map((item) => { const meta = decode(item.note); return <article key={item.id}><span><Milk size={18}/></span><div><strong>{Number(meta.liters || 0).toLocaleString("pt-BR")} L</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")} · {meta.shift} · {meta.destination}</small></div><b>{meta.cows ? `${meta.cows} animais` : "Leite"}</b></article>; }) : <p className="herd-production-empty">Nenhuma produção de leite registrada.</p>}</div><form className="herd-production-form" onSubmit={addMilk}><h3><Plus size={17}/> Registrar leite</h3><div><label>Data<input name="date" type="date" defaultValue={today()} /></label><label>Litros<input name="liters" inputMode="decimal" required placeholder="0" /></label></div><div><label>Animais em produção<input name="cows" inputMode="numeric" placeholder="0" /></label><label>Turno<select name="shift"><option>Total do dia</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label></div><div><label>Destino<select name="destination"><option>Venda</option><option>Consumo próprio</option><option>Beneficiamento</option><option>Outro</option></select></label><label>Preço por litro (R$)<input name="price" inputMode="decimal" placeholder="0,00" /></label></div><button className="primary-button" type="submit">Salvar produção</button></form></div>
    </Modal>

    <Modal open={open === "production"} onClose={() => setOpen(null)} eyebrow="REBANHO" title="Produção animal" wide>
      <div className="herd-production-modal"><div className="herd-production-list">{productionRecords.length ? productionRecords.slice(0,8).map((item) => { const meta = decode(item.note); return <article key={item.id}><span><ClipboardCheck size={18}/></span><div><strong>{meta.product}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")} · {meta.destination}</small></div><b>{meta.quantity} {meta.unit}</b></article>; }) : <p className="herd-production-empty">Nenhum registro de produção animal.</p>}</div><form className="herd-production-form" onSubmit={addProduction}><h3><Plus size={17}/> Registrar produção</h3><label>Produto<input name="product" required placeholder="Ex.: ovos, mel, lã, animais comercializados" /></label><div><label>Quantidade<input name="quantity" inputMode="decimal" required placeholder="0" /></label><label>Unidade<select name="unit"><option>kg</option><option>unidades</option><option>litros</option><option>caixas</option><option>cabeças</option></select></label></div><div><label>Data<input name="date" type="date" defaultValue={today()} /></label><label>Destino<select name="destination"><option>Venda</option><option>Uso próprio</option><option>Estoque</option><option>Beneficiamento</option></select></label></div><label>Observações<textarea name="notes" /></label><button className="primary-button" type="submit">Salvar registro</button></form></div>
    </Modal>
  </>;
}
