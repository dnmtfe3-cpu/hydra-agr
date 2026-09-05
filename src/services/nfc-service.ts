import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { CapacitorNfc, type NfcEvent, type NdefRecord } from "@capgo/capacitor-nfc";

export type NfcAvailability = "ready" | "disabled" | "unsupported" | "web";

type WebNfcRecord = {
  recordType?: string;
  data?: DataView;
};

type WebNfcReadingEvent = Event & {
  serialNumber?: string;
  message?: { records?: WebNfcRecord[] };
};

type WebNfcReader = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  write: (message: string | { records: Array<{ recordType: string; data: string }> }) => Promise<void>;
  onreading: ((event: WebNfcReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
};

type WebNfcWindow = Window & typeof globalThis & {
  NDEFReader?: new () => WebNfcReader;
};

let webAbortController: AbortController | null = null;

export function isWebNfcSupported() {
  if (typeof window === "undefined") return false;
  return Boolean((window as WebNfcWindow).NDEFReader && window.isSecureContext);
}

export function canWriteNfcUrl() {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() || isWebNfcSupported();
}

export async function getNfcAvailability(): Promise<NfcAvailability> {
  if (!Capacitor.isNativePlatform()) return isWebNfcSupported() ? "ready" : "web";
  try {
    const { supported } = await CapacitorNfc.isSupported();
    if (!supported) return "unsupported";
    const { status } = await CapacitorNfc.getStatus();
    return status === "NFC_OK" ? "ready" : status === "NFC_DISABLED" ? "disabled" : "unsupported";
  } catch {
    return "unsupported";
  }
}

export async function openNfcSettings() {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorNfc.showSettings().catch(() => undefined);
}

const URI_PREFIXES: Record<number, string> = {
  0x00: "",
  0x01: "http://www.",
  0x02: "https://www.",
  0x03: "http://",
  0x04: "https://",
  0x05: "tel:",
  0x06: "mailto:",
};

function decodeNdefRecord(record: NdefRecord | undefined) {
  if (!record?.payload?.length) return "";
  const payload = Uint8Array.from(record.payload);
  const type = String.fromCharCode(...(record.type ?? []));

  if (type === "U" && payload.length > 1) {
    const prefix = URI_PREFIXES[payload[0]] ?? "";
    return `${prefix}${new TextDecoder().decode(payload.slice(1))}`.trim();
  }

  if (type === "T" && payload.length > 1) {
    const languageLength = payload[0] & 0x3f;
    return new TextDecoder().decode(payload.slice(1 + languageLength)).trim();
  }

  return new TextDecoder().decode(payload).replace(/^\x00+/, "").replace(/^\x02[a-z]{2}/i, "").trim();
}

function normalizeTagValue(value: string) {
  const clean = value.trim();
  if (!clean) return "";

  // Tags gravadas pelo Hydra usam URL. Quando só o NDEF está disponível no iOS,
  // preservamos o identificador final para localizar o mesmo animal.
  try {
    const url = new URL(clean);
    const fromQuery = url.searchParams.get("nfc") || url.searchParams.get("tag") || url.searchParams.get("id");
    if (fromQuery) return fromQuery.trim();
    const lastPath = url.pathname.split("/").filter(Boolean).at(-1);
    if (lastPath) return decodeURIComponent(lastPath).trim();
  } catch {
    // Não é URL: usa o valor como veio da etiqueta.
  }

  return clean;
}

function tagCode(event: NfcEvent) {
  const bytes = event.tag.id ?? [];
  if (bytes.length > 0) {
    return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  for (const record of event.tag.ndefMessage ?? []) {
    const decoded = normalizeTagValue(decodeNdefRecord(record));
    if (decoded) return decoded;
  }
  return "";
}

function webTagCode(event: WebNfcReadingEvent) {
  const serial = event.serialNumber?.replace(/:/g, "").trim();
  if (serial) return serial.toUpperCase();
  for (const record of event.message?.records ?? []) {
    if (!record.data) continue;
    const decoded = normalizeTagValue(new TextDecoder().decode(record.data).trim());
    if (decoded) return decoded;
  }
  return "";
}

async function readWebNfcTag(timeoutMs: number) {
  const Reader = (window as WebNfcWindow).NDEFReader;
  if (!Reader || !window.isSecureContext) throw new Error("Web NFC indisponível neste navegador.");

  webAbortController?.abort();
  const controller = new AbortController();
  webAbortController = controller;
  const reader = new Reader();

  return new Promise<string>(async (resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      if (webAbortController === controller) webAbortController = null;
      controller.abort();
      callback();
    };
    const timer = window.setTimeout(() => finish(() => reject(new Error("Tempo de leitura esgotado."))), timeoutMs);

    reader.onreadingerror = () => finish(() => reject(new Error("Não foi possível ler esta etiqueta NFC.")));
    reader.onreading = (event) => {
      const code = webTagCode(event);
      if (!code) return;
      finish(() => resolve(code));
    };

    try {
      await reader.scan({ signal: controller.signal });
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error("Não foi possível iniciar a leitura NFC.")));
    }
  });
}

