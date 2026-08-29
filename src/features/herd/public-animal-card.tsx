import { BadgeCheck, Beef as Cow, ExternalLink, Fingerprint, MapPin, Nfc, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Animal } from "../../lib/hydra-types";
import { publicMediaUrl, requireSupabase } from "../../services/supabase";

export type PublicAnimalOrigin = {
  propertyName?: string;
  municipality?: string;
  state?: string;
};

export type PublicAnimalSnapshot = {
  identification: string;
  name?: string;
  species: string;
  breed?: string;
  sex?: string;
  birthDate?: string;
  weight?: number;
  status?: string;
  photoPath?: string;
  propertyName?: string;
  municipality?: string;
  state?: string;
};

const PUBLIC_KEYS = ["pa", "i", "n", "s", "b", "sx", "bd", "w", "st", "ph", "pn", "pm", "uf"] as const;

export function buildPublicAnimalUrl(animal: Animal, photoPath?: string, origin?: PublicAnimalOrigin) {
  const url = new URL(window.location.origin);
  url.searchParams.set("pa", "1");
  url.searchParams.set("i", animal.identification.slice(0, 40));
  if (animal.name) url.searchParams.set("n", animal.name.slice(0, 32));
  url.searchParams.set("s", animal.species.slice(0, 24));
  if (animal.breed) url.searchParams.set("b", animal.breed.slice(0, 28));
  if (animal.sex) url.searchParams.set("sx", animal.sex.slice(0, 16));
  if (animal.birthDate) url.searchParams.set("bd", animal.birthDate.slice(0, 10));
  if (animal.weight && Number.isFinite(animal.weight)) url.searchParams.set("w", String(animal.weight));
  if (animal.status) url.searchParams.set("st", animal.status.slice(0, 20));
  if (photoPath) url.searchParams.set("ph", photoPath.slice(0, 180));
  if (origin?.propertyName) url.searchParams.set("pn", origin.propertyName.slice(0, 40));
  if (origin?.municipality) url.searchParams.set("pm", origin.municipality.slice(0, 28));
  if (origin?.state) url.searchParams.set("uf", origin.state.slice(0, 2).toUpperCase());
  return url.toString();
}

export function readPublicAnimalSnapshot(href = window.location.href): PublicAnimalSnapshot | null {
  try {
    const url = new URL(href);
    if (url.searchParams.get("pa") !== "1") return null;
    const identification = url.searchParams.get("i")?.trim() ?? "";
    const species = url.searchParams.get("s")?.trim() ?? "";
    if (!identification || !species) return null;
    const parsedWeight = Number(url.searchParams.get("w"));
    const rawPhotoPath = url.searchParams.get("ph")?.trim() ?? "";
    const rawBirthDate = url.searchParams.get("bd")?.trim() ?? "";
    const photoPath = rawPhotoPath && !rawPhotoPath.includes("..") && !rawPhotoPath.startsWith("/") ? rawPhotoPath.slice(0, 180) : undefined;
    const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(rawBirthDate) ? rawBirthDate : undefined;
    return {
      identification: identification.slice(0, 40),
      name: url.searchParams.get("n")?.trim().slice(0, 32) || undefined,
      species: species.slice(0, 24),
      breed: url.searchParams.get("b")?.trim().slice(0, 28) || undefined,
      sex: url.searchParams.get("sx")?.trim().slice(0, 16) || undefined,
      birthDate,
      weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : undefined,
      status: url.searchParams.get("st")?.trim().slice(0, 20) || undefined,
      photoPath,
      propertyName: url.searchParams.get("pn")?.trim().slice(0, 40) || undefined,
      municipality: url.searchParams.get("pm")?.trim().slice(0, 28) || undefined,
      state: url.searchParams.get("uf")?.trim().slice(0, 2).toUpperCase() || undefined,
    };
  } catch {
    return null;
  }
}

export function clearPublicAnimalParams() {
  const url = new URL(window.location.href);
  PUBLIC_KEYS.forEach((key) => url.searchParams.delete(key));
  return `${url.pathname}${url.search}${url.hash}` || "/";
}

type LiveAnimal = {
  identification?: string;
  name?: string;
  status?: string;
  propertyName?: string;
  municipality?: string;
  state?: string;
  lost?: boolean;
};

