"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Beef, ChevronRight, Leaf, LoaderCircle, PackageOpen, Recycle, Sprout, Trash2, UsersRound } from "lucide-react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type HydraAccount } from "../../lib/hydra-types";
import { requireSupabase } from "../../services/supabase";
import "./nutriciclo-panel.css";

type DestinationKind = "alimentacao_animal" | "consumo_familiar" | "compostagem" | "perda" | "outro";
type ProductionRow = { id: string; product: string; quantity: number; unit: string };
type SaleRow = { product: string; quantity: number; unit: string };
type DestinationRow = {
  id: string;
  product: string;
  quantity: number;
  unit: string;
  destination: DestinationKind;
  animalId?: string;
  date: string;
  note?: string;
};

type ProductCycle = {
  key: string;
  product: string;
  unit: string;
  produced: number;
  sold: number;
  animalFeed: number;
  family: number;
  compost: number;
  loss: number;
  other: number;
  available: number;
  used: number;
  efficiency: number | null;
};

const destinationLabels: Record<DestinationKind, string> = {
  alimentacao_animal: "Alimentação animal",
  consumo_familiar: "Consumo da família",
  compostagem: "Compostagem",
  perda: "Perda",
  outro: "Outro uso",
};

const today = () => new Date().toISOString().slice(0, 10);
const keyOf = (product: string, unit: string) => `${product.trim().toLocaleLowerCase("pt-BR")}::${unit}`;
const fmt = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);

