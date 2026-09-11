import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { requireSupabase } from "./supabase";

export type MapPoint = [number, number]; // [longitude, latitude]
export type PropertyMapFeatureType = "boundary" | "sector" | "water" | "corral" | "gate" | "other";

export type PropertyMapGeometry =
  | { type: "Point"; coordinates: MapPoint }
  | { type: "Polygon"; coordinates: MapPoint[][] };

export type PropertyMapFeature = {
  id: string;
  ownerUserId: string;
  propertyId: string;
  featureType: PropertyMapFeatureType;
  name: string;
  sectorId?: string;
  geometry: PropertyMapGeometry;
  updatedAt: string;
};

export type AnimalSighting = {
  id: string;
  animalId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  source: "public_tag" | "qr" | "nfc" | "manual" | "gps";
  seenAt: string;
};

type FeatureRow = {
  id: string;
  owner_user_id: string;
  property_id: string;
  feature_type: PropertyMapFeatureType;
  name: string | null;
  sector_id: string | null;
  geometry: PropertyMapGeometry;
  updated_at: string;
};

type SightingRow = {
  id: string;
  animal_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  source: AnimalSighting["source"];
  seen_at: string;
};

type CachedMapData = {
  features: PropertyMapFeature[];
  sightings: AnimalSighting[];
  savedAt: string;
};

type MapMutation = {
  id: string;
  action: "upsert" | "delete";
  ownerUserId: string;
  propertyId: string;
  featureId: string;
  feature?: Omit<PropertyMapFeature, "updatedAt">;
  createdAt: string;
};

function mapCacheKey(ownerUserId: string, propertyId: string) {
  return `hydra.map.cache.${ownerUserId}.${propertyId}`;
}

function mapQueueKey(ownerUserId: string, propertyId: string) {
  return `hydra.map.queue.${ownerUserId}.${propertyId}`;
}

function mapFeatureIndexKey(featureId: string) {
  return `hydra.map.feature-index.${featureId}`;
}

async function readMapCache(ownerUserId: string, propertyId: string): Promise<CachedMapData | null> {
  try {
    const { value } = await Preferences.get({ key: mapCacheKey(ownerUserId, propertyId) });
    return value ? JSON.parse(value) as CachedMapData : null;
  } catch {
    return null;
  }
}

async function writeMapCache(ownerUserId: string, propertyId: string, data: Omit<CachedMapData, "savedAt">) {
  const cached: CachedMapData = { ...data, savedAt: new Date().toISOString() };
  await Preferences.set({ key: mapCacheKey(ownerUserId, propertyId), value: JSON.stringify(cached) });
  await Promise.all(data.features.map((feature) => Preferences.set({
    key: mapFeatureIndexKey(feature.id),
    value: JSON.stringify({ ownerUserId, propertyId }),
  })));
}

async function readMapQueue(ownerUserId: string, propertyId: string): Promise<MapMutation[]> {
  try {
    const { value } = await Preferences.get({ key: mapQueueKey(ownerUserId, propertyId) });
    return value ? JSON.parse(value) as MapMutation[] : [];
  } catch {
    return [];
  }
}

async function writeMapQueue(ownerUserId: string, propertyId: string, queue: MapMutation[]) {
  if (queue.length === 0) {
    await Preferences.remove({ key: mapQueueKey(ownerUserId, propertyId) });
    return;
  }
  await Preferences.set({ key: mapQueueKey(ownerUserId, propertyId), value: JSON.stringify(queue.slice(-80)) });
}

async function enqueueMapMutation(mutation: MapMutation) {
  const queue = await readMapQueue(mutation.ownerUserId, mutation.propertyId);
  const withoutSameFeature = queue.filter((item) => item.featureId !== mutation.featureId);
  await writeMapQueue(mutation.ownerUserId, mutation.propertyId, [...withoutSameFeature, mutation]);
}

async function connected() {
  try {
    return (await Network.getStatus()).connected;
  } catch {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  }
}

