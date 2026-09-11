import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
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
type RecordKind = "production" | "sale" | "expense" | "work";
type NotebookItem = ProductionRecord | SaleRecord | ProductionExpense | FamilyWorkRecord;
type QueueMutation = {
  id: string;
  kind: RecordKind;
  action: "upsert" | "delete";
  ownerUserId: string;
  propertyId: string;
  recordId: string;
  item?: NotebookItem;
  createdAt: string;
};
type RecordIndex = { ownerUserId: string; propertyId: string; kind: RecordKind };

const knownOwners = new Set<string>();
let reconnectListenerInstalled = false;

function throwIfError(error: unknown) {
  if (!error) return;
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "Não foi possível concluir a operação.";
  throw new Error(message);
}

function dateOnly(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function ownerOf(account: HydraAccount) {
  return account.access.ownerUserId || account.id;
}

function propertyIdOf(account: HydraAccount) {
  return account.property.id ?? `property-${ownerOf(account)}`;
}

function cacheKey(ownerUserId: string) {
  return `hydra.production.cache.${ownerUserId}`;
}

function queueKey(ownerUserId: string) {
  return `hydra.production.queue.${ownerUserId}`;
}

function indexKey(kind: RecordKind, recordId: string) {
  return `hydra.production.index.${kind}.${recordId}`;
}

function emptyNotebook(): ProductionNotebook {
  return { production: [], sales: [], expenses: [], familyWork: [] };
}

async function connected() {
  try {
    return (await Network.getStatus()).connected;
  } catch {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  }
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

async function cacheNotebook(ownerUserId: string, notebook: ProductionNotebook) {
  await writeJson(cacheKey(ownerUserId), notebook);
}

async function readNotebook(ownerUserId: string) {
  return readJson<ProductionNotebook>(cacheKey(ownerUserId));
}

async function setIndex(kind: RecordKind, recordId: string, ownerUserId: string, propertyId: string) {
  await writeJson(indexKey(kind, recordId), { ownerUserId, propertyId, kind } satisfies RecordIndex);
}

async function readIndex(kind: RecordKind, recordId: string) {
  return readJson<RecordIndex>(indexKey(kind, recordId));
}

async function removeIndex(kind: RecordKind, recordId: string) {
  await Preferences.remove({ key: indexKey(kind, recordId) });
}

async function indexNotebook(ownerUserId: string, propertyId: string, notebook: ProductionNotebook) {
  await Promise.all([
    ...notebook.production.map((item) => setIndex("production", item.id, ownerUserId, propertyId)),
    ...notebook.sales.map((item) => setIndex("sale", item.id, ownerUserId, propertyId)),
    ...notebook.expenses.map((item) => setIndex("expense", item.id, ownerUserId, propertyId)),
    ...notebook.familyWork.map((item) => setIndex("work", item.id, ownerUserId, propertyId)),
  ]);
}

async function queueMutation(mutation: QueueMutation) {
  const key = queueKey(mutation.ownerUserId);
  const queue = await readJson<QueueMutation[]>(key) ?? [];
  const compacted = queue.filter((entry) => !(entry.kind === mutation.kind && entry.recordId === mutation.recordId));
  compacted.push(mutation);
  await writeJson(key, compacted.slice(-250));
}

function common(ownerUserId: string, propertyId: string) {
  return { owner_user_id: ownerUserId, property_id: propertyId };
}

function productionPayload(ownerUserId: string, propertyId: string, item: ProductionRecord) {
  return {
    ...common(ownerUserId, propertyId),
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
  };
}

function salePayload(ownerUserId: string, propertyId: string, item: SaleRecord) {
  return {
    ...common(ownerUserId, propertyId),
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
  };
}

function expensePayload(ownerUserId: string, propertyId: string, item: ProductionExpense) {
  return {
    ...common(ownerUserId, propertyId),
    id: item.id,
    description: item.description.trim(),
    category: item.category,
    amount: item.amount,
    spent_on: item.date,
    production_id: item.productionId ?? null,
    updated_at: new Date().toISOString(),
  };
}

function workPayload(ownerUserId: string, propertyId: string, item: FamilyWorkRecord) {
  return {
    ...common(ownerUserId, propertyId),
    id: item.id,
    activity_name: item.activityName.trim(),
    activity_id: item.activityId ?? null,
    production_id: item.productionId ?? null,
    participants: item.participants,
    duration_hours: item.durationHours ?? null,
    worked_on: item.date,
    note: item.note?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

async function executeMutation(mutation: QueueMutation) {
  const client = requireSupabase();
  if (mutation.action === "upsert" && mutation.item) {
    if (mutation.kind === "production") {
      const { error } = await client.from("production_records").upsert(productionPayload(mutation.ownerUserId, mutation.propertyId, mutation.item as ProductionRecord), { onConflict: "id" });
      throwIfError(error);
      return;
    }
    if (mutation.kind === "sale") {
      const { error } = await client.from("sales_records").upsert(salePayload(mutation.ownerUserId, mutation.propertyId, mutation.item as SaleRecord), { onConflict: "id" });
      throwIfError(error);
      return;
    }
    if (mutation.kind === "expense") {
      const { error } = await client.from("production_expenses").upsert(expensePayload(mutation.ownerUserId, mutation.propertyId, mutation.item as ProductionExpense), { onConflict: "id" });
      throwIfError(error);
      return;
    }
    const { error } = await client.from("family_work_records").upsert(workPayload(mutation.ownerUserId, mutation.propertyId, mutation.item as FamilyWorkRecord), { onConflict: "id" });
    throwIfError(error);
    return;
  }

  if (mutation.kind === "production") {
    const [sales, expenses, work] = await Promise.all([
      client.from("sales_records").update({ production_id: null }).eq("production_id", mutation.recordId).eq("owner_user_id", mutation.ownerUserId),
      client.from("production_expenses").update({ production_id: null }).eq("production_id", mutation.recordId).eq("owner_user_id", mutation.ownerUserId),
      client.from("family_work_records").update({ production_id: null }).eq("production_id", mutation.recordId).eq("owner_user_id", mutation.ownerUserId),
    ]);
    [sales, expenses, work].forEach((result) => throwIfError(result.error));
    const { error } = await client.from("production_records").delete().eq("id", mutation.recordId).eq("owner_user_id", mutation.ownerUserId);
    throwIfError(error);
    return;
  }

  const table = mutation.kind === "sale"
    ? "sales_records"
    : mutation.kind === "expense"
      ? "production_expenses"
      : "family_work_records";
  const { error } = await client.from(table).delete().eq("id", mutation.recordId).eq("owner_user_id", mutation.ownerUserId);
  throwIfError(error);
}

export async function flushProductionQueue(ownerUserId: string) {
  if (!(await connected())) return 0;
  const key = queueKey(ownerUserId);
  const queue = await readJson<QueueMutation[]>(key) ?? [];
  if (!queue.length) return 0;

  let completed = 0;
  const remaining = [...queue];
  while (remaining.length) {
    const mutation = remaining[0];
    try {
      await executeMutation(mutation);
      remaining.shift();
      completed += 1;
      await writeJson(key, remaining);
    } catch {
      break;
    }
  }
  return completed;
}

function registerOwner(ownerUserId: string) {
  knownOwners.add(ownerUserId);
  if (reconnectListenerInstalled || typeof window === "undefined") return;
  reconnectListenerInstalled = true;
  window.addEventListener("online", () => {
    for (const owner of knownOwners) void flushProductionQueue(owner);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const owner of knownOwners) void flushProductionQueue(owner);
  });
}

function mapRemoteNotebook(production: Row[], sales: Row[], expenses: Row[], familyWork: Row[]): ProductionNotebook {
  return {
    production: production.map((row) => ({
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
    sales: sales.map((row) => ({
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
    expenses: expenses.map((row) => ({
      id: String(row.id),
      description: String(row.description),
      category: String(row.category),
      amount: Number(row.amount),
      date: dateOnly(row.spent_on),
      productionId: row.production_id ? String(row.production_id) : undefined,
    })),
    familyWork: familyWork.map((row) => ({
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

export async function loadProductionNotebook(account: HydraAccount): Promise<ProductionNotebook> {
  const ownerUserId = ownerOf(account);
  const propertyId = propertyIdOf(account);
  registerOwner(ownerUserId);
  const cached = await readNotebook(ownerUserId);

  if (!(await connected())) return cached ?? emptyNotebook();

  await flushProductionQueue(ownerUserId);
  try {
    const client = requireSupabase();
    const [production, sales, expenses, familyWork] = await Promise.all([
      client.from("production_records").select("*").eq("owner_user_id", ownerUserId).order("produced_on", { ascending: false }),
      client.from("sales_records").select("*").eq("owner_user_id", ownerUserId).order("sold_on", { ascending: false }),
      client.from("production_expenses").select("*").eq("owner_user_id", ownerUserId).order("spent_on", { ascending: false }),
      client.from("family_work_records").select("*").eq("owner_user_id", ownerUserId).order("worked_on", { ascending: false }),
    ]);
    [production, sales, expenses, familyWork].forEach((result) => throwIfError(result.error));
    const notebook = mapRemoteNotebook(
      (production.data ?? []) as Row[],
      (sales.data ?? []) as Row[],
      (expenses.data ?? []) as Row[],
      (familyWork.data ?? []) as Row[],
    );
    await cacheNotebook(ownerUserId, notebook);
    await indexNotebook(ownerUserId, propertyId, notebook);
    return notebook;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const next = items.filter((current) => current.id !== item.id);
  next.unshift(item);
  return next.sort((a, b) => ("date" in b ? String(b.date) : "").localeCompare("date" in a ? String(a.date) : ""));
}

async function saveLocal(account: HydraAccount, kind: RecordKind, item: NotebookItem) {
  const ownerUserId = ownerOf(account);
  const propertyId = propertyIdOf(account);
  registerOwner(ownerUserId);
  const notebook = await readNotebook(ownerUserId) ?? emptyNotebook();

  if (kind === "production") notebook.production = upsertById(notebook.production, item as ProductionRecord);
  if (kind === "sale") notebook.sales = upsertById(notebook.sales, item as SaleRecord);
  if (kind === "expense") notebook.expenses = upsertById(notebook.expenses, item as ProductionExpense);
  if (kind === "work") notebook.familyWork = upsertById(notebook.familyWork, item as FamilyWorkRecord);

  await cacheNotebook(ownerUserId, notebook);
  await setIndex(kind, item.id, ownerUserId, propertyId);
  await queueMutation({
    id: `${kind}:${item.id}:${Date.now()}`,
    kind,
    action: "upsert",
    ownerUserId,
    propertyId,
    recordId: item.id,
    item,
    createdAt: new Date().toISOString(),
  });
  if (await connected()) await flushProductionQueue(ownerUserId);
}

export async function saveProductionRecord(account: HydraAccount, item: ProductionRecord) {
  await saveLocal(account, "production", item);
}

export async function saveSaleRecord(account: HydraAccount, item: SaleRecord) {
  await saveLocal(account, "sale", item);
}

export async function saveProductionExpense(account: HydraAccount, item: ProductionExpense) {
  await saveLocal(account, "expense", item);
}

export async function saveFamilyWorkRecord(account: HydraAccount, item: FamilyWorkRecord) {
  await saveLocal(account, "work", item);
}

async function deleteLocal(kind: RecordKind, recordId: string) {
  const index = await readIndex(kind, recordId);
  if (!index) {
    if (!(await connected())) throw new Error("Este registro ainda não foi carregado neste aparelho.");
    const client = requireSupabase();
    if (kind === "production") {
      const [sales, expenses, work] = await Promise.all([
        client.from("sales_records").update({ production_id: null }).eq("production_id", recordId),
        client.from("production_expenses").update({ production_id: null }).eq("production_id", recordId),
        client.from("family_work_records").update({ production_id: null }).eq("production_id", recordId),
      ]);
      [sales, expenses, work].forEach((result) => throwIfError(result.error));
      const { error } = await client.from("production_records").delete().eq("id", recordId);
      throwIfError(error);
      return;
    }
    const table = kind === "sale" ? "sales_records" : kind === "expense" ? "production_expenses" : "family_work_records";
    const { error } = await client.from(table).delete().eq("id", recordId);
    throwIfError(error);
    return;
  }

  registerOwner(index.ownerUserId);
  const notebook = await readNotebook(index.ownerUserId) ?? emptyNotebook();
  if (kind === "production") {
    notebook.production = notebook.production.filter((item) => item.id !== recordId);
    notebook.sales = notebook.sales.map((item) => item.productionId === recordId ? { ...item, productionId: undefined } : item);
    notebook.expenses = notebook.expenses.map((item) => item.productionId === recordId ? { ...item, productionId: undefined } : item);
    notebook.familyWork = notebook.familyWork.map((item) => item.productionId === recordId ? { ...item, productionId: undefined } : item);
  }
  if (kind === "sale") notebook.sales = notebook.sales.filter((item) => item.id !== recordId);
  if (kind === "expense") notebook.expenses = notebook.expenses.filter((item) => item.id !== recordId);
  if (kind === "work") notebook.familyWork = notebook.familyWork.filter((item) => item.id !== recordId);

  await cacheNotebook(index.ownerUserId, notebook);
  await removeIndex(kind, recordId);
  await queueMutation({
    id: `${kind}:${recordId}:${Date.now()}`,
    kind,
    action: "delete",
    ownerUserId: index.ownerUserId,
    propertyId: index.propertyId,
    recordId,
    createdAt: new Date().toISOString(),
  });
  if (await connected()) await flushProductionQueue(index.ownerUserId);
}

export async function deleteProductionRecord(id: string) {
  await deleteLocal("production", id);
}

export async function deleteSaleRecord(id: string) {
  await deleteLocal("sale", id);
}

export async function deleteProductionExpense(id: string) {
  await deleteLocal("expense", id);
}

export async function deleteFamilyWorkRecord(id: string) {
  await deleteLocal("work", id);
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
