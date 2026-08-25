import { ChevronRight, Copy, Image as ImageIcon, LoaderCircle, MapPin, Nfc, QrCode, Radio, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { Animal } from "../../lib/hydra-types";
import { uploadPublicImage } from "../../services/media-service";
import { canWriteNfcUrl, writeNfcUrl } from "../../services/nfc-service";
import { requireSupabase } from "../../services/supabase";
import { buildPublicAnimalUrl, type PublicAnimalOrigin } from "./public-animal-card";
import "./hydra-id-share-cards.css";

function mimeFromPath(path?: string) {
  const normalized = path?.toLowerCase() ?? "";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function AnimalPublicShare({ animal }: { animal: Animal }) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [publicPhotoPath, setPublicPhotoPath] = useState<string>();
  const [origin, setOrigin] = useState<PublicAnimalOrigin>({});
  const [originBusy, setOriginBusy] = useState(false);
  const photoSourceKey = `${animal.id}|${animal.photoPath ?? ""}|${animal.photoUrl ?? ""}`;
  const publicUrl = useMemo(() => buildPublicAnimalUrl(animal, publicPhotoPath, origin), [animal, publicPhotoPath, origin]);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(publicUrl)}`;
  const canWriteNfc = canWriteNfcUrl();
  const hasPhoto = Boolean(animal.photoPath || animal.photoUrl);

  useEffect(() => {
    setPublicPhotoPath(undefined);
    setPhotoError("");
  }, [photoSourceKey]);

  async function prepareOrigin() {
    if (origin.propertyName || origin.municipality) return origin;
    setOriginBusy(true);
    try {
      const client = requireSupabase();
      const { data: animalRow, error: animalError } = await client
        .from("animals")
        .select("owner_user_id")
        .eq("id", animal.id)
        .maybeSingle();
      if (animalError) throw animalError;
      const ownerUserId = animalRow?.owner_user_id ? String(animalRow.owner_user_id) : "";
      if (!ownerUserId) return {};

      const { data: propertyRow, error: propertyError } = await client
        .from("properties")
        .select("name,municipality")
        .eq("owner_user_id", ownerUserId)
        .maybeSingle();
      if (propertyError) throw propertyError;

      const nextOrigin: PublicAnimalOrigin = {
        propertyName: propertyRow?.name ? String(propertyRow.name) : undefined,
        municipality: propertyRow?.municipality ? String(propertyRow.municipality) : undefined,
      };
      setOrigin(nextOrigin);
      return nextOrigin;
    } catch {
      return {};
    } finally {
      setOriginBusy(false);
    }
  }

  async function preparePublicPhoto() {
    if (publicPhotoPath) return publicPhotoPath;
    if (!hasPhoto) return undefined;

    setPhotoBusy(true);
    setPhotoError("");
    try {
      const client = requireSupabase();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Sessão não encontrada.");

      let blob: Blob;
      let contentType = mimeFromPath(animal.photoPath);

      if (animal.photoPath) {
        const { data, error } = await client.storage.from("farm-media").download(animal.photoPath);
        if (error || !data) throw error ?? new Error("Não foi possível acessar a foto privada do animal.");
        blob = data;
        if (blob.type?.startsWith("image/")) contentType = blob.type;
      } else if (animal.photoUrl) {
        const response = await fetch(`${animal.photoUrl}${animal.photoUrl.includes("?") ? "&" : "?"}hydra=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Não foi possível preparar a foto do animal.");
        blob = await response.blob();
        if (blob.type?.startsWith("image/")) contentType = blob.type;
      } else {
        return undefined;
      }

      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const file = new File([blob], `animal-${animal.id}.${extension}`, { type: contentType });
      const path = await uploadPublicImage("community-media", userData.user.id, file, `public-animal-${animal.id}`);
      setPublicPhotoPath(path);
      return path;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível incluir a foto na ficha pública.";
      setPhotoError(message);
      showAppToast(message, "error");
      return undefined;
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void prepareOrigin();
    if (hasPhoto && !publicPhotoPath && !photoBusy) void preparePublicPhoto();
  }, [open, hasPhoto, publicPhotoPath, photoSourceKey]);

  async function currentPublicUrl() {
    const [photoPath, currentOrigin] = await Promise.all([preparePublicPhoto(), prepareOrigin()]);
    return buildPublicAnimalUrl(animal, photoPath, currentOrigin);
  }

  async function copyLink() {
    try {
      const url = await currentPublicUrl();
      await navigator.clipboard.writeText(url);
      showAppToast("Link público copiado");
    } catch {
      showAppToast("Não foi possível copiar o link.", "error");
    }
  }

  async function shareLink() {
    const url = await currentPublicUrl();
    if (!navigator.share) {
      try {
        await navigator.clipboard.writeText(url);
        showAppToast("Link público copiado");
      } catch {
        showAppToast("Não foi possível copiar o link.", "error");
      }
      return;
    }
    try {
      await navigator.share({ title: `${animal.name || animal.identification} · Hydra Agro`, text: "Hydra ID do animal", url });
    } catch {
      // Cancelar o compartilhamento não precisa gerar erro.
    }
  }

  async function writeTag() {
    setWriting(true);
    try {
      const url = await currentPublicUrl();
      await writeNfcUrl(url);
      showAppToast("Hydra ID gravado na etiqueta NFC");
    } catch (caught) {
      showAppToast(caught instanceof Error ? caught.message : "Não foi possível gravar a etiqueta.", "error");
    } finally {
      setWriting(false);
    }
  }

  const photoTitle = photoBusy
    ? "Preparando..."
    : publicPhotoPath
      ? "Disponível"
      : photoError
        ? "Sem imagem"
        : hasPhoto
          ? "No Hydra ID"
          : "Não cadastrada";

  const photoCaption = publicPhotoPath
    ? "Reconhecimento visual"
    : photoError
      ? "A ficha continua ativa"
      : hasPhoto
        ? "Foto do cadastro"
        : "Adicione uma foto ao animal";

  return (
    <>
      <button className="animal-public-share-button" onClick={() => setOpen(true)}>
        <span><QrCode size={20} /></span>
        <div><strong>Hydra ID · NFC / QR</strong><small>Abra a ficha pública do animal sem entrar na conta</small></div>
        <ChevronRight size={18} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} eyebrow="HYDRA ID" title="Identidade digital do animal" wide dismissible={!writing && !photoBusy}>
        <div className="public-share-modal">
          <p className="public-share-intro">Uma identidade simples para reconhecer o animal e descobrir de qual propriedade ele veio.</p>

          <div className="hydra-id-info-grid">
            <article className="hydra-id-info-card hydra-id-info-card-wide">
              <span className="hydra-id-info-icon">{originBusy ? <LoaderCircle size={20} className="spin" /> : <MapPin size={20} />}</span>
              <div className="hydra-id-info-copy">
                <small>Propriedade de origem</small>
                <strong>{originBusy ? "Localizando..." : origin.propertyName || "Propriedade vinculada"}</strong>
                <em>{origin.municipality || "Origem registrada no Hydra Agro"}</em>
              </div>
            </article>

            <article className={`hydra-id-info-card is-photo ${photoError ? "is-error" : ""}`}>
              <span className="hydra-id-info-icon">{photoBusy ? <LoaderCircle size={19} className="spin" /> : <ImageIcon size={19} />}</span>
              <div className="hydra-id-info-copy">
                <small>Foto</small>
                <strong>{photoTitle}</strong>
                <em>{photoCaption}</em>
              </div>
            </article>

            <article className="hydra-id-info-card is-access">
              <span className="hydra-id-info-icon"><Nfc size={19} /></span>
              <div className="hydra-id-info-copy">
                <small>Acesso</small>
                <strong>NFC + QR</strong>
                <em>Abre sem login</em>
              </div>
            </article>
          </div>

          <div className="public-share-qr-wrap"><img src={qrUrl} alt={`QR Code da ficha pública de ${animal.name || animal.identification}`} /></div>
          <div className="public-share-link">{publicUrl}</div>

          <div className="public-share-actions">
            <button className="secondary-button" onClick={() => void copyLink()} disabled={photoBusy || writing || originBusy}><Copy size={17} /> Copiar link</button>
            <button className="secondary-button" onClick={() => void shareLink()} disabled={photoBusy || writing || originBusy}><Share2 size={17} /> Compartilhar</button>
            {canWriteNfc && <button className="primary-button full" onClick={() => void writeTag()} disabled={writing || photoBusy || originBusy}><Radio size={17} /> {writing ? "Aproxime a etiqueta…" : "Gravar Hydra ID na etiqueta"}</button>}
          </div>

          <p className="public-share-note"><Nfc size={15} /> Nome da fazenda e município ajudam a identificar a origem do animal. Dados pessoais continuam privados.</p>
        </div>
      </Modal>
    </>
  );
}
