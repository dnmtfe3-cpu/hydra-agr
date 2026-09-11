import type { HydraAccount } from "../../lib/hydra-types";
import { uploadPublicImage } from "../../services/media-service";
import { publicMediaUrl, supabase } from "../../services/supabase";

export type RuralOccurrenceCategory =
  | "water"
  | "animal_found"
  | "animal_missing"
  | "road"
  | "bridge"
  | "culvert"
  | "access"
  | "animal_road"
  | "fence"
  | "structure"
  | "road_risk"
  | "other";

export type RuralOccurrenceStatus = "Aberto" | "Em andamento" | "Sem confirmação recente" | "Resolvido" | "Procurando" | "Possível localização" | "Encontrado" | "Recuperado";
export type RuralOccurrencePriority = "Normal" | "Atenção" | "Alta atenção";
export type RuralOccurrenceSyncState = "Sincronizado" | "Pendente" | "Sem internet";

export type RuralOccurrence = {
  id: string;
  reporterId: string;
  protocol: string;
  category: RuralOccurrenceCategory;
  subtype: string;
  community: string;
  region: string;
  municipality: string;
  state: string;
  description: string;
  latitude?: number;
  longitude?: number;
  photoPath?: string;
  photoUrl?: string;
  status: RuralOccurrenceStatus;
  priority: RuralOccurrencePriority;
  reportCount: number;
  affectedCount: number;
  ongoing?: boolean;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
  publicVisible: boolean;
  syncState: RuralOccurrenceSyncState;
  mine: boolean;
};

export type CreateRuralOccurrenceInput = {
  category: RuralOccurrenceCategory;
  subtype: string;
  community: string;
  region?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  status?: RuralOccurrenceStatus;
  priority?: RuralOccurrencePriority;
  affectedCount?: number;
  ongoing?: boolean;
  startedAt?: string;
  publicVisible?: boolean;
};

type CachedOccurrence = RuralOccurrence & {
  photoBlob?: Blob;
  photoName?: string;
  photoType?: string;
};

const DB_NAME = "hydra-community-v1";
const STORE_NAME = "occurrences";

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cachePut(value: CachedOccurrence) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function cacheAll(userId: string): Promise<CachedOccurrence[]> {
  const db = await openDb();
  if (!db) return [];
  const values = await new Promise<CachedOccurrence[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result || []).filter((item) => item.reporterId === userId));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return values;
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function protocolPrefix(category: RuralOccurrenceCategory) {
  if (category === "water") return "HYDRA-AGUA";
  if (category === "animal_found" || category === "animal_missing") return "HYDRA-ANIMAL";
  return "HYDRA-OC";
}

function makeProtocol(category: RuralOccurrenceCategory) {
  const suffix = `${Date.now()}`.slice(-6);
  return `${protocolPrefix(category)}-${suffix}`;
}

export function approximateCoordinate(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(value * 100) / 100;
}

function rowToOccurrence(row: Record<string, unknown>, userId: string): RuralOccurrence {
  const photoPath = typeof row.photo_path === "string" ? row.photo_path : undefined;
  return {
    id: String(row.id),
    reporterId: String(row.reporter_id || ""),
    protocol: String(row.protocol || ""),
    category: String(row.category || "other") as RuralOccurrenceCategory,
    subtype: String(row.subtype || "Outro"),
    community: String(row.community || ""),
    region: String(row.region || ""),
    municipality: String(row.municipality || ""),
    state: String(row.state || ""),
    description: String(row.description || ""),
    latitude: typeof row.latitude_approx === "number" ? row.latitude_approx : row.latitude_approx ? Number(row.latitude_approx) : undefined,
    longitude: typeof row.longitude_approx === "number" ? row.longitude_approx : row.longitude_approx ? Number(row.longitude_approx) : undefined,
    photoPath,
    photoUrl: photoPath ? publicMediaUrl("community-media", photoPath) : undefined,
    status: String(row.status || "Aberto") as RuralOccurrenceStatus,
    priority: String(row.priority || "Normal") as RuralOccurrencePriority,
    reportCount: Number(row.report_count || 1),
    affectedCount: Number(row.affected_count || 1),
    ongoing: Boolean(row.ongoing),
    startedAt: typeof row.started_at === "string" ? row.started_at : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
    publicVisible: row.public_visible !== false,
    syncState: "Sincronizado",
    mine: String(row.reporter_id || "") === userId,
  };
}

