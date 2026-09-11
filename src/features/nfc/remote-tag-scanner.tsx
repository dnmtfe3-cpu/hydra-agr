import { Camera, Fingerprint, Minus, Plus, Search, ShieldAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showAppToast } from "../../components/modal-system";
import { requireSupabase } from "../../services/supabase";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
type JsQrResult = { data?: string };
type JsQrDecoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
) => JsQrResult | null;

type ZoomCapabilities = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
type ZoomConstraintSet = MediaTrackConstraintSet & { zoom?: number };
type PublicLookup = {
  identification?: string;
};

const HYDRA_PUBLIC_ORIGIN = "https://www.hydraagro.sbs";
const JSQR_SCRIPT_ID = "hydra-jsqr-runtime";
const JSQR_SRC = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
let jsQrLoader: Promise<JsQrDecoder | null> | null = null;

function currentJsQr() {
  return (window as typeof window & { jsQR?: JsQrDecoder }).jsQR ?? null;
}

function loadJsQrDecoder() {
  const ready = currentJsQr();
  if (ready) return Promise.resolve(ready);
  if (jsQrLoader) return jsQrLoader;

  jsQrLoader = new Promise<JsQrDecoder | null>((resolve) => {
    const finish = () => resolve(currentJsQr());
    const existing = document.getElementById(JSQR_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      window.setTimeout(finish, 5000);
      return;
    }

    const script = document.createElement("script");
    script.id = JSQR_SCRIPT_ID;
    script.src = JSQR_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
    window.setTimeout(finish, 5000);
  });

  return jsQrLoader;
}

function parseHydraTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^[a-z0-9][a-z0-9_-]{2,79}$/i.test(trimmed)) {
    return `${HYDRA_PUBLIC_ORIGIN}/tag/${encodeURIComponent(trimmed)}`;
  }

  try {
    const url = new URL(trimmed, window.location.origin);
    const validHosts = new Set([window.location.host, "hydraagro.sbs", "www.hydraagro.sbs"]);
    if (!validHosts.has(url.host)) return null;

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts[0] === "tag" && pathParts[1]) return url.toString();
    if (url.searchParams.get("pa") === "1" && url.searchParams.get("i")) return url.toString();
  } catch {
    // Conteúdo inválido para Hydra Tag.
  }

  return null;
}

