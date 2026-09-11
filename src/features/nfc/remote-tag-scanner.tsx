import { Camera, Minus, Plus, ShieldAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showAppToast } from "../../components/modal-system";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type ZoomCapabilities = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
type ZoomConstraintSet = MediaTrackConstraintSet & { zoom?: number };

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

export function RemoteTagScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const scanningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);

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
      // Mantém a câmera ativa; alguns aparelhos falham enquanto o vídeo ainda estabiliza.
    }
    timerRef.current = window.setTimeout(() => void scanFrame(), 450);
  }

  async function startCamera() {
    setError("");
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setError("Este navegador não oferece leitura de QR pela câmera. Use a câmera normal do celular para apontar para a Hydra Tag.");
      return;
    }
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
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      scanningRef.current = true;
      void scanFrame();
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

  function close() {
    stopCamera();
    setOpen(false);
    setError("");
  }

  return <>
    <section className="distance-id-card" aria-label="Identificação à distância">
      <div className="distance-id-icon"><Camera size={22} /></div>
      <div className="distance-id-copy">
        <small>HYDRA TAG À DISTÂNCIA</small>
        <strong>Identifique sem chegar perto do animal</strong>
        <p>Use o zoom da câmera para ler o QR grande da Hydra Tag. A ficha mostra a propriedade de origem sem expor telefone, endereço ou outros dados privados.</p>
      </div>
      <button className="secondary-button distance-id-button" onClick={() => { setOpen(true); window.setTimeout(() => void startCamera(), 80); }}><Camera size={17} /> Abrir câmera</button>
      <div className="distance-id-safety"><ShieldAlert size={17} /><span>Se o animal estiver agressivo ou solto em via pública, mantenha distância. Não tente segurar, cercar ou se aproximar só para ler a tag.</span></div>
    </section>

    {open && <div className="distance-scanner-layer" role="dialog" aria-modal="true" aria-label="Scanner de Hydra Tag à distância">
      <div className="distance-scanner-panel">
        <header><div><small>IDENTIFICAÇÃO À DISTÂNCIA</small><strong>Aponte para o QR da Hydra Tag</strong></div><button onClick={close} aria-label="Fechar câmera"><X size={22} /></button></header>
        <div className="distance-camera-wrap">
          <video ref={videoRef} className="distance-camera-video" playsInline muted />
          <div className="distance-camera-frame"><span /><span /><span /><span /></div>
          <div className="distance-camera-hint">Mantenha o animal inteiro fora da sua área de aproximação. Enquadre apenas a tag usando o zoom.</div>
        </div>
        {zoomRange && <div className="distance-zoom-control"><button onClick={() => void applyZoom(zoom - zoomRange.step)} aria-label="Diminuir zoom"><Minus size={18} /></button><input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoom} onChange={(event) => void applyZoom(Number(event.target.value))} /><button onClick={() => void applyZoom(zoom + zoomRange.step)} aria-label="Aumentar zoom"><Plus size={18} /></button><span>{zoom.toFixed(1)}×</span></div>}
        {error && <div className="distance-scanner-error" role="alert">{error}</div>}
        <p className="distance-scanner-note">Ao reconhecer a tag, o Hydra Agro abre automaticamente a ficha pública do animal e informa a propriedade de origem. Se ele estiver marcado como perdido, o sistema permite avisar o proprietário.</p>
      </div>
    </div>}
  </>;
}
