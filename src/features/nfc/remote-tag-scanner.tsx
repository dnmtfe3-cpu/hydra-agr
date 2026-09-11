import { Camera, Fingerprint, Minus, Plus, Search, ShieldAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showAppToast } from "../../components/modal-system";
import { requireSupabase } from "../../services/supabase";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type ZoomCapabilities = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
type ZoomConstraintSet = MediaTrackConstraintSet & { zoom?: number };
type PublicLookup = {
  identification?: string;
  name?: string;
  species?: string;
  breed?: string;
  sex?: string;
  status?: string;
  propertyName?: string;
  municipality?: string;
  state?: string;
};

function parseHydraTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.searchParams.get("pa") === "1" && url.searchParams.get("i")) return url.toString();
  } catch {
    // Pode ser um código visual digitado/impresso em vez de URL.
  }
  return null;
}

function setSafeParam(url: URL, key: string, value: unknown, max: number) {
  if (typeof value !== "string") return;
  const clean = value.trim();
  if (clean) url.searchParams.set(key, clean.slice(0, max));
}

export function RemoteTagScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
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
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stopCamera(), []);

  async function scanFrame() {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
    try {
      const results = await detectorRef.current.detect(videoRef.current);
      const raw = results.map((item) => item.rawValue?.trim()).find(Boolean);
      if (raw) {
        const hydraUrl = parseHydraTag(raw);
        if (hydraUrl) {
          stopCamera();
          setOpen(false);
          window.location.assign(hydraUrl);
          return;
        }
      }
    } catch {
      // Alguns aparelhos falham enquanto o vídeo ainda estabiliza.
    }
    timerRef.current = window.setTimeout(() => void scanFrame(), 450);
  }

  async function startCamera() {
    setError("");
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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

      if (!videoRef.current) {
        stopCamera();
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (Detector) {
        detectorRef.current = new Detector({ formats: ["qr_code"] });
        scanningRef.current = true;
        void scanFrame();
      } else {
        detectorRef.current = null;
        setError("A leitura automática de QR não está disponível neste aparelho. Você ainda pode usar o zoom para enxergar o Hydra ID e digitá-lo.");
      }
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
    const code = manualCode.trim().slice(0, 40);
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
      const url = new URL(window.location.origin);
      url.searchParams.set("pa", "1");
      url.searchParams.set("i", identification.slice(0, 40));
      url.searchParams.set("s", (animal.species?.trim() || "animal").slice(0, 24));
      setSafeParam(url, "n", animal.name, 32);
      setSafeParam(url, "b", animal.breed, 28);
      setSafeParam(url, "sx", animal.sex, 16);
      setSafeParam(url, "st", animal.status, 20);
      setSafeParam(url, "pn", animal.propertyName, 40);
      setSafeParam(url, "pm", animal.municipality, 28);
      setSafeParam(url, "uf", animal.state?.toUpperCase(), 2);

      stopCamera();
      setOpen(false);
      window.location.assign(url.toString());
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
          <p>Use a opção que você consegue enxergar sem chegar perto do animal.</p>
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
            maxLength={40}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder="Ex.: HYDRA-8F2K"
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
          <div className="distance-camera-hint">Fique em local seguro e use o zoom. Não se aproxime só para enquadrar a tag.</div>
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