function remotePayload(occurrence: CachedOccurrence, photoPath?: string) {
  return {
    id: occurrence.id,
    reporter_id: occurrence.reporterId,
    protocol: occurrence.protocol,
    category: occurrence.category,
    subtype: occurrence.subtype,
    community: occurrence.community || null,
    region: occurrence.region || null,
    municipality: occurrence.municipality || null,
    state: occurrence.state || null,
    description: occurrence.description || null,
    latitude_approx: occurrence.latitude ?? null,
    longitude_approx: occurrence.longitude ?? null,
    photo_path: photoPath || occurrence.photoPath || null,
    status: occurrence.status,
    priority: occurrence.priority,
    report_count: occurrence.reportCount,
    affected_count: occurrence.affectedCount,
    ongoing: Boolean(occurrence.ongoing),
    started_at: occurrence.startedAt || null,
    public_visible: occurrence.publicVisible,
    created_at: occurrence.createdAt,
    updated_at: occurrence.updatedAt,
  };
}

async function tryUploadOccurrence(occurrence: CachedOccurrence) {
  if (!supabase || (typeof navigator !== "undefined" && !navigator.onLine)) return false;
  let photoPath = occurrence.photoPath;
  if (!photoPath && occurrence.photoBlob) {
    const file = new File([occurrence.photoBlob], occurrence.photoName || `occurrence-${occurrence.id}.jpg`, {
      type: occurrence.photoType || occurrence.photoBlob.type || "image/jpeg",
    });
    photoPath = await uploadPublicImage("community-media", occurrence.reporterId, file, `rural-${occurrence.id}`);
  }
  const { error } = await supabase.from("rural_occurrences").upsert(remotePayload(occurrence, photoPath), { onConflict: "id" });
  if (error) return false;
  await cachePut({
    ...occurrence,
    photoPath,
    photoUrl: photoPath ? publicMediaUrl("community-media", photoPath) : occurrence.photoUrl,
    photoBlob: undefined,
    photoName: undefined,
    photoType: undefined,
    syncState: "Sincronizado",
  });
  return true;
}

export async function createRuralOccurrence(account: HydraAccount, input: CreateRuralOccurrenceInput, photo?: File): Promise<RuralOccurrence> {
  const now = new Date().toISOString();
  const online = typeof navigator === "undefined" || navigator.onLine;
  const occurrence: CachedOccurrence = {
    id: uuid(),
    reporterId: account.id,
    protocol: makeProtocol(input.category),
    category: input.category,
    subtype: input.subtype.trim().slice(0, 80) || "Outro",
    community: input.community.trim().slice(0, 80),
    region: (input.region || "").trim().slice(0, 80),
    municipality: account.property.municipality.trim().slice(0, 80),
    state: account.property.state.trim().slice(0, 2).toUpperCase(),
    description: (input.description || "").trim().slice(0, 600),
    latitude: approximateCoordinate(input.latitude),
    longitude: approximateCoordinate(input.longitude),
    status: input.status || (input.category === "animal_missing" ? "Procurando" : "Aberto"),
    priority: input.priority || "Normal",
    reportCount: 1,
    affectedCount: Math.max(1, input.affectedCount || 1),
    ongoing: input.ongoing,
    startedAt: input.startedAt,
    createdAt: now,
    updatedAt: now,
    publicVisible: input.publicVisible !== false,
    syncState: online ? "Pendente" : "Sem internet",
    mine: true,
    photoBlob: photo,
    photoName: photo?.name,
    photoType: photo?.type,
  };
  await cachePut(occurrence);
  try {
    if (await tryUploadOccurrence(occurrence)) {
      return { ...occurrence, photoBlob: undefined, photoName: undefined, photoType: undefined, syncState: "Sincronizado" };
    }
  } catch {
    // O registro local permanece disponível e será sincronizado depois.
  }
  return occurrence;
}

export async function syncPendingRuralOccurrences(account: HydraAccount) {
  const cached = await cacheAll(account.id);
  let synced = 0;
  for (const occurrence of cached) {
    if (occurrence.syncState === "Sincronizado") continue;
    try {
      if (await tryUploadOccurrence({ ...occurrence, syncState: "Pendente" })) synced += 1;
    } catch {
      await cachePut({ ...occurrence, syncState: typeof navigator !== "undefined" && !navigator.onLine ? "Sem internet" : "Pendente" });
    }
  }
  return synced;
}

