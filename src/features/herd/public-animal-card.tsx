import { BadgeCheck, Beef as Cow, ExternalLink, Nfc, ShieldCheck, Weight } from "lucide-react";
import type { Animal } from "../../lib/hydra-types";
import { publicMediaUrl } from "../../services/supabase";

export type PublicAnimalSnapshot = {
  identification: string;
  name?: string;
  species: string;
  breed?: string;
  weight?: number;
  status?: string;
  photoPath?: string;
};

const PUBLIC_KEYS = ["pa", "i", "n", "s", "b", "w", "st", "ph"] as const;

export function buildPublicAnimalUrl(animal: Animal, photoPath?: string) {
  const url = new URL(window.location.origin);
  url.searchParams.set("pa", "1");
  url.searchParams.set("i", animal.identification.slice(0, 40));
  if (animal.name) url.searchParams.set("n", animal.name.slice(0, 32));
  url.searchParams.set("s", animal.species.slice(0, 24));
  if (animal.breed) url.searchParams.set("b", animal.breed.slice(0, 28));
  if (animal.weight && Number.isFinite(animal.weight)) url.searchParams.set("w", String(animal.weight));
  if (animal.status) url.searchParams.set("st", animal.status.slice(0, 20));
  if (photoPath) url.searchParams.set("ph", photoPath.slice(0, 180));
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
    const photoPath = rawPhotoPath && !rawPhotoPath.includes("..") && !rawPhotoPath.startsWith("/") ? rawPhotoPath.slice(0, 180) : undefined;
    return {
      identification: identification.slice(0, 40),
      name: url.searchParams.get("n")?.trim().slice(0, 32) || undefined,
      species: species.slice(0, 24),
      breed: url.searchParams.get("b")?.trim().slice(0, 28) || undefined,
      weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : undefined,
      status: url.searchParams.get("st")?.trim().slice(0, 20) || undefined,
      photoPath,
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

export function PublicAnimalScreen({ animal, onOpenApp }: { animal: PublicAnimalSnapshot; onOpenApp: () => void }) {
  const photoUrl = animal.photoPath ? publicMediaUrl("community-media", animal.photoPath) : undefined;

  return (
    <main className="public-animal-page">
      <section className="public-animal-shell">
        <header className="public-animal-brand">
          <span className="public-animal-logo"><Cow size={27} /></span>
          <div><strong>Hydra Agro</strong><small>Hydra ID · identificação animal</small></div>
          <span className="public-animal-safe"><Nfc size={16} /> NFC / QR</span>
        </header>

        <div className={`public-animal-hero ${photoUrl ? "has-photo" : ""}`}>
          {photoUrl && <img className="public-animal-photo" src={photoUrl} alt={`Foto de ${animal.name || animal.identification}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />}
          {photoUrl && <div className="public-animal-hero-shade" style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(180deg, rgba(5,24,16,.08) 15%, rgba(5,24,16,.28) 46%, rgba(5,24,16,.88) 100%)" }} />}
          {!photoUrl && <span className="public-animal-icon"><Cow size={42} /></span>}
          <div className="public-animal-hero-copy" style={{ position: "relative", zIndex: 2 }}>
            <span className="public-animal-kicker"><BadgeCheck size={15} /> HYDRA ID</span>
            <h1>{animal.name || "Animal identificado"}</h1>
            <p>{animal.identification}</p>
          </div>
        </div>

        <div className="public-animal-data">
          <div><span>Espécie</span><strong>{animal.species}</strong></div>
          <div><span>Raça</span><strong>{animal.breed || "Não informada"}</strong></div>
          <div><span>Peso atual</span><strong>{animal.weight ? `${animal.weight} kg` : "Não informado"}</strong></div>
          <div><span>Situação</span><strong>{animal.status || "Cadastrado"}</strong></div>
        </div>

        {animal.weight && <div className="public-animal-highlight"><Weight size={20} /><div><span>Último peso compartilhado</span><strong>{animal.weight} kg</strong></div></div>}

        <div className="public-animal-privacy">
          <ShieldCheck size={20} />
          <p><strong>Identidade pública protegida</strong><small>O Hydra ID mostra apenas os dados básicos usados para identificar este animal e, quando disponível, uma cópia pública da foto. Conta, propriedade, equipe e observações privadas não são compartilhadas.</small></p>
        </div>

        <button className="public-animal-open" onClick={onOpenApp}><ExternalLink size={18} /> Abrir Hydra Agro</button>
        <p className="public-animal-footer">Hydra ID · tecnologia que nasce do campo</p>
      </section>
    </main>
  );
}
