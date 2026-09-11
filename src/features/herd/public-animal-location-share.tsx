import { LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { recordPublicAnimalSighting } from "../../services/property-map-service";
import "./public-animal-location-share.css";

type ShareState = "idle" | "locating" | "saving" | "done" | "error";

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "A localização não foi compartilhada. Libere a permissão do GPS se quiser enviar este ponto.";
  if (error.code === error.POSITION_UNAVAILABLE) return "O celular não conseguiu encontrar sua localização agora.";
  if (error.code === error.TIMEOUT) return "O GPS demorou para responder. Tente novamente em um local mais aberto.";
  return "Não foi possível obter sua localização agora.";
}

export function PublicAnimalLocationShare({ hydraCode }: { hydraCode: string }) {
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState("");
  const [accuracy, setAccuracy] = useState<number>();

  function shareLocation() {
    if (!navigator.geolocation) {
      setState("error");
      setMessage("Este aparelho não oferece localização pelo navegador.");
      return;
    }

    setState("locating");
    setMessage("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      setState("saving");
      try {
        const coords = position.coords;
        await recordPublicAnimalSighting({
          hydraCode,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : undefined,
          source: "public_tag",
        });
        setAccuracy(Number.isFinite(coords.accuracy) ? coords.accuracy : undefined);
        setState("done");
        setMessage("Localização compartilhada com a propriedade.");
      } catch {
        setState("error");
        setMessage("Não foi possível salvar este ponto agora. Tente novamente em instantes.");
      }
    }, (error) => {
      setState("error");
      setMessage(locationErrorMessage(error));
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  }

  if (state === "done") {
    return <section className="public-animal-location-card is-done" aria-live="polite">
      <span className="public-animal-location-icon"><ShieldCheck size={22} /></span>
      <div>
        <strong>{message}</strong>
        <p>O dono poderá ver onde este animal foi visto por último no mapa do Hydra Agro{accuracy ? ` · precisão aproximada de ${Math.round(accuracy)} m` : ""}.</p>
      </div>
    </section>;
  }

  const busy = state === "locating" || state === "saving";
  return <section className="public-animal-location-card">
    <div className="public-animal-location-heading">
      <span className="public-animal-location-icon"><MapPin size={21} /></span>
      <div><strong>Viu este animal aqui?</strong><small>Ajude a propriedade com a última localização conhecida.</small></div>
    </div>
    <p className="public-animal-location-privacy">Sua posição só é enviada depois que você tocar no botão e permitir o GPS. O Hydra Agro não mostra seu endereço ao proprietário.</p>
    <button className="public-animal-location-button" type="button" onClick={shareLocation} disabled={busy}>
      <LocateFixed size={18} />
      {state === "locating" ? "Obtendo localização…" : state === "saving" ? "Salvando ponto…" : "Compartilhar onde vi este animal"}
    </button>
    {state === "error" && <p className="public-animal-location-error" role="alert">{message}</p>}
  </section>;
}