export function PublicAnimalScreen({ animal, onOpenApp }: { animal: PublicAnimalSnapshot; onOpenApp: () => void }) {
  const [live, setLive] = useState<LiveAnimal | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let active = true;
    void requireSupabase().rpc("public_animal_by_hydra_code", { p_code: animal.identification })
      .then(({ data, error }) => {
        if (!active || error || !data || typeof data !== "object") return;
        setLive(data as LiveAnimal);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [animal.identification]);

  const current = useMemo<PublicAnimalSnapshot>(() => ({
    ...animal,
    identification: live?.identification || animal.identification,
    name: live?.name || animal.name,
    status: live?.status || animal.status,
    propertyName: live?.propertyName || animal.propertyName,
    municipality: live?.municipality || animal.municipality,
    state: live?.state || animal.state,
  }), [animal, live]);

  const isLost = Boolean(live?.lost) || current.status?.toLocaleLowerCase("pt-BR") === "perdido";
  const rawPhotoUrl = current.photoPath ? publicMediaUrl("community-media", current.photoPath) : undefined;
  const photoUrl = rawPhotoUrl ? `${rawPhotoUrl}${rawPhotoUrl.includes("?") ? "&" : "?"}hydra=${Date.now()}` : undefined;
  const location = [current.municipality, current.state].filter(Boolean).join("/ ");

  async function reportFound() {
    setReporting(true);
    setReportError("");
    try {
      const { error } = await requireSupabase().rpc("report_found_animal", { p_code: animal.identification, p_message: null });
      if (error) throw error;
      setReported(true);
    } catch {
      setReportError("Não foi possível enviar o aviso agora. Tente novamente em instantes.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <main className="public-animal-page">
      <section className="public-animal-shell">
        <header className="public-animal-brand">
          <span className="public-animal-logo"><Cow size={27} /></span>
          <div><strong>Hydra Agro</strong><small>Hydra Tag · identidade digital animal</small></div>
          <span className="public-animal-safe"><Nfc size={16} /> NFC / QR</span>
        </header>

        <div className={`public-animal-hero ${photoUrl ? "has-photo" : ""}`}>
          {photoUrl && <img className="public-animal-photo" src={photoUrl} alt={`Foto de ${current.name || current.identification}`} />}
          {photoUrl && <div className="public-animal-hero-shade" />}
          {!photoUrl && <span className="public-animal-icon"><Cow size={42} /></span>}
          <div className="public-animal-hero-copy">
            <span className="public-animal-kicker"><BadgeCheck size={15} /> HYDRA TAG ATIVA</span>
            <h1>{current.name || "Animal identificado"}</h1>
            <p>{current.identification}</p>
          </div>
        </div>

        {isLost && (
          <div className="public-animal-highlight" role="status">
            <TriangleAlert size={22} />
            <div><span>ATENÇÃO</span><strong>Animal marcado como perdido</strong><small>Se você encontrou este animal, avise a propriedade pelo botão abaixo.</small></div>
          </div>
        )}

        {(current.propertyName || current.municipality) && (
          <div className="public-animal-highlight">
            <MapPin size={20} />
            <div><span>Propriedade de origem</span><strong>{current.propertyName || "Propriedade cadastrada"}</strong><small>{location || "Origem registrada no Hydra Agro"}</small></div>
          </div>
        )}

        <section className="public-animal-section">
          <div className="public-animal-section-title"><Fingerprint size={17} /><div><strong>Identificação</strong><small>Dados públicos autorizados</small></div></div>
          <div className="public-animal-data public-animal-data-detailed">
            <div><span>Hydra ID</span><strong>{current.identification}</strong></div>
            <div><span>Nome/número</span><strong>{current.name || current.identification}</strong></div>
            <div><span>Status</span><strong>{current.status || "Cadastrado"}</strong></div>
            <div><span>Localização</span><strong>{location || "Não informada"}</strong></div>
          </div>
        </section>

        {isLost && (
          <section className="public-animal-section">
            {reported ? (
              <div className="public-animal-validation"><span className="public-animal-validation-icon"><ShieldCheck size={21} /></span><div><strong>Aviso enviado</strong><p>O proprietário recebeu uma notificação dentro do Hydra Agro. Seus dados pessoais não foram compartilhados.</p></div></div>
            ) : (
              <button className="public-animal-open" onClick={() => void reportFound()} disabled={reporting}>{reporting ? "Enviando aviso…" : "Encontrei este animal"}</button>
            )}
            {reportError && <p className="form-error" role="alert">{reportError}</p>}
          </section>
        )}

        <div className="public-animal-privacy">
          <ShieldCheck size={20} />
          <p><strong>Privacidade protegida</strong><small>Esta ficha não mostra telefone, e-mail, CEP nem endereço da propriedade. O aviso de animal encontrado é enviado internamente pelo Hydra Agro.</small></p>
        </div>

        <button className="public-animal-open" onClick={onOpenApp}><ExternalLink size={18} /> Abrir Hydra Agro</button>
        <p className="public-animal-footer">Hydra Tag · tecnologia que nasce do campo</p>
      </section>
    </main>
  );
}