export async function listRuralOccurrences(account: HydraAccount): Promise<RuralOccurrence[]> {
  const cached = await cacheAll(account.id);
  const local = cached.map(({ photoBlob: _photoBlob, photoName: _photoName, photoType: _photoType, ...item }) => item);
  if (!supabase || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return local.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const query = supabase
    .from("rural_occurrences")
    .select("id,reporter_id,protocol,category,subtype,community,region,municipality,state,description,latitude_approx,longitude_approx,photo_path,status,priority,report_count,affected_count,ongoing,started_at,public_visible,created_at,updated_at")
    .eq("public_visible", true)
    .order("updated_at", { ascending: false })
    .limit(120);

  const { data, error } = account.property.state
    ? await query.eq("state", account.property.state.toUpperCase())
    : await query;

  if (error) return local.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const remote = (data || []).map((row) => rowToOccurrence(row as Record<string, unknown>, account.id));
  const merged = new Map<string, RuralOccurrence>();
  remote.forEach((item) => merged.set(item.id, item));
  local.forEach((item) => {
    if (item.syncState !== "Sincronizado" || !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function confirmRuralOccurrence(occurrence: RuralOccurrence, userId: string) {
  if (!supabase || occurrence.syncState !== "Sincronizado" || (typeof navigator !== "undefined" && !navigator.onLine)) {
    if (!occurrence.mine) throw new Error("Conecte-se à internet para confirmar uma ocorrência da comunidade.");
    const cached = (await cacheAll(userId)).find((item) => item.id === occurrence.id);
    if (!cached) return;
    await cachePut({
      ...cached,
      reportCount: cached.reportCount + 1,
      affectedCount: cached.affectedCount + (cached.category === "water" ? 1 : 0),
      updatedAt: new Date().toISOString(),
      syncState: "Pendente",
    });
    return;
  }
  const { error } = await supabase.from("rural_occurrence_confirmations").insert({
    occurrence_id: occurrence.id,
    user_id: userId,
    confirmation_type: occurrence.category === "water" && occurrence.subtype === "Falta de água" ? "affected" : "still_active",
  });
  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) throw error;
}

export async function updateRuralOccurrenceStatus(occurrence: RuralOccurrence, status: RuralOccurrenceStatus) {
  const updatedAt = new Date().toISOString();
  if (occurrence.mine) {
    const cached = (await cacheAll(occurrence.reporterId)).find((item) => item.id === occurrence.id);
    if (cached) await cachePut({ ...cached, status, updatedAt, syncState: occurrence.syncState === "Sincronizado" ? "Pendente" : occurrence.syncState });
  }
  if (!supabase || occurrence.syncState !== "Sincronizado" || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const { error } = await supabase.from("rural_occurrences").update({
    status,
    updated_at: updatedAt,
    resolved_at: status === "Resolvido" || status === "Recuperado" ? updatedAt : null,
  }).eq("id", occurrence.id).eq("reporter_id", occurrence.reporterId);
  if (error) throw error;
}

export function findSimilarOccurrence(items: RuralOccurrence[], draft: Pick<CreateRuralOccurrenceInput, "category" | "subtype" | "community" | "latitude" | "longitude">) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const community = draft.community.trim().toLocaleLowerCase("pt-BR");
  const lat = approximateCoordinate(draft.latitude);
  const lon = approximateCoordinate(draft.longitude);
  return items.find((item) => {
    if (["Resolvido", "Recuperado"].includes(item.status)) return false;
    if (item.category !== draft.category || item.subtype !== draft.subtype) return false;
    if (new Date(item.updatedAt).getTime() < cutoff) return false;
    const sameCommunity = Boolean(community) && item.community.trim().toLocaleLowerCase("pt-BR") === community;
    const near = lat !== undefined && lon !== undefined && item.latitude !== undefined && item.longitude !== undefined
      ? Math.abs(item.latitude - lat) <= 0.03 && Math.abs(item.longitude - lon) <= 0.03
      : false;
    return sameCommunity || near;
  });
}

export function ruralOccurrenceShareText(item: RuralOccurrence) {
  const heading = item.category === "water" ? "HYDRA ÁGUA" : item.category.startsWith("animal") ? "HYDRA ANIMAL" : "HYDRA COMUNIDADE";
  const lines = [
    heading,
    "",
    `Problema: ${item.subtype}`,
    `Região: ${item.community || item.region || "Região informada"}`,
    `Relatos: ${item.reportCount}`,
    item.category === "water" ? `Pessoas afetadas: ${item.affectedCount}` : "",
    `Status: ${item.status}`,
    `Protocolo interno: ${item.protocol}`,
    "",
    "Protocolo do Hydra Agro. Não é protocolo oficial de órgão público.",
  ].filter(Boolean);
  return lines.join("\n");
}
