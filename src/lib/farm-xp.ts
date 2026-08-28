import type { HydraAccount } from "./hydra-types";

export const MAX_FARM_LEVEL = 10;
export const MAX_FARM_XP = 5000;
export const XP_PER_LEVEL = 500;

export type FarmMission = {
  id: string;
  title: string;
  description: string;
  reward: number;
  current: number;
  target: number;
  completed: boolean;
};

export function farmMissions(account: HydraAccount): FarmMission[] {
  const identified = account.animals.filter((animal) => Boolean(animal.electronicId)).length;
  const completedActivities = account.activities.filter((activity) => activity.done).length;
  const waterDays = new Set(account.waterRecords.map((record) => record.date)).size;
  const propertyComplete = Boolean(account.property.name && account.property.municipality && account.property.mainActivity);

  return [
    { id: "property", title: "Propriedade pronta", description: "Complete os dados principais da fazenda.", reward: 200, current: propertyComplete ? 1 : 0, target: 1, completed: propertyComplete },
    { id: "identified-herd", title: "Rebanho conectado", description: "Vincule NFC/RFID em 5 animais.", reward: 200, current: Math.min(identified, 5), target: 5, completed: identified >= 5 },
    { id: "routine", title: "Rotina em dia", description: "Conclua 10 atividades da propriedade.", reward: 200, current: Math.min(completedActivities, 10), target: 10, completed: completedActivities >= 10 },
    { id: "monitoring", title: "Olho na fazenda", description: "Faça 5 monitoramentos.", reward: 200, current: Math.min(account.monitoring.length, 5), target: 5, completed: account.monitoring.length >= 5 },
    { id: "water", title: "Água sob controle", description: "Registre água em 7 dias diferentes.", reward: 200, current: Math.min(waterDays, 7), target: 7, completed: waterDays >= 7 },
  ];
}

export function farmExperience(_account: HydraAccount) {
  return { xp: 0, level: 1, progress: 0, lifetimeVip: false };
}
