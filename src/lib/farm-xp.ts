import type { HydraAccount } from "./hydra-types";

export const MAX_FARM_LEVEL = 10;
export const MAX_FARM_XP = 5000;
export const XP_PER_LEVEL = 500;

export type FarmMissionTier = "main" | "medium" | "hard";

export type FarmMission = {
  id: string;
  tier: FarmMissionTier;
  title: string;
  description: string;
  reward: number;
  current: number;
  target: number;
  completed: boolean;
};

function mission(
  id: string,
  tier: FarmMissionTier,
  title: string,
  description: string,
  current: number,
  target: number,
  reward: number,
): FarmMission {
  return {
    id,
    tier,
    title,
    description,
    reward,
    current: Math.min(current, target),
    target,
    completed: current >= target,
  };
}

export function farmMissions(account: HydraAccount): FarmMission[] {
  const animalCount = account.animals.length;
  const identified = account.animals.filter((animal) => Boolean(animal.electronicId)).length;
  const completedActivities = account.activities.filter((activity) => activity.done).length;
  const monitoring = account.monitoring.length;
  const waterDays = new Set(account.waterRecords.map((record) => record.date)).size;
  const nfcReads = account.nfcReadCount ?? 0;
  const propertyComplete = Boolean(account.property.name && account.property.municipality && account.property.mainActivity);

  const missions: FarmMission[] = [
    mission("main-property", "main", "Propriedade pronta", "Complete nome, município e atividade principal.", propertyComplete ? 1 : 0, 1, 40),
    mission("main-animal", "main", "Primeiro animal", "Cadastre o primeiro animal do rebanho.", animalCount, 1, 40),
    mission("main-identification", "main", "Primeira identificação", "Vincule NFC/RFID ao primeiro animal.", identified, 1, 40),
    mission("main-activity", "main", "Primeira atividade", "Conclua uma atividade da propriedade.", completedActivities, 1, 40),
    mission("main-water", "main", "Primeiro registro de água", "Registre o primeiro dia de controle de água.", waterDays, 1, 40),
  ];

  const mediumSets: Array<[string, string, number, number[]]> = [
    ["Rebanho em crescimento", "Cadastre animais no rebanho.", animalCount, [3, 5, 10]],
    ["Rebanho identificado", "Aumente os animais com NFC/RFID.", identified, [3, 5, 8]],
    ["Rotina organizada", "Conclua atividades da propriedade.", completedActivities, [3, 5, 10]],
    ["Monitoramento ativo", "Faça monitoramentos na fazenda.", monitoring, [1, 3, 5]],
    ["Água acompanhada", "Registre dias diferentes de controle de água.", waterDays, [3, 5, 7]],
  ];

  mediumSets.forEach(([title, description, current, targets], group) => {
    targets.forEach((target, index) => {
      missions.push(mission(`medium-${group}-${index}`, "medium", title, `${description} Meta: ${target}.`, current, target, 100));
    });
  });

  const hardSets: Array<[string, string, number, number[]]> = [
    ["Rebanho avançado", "Amplie o rebanho cadastrado.", animalCount, [15, 20, 30, 40, 50]],
    ["Identificação avançada", "Identifique mais animais com NFC/RFID.", identified, [10, 15, 20, 30, 40]],
    ["Rotina avançada", "Conclua mais atividades na propriedade.", completedActivities, [15, 25, 40, 60, 100]],
    ["Monitoramento avançado", "Aumente a frequência de monitoramentos.", monitoring, [10, 20, 30, 50, 75]],
    ["Água avançada", "Mantenha o acompanhamento de água por mais dias.", waterDays, [10, 20, 30, 60, 90]],
    ["NFC em campo", "Realize leituras NFC/RFID na rotina.", nfcReads, [10, 25, 50, 100, 200]],
  ];

  hardSets.forEach(([title, description, current, targets], group) => {
    targets.forEach((target, index) => {
      missions.push(mission(`hard-${group}-${index}`, "hard", title, `${description} Meta: ${target}.`, current, target, 110));
    });
  });

  return missions;
}

export function farmExperience(account: HydraAccount) {
  const missions = farmMissions(account);
  const xp = Math.min(MAX_FARM_XP, missions.filter((item) => item.completed).reduce((total, item) => total + item.reward, 0));
  const level = xp >= MAX_FARM_XP ? MAX_FARM_LEVEL : Math.min(MAX_FARM_LEVEL - 1, Math.floor(xp / XP_PER_LEVEL) + 1);
  const levelStart = (level - 1) * XP_PER_LEVEL;
  const progress = level >= MAX_FARM_LEVEL ? 100 : Math.max(0, Math.min(100, Math.round(((xp - levelStart) / XP_PER_LEVEL) * 100)));

  return { xp, level, progress, lifetimeVip: xp >= MAX_FARM_XP };
}
