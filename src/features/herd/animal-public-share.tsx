import { ChevronRight, Copy, Image as ImageIcon, LoaderCircle, Nfc, QrCode, Radio, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { Animal } from "../../lib/hydra-types";
import { uploadPublicImage } from "../../services/media-service";
import { canWriteNfcUrl, writeNfcUrl } from "../../services/nfc-service";
import { requireSupabase } from "../../services/supabase";
import { buildPublicAnimalUrl } from "./public-animal-card";

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
  const publicUrl = useMemo(() => buildPublicAnimalUrl(animal, publicPhotoPath), [animal, publicPhotoPath]);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(publicUrl)}`;
  const canWriteNfc = canWriteNfcUrl();
  const hasPhoto = Boolean(animal.photoPath || animal.photoUrl);

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
        const response = await fetch(animal.photoUrl);
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
    if (!open || !hasPhoto || publicPhotoPath || photoBusy) return;
    void preparePublicPhoto();
  }, [open, hasPhoto, publicPhotoPath]);

  async function currentPublicUrl() {
    const photoPath = await preparePublicPhoto();
    return buildPublicAnimalUrl(animal, photoPath);
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
      await navigator.share({ title: `${animal.name || animal.identification} · Hydra Agro`, text: "Ficha pública do animal no Hydra Agro", url });
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

  return (
    <>
      <button className="animal-public-share-button" onClick={() => setOpen(true)}>
        <span><QrCode size={20} /></span>
        <div><strong>Hydra ID · NFC / QR</strong><small>Abra a ficha pública do animal sem entrar na conta</small></div>
        <ChevronRight size={18} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} eyebrow="HYDRA ID" title="Identidade digital do animal" wide dismissible={!writing && !photoBusy}>
        <div className="public-share-modal">
          <p className="public-share-intro">O mesmo link pode ser usado no QR Code e gravado dentro da etiqueta NFC. Ao aproximar um celular da tag, a ficha pública deste animal abre no navegador sem precisar entrar no Hydra Agro.</p>

          {hasPhoto && <div className={`public-share-photo-status ${publicPhotoPath ? "ready" : photoError ? "error" : ""}`}>{photoBusy ? <LoaderCircle size={18} className="spin" /> : <ImageIcon size={18} />}<span><strong>{publicPhotoPath ? "Foto incluída" : photoError ? "Foto não incluída" : "Preparando foto"}</strong><small>{publicPhotoPath ? "Ela aparecerá ao abrir o NFC ou QR." : photoError ? "O link continuará funcionando sem a imagem." : "Criando uma cópia pública somente desta imagem."}</small></span></div>}

          <div className="public-share-qr-wrap"><img src={qrUrl} alt={`QR Code da ficha pública de ${animal.name || animal.identification}`} /></div>
          <div className="public-share-link">{publicUrl}</div>

          <div className="public-share-actions">
            <button className="secondary-button" onClick={() => void copyLink()} disabled={photoBusy || writing}><Copy size={17} /> Copiar link</button>
            <button className="secondary-button" onClick={() => void shareLink()} disabled={photoBusy || writing}><Share2 size={17} /> Compartilhar</button>
            {canWriteNfc && <button className="primary-button full" onClick={() => void writeTag()} disabled={writing || photoBusy}><Radio size={17} /> {writing ? "Aproxime a etiqueta…" : "Gravar Hydra ID na etiqueta"}</button>}
          </div>

          <p className="public-share-note"><Nfc size={15} /> Depois de gravada, a etiqueta funciona sozinha: encoste um celular compatível e toque na notificação para abrir a ficha pública. A conta, a propriedade, a equipe e as observações privadas continuam escondidas.</p>
        </div>
      </Modal>
    </>
  );
}
