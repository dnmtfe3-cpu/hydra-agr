import { Beef as Cow, ExternalLink, Fingerprint, Search, ShieldAlert, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { requireSupabase } from "../../services/supabase";
import { PublicAnimalScreen, readPublicAnimalSnapshot, type PublicAnimalSnapshot } from "./public-animal-card";
import "./public-tag-lookup.css";

type PublicLookup = {
  identification?: string;
  name?: string;
  species?: string;
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

function cleanCode(value: string) {
  return value.trim().slice(0, 40);
}

function codeFromPath() {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "tag" || !parts[1]) return "";
  try {
    return cleanCode(decodeURIComponent(parts.slice(1).join("/")));
  } catch {
    return cleanCode(parts[1]);
  }
}

function snapshotFromLookup(data: PublicLookup, fallbackCode: string): PublicAnimalSnapshot | null {
  const identification = cleanCode(data.identification || fallbackCode);
  const species = data.species?.trim().slice(0, 24) || "animal";
  if (!identification) return null;

  return {
    identification,
    name: data.name?.trim().slice(0, 32) || undefined,
    species,
    breed: data.breed?.trim().slice(0, 28) || undefined,
    sex: data.sex?.trim().slice(0, 16) || undefined,
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(data.birthDate || "") ? data.birthDate : undefined,
    weight: typeof data.weight === "number" && Number.isFinite(data.weight) && data.weight > 0 ? data.weight : undefined,
    status: data.status?.trim().slice(0, 20) || undefined,
    photoPath: data.photoPath?.trim().slice(0, 180) || undefined,
    propertyName: data.propertyName?.trim().slice(0, 40) || undefined,
    municipality: data.municipality?.trim().slice(0, 28) || undefined,
    state: data.state?.trim().slice(0, 2).toUpperCase() || undefined,
  };
}

function publicAnimalUrl(animal: PublicAnimalSnapshot) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("pa", "1");
  url.searchParams.set("i", animal.identification);
  url.searchParams.set("s", animal.species || "animal");
  if (animal.name) url.searchParams.set("n", animal.name);
  if (animal.breed) url.searchParams.set("b", animal.breed);
  if (animal.sex) url.searchParams.set("sx", animal.sex);
  if (animal.birthDate) url.searchParams.set("bd", animal.birthDate);
  if (animal.weight) url.searchParams.set("w", String(animal.weight));
  if (animal.status) url.searchParams.set("st", animal.status);
  if (animal.photoPath) url.searchParams.set("ph", animal.photoPath);
  if (animal.propertyName) url.searchParams.set("pn", animal.propertyName);
  if (animal.municipality) url.searchParams.set("pm", animal.municipality);
  if (animal.state) url.searchParams.set("uf", animal.state);
  return url.toString();
}

export function PublicTagLookup() {
  const snapshotInUrl = useMemo(() => readPublicAnimalSnapshot(), []);
  const initialCode = useMemo(() => {
    if (snapshotInUrl?.identification) return snapshotInUrl.identification;
    const pathCode = codeFromPath();
    if (pathCode) return pathCode;
    if (typeof window === "undefined") return "";
    return cleanCode(new URLSearchParams(window.location.search).get("i") || "");
  }, [snapshotInUrl]);

  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(Boolean(initialCode && !snapshotInUrl));
  const [error, setError] = useState("");

  const lookup = useCallback(async (rawCode: string, replaceAfterLookup = true) => {
    const normalized = cleanCode(rawCode);
    if (!normalized) {
      setError("Digite o Hydra ID que aparece no brinco.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("public_animal_by_hydra_code", { p_code: normalized });
      if (rpcError || !data || typeof data !== "object") {
        setError("Hydra ID não encontrado. Confira o código sem se aproximar do animal.");
        return;
      }

      const animal = snapshotFromLookup(data as PublicLookup, normalized);
      if (!animal) {
        setError("Não foi possível identificar esse Hydra ID.");
        return;
      }

      if (replaceAfterLookup) window.location.replace(publicAnimalUrl(animal));
    } catch {
      setError("Não foi possível consultar a Hydra Tag agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!snapshotInUrl && initialCode) void lookup(initialCode);
  }, [initialCode, lookup, snapshotInUrl]);

  if (snapshotInUrl) {
    return <PublicAnimalScreen animal={snapshotInUrl} onOpenApp={() => window.location.assign("/")} />;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void lookup(code);
  }

  return (
    <main className="public-tag-lookup-page">
      <section className="public-tag-lookup-shell">
        <header className="public-tag-lookup-brand">
          <img src="/hydra-mark.svg" alt="" />
          <div><strong>Hydra Agro</strong><small>Identificação pública de animais</small></div>
        </header>

        <div className="public-tag-lookup-hero">
          <span className="public-tag-lookup-icon"><Cow size={30} /></span>
          <small>HYDRA TAG</small>
          <h1>Encontrou um animal?</h1>
          <p>Você não precisa instalar o Hydra Agro, criar conta ou ter NFC para consultar a identificação.</p>
        </div>

        <div className="public-tag-lookup-steps" aria-label="Como identificar o animal">
          <div><span><Smartphone size={19} /></span><p><strong>QR legível</strong><small>Abra a câmera normal do celular e aponte para o QR. A ficha abre direto no navegador.</small></p></div>
          <div><span><Fingerprint size={19} /></span><p><strong>QR sujo ou danificado</strong><small>Veja o Hydra ID grande do brinco à distância e digite abaixo.</small></p></div>
        </div>

        <form className="public-tag-lookup-form" onSubmit={submit}>
          <label htmlFor="public-hydra-id">Hydra ID</label>
          <div>
            <input
              id="public-hydra-id"
              value={code}
              onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }}
              placeholder="Ex.: HYDRA-8F2K"
              maxLength={40}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
            <button type="submit" disabled={busy}><Search size={18} /> {busy ? "Consultando…" : "Consultar"}</button>
          </div>
          {error && <p className="public-tag-lookup-error" role="alert">{error}</p>}
        </form>

        <div className="public-tag-lookup-safety">
          <ShieldAlert size={20} />
          <p><strong>Não se aproxime só para identificar.</strong><small>Se o animal estiver agressivo ou solto em via pública, mantenha distância. Não tente limpar o brinco, segurar ou cercar o animal.</small></p>
        </div>

        <div className="public-tag-lookup-privacy">
          <strong>Consulta pública, dados protegidos</strong>
          <p>A ficha mostra somente informações autorizadas para identificação. Telefone, e-mail, CEP e endereço detalhado da propriedade não ficam públicos.</p>
        </div>

        <button className="public-tag-lookup-app" type="button" onClick={() => window.location.assign("/")}><ExternalLink size={17} /> Abrir Hydra Agro</button>
        <p className="public-tag-lookup-address">hydraagro.sbs/tag</p>
      </section>
    </main>
  );
}
