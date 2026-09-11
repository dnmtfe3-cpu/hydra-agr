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

export async function loadPropertyMapData(ownerUserId: string, propertyId: string) {
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

  return { features, sightings };
}

export async function savePropertyMapFeature(feature: Omit<PropertyMapFeature, "updatedAt">) {
  const client = requireSupabase();
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

export async function deletePropertyMapFeature(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("property_map_features").delete().eq("id", id);
  if (error) throw error;
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
