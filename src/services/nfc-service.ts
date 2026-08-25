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
  const { supported } = await CapacitorNfc.isSupported();
  if (!supported) return "unsupported";
  const { status } = await CapacitorNfc.getStatus();
  return status === "NFC_OK" ? "ready" : status === "NFC_DISABLED" ? "disabled" : "unsupported";
}

export async function openNfcSettings() {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorNfc.showSettings();
}

function tagCode(event: NfcEvent) {
  const bytes = event.tag.id ?? [];
  if (bytes.length > 0) {
    return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  const payload = event.tag.ndefMessage?.[0]?.payload ?? [];
  if (payload.length > 0) {
    const decoded = new TextDecoder().decode(new Uint8Array(payload)).replace(/^\x02[a-z]{2}/i, "").trim();
    if (decoded) return decoded;
  }
  return "";
}

function webTagCode(event: WebNfcReadingEvent) {
  const serial = event.serialNumber?.replace(/:/g, "").trim();
  if (serial) return serial.toUpperCase();
  for (const record of event.message?.records ?? []) {
    if (!record.data) continue;
    const decoded = new TextDecoder().decode(record.data).trim();
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

export async function readNfcTag(timeoutMs = 30_000): Promise<string> {
  if (!Capacitor.isNativePlatform()) return readWebNfcTag(timeoutMs);

  const availability = await getNfcAvailability();
  if (availability !== "ready") {
    const error = new Error(availability);
    error.name = "NfcUnavailable";
    throw error;
  }

  return new Promise<string>(async (resolve, reject) => {
    let finished = false;
    let timer: number | undefined;
    const listener = await CapacitorNfc.addListener("nfcEvent", async (event) => {
      if (finished) return;
      const code = tagCode(event);
      if (!code) return;
      finished = true;
      if (timer) window.clearTimeout(timer);
      await listener.remove();
      await CapacitorNfc.stopScanning().catch(() => undefined);
      await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
      resolve(code);
    });

    timer = window.setTimeout(async () => {
      if (finished) return;
      finished = true;
      await listener.remove();
      await CapacitorNfc.stopScanning().catch(() => undefined);
      reject(new Error("Tempo de leitura esgotado."));
    }, timeoutMs);

    try {
      await CapacitorNfc.startScanning({
        invalidateAfterFirstRead: true,
        alertMessage: "Aproxime o brinco eletrônico ou tag do aparelho.",
        iosSessionType: "tag",
      });
    } catch (error) {
      finished = true;
      if (timer) window.clearTimeout(timer);
      await listener.remove();
      reject(error);
    }
  });
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

    const cleanup = async () => {
      if (timer) window.clearTimeout(timer);
      await listener?.remove().catch(() => undefined);
      await CapacitorNfc.stopScanning().catch(() => undefined);
    };

    const fail = async (error: unknown) => {
      if (finished) return;
      finished = true;
      await cleanup();
      reject(error instanceof Error ? error : new Error("Não foi possível gravar a etiqueta NFC."));
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

      timer = window.setTimeout(() => {
        void fail(new Error("Tempo de gravação esgotado. Aproxime a etiqueta novamente."));
      }, timeoutMs);

      await CapacitorNfc.startScanning({
        invalidateAfterFirstRead: false,
        alertMessage: "Aproxime a etiqueta para gravar o Hydra ID.",
        iosSessionType: "tag",
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
