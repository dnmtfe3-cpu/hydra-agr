import { requireSupabase } from "./supabase";

export type MissionProgress = {
  ordinal: number;
  tier: "main" | "medium" | "hard" | "complete";
  title: string;
  description: string;
  reward: number;
  current: number;
  target: number;
  xp: number;
  level: number;
  levelProgress: number;
  completedCount: number;
  totalMissions: number;
  complete: boolean;
};

export async function syncMissionProgress(): Promise<MissionProgress> {
  const { data, error } = await requireSupabase().rpc("sync_farm_mission_progress");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Não foi possível carregar a missão atual.");

  return {
    ordinal: Number(row.mission_ordinal ?? 1),
    tier: String(row.tier ?? "main") as MissionProgress["tier"],
    title: String(row.title ?? "Missão atual"),
    description: String(row.description ?? ""),
    reward: Number(row.reward ?? 0),
    current: Number(row.current_value ?? 0),
    target: Number(row.target_value ?? 0),
    xp: Number(row.xp ?? 0),
    level: Number(row.level ?? 1),
    levelProgress: Number(row.level_progress ?? 0),
    completedCount: Number(row.completed_count ?? 0),
    totalMissions: Number(row.total_missions ?? 50),
    complete: Boolean(row.complete),
  };
}
