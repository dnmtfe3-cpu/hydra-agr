import type { HydraAccount } from "../lib/hydra-types";

export type HydraInsightPriority = "critical" | "attention" | "info";

export type HydraInsight = {
  id: string;
  category: "animals" | "activities" | "climate" | "property" | "hydra_tag" | "system";
  priority: HydraInsightPriority;
  title: string;
  detail: string;
};

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / 86_400_000);
}

function lastWeightDate(account: HydraAccount, animalId: string) {
  const animal = account.animals.find((item) => item.id === animalId);
  const weights = (animal?.history ?? [])
    .filter((item) => typeof item.weight === "number")
    .map((item) => item.date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return weights[0];
}

export function buildHydraInsights(account: HydraAccount): HydraInsight[] {
  const today = new Date().toISOString().slice(0, 10);
  const insights: HydraInsight[] = [];

  const overdue = account.activities.filter((item) => !item.done && item.date?.slice(0, 10) < today);
  if (overdue.length) insights.push({
    id: "activities-overdue",
    category: "activities",
    priority: overdue.length >= 3 ? "critical" : "attention",
    title: `${overdue.length} atividade${overdue.length === 1 ? " está" : "s estão"} atrasada${overdue.length === 1 ? "" : "s"}.`,
    detail: "Revise as tarefas pendentes da propriedade.",
  });

  const staleWeight = account.animals.filter((animal) => daysSince(lastWeightDate(account, animal.id)) > 60);
  if (staleWeight.length) insights.push({
    id: "animals-stale-weight",
    category: "animals",
    priority: "attention",
    title: `${staleWeight.length} animal${staleWeight.length === 1 ? " está" : "is estão"} sem pesagem recente.`,
    detail: "A estimativa usa os registros de pesagem disponíveis no Hydra Agro.",
  });

  const attentionAnimals = account.animals.filter((animal) => {
    const text = `${animal.status} ${animal.notes ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.includes("atenc") || text.includes("observ") || text.includes("trat") || text.includes("doent");
  });
  if (attentionAnimals.length) insights.push({
    id: "animals-attention",
    category: "animals",
    priority: "attention",
    title: `${attentionAnimals.length} registro${attentionAnimals.length === 1 ? " precisa" : "s precisam"} de atenção.`,
    detail: "O Hydra Agro apenas destaca registros existentes; isso não substitui avaliação veterinária.",
  });

  const withoutTag = account.animals.filter((animal) => !animal.electronicId);
  if (withoutTag.length) insights.push({
    id: "hydra-tag-missing",
    category: "hydra_tag",
    priority: "info",
    title: `${withoutTag.length} animal${withoutTag.length === 1 ? " está" : "is estão"} sem Hydra Tag vinculada.`,
    detail: "A identificação eletrônica pode facilitar a localização da ficha do animal.",
  });

  const lost = account.animals.filter((animal) => animal.status.toLocaleLowerCase("pt-BR") === "perdido");
  if (lost.length) insights.unshift({
    id: "animals-lost",
    category: "hydra_tag",
    priority: "critical",
    title: `${lost.length} animal${lost.length === 1 ? " está" : "is estão"} marcado${lost.length === 1 ? "" : "s"} como perdido${lost.length === 1 ? "" : "s"}.`,
    detail: "A ficha pública da Hydra Tag mostra o alerta e permite enviar aviso ao proprietário.",
  });

  if (!account.property.name || !account.property.municipality || !account.property.state) insights.push({
    id: "property-incomplete",
    category: "property",
    priority: "attention",
    title: "Existem dados essenciais da propriedade incompletos.",
    detail: "Confira nome, município e UF para manter clima, comunidade e relatórios corretos.",
  });

  return insights.slice(0, 8);
}