function friendlyNfcError(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  if (/cancel|userCancelled/i.test(raw)) return new Error("Leitura NFC cancelada.");
  if (/timeout|sessionTimeout/i.test(raw)) return new Error("Tempo de leitura esgotado. Tente novamente aproximando a tag da parte superior do iPhone.");
  if (/entitlement|security|unsupportedFeature|NO_NFC/i.test(raw)) {
    return new Error("O iPhone não liberou a sessão NFC para esta assinatura. Reassine o app com um perfil que permita NFC e tente novamente.");
  }
  return error instanceof Error ? error : new Error("Não foi possível iniciar a leitura NFC.");
}

async function readNativeSession(timeoutMs: number, iosSessionType: "tag" | "ndef") {
  return new Promise<string>(async (resolve, reject) => {
    let finished = false;
    let timer: number | undefined;
    let listener: { remove: () => Promise<void> } | undefined;
    let sessionEndListener: { remove: () => Promise<void> } | undefined;

    const cleanup = async () => {
      if (timer) window.clearTimeout(timer);
      await listener?.remove().catch(() => undefined);
      await sessionEndListener?.remove().catch(() => undefined);
      await CapacitorNfc.stopScanning().catch(() => undefined);
    };

    const finishError = async (error: unknown) => {
      if (finished) return;
      finished = true;
      await cleanup();
      reject(friendlyNfcError(error));
    };

    try {
      listener = await CapacitorNfc.addListener("nfcEvent", async (event) => {
        if (finished) return;
        const code = tagCode(event);
        if (!code) return;
        finished = true;
        await cleanup();
        await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
        resolve(code);
      });

      sessionEndListener = await CapacitorNfc.addListener("nfcSessionEnd", (event) => {
        if (!finished) void finishError(new Error(event.reason));
      });

      timer = window.setTimeout(() => {
        void finishError(new Error("sessionTimeout"));
      }, timeoutMs);

      await CapacitorNfc.startScanning({
        invalidateAfterFirstRead: true,
        alertMessage: iosSessionType === "tag"
          ? "Aproxime a parte superior do iPhone da tag ou brinco eletrônico."
          : "Aproxime a parte superior do iPhone da etiqueta NFC.",
        iosSessionType,
        ...(iosSessionType === "tag" ? { iosPollingOptions: ["iso14443", "iso15693"] as const } : {}),
      });
    } catch (error) {
      await finishError(error);
    }
  });
}

export async function readNfcTag(timeoutMs = 30_000): Promise<string> {
  if (!Capacitor.isNativePlatform()) return readWebNfcTag(timeoutMs);

  const availability = await getNfcAvailability();
  if (availability !== "ready") {
    const error = new Error(availability);
    error.name = "NfcUnavailable";
    throw error;
  }

  await CapacitorNfc.stopScanning().catch(() => undefined);

  if (Capacitor.getPlatform() === "ios") {
    try {
      // TAG lê UID e também NDEF; é o modo preferido para manter o mesmo código do Android.
      return await readNativeSession(timeoutMs, "tag");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Se a assinatura/perfil não aceitar TAG, tenta NDEF para etiquetas já gravadas.
      if (/assinatura|sessão NFC|entitlement|security|NO_NFC/i.test(message)) {
        await CapacitorNfc.stopScanning().catch(() => undefined);
        return readNativeSession(timeoutMs, "ndef");
      }
      throw error;
    }
  }

  return readNativeSession(timeoutMs, "tag");
}