async function executeMapMutation(mutation: MapMutation) {
  const client = requireSupabase();
  if (mutation.action === "delete") {
    const { error } = await client.from("property_map_features").delete().eq("id", mutation.featureId);
    if (error) throw error;
    return;
  }
  if (!mutation.feature) return;
  const feature = mutation.feature;
  const { error } = await client.from("property_map_features").upsert({
    id: feature.id,
    owner_user_id: feature.ownerUserId,
    property_id: feature.propertyId,
    feature_type: feature.featureType,
    name: feature.name,
    sector_id: feature.sectorId ?? null,
    geometry: feature.geometry,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw error;
}

export async function flushPropertyMapQueue(ownerUserId: string, propertyId: string) {
  if (!await connected()) return false;
  let queue = await readMapQueue(ownerUserId, propertyId);
  while (queue.length > 0) {
    await executeMapMutation(queue[0]);
    queue = queue.slice(1);
    await writeMapQueue(ownerUserId, propertyId, queue);
  }
  return true;
}

export async function loadPropertyMapData(ownerUserId: string, propertyId: string) {
  const cached = await readMapCache(ownerUserId, propertyId);
  try {
    await flushPropertyMapQueue(ownerUserId, propertyId);
    const client = requireSupabase();
    const [featuresResult, sightingsResult] = await Promise.all([
      client
        .from("property_map_features")
        .select("id,owner_user_id,property_id,feature_type,name,sector_id,geometry,updated_at")
        .eq("owner_user_id", ownerUserId)
        .eq("property_id", propertyId)
        .order("created_at"),
      client
        .from("animal_sightings")
        .select("id,animal_id,latitude,longitude,accuracy_m,source,seen_at")
        .eq("owner_user_id", ownerUserId)
        .eq("property_id", propertyId)
        .order("seen_at", { ascending: false })
        .limit(120),
    ]);

    if (featuresResult.error) throw featuresResult.error;
    if (sightingsResult.error) throw sightingsResult.error;

    const features = ((featuresResult.data ?? []) as FeatureRow[]).map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      propertyId: row.property_id,
      featureType: row.feature_type,
      name: row.name ?? "",
      sectorId: row.sector_id ?? undefined,
      geometry: row.geometry,
      updatedAt: row.updated_at,
    })) satisfies PropertyMapFeature[];

    const sightings = ((sightingsResult.data ?? []) as SightingRow[]).map((row) => ({
      id: row.id,
      animalId: row.animal_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracyM: row.accuracy_m === null ? undefined : Number(row.accuracy_m),
      source: row.source,
      seenAt: row.seen_at,
    })) satisfies AnimalSighting[];

    await writeMapCache(ownerUserId, propertyId, { features, sightings });
    return { features, sightings };
  } catch (error) {
    if (cached) return { features: cached.features, sightings: cached.sightings };
    throw error;
  }
}

export async function savePropertyMapFeature(feature: Omit<PropertyMapFeature, "updatedAt">) {
  const optimistic: PropertyMapFeature = { ...feature, updatedAt: new Date().toISOString() };
  const cached = await readMapCache(feature.ownerUserId, feature.propertyId);
  const currentFeatures = cached?.features ?? [];
  const nextFeatures = [...currentFeatures.filter((item) => item.id !== feature.id), optimistic];
  await writeMapCache(feature.ownerUserId, feature.propertyId, { features: nextFeatures, sightings: cached?.sightings ?? [] });
  await Preferences.set({
    key: mapFeatureIndexKey(feature.id),
    value: JSON.stringify({ ownerUserId: feature.ownerUserId, propertyId: feature.propertyId }),
  });
  await enqueueMapMutation({
    id: `map-upsert-${feature.id}-${Date.now()}`,
    action: "upsert",
    ownerUserId: feature.ownerUserId,
    propertyId: feature.propertyId,
    featureId: feature.id,
    feature,
    createdAt: new Date().toISOString(),
  });
  if (!await connected()) return;
  try { await flushPropertyMapQueue(feature.ownerUserId, feature.propertyId); } catch { /* permanece salvo localmente para nova tentativa */ }
}

export async function deletePropertyMapFeature(id: string) {
  let index: { ownerUserId: string; propertyId: string } | null = null;
  try {
    const { value } = await Preferences.get({ key: mapFeatureIndexKey(id) });
    if (value) index = JSON.parse(value) as { ownerUserId: string; propertyId: string };
  } catch {
    index = null;
  }

  if (!index) {
    const { error } = await requireSupabase().from("property_map_features").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const cached = await readMapCache(index.ownerUserId, index.propertyId);
  if (cached) {
    await writeMapCache(index.ownerUserId, index.propertyId, {
      features: cached.features.filter((item) => item.id !== id),
      sightings: cached.sightings,
    });
  }
  await enqueueMapMutation({
    id: `map-delete-${id}-${Date.now()}`,
    action: "delete",
    ownerUserId: index.ownerUserId,
    propertyId: index.propertyId,
    featureId: id,
    createdAt: new Date().toISOString(),
  });
  await Preferences.remove({ key: mapFeatureIndexKey(id) });
  if (!await connected()) return;
  try { await flushPropertyMapQueue(index.ownerUserId, index.propertyId); } catch { /* permanece na fila */ }
}

export async function recordPublicAnimalSighting(input: {
  hydraCode: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  source?: "public_tag" | "qr" | "nfc" | "manual";
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("record_public_animal_sighting", {
    p_code: input.hydraCode,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: input.accuracyM ?? null,
    p_source: input.source ?? "public_tag",
  });
  if (error) throw error;
  return data as { ok?: boolean; saved?: boolean; reason?: string } | null;
}
