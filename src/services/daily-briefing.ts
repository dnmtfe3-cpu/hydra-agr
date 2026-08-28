import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { HydraAccount } from "../lib/hydra-types";

const DAILY_ID = 6401;
export const DAILY_BRIEFING_CHANNEL_ID = "hydra-property-alerts";
const SETTINGS_KEY = "hydra.daily-briefing";
const COPY_VERSION_KEY = "hydra.daily-briefing.copy-version";
const COPY_VERSION = "2";

export type DailyBriefingSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const defaultDailyBriefingSettings: DailyBriefingSettings = {
  enabled: false,
  hour: 6,
  minute: 0,
};

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function isHealthAttention(status?: string) {
  const normalized = (status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("atenc") || normalized.includes("doent") || normalized.includes("trat") || normalized.includes("observ");
}

export function buildDailyBriefing(account: HydraAccount) {
  const today = todayIso();
  const dueToday = account.activities.filter((item) => !item.done && item.date?.slice(0, 10) === today);
  const overdue = account.activities.filter((item) => !item.done && item.date?.slice(0, 10) < today);
  const healthAttention = account.animals.filter((animal) => isHealthAttention(animal.status));
  const withoutNfc = account.animals.filter((animal) => !animal.electronicId);
  const feeding = dueToday.filter((item) => item.category.toLocaleLowerCase("pt-BR").includes("alimenta"));
  const parts: string[] = [];

  if (dueToday.length) parts.push(`${dueToday.length} tarefa${dueToday.length === 1 ? "" : "s"} para hoje`);
  if (overdue.length) parts.push(`${overdue.length} tarefa${overdue.length === 1 ? " atrasada" : "s atrasadas"}`);
  if (feeding.length) parts.push(`${feeding.length} manejo${feeding.length === 1 ? "" : "s"} de alimentação`);
  if (healthAttention.length) parts.push(`${healthAttention.length} animal${healthAttention.length === 1 ? "" : "is"} em atenção`);
  if (withoutNfc.length) parts.push(`${withoutNfc.length} animal${withoutNfc.length === 1 ? "" : "is"} sem NFC/RFID`);

  const farm = account.property.name || "Sua propriedade";
  const title = parts.length ? "O que fazer hoje" : "Tudo em dia";
  const body = parts.length
    ? `${farm} • ${parts.slice(0, 3).join(" • ")}.`
    : `${farm} • nenhuma tarefa urgente para hoje.`;

  const lines = [
    `${farm}`,
    "",
    parts.length ? "Hoje:" : "Tudo em dia por aqui.",
    ...dueToday.slice(0, 5).map((item) => `• ${item.title}`),
    ...(overdue.length ? [`• ${overdue.length} tarefa${overdue.length === 1 ? " atrasada" : "s atrasadas"}`] : []),
    ...(healthAttention.length ? [`• ${healthAttention.length} animal${healthAttention.length === 1 ? "" : "is"} em acompanhamento`] : []),
    ...(withoutNfc.length ? [`• ${withoutNfc.length} animal${withoutNfc.length === 1 ? "" : "is"} sem NFC/RFID`] : []),
    "",
    parts.length ? "Abra o Hydra Agro para ver os detalhes." : "Nenhuma tarefa urgente registrada para hoje.",
  ];

  return { title, body, text: lines.join("\n"), dueToday, overdue, healthAttention, withoutNfc };
}

export async function loadDailyBriefingSettings() {
  const stored = await Preferences.get({ key: SETTINGS_KEY });
  if (!stored.value) return defaultDailyBriefingSettings;
  try {
    return { ...defaultDailyBriefingSettings, ...JSON.parse(stored.value) } as DailyBriefingSettings;
  } catch {
    return defaultDailyBriefingSettings;
  }
}

export async function saveDailyBriefingSettings(settings: DailyBriefingSettings) {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
}

export async function scheduleDailyBriefing(account: HydraAccount, settings: DailyBriefingSettings) {
  await saveDailyBriefingSettings(settings);
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: "web" as const };

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  if (Capacitor.getPlatform() === "android") {
    await LocalNotifications.createChannel({
      id: DAILY_BRIEFING_CHANNEL_ID,
      name: "Avisos da propriedade",
      description: "Tarefas e avisos importantes da propriedade.",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
    }).catch(() => undefined);
  }

  await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] }).catch(() => undefined);
  if (!settings.enabled) return { ok: true, reason: "disabled" as const };

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return { ok: false, reason: "permission" as const };

  const briefing = buildDailyBriefing(account);
  await LocalNotifications.schedule({
    notifications: [{
      id: DAILY_ID,
      title: briefing.title,
      body: briefing.body,
      channelId: Capacitor.getPlatform() === "android" ? DAILY_BRIEFING_CHANNEL_ID : undefined,
      schedule: { on: { hour: settings.hour, minute: settings.minute }, repeats: true, allowWhileIdle: true },
      extra: { route: "today", source: "daily-briefing" },
    }],
  });

  return { ok: true, reason: "scheduled" as const };
}

export async function refreshDailyBriefingCopy(account: HydraAccount) {
  if (!Capacitor.isNativePlatform()) return;
  const version = await Preferences.get({ key: COPY_VERSION_KEY });
  if (version.value === COPY_VERSION) return;

  const settings = await loadDailyBriefingSettings();
  if (settings.enabled) {
    const result = await scheduleDailyBriefing(account, settings);
    if (!result.ok) return;
  }

  await Preferences.set({ key: COPY_VERSION_KEY, value: COPY_VERSION });
}

export async function shareDailyBriefing(account: HydraAccount) {
  const briefing = buildDailyBriefing(account);
  if (navigator.share) {
    try {
      await navigator.share({ title: briefing.title, text: briefing.text });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
    }
  }
  await navigator.clipboard?.writeText(briefing.text);
  return "copied" as const;
}
