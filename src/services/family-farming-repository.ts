import type {
  FamilyWorkRecord,
  HydraAccount,
  ProductionExpense,
  ProductionNotebook,
  ProductionRecord,
  SaleRecord,
} from "../lib/hydra-types";
import { requireSupabase } from "./supabase";

type Row = Record<string, unknown>;

function throwIfError(error: unknown) {
  if (!error) return;
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "Não foi possível concluir a operação.";
  throw new Error(message);
}

function dateOnly(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

export async function loadProductionNotebook(account: HydraAccount): Promise<ProductionNotebook> {
  const client = requireSupabase();
  const owner = account.access.ownerUserId || account.id;
  const [production, sales, expenses, familyWork] = await Promise.all([
    client.from("production_records").select("*").eq("owner_user_id", owner).order("produced_on", { ascending: false }),
    client.from("sales_records").select("*").eq("owner_user_id", owner).order("sold_on", { ascending: false }),
    client.from("production_expenses").select("*").eq("owner_user_id", owner).order("spent_on", { ascending: false }),
    client.from("family_work_records").select("*").eq("owner_user_id", owner).order("worked_on", { ascending: false }),
  ]);
  [production, sales, expenses, familyWork].forEach((result) => throwIfError(result.error));

  return {
    production: ((production.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      product: String(row.product),
      quantity: Number(row.quantity),
      unit: String(row.unit),
      date: dateOnly(row.produced_on),
      sectorId: row.sector_id ? String(row.sector_id) : undefined,
      animalId: row.animal_id ? String(row.animal_id) : undefined,
      activityId: row.activity_id ? String(row.activity_id) : undefined,
      note: row.note ? String(row.note) : undefined,
    })),
    sales: ((sales.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      product: String(row.product),
      quantity: Number(row.quantity),
      unit: String(row.unit),
      unitPrice: Number(row.unit_price),
      buyer: row.buyer ? String(row.buyer) : undefined,
      saleType: String(row.sale_type),
      date: dateOnly(row.sold_on),
      productionId: row.production_id ? String(row.production_id) : undefined,
    })),
    expenses: ((expenses.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      description: String(row.description),
      category: String(row.category),
      amount: Number(row.amount),
      date: dateOnly(row.spent_on),
      productionId: row.production_id ? String(row.production_id) : undefined,
    })),
    familyWork: ((familyWork.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      activityName: String(row.activity_name),
      activityId: row.activity_id ? String(row.activity_id) : undefined,
      productionId: row.production_id ? String(row.production_id) : undefined,
      participants: Array.isArray(row.participants) ? row.participants.map(String) : [],
      durationHours: row.duration_hours === null || row.duration_hours === undefined ? undefined : Number(row.duration_hours),
      date: dateOnly(row.worked_on),
      note: row.note ? String(row.note) : undefined,
    })),
  };
}

function common(account: HydraAccount) {
  return {
    owner_user_id: account.access.ownerUserId || account.id,
    property_id: account.property.id ?? `property-${account.access.ownerUserId || account.id}`,
  };
}

export async function saveProductionRecord(account: HydraAccount, item: ProductionRecord) {
  const { error } = await requireSupabase().from("production_records").upsert({
    ...common(account),
    id: item.id,
    product: item.product.trim(),
    quantity: item.quantity,
    unit: item.unit,
    produced_on: item.date,
    sector_id: item.sectorId ?? null,
    animal_id: item.animalId ?? null,
    activity_id: item.activityId ?? null,
    note: item.note?.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  throwIfError(error);
}

export async function saveSaleRecord(account: HydraAccount, item: SaleRecord) {
  const { error } = await requireSupabase().from("sales_records").upsert({
    ...common(account),
    id: item.id,
    product: item.product.trim(),
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    buyer: item.buyer?.trim() || null,
    sale_type: item.saleType,
    sold_on: item.date,
    production_id: item.productionId ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  throwIfError(error);
}

export async function saveProductionExpense(account: HydraAccount, item: ProductionExpense) {
  const { error } = await requireSupabase().from("production_expenses").upsert({
    ...common(account),
    id: item.id,
    description: item.description.trim(),
    category: item.category,
    amount: item.amount,
    spent_on: item.date,
    production_id: item.productionId ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  throwIfError(error);
}

export async function saveFamilyWorkRecord(account: HydraAccount, item: FamilyWorkRecord) {
  const { error } = await requireSupabase().from("family_work_records").upsert({
    ...common(account),
    id: item.id,
    activity_name: item.activityName.trim(),
    activity_id: item.activityId ?? null,
    production_id: item.productionId ?? null,
    participants: item.participants,
    duration_hours: item.durationHours ?? null,
    worked_on: item.date,
    note: item.note?.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  throwIfError(error);
}

export async function deleteProductionRecord(id: string) {
  const client = requireSupabase();
  const [sales, expenses, work] = await Promise.all([
    client.from("sales_records").update({ production_id: null }).eq("production_id", id),
    client.from("production_expenses").update({ production_id: null }).eq("production_id", id),
    client.from("family_work_records").update({ production_id: null }).eq("production_id", id),
  ]);
  [sales, expenses, work].forEach((result) => throwIfError(result.error));
  const { error } = await client.from("production_records").delete().eq("id", id);
  throwIfError(error);
}

export async function deleteSaleRecord(id: string) {
  const { error } = await requireSupabase().from("sales_records").delete().eq("id", id);
  throwIfError(error);
}

export async function deleteProductionExpense(id: string) {
  const { error } = await requireSupabase().from("production_expenses").delete().eq("id", id);
  throwIfError(error);
}

export async function deleteFamilyWorkRecord(id: string) {
  const { error } = await requireSupabase().from("family_work_records").delete().eq("id", id);
  throwIfError(error);
}

export function productionStock(notebook: ProductionNotebook) {
  const stock = new Map<string, { product: string; unit: string; produced: number; sold: number; available: number }>();
  for (const item of notebook.production) {
    const key = `${item.product.trim().toLocaleLowerCase("pt-BR")}::${item.unit}`;
    const current = stock.get(key) ?? { product: item.product, unit: item.unit, produced: 0, sold: 0, available: 0 };
    current.produced += item.quantity;
    stock.set(key, current);
  }
  for (const sale of notebook.sales) {
    const key = `${sale.product.trim().toLocaleLowerCase("pt-BR")}::${sale.unit}`;
    const current = stock.get(key) ?? { product: sale.product, unit: sale.unit, produced: 0, sold: 0, available: 0 };
    current.sold += sale.quantity;
    stock.set(key, current);
  }
  stock.forEach((value) => { value.available = Math.max(0, value.produced - value.sold); });
  return [...stock.values()].sort((a, b) => b.available - a.available);
}

export function currentMonthTotals(notebook: ProductionNotebook, now = new Date()) {
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const revenue = notebook.sales.filter((item) => item.date.startsWith(prefix)).reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const expenses = notebook.expenses.filter((item) => item.date.startsWith(prefix)).reduce((total, item) => total + item.amount, 0);
  return { revenue, expenses, result: revenue - expenses };
}
