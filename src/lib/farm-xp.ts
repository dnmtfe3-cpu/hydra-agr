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

export function farmExperience(account: HydraAccount) {
  if (account.role === "owner") {
    return { xp: MAX_FARM_XP, level: MAX_FARM_LEVEL, progress: 100, lifetimeVip: true };
  }

  const identified = account.animals.filter((animal) => Boolean(animal.electronicId)).length;
  const completedActivities = account.activities.filter((activity) => activity.done).length;
  const waterDays = new Set(account.waterRecords.map((record) => record.date)).size;
  const propertyComplete = Boolean(account.property.name && account.property.municipality && account.property.mainActivity);
  const sectors = account.sectors.length;
  const nfcReads = account.nfcReadCount ?? 0;
  const missions = farmMissions(account);

  const baseXp =
    (propertyComplete ? 250 : 0)
    + Math.min(account.animals.length, 10) * 50
    + Math.min(identified, 10) * 100
    + Math.min(waterDays, 7) * 50
    + Math.min(completedActivities, 10) * 50
    + Math.min(account.monitoring.length, 10) * 75
    + Math.min(sectors, 3) * 100
    + Math.min(nfcReads, 35) * 10;

  const missionXp = missions.filter((mission) => mission.completed).reduce((total, mission) => total + mission.reward, 0);
  const xp = Math.min(MAX_FARM_XP, baseXp + missionXp);
  const level = Math.min(MAX_FARM_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1);
  const levelStart = (level - 1) * XP_PER_LEVEL;
  const progress = level >= MAX_FARM_LEVEL ? 100 : Math.min(100, Math.round(((xp - levelStart) / XP_PER_LEVEL) * 100));

  return { xp, level, progress, lifetimeVip: xp >= MAX_FARM_XP };
}
