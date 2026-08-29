import { requireSupabase } from "./supabase";

export type HydraTagHistoryItem = {
  id: string;
  type: string;
  details: string;
  date: string;
};

export type AnimalPassportItem = {
  id: string;
  type: string;
  title: string;
  details?: string;
  date: string;
};

function id(prefix: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${suffix}`;
}

export async function setAnimalLostMode(animalId: string, lost: boolean) {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Sessão não encontrada.");

  const { data: animal, error: animalError } = await client
    .from("animals")
    .select("id,owner_user_id,property_id,name,identification,status")
    .eq("id", animalId)
    .single();
  if (animalError) throw animalError;
  if (String(animal.owner_user_id) !== userData.user.id) throw new Error("Somente o proprietário pode alterar este status.");

  const nextStatus = lost ? "Perdido" : "Ativo";
  const { error: updateError } = await client.from("animals").update({ status: nextStatus }).eq("id", animalId);
  if (updateError) throw updateError;

  const eventType = lost ? "lost_mode_enabled" : "animal_recovered";
  const details = lost ? "Animal marcado como perdido pela Hydra Tag" : "Animal marcado como encontrado pelo proprietário";
  const now = new Date().toISOString();

  const { error: eventError } = await client.from("hydra_tag_events").insert({
    id: id("tag-event"),
    owner_user_id: userData.user.id,
    animal_id: animalId,
    event_type: eventType,
    details,
    metadata: { previousStatus: animal.status, nextStatus },
    created_at: now,
  });
  if (eventError) throw eventError;

  const { error: passportError } = await client.from("animal_events").insert({
    id: id("animal-event"),
    owner_user_id: userData.user.id,
    property_id: String(animal.property_id),
    animal_id: animalId,
    event_type: lost ? "occurrence" : "recovery",
    event_date: now.slice(0, 10),
    title: lost ? "Animal marcado como perdido" : "Animal encontrado",
    details,
    metadata: { source: "hydra_tag" },
    is_demo: false,
  });
  if (passportError) throw passportError;

  if (!lost) {
    await client
      .from("animal_found_reports")
      .update({ status: "resolved", resolved_at: now })
      .eq("animal_id", animalId)
      .eq("status", "open");
  }

  return { status: nextStatus };
}

export async function loadAnimalPassport(animalId: string): Promise<AnimalPassportItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("animal_events")
    .select("id,event_type,event_date,title,details,created_at")
    .eq("animal_id", animalId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    type: String(row.event_type),
    title: String(row.title),
    details: row.details ? String(row.details) : undefined,
    date: String(row.created_at || row.event_date),
  }));
}

export async function loadHydraTagHistory(animalId: string): Promise<HydraTagHistoryItem[]> {
  const client = requireSupabase();
  const [tagsResult, eventsResult] = await Promise.all([
    client.from("nfc_tags").select("id,code,technology,linked_at,created_at,last_read_at,read_count").eq("animal_id", animalId).order("created_at", { ascending: false }),
    client.from("hydra_tag_events").select("id,event_type,details,created_at").eq("animal_id", animalId).order("created_at", { ascending: false }),
  ]);
  if (tagsResult.error) throw tagsResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const items: HydraTagHistoryItem[] = [];
  for (const tag of tagsResult.data ?? []) {
    items.push({
      id: `linked-${tag.id}`,
      type: "Vinculação",
      details: `Hydra Tag ${String(tag.code)} vinculada${tag.technology ? ` · ${String(tag.technology)}` : ""}`,
      date: String(tag.linked_at || tag.created_at),
    });
    const reads = Number(tag.read_count ?? 0);
    if (reads > 0) {
      items.push({
        id: `reads-${tag.id}`,
        type: "Leituras",
        details: `${reads} leitura${reads === 1 ? " registrada" : "s registradas"}`,
        date: String(tag.last_read_at || tag.created_at),
      });
    }
  }
  for (const event of eventsResult.data ?? []) {
    items.push({
      id: String(event.id),
      type: String(event.event_type),
      details: String(event.details || "Alteração registrada na Hydra Tag"),
      date: String(event.created_at),
    });
  }
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function loadHydraImpact() {
  const { data, error } = await requireSupabase().rpc("hydra_impact_metrics");
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    properties: Number(row.properties ?? 0),
    animals: Number(row.animals ?? 0),
    activeTags: Number(row.activeTags ?? 0),
    municipalities: Number(row.municipalities ?? 0),
    states: Number(row.states ?? 0),
  };
}