export function NutriCicloPanel({ account, open, onClose }: { account: HydraAccount; open: boolean; onClose: () => void }) {
  const [production, setProduction] = useState<ProductionRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [destination, setDestination] = useState<DestinationKind>("alimentacao_animal");
  const owner = account.access.ownerUserId || account.id;
  const propertyId = account.property.id || `property-${owner}`;
  const canEdit = account.access.kind === "owner" || account.access.staffRole === "manager";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const client = requireSupabase();
      const [p, s, d] = await Promise.all([
        client.from("production_records").select("id,product,quantity,unit").eq("owner_user_id", owner),
        client.from("sales_records").select("product,quantity,unit").eq("owner_user_id", owner),
        client.from("production_destinations").select("id,product,quantity,unit,destination,animal_id,moved_on,note").eq("owner_user_id", owner).order("moved_on", { ascending: false }),
      ]);
      const firstError = p.error || s.error || d.error;
      if (firstError) throw firstError;
      setProduction((p.data ?? []).map((row: any) => ({ id: String(row.id), product: String(row.product), quantity: Number(row.quantity), unit: String(row.unit) })));
      setSales((s.data ?? []).map((row: any) => ({ product: String(row.product), quantity: Number(row.quantity), unit: String(row.unit) })));
      setDestinations((d.data ?? []).map((row: any) => ({ id: String(row.id), product: String(row.product), quantity: Number(row.quantity), unit: String(row.unit), destination: row.destination as DestinationKind, animalId: row.animal_id ? String(row.animal_id) : undefined, date: String(row.moved_on).slice(0, 10), note: row.note ? String(row.note) : undefined })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o NutriCiclo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) void load(); }, [open, owner]);

  const cycles = useMemo<ProductCycle[]>(() => {
    const map = new Map<string, ProductCycle>();
    for (const row of production) {
      const key = keyOf(row.product, row.unit);
      const item = map.get(key) ?? { key, product: row.product, unit: row.unit, produced: 0, sold: 0, animalFeed: 0, family: 0, compost: 0, loss: 0, other: 0, available: 0, used: 0, efficiency: null };
      item.produced += row.quantity;
      map.set(key, item);
    }
    for (const row of sales) {
      const key = keyOf(row.product, row.unit);
      const item = map.get(key);
      if (item) item.sold += row.quantity;
    }
    for (const row of destinations) {
      const key = keyOf(row.product, row.unit);
      const item = map.get(key);
      if (!item) continue;
      if (row.destination === "alimentacao_animal") item.animalFeed += row.quantity;
      if (row.destination === "consumo_familiar") item.family += row.quantity;
      if (row.destination === "compostagem") item.compost += row.quantity;
      if (row.destination === "perda") item.loss += row.quantity;
      if (row.destination === "outro") item.other += row.quantity;
    }
    for (const item of map.values()) {
      item.used = item.sold + item.animalFeed + item.family + item.compost + item.loss + item.other;
      item.available = Math.max(0, item.produced - item.used);
      const useful = item.sold + item.animalFeed + item.family + item.compost + item.other;
      item.efficiency = item.produced > 0 ? Math.min(100, (useful / item.produced) * 100) : null;
    }
    return [...map.values()].sort((a, b) => b.produced - a.produced);
  }, [production, sales, destinations]);

  useEffect(() => {
    if (cycles.length && !cycles.some((item) => item.key === selectedKey)) setSelectedKey(cycles[0].key);
  }, [cycles, selectedKey]);

  const selected = cycles.find((item) => item.key === selectedKey);
  const totalProduced = cycles.reduce((sum, item) => sum + item.produced, 0);
  const totalUseful = cycles.reduce((sum, item) => sum + item.sold + item.animalFeed + item.family + item.compost + item.other, 0);
  const totalLoss = cycles.reduce((sum, item) => sum + item.loss, 0);
  const overallEfficiency = totalProduced > 0 ? Math.min(100, (totalUseful / totalProduced) * 100) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canEdit) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(String(form.get("quantity") || "0").replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Informe uma quantidade válida."); return; }
    if (quantity > selected.available) { setError(`Quantidade maior que a disponível. Restam ${fmt(selected.available)} ${selected.unit}.`); return; }
    setBusy(true); setError("");
    try {
      const { error: saveError } = await requireSupabase().from("production_destinations").insert({
        id: makeId("nutriciclo"), owner_user_id: owner, property_id: propertyId,
        product: selected.product, quantity, unit: selected.unit, destination,
        animal_id: destination === "alimentacao_animal" ? String(form.get("animalId") || "") || null : null,
        moved_on: String(form.get("date") || today()), note: String(form.get("note") || "").trim() || null,
      });
      if (saveError) throw saveError;
      showAppToast("Destino da produção registrado");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar.");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!canEdit || !window.confirm("Excluir este movimento do NutriCiclo?")) return;
    const { error: removeError } = await requireSupabase().from("production_destinations").delete().eq("id", id);
    if (removeError) { setError(removeError.message); return; }
    showAppToast("Movimento excluído");
    await load();
  }

  return <Modal open={open} onClose={onClose} eyebrow="AGRICULTURA FAMILIAR" title="Hydra NutriCiclo" wide>
    <div className="nutriciclo">
      <header className="nutriciclo-intro"><span><Recycle size={23} /></span><div><strong>Do que é produzido ao que é aproveitado</strong><small>Produção, venda, alimentação, consumo familiar, compostagem e perdas em um único ciclo.</small></div></header>

      {loading ? <div className="nutriciclo-loading"><LoaderCircle className="spin" size={24} /> Carregando ciclo...</div> : error && cycles.length === 0 ? <div className="nutriciclo-error">{error}</div> : cycles.length === 0 ? <div className="nutriciclo-empty"><Sprout size={25} /><strong>Registre uma produção primeiro</strong><span>O NutriCiclo usa os dados reais do Caderno da Produção.</span></div> : <>
        <section className="nutriciclo-score"><div><small>APROVEITAMENTO DA PRODUÇÃO</small><strong>{overallEfficiency === null ? "—" : `${Math.round(overallEfficiency)}%`}</strong><span>{overallEfficiency === null ? "Dados insuficientes" : totalLoss > 0 ? `${fmt(totalLoss)} em perdas registradas` : "Nenhuma perda registrada"}</span></div><Recycle size={32} /></section>

        <div className="nutriciclo-cycles">{cycles.map((item) => <button type="button" key={item.key} className={item.key === selectedKey ? "active" : ""} onClick={() => setSelectedKey(item.key)}><span><Sprout size={18} /></span><div><strong>{item.product}</strong><small>{fmt(item.produced)} {item.unit} produzidos · {fmt(item.available)} disponíveis</small></div><b>{item.efficiency === null ? "—" : `${Math.round(item.efficiency)}%`}</b><ChevronRight size={17} /></button>)}</div>

        {selected && <section className="nutriciclo-detail">
          <div className="nutriciclo-detail-head"><div><small>CICLO ATUAL</small><h3>{selected.product}</h3></div><b>{fmt(selected.available)} {selected.unit}<small>disponíveis</small></b></div>
          <div className="nutriciclo-flow">
            <div><span><Sprout size={18} /></span><strong>{fmt(selected.produced)}</strong><small>Produzido</small></div>
            <div><span><PackageOpen size={18} /></span><strong>{fmt(selected.sold)}</strong><small>Vendido</small></div>
            <div><span><Beef size={18} /></span><strong>{fmt(selected.animalFeed)}</strong><small>Animais</small></div>
            <div><span><UsersRound size={18} /></span><strong>{fmt(selected.family)}</strong><small>Família</small></div>
            <div><span><Leaf size={18} /></span><strong>{fmt(selected.compost)}</strong><small>Compostagem</small></div>
          </div>
        </section>}

        {canEdit && selected && selected.available > 0 && <form className="nutriciclo-form" onSubmit={submit}>
          <h3>Registrar destino</h3>
          <label>Produto<select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>{cycles.filter((item) => item.available > 0).map((item) => <option key={item.key} value={item.key}>{item.product} · {fmt(item.available)} {item.unit}</option>)}</select></label>
          <div><label>Quantidade<input name="quantity" inputMode="decimal" required placeholder={`Até ${fmt(selected.available)}`} /></label><label>Destino<select value={destination} onChange={(e) => setDestination(e.target.value as DestinationKind)}>{Object.entries(destinationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          {destination === "alimentacao_animal" && <label>Animal relacionado (opcional)<select name="animalId" defaultValue=""><option value="">Rebanho/lote geral</option>{account.animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name || animal.identification}</option>)}</select></label>}
          <div><label>Data<input name="date" type="date" defaultValue={today()} /></label><label>Observação<input name="note" placeholder="Opcional" /></label></div>
          {error && <p className="nutriciclo-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Salvando..." : "Registrar no ciclo"}</button>
        </form>}

        <section className="nutriciclo-history"><h3>Últimos destinos</h3>{destinations.length ? destinations.slice(0, 8).map((item) => <article key={item.id}><span><Recycle size={17} /></span><div><strong>{item.product}</strong><small>{fmt(item.quantity)} {item.unit} · {destinationLabels[item.destination]} · {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div>{canEdit && <button type="button" onClick={() => void remove(item.id)} aria-label="Excluir"><Trash2 size={16} /></button>}</article>) : <p>Nenhum destino registrado ainda.</p>}</section>
      </>}
    </div>
  </Modal>;
}