function urlNdefRecord(url: string): NdefRecord {
  const bytes = Array.from(new TextEncoder().encode(url));
  return {
    tnf: 0x01,
    type: [0x55],
    id: [],
    // 0x00 = URI sem abreviação. Assim qualquer URL HTTPS válida é preservada.
    payload: [0x00, ...bytes],
  };
}

async function writeNativeNfcUrl(url: string, timeoutMs: number) {
  const availability = await getNfcAvailability();
  if (availability !== "ready") {
    if (availability === "disabled") throw new Error("Ative o NFC do celular para gravar a etiqueta.");
    throw new Error("Este aparelho não oferece gravação NFC compatível.");
  }

  const record = urlNdefRecord(url);

  return new Promise<string>(async (resolve, reject) => {
    let finished = false;
    let writing = false;
    let timer: number | undefined;
    let listener: { remove: () => Promise<void> } | undefined;
    let sessionEndListener: { remove: () => Promise<void> } | undefined;

    const cleanup = async () => {
      if (timer) window.clearTimeout(timer);
      await listener?.remove().catch(() => undefined);
      await sessionEndListener?.remove().catch(() => undefined);
      await CapacitorNfc.stopScanning().catch(() => undefined);
    };

    const fail = async (error: unknown) => {
      if (finished) return;
      finished = true;
      await cleanup();
      reject(friendlyNfcError(error));
    };

    try {
      listener = await CapacitorNfc.addListener("nfcEvent", async (event) => {
        if (finished || writing) return;
        const code = tagCode(event);
        if (!code) return;
        writing = true;

        try {
          if (event.tag.isWritable === false) throw new Error("Esta etiqueta NFC está protegida contra gravação.");

          const estimatedBytes = record.payload.length + record.type.length + 8;
          if (event.tag.maxSize && estimatedBytes > event.tag.maxSize) {
            throw new Error("O link é maior que a memória disponível nesta etiqueta NFC.");
          }

          await CapacitorNfc.write({ records: [record], allowFormat: true });
          finished = true;
          await cleanup();
          await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
          resolve(code);
        } catch (error) {
          writing = false;
          await fail(error);
        }
      });

      sessionEndListener = await CapacitorNfc.addListener("nfcSessionEnd", (event) => {
        if (!finished) void fail(new Error(event.reason));
      });

      timer = window.setTimeout(() => {
        void fail(new Error("Tempo de gravação esgotado. Aproxime a etiqueta novamente."));
      }, timeoutMs);

      await CapacitorNfc.startScanning({
        invalidateAfterFirstRead: false,
        alertMessage: Capacitor.getPlatform() === "ios"
          ? "Aproxime a parte superior do iPhone da etiqueta para gravar o Hydra ID."
          : "Aproxime a etiqueta para gravar o Hydra ID.",
        iosSessionType: "tag",
        iosPollingOptions: ["iso14443", "iso15693"],
      });
    } catch (error) {
      await fail(error);
    }
  });
}

export async function writeWebNfcUrl(url: string) {
  const Reader = typeof window !== "undefined" ? (window as WebNfcWindow).NDEFReader : undefined;
  if (!Reader || !window.isSecureContext) throw new Error("A gravação Web NFC precisa de Android com Chrome compatível e HTTPS.");
  const reader = new Reader();
  await reader.write({ records: [{ recordType: "url", data: url }] });
}

export async function writeNfcUrl(url: string, timeoutMs = 30_000) {
  if (!Capacitor.isNativePlatform()) {
    await writeWebNfcUrl(url);
    return undefined;
  }
  return writeNativeNfcUrl(url, timeoutMs);
}

export async function stopNfcRead() {
  webAbortController?.abort();
  webAbortController = null;
  if (Capacitor.isNativePlatform()) await CapacitorNfc.stopScanning().catch(() => undefined);
}
