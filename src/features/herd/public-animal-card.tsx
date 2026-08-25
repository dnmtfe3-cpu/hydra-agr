import { BadgeCheck, Beef as Cow, CalendarDays, ExternalLink, Fingerprint, HeartPulse, Nfc, ShieldCheck, Weight } from "lucide-react";
import type { Animal } from "../../lib/hydra-types";
import { publicMediaUrl } from "../../services/supabase";

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
};

const PUBLIC_KEYS = ["pa", "i", "n", "s", "b", "sx", "bd", "w", "st", "ph"] as const;

export function buildPublicAnimalUrl(animal: Animal, photoPath?: string) {
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

function formatBirthDate(value?: string) {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function animalAge(value?: string) {
  if (!value) return "Não informada";
  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) return "Não informada";
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "Não informada";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years}a ${remainingMonths}m` : `${years} ${years === 1 ? "ano" : "anos"}`;
}

export function PublicAnimalScreen({ animal, onOpenApp }: { animal: PublicAnimalSnapshot; onOpenApp: () => void }) {
  const photoUrl = animal.photoPath ? publicMediaUrl("community-media", animal.photoPath) : undefined;
  const age = animalAge(animal.birthDate);

  return (
    <main className="public-animal-page">
      <section className="public-animal-shell">
        <header className="public-animal-brand">
          <span className="public-animal-logo"><Cow size={27} /></span>
          <div><strong>Hydra Agro</strong><small>Hydra ID · identidade digital animal</small></div>
          <span className="public-animal-safe"><Nfc size={16} /> NFC / QR</span>
        </header>

        <div className={`public-animal-hero ${photoUrl ? "has-photo" : ""}`}>
          {photoUrl && <img className="public-animal-photo" src={photoUrl} alt={`Foto de ${animal.name || animal.identification}`} />}
          {photoUrl && <div className="public-animal-hero-shade" />}
          {!photoUrl && <span className="public-animal-icon"><Cow size={42} /></span>}
          <div className="public-animal-hero-copy">
            <span className="public-animal-kicker"><BadgeCheck size={15} /> HYDRA ID ATIVO</span>
            <h1>{animal.name || "Animal identificado"}</h1>
            <p>{animal.identification}</p>
          </div>
        </div>

        <div className="public-animal-trust-row">
          <div><BadgeCheck size={16} /><span><strong>Identidade ativa</strong><small>Registro reconhecido pelo Hydra Agro</small></span></div>
          <div><Nfc size={16} /><span><strong>Acesso rápido</strong><small>NFC e QR apontam para esta ficha</small></span></div>
        </div>

        <section className="public-animal-section">
          <div className="public-animal-section-title"><Fingerprint size={17} /><div><strong>Identificação</strong><small>Dados básicos do animal</small></div></div>
          <div className="public-animal-data public-animal-data-detailed">
            <div><span>Hydra ID</span><strong>{animal.identification}</strong></div>
            <div><span>Espécie</span><strong>{animal.species}</strong></div>
            <div><span>Raça</span><strong>{animal.breed || "Não informada"}</strong></div>
            <div><span>Sexo</span><strong>{animal.sex || "Não informado"}</strong></div>
          </div>
        </section>

        <section className="public-animal-section">
          <div className="public-animal-section-title"><HeartPulse size={17} /><div><strong>Dados atuais</strong><small>Informações compartilhadas pelo cadastro</small></div></div>
          <div className="public-animal-data public-animal-data-detailed">
            <div><span>Peso atual</span><strong>{animal.weight ? `${animal.weight} kg` : "Não informado"}</strong></div>
            <div><span>Situação</span><strong>{animal.status || "Cadastrado"}</strong></div>
            <div><span>Nascimento</span><strong>{formatBirthDate(animal.birthDate)}</strong></div>
            <div><span>Idade estimada</span><strong>{age}</strong></div>
          </div>
        </section>

        <div className="public-animal-validation">
          <span className="public-animal-validation-icon"><ShieldCheck size={21} /></span>
          <div>
            <small>VALIDAÇÃO HYDRA ID</small>
            <strong>Identificação digital compartilhada</strong>
            <p>Esta ficha foi preparada para acesso rápido por NFC ou QR e reúne apenas informações públicas de identificação do animal.</p>
          </div>
          <BadgeCheck size={22} className="public-animal-validation-check" />
        </div>

        {animal.weight && <div className="public-animal-highlight"><Weight size={20} /><div><span>Peso compartilhado</span><strong>{animal.weight} kg</strong><small>Valor exibido a partir da ficha cadastrada no Hydra Agro.</small></div></div>}

        {animal.birthDate && <div className="public-animal-highlight public-animal-highlight-secondary"><CalendarDays size={20} /><div><span>Faixa etária</span><strong>{age}</strong><small>Calculada automaticamente usando a data de nascimento informada.</small></div></div>}

        <div className="public-animal-privacy">
          <ShieldCheck size={20} />
          <p><strong>Privacidade protegida</strong><small>Conta, dados da propriedade, equipe, telefone, observações e histórico interno não aparecem nesta ficha pública.</small></p>
        </div>

        <button className="public-animal-open" onClick={onOpenApp}><ExternalLink size={18} /> Abrir Hydra Agro</button>
        <p className="public-animal-footer">Hydra ID · tecnologia que nasce do campo</p>
      </section>
    </main>
  );
}
