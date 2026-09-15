import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CheckCircle2, MapPin, Search, ShieldAlert, Siren, Upload, X } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { capturePhoto, uploadPublicImage } from "../../services/media-service";
import { requireSupabase } from "../../services/supabase";
import "./found-animal-panel.css";

type Props = {
  account: HydraAccount;
  onClose?: () => void;
};

type SafeLookup = {
  found?: boolean;
  responsibleLocated?: boolean;
  lost?: boolean;
};

export function FoundAnimalPanel({ account, onClose }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<SafeLookup | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notified, setNotified] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [municipality, setMunicipality] = useState(account.property.municipality || "");
  const [state, setState] = useState(account.property.state || "");
  const [unknownBusy, setUnknownBusy] = useState(false);
  const [unknownSent, setUnknownSent] = useState(false);
  const [possibleMatches, setPossibleMatches] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photo) {
      setPhotoUrl("");
      return;
    }
    const next = URL.createObjectURL(photo);
    setPhotoUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo]);

  async function identify(event: FormEvent) {
    event.preventDefault();
    const normalized = code.trim();
    if (normalized.length < 3) {
      setError("Informe o código visível no brinco.");
      return;
    }
    setLookupBusy(true);
    setError("");
    setLookup(null);
    setNotified(false);
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("safe_animal_lookup", { p_code: normalized });
      if (rpcError) throw rpcError;
      setLookup((data && typeof data === "object" ? data : { found: false }) as SafeLookup);
    } catch {
      setError("Não foi possível verificar o código agora.");
    } finally {
      setLookupBusy(false);
    }
  }

  async function notifyOwner() {
    if (!code.trim() || !lookup?.responsibleLocated) return;
    setNotifyBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("report_found_animal_safe", {
        p_code: code.trim(),
        p_municipality: municipality.trim() || null,
        p_state: state.trim().toUpperCase() || null,
      });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object" || !(data as { ok?: boolean }).ok) throw new Error("Falha ao registrar aviso.");
      setNotified(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível avisar o responsável.");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function takePhoto() {
    setError("");
    try {
      const captured = await capturePhoto();
      if (captured) {
        setPhoto(captured);
        return;
      }
      fileInput.current?.click();
    } catch {
      fileInput.current?.click();
    }
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma foto do animal.");
      return;
    }
    setPhoto(file);
    setUnknownSent(false);
  }

  async function reportUnknown(event: FormEvent) {
    event.preventDefault();
    if (!photo) {
      setError("Tire uma foto à distância antes de enviar.");
      return;
    }
    if (!municipality.trim() || state.trim().length !== 2) {
      setError("Informe município e UF aproximados.");
      return;
    }
    setUnknownBusy(true);
    setError("");
    try {
      const stem = `found-animal-${Date.now()}`;
      const photoPath = await uploadPublicImage("community-media", account.id, photo, stem);
      const { data, error: rpcError } = await requireSupabase().rpc("report_unknown_found_animal", {
        p_photo_path: photoPath,
        p_municipality: municipality.trim(),
        p_state: state.trim().toUpperCase(),
      });
      if (rpcError) throw rpcError;
      const result = data && typeof data === "object" ? data as { ok?: boolean; possibleMatches?: number } : {};
      if (!result.ok) throw new Error("Não foi possível registrar o animal encontrado.");
      setPossibleMatches(Number(result.possibleMatches ?? 0));
      setUnknownSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a ocorrência.");
    } finally {
      setUnknownBusy(false);
    }
  }

  return (
    <section className="found-animal-panel" aria-label="Animal Encontrado">
      <header className="found-animal-header">
        <div>
          <span>IDENTIFICAÇÃO SEGURA</span>
          <h2>Animal Encontrado</h2>
          <p>Use a câmera e o zoom do celular para ler o código do brinco sem chegar perto do animal.</p>
        </div>
        {onClose && <button type="button" className="found-animal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>}
      </header>

      <div className="found-animal-warning" role="note">
        <ShieldAlert size={22} />
        <div><strong>Não se aproxime de animais agressivos</strong><p>Mantenha distância segura. Use o zoom da câmera e não tente tocar, cercar ou conter o animal.</p></div>
      </div>

      <section className="found-animal-card">
        <div className="found-animal-card-title"><Search size={19} /><div><strong>Tenho o código do brinco</strong><small>Nenhum dado pessoal do proprietário será mostrado.</small></div></div>
        <form onSubmit={identify}>
          <label>Código visível<input value={code} onChange={(event) => { setCode(event.target.value); setLookup(null); setNotified(false); }} placeholder="Ex.: HYDRA-528" autoCapitalize="characters" /></label>
          <button className="primary-button full" type="submit" disabled={lookupBusy}>{lookupBusy ? "Verificando…" : "Identificar responsável"}</button>
        </form>

        {lookup && (
          <div className={`found-animal-result ${lookup.responsibleLocated ? "ok" : "not-found"}`}>
            {lookup.responsibleLocated ? <CheckCircle2 size={22} /> : <Search size={22} />}
            <div>
              <strong>{lookup.responsibleLocated ? "Responsável localizado" : "Código não localizado"}</strong>
              <p>{lookup.responsibleLocated ? "O animal está vinculado a um cadastro do Hydra Agro. Por segurança, nome, telefone, endereço e dados da fazenda permanecem ocultos." : "Confira o código. Se não conseguir ler, use a opção de foto abaixo."}</p>
              {lookup.responsibleLocated && !notified && <button type="button" onClick={() => void notifyOwner()} disabled={notifyBusy}>{notifyBusy ? "Enviando aviso…" : "Notificar proprietário pelo app"}</button>}
              {notified && <small className="found-animal-success">Aviso enviado pelo Hydra Agro.</small>}
            </div>
          </div>
        )}
      </section>

      <section className="found-animal-card">
        <div className="found-animal-card-title"><Camera size={19} /><div><strong>Não consigo ler o código</strong><small>Fotografe à distância e informe apenas a região aproximada.</small></div></div>
        <form onSubmit={reportUnknown}>
          <input ref={fileInput} hidden type="file" accept="image/*" capture="environment" onChange={choosePhoto} />
          <button className="found-animal-photo-button" type="button" onClick={() => void takePhoto()}><Camera size={19} /> {photo ? "Trocar foto" : "Tirar foto à distância"}</button>
          {photoUrl && <img className="found-animal-preview" src={photoUrl} alt="Foto do animal encontrado" />}
          <div className="found-animal-location"><MapPin size={18} /><span>Localização aproximada</span></div>
          <div className="found-animal-location-fields">
            <label>Município<input value={municipality} onChange={(event) => setMunicipality(event.target.value)} placeholder="Município" /></label>
            <label>UF<input value={state} maxLength={2} onChange={(event) => setState(event.target.value.toUpperCase())} placeholder="BA" /></label>
          </div>
          <button className="primary-button full" type="submit" disabled={unknownBusy}>{unknownBusy ? "Cruzando cadastros…" : <><Upload size={18} /> Enviar Animal Encontrado</>}</button>
        </form>

        {unknownSent && (
          <div className="found-animal-result ok">
            <Siren size={22} />
            <div><strong>Ocorrência registrada</strong><p>{possibleMatches > 0 ? `Encontramos ${possibleMatches} possível(is) cadastro(s) de animal desaparecido na região e os responsáveis foram avisados pelo app.` : "Nenhum animal desaparecido compatível foi localizado nessa região agora. A ocorrência ficou registrada para novos cruzamentos."}</p></div>
          </div>
        )}
      </section>

      {error && <p className="found-animal-error" role="alert">{error}</p>}
      <p className="found-animal-privacy-note">O Hydra Agro não revela dados pessoais de proprietários para quem encontrou o animal. O contato acontece por notificação interna.</p>
    </section>
  );
}