export function RemoteTagScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const jsQrRef = useRef<JsQrDecoder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");

  function stopCamera() {
    scanningRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    jsQrRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    document.body.classList.toggle("hydra-distance-scanner-open", open);
    return () => document.body.classList.remove("hydra-distance-scanner-open");
  }, [open]);

  function readWithJsQr(video: HTMLVideoElement) {
    const decoder = jsQrRef.current;
    if (!decoder || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return "";

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "";
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return decoder(image.data, width, height, { inversionAttempts: "attemptBoth" })?.data?.trim() ?? "";
  }

  async function scanFrame() {
    if (!scanningRef.current || !videoRef.current) return;

    let raw = "";

    // Alguns iPhones expõem BarcodeDetector, mas a implementação não reconhece
    // QR de forma confiável. Por isso ele é apenas a primeira tentativa.
    if (detectorRef.current) {
      try {
        const results = await detectorRef.current.detect(videoRef.current);
        raw = results.map((item) => item.rawValue?.trim()).find(Boolean) ?? "";
      } catch {
        // Continua imediatamente para o leitor por canvas/jsQR.
      }
    }

    if (!raw && jsQrRef.current) {
      try {
        raw = readWithJsQr(videoRef.current);
      } catch {
        // Um frame isolado pode falhar por foco/exposição.
      }
    }

    if (raw) {
      const hydraUrl = parseHydraTag(raw);
      if (hydraUrl) {
        stopCamera();
        setOpen(false);
        window.location.assign(hydraUrl);
        return;
      }
    }

    timerRef.current = window.setTimeout(() => void scanFrame(), 140);
  }

  async function startCamera() {
    setError("");
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

    try {
      // Carrega o leitor alternativo sempre. Isso evita o bug em aparelhos que
      // dizem suportar BarcodeDetector mas não conseguem decodificar o QR.
      void loadJsQrDecoder().then((decoder) => {
        jsQrRef.current = decoder;
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as ZoomCapabilities;
      if (capabilities.zoom) {
        const step = capabilities.zoom.step || 0.1;
        const initial = Math.min(Math.max(1, capabilities.zoom.min), capabilities.zoom.max);
        setZoom(initial);
        setZoomRange({ min: capabilities.zoom.min, max: capabilities.zoom.max, step });
      } else {
        setZoomRange(null);
      }

      // Tenta manter foco contínuo em aparelhos que oferecem essa capacidade.
      try {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      } catch {
        // Nem todo navegador expõe controle de foco.
      }

      if (!videoRef.current) {
        stopCamera();
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (Detector) {
        try {
          detectorRef.current = new Detector({ formats: ["qr_code"] });
        } catch {
          detectorRef.current = null;
        }
      }

      scanningRef.current = true;
      void scanFrame();

      window.setTimeout(() => {
        if (scanningRef.current && !detectorRef.current && !jsQrRef.current) {
          setError("O leitor automático não iniciou neste aparelho. Use o Hydra ID abaixo.");
        }
      }, 5500);
    } catch {
      stopCamera();
      setError("Não foi possível abrir a câmera. Verifique a permissão do Hydra Agro para usar a câmera.");
    }
  }

  async function applyZoom(next: number) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) return;
    const value = Math.max(zoomRange.min, Math.min(zoomRange.max, next));
    try {
      await track.applyConstraints({ advanced: [{ zoom: value } as ZoomConstraintSet] });
      setZoom(value);
    } catch {
      showAppToast("O zoom da câmera não está disponível neste aparelho.", "error");
    }
  }

  async function lookupManualCode() {
    const code = manualCode.trim().slice(0, 80);
    if (!code) {
      setLookupError("Digite o Hydra ID visível no brinco.");
      return;
    }

    setLookupBusy(true);
    setLookupError("");
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("public_animal_by_hydra_code", { p_code: code });
      if (rpcError || !data || typeof data !== "object") {
        setLookupError("Hydra ID não encontrado. Confira o código sem precisar se aproximar do animal.");
        return;
      }

      const animal = data as PublicLookup;
      const identification = animal.identification?.trim() || code;
      stopCamera();
      setOpen(false);
      window.location.assign(`/tag/${encodeURIComponent(identification)}`);
    } catch {
      setLookupError("Não foi possível consultar esse Hydra ID agora. Tente novamente sem se aproximar do animal.");
    } finally {
      setLookupBusy(false);
    }
  }

  function openCamera() {
    setManualOpen(false);
    setLookupError("");
    setOpen(true);
    window.setTimeout(() => void startCamera(), 80);
  }

  function openManualLookup() {
    stopCamera();
    setOpen(false);
    setError("");
    setLookupError("");
    setManualOpen(true);
  }

  function closeCamera() {
    stopCamera();
    setOpen(false);
    setError("");
  }

  return <>
    <section className="distance-id-card" aria-label="Identificação à distância">
      <div className="distance-id-head">
        <div className="distance-id-icon"><Camera size={20} /></div>
        <div className="distance-id-copy">
          <small>ANIMAL FORA DA PROPRIEDADE</small>
          <strong>Identificar à distância</strong>
          <p>Use a câmera ou o Hydra ID sem precisar chegar perto do animal.</p>
        </div>
      </div>

      <div className="distance-id-actions">
        <button className="distance-action distance-action-primary" onClick={openCamera}>
          <Camera size={20} />
          <span><strong>Ler QR à distância</strong><small>Câmera e zoom</small></span>
        </button>
        <button
          className={`distance-action${manualOpen ? " is-active" : ""}`}
          onClick={() => { setManualOpen((value) => !value); setLookupError(""); }}
          aria-expanded={manualOpen}
        >
          <Fingerprint size={20} />
          <span><strong>Digitar Hydra ID</strong><small>QR sujo ou coberto</small></span>
        </button>
      </div>

      {manualOpen && <div className="distance-manual-id distance-manual-inline">
        <div className="distance-manual-heading">
          <Fingerprint size={18} />
          <div><strong>Hydra ID visível no brinco</strong><span>Use o zoom do celular para ler apenas o código.</span></div>
        </div>
        <div className="distance-manual-form">
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => { if (event.key === "Enter") void lookupManualCode(); }}
            maxLength={80}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder="Ex.: HA-000024"
            aria-label="Hydra ID do animal"
          />
          <button onClick={() => void lookupManualCode()} disabled={lookupBusy}>
            <Search size={17} /> {lookupBusy ? "Buscando" : "Consultar"}
          </button>
        </div>
        {lookupError && <div className="distance-manual-error" role="alert">{lookupError}</div>}
      </div>}

      <div className="distance-id-safety">
        <ShieldAlert size={16} />
        <span>Animal agressivo ou solto na via: mantenha distância. Não tente limpar ou segurar o brinco.</span>
      </div>
    </section>

    {open && <div className="distance-scanner-layer" role="dialog" aria-modal="true" aria-label="Scanner de Hydra Tag à distância">
      <div className="distance-scanner-panel">
        <header>
          <div><small>IDENTIFICAÇÃO À DISTÂNCIA</small><strong>Ler QR da Hydra Tag</strong></div>
          <button onClick={closeCamera} aria-label="Fechar câmera"><X size={22} /></button>
        </header>

        <div className="distance-camera-wrap">
          <video ref={videoRef} className="distance-camera-video" playsInline muted />
          <div className="distance-camera-frame"><span /><span /><span /><span /></div>
          <div className="distance-camera-hint">Centralize o QR dentro do quadro. A leitura é automática.</div>
        </div>

        {zoomRange && <div className="distance-zoom-control">
          <button onClick={() => void applyZoom(zoom - zoomRange.step)} aria-label="Diminuir zoom"><Minus size={18} /></button>
          <input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoom} onChange={(event) => void applyZoom(Number(event.target.value))} />
          <button onClick={() => void applyZoom(zoom + zoomRange.step)} aria-label="Aumentar zoom"><Plus size={18} /></button>
          <span>{zoom.toFixed(1)}×</span>
        </div>}

        {error && <div className="distance-scanner-error" role="alert">{error}</div>}

        <button className="distance-camera-fallback" onClick={openManualLookup}>
          <Fingerprint size={17} /> QR sujo? Usar Hydra ID
        </button>

        <p className="distance-scanner-note">Ao reconhecer o QR, o Hydra Agro abre a ficha pública do animal sem expor telefone ou endereço do responsável.</p>
      </div>
    </div>}
  </>;
}
