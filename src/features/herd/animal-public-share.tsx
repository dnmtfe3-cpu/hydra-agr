import { ChevronRight, Copy, Image as ImageIcon, LoaderCircle, MapPin, Nfc, QrCode, Radio, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { Animal } from "../../lib/hydra-types";
import { uploadPublicImage } from "../../services/media-service";
import { canWriteNfcUrl, writeNfcUrl } from "../../services/nfc-service";
import { requireSupabase } from "../../services/supabase";
import { buildPublicAnimalUrl, type PublicAnimalOrigin } from "./public-animal-card";

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

  return (
    <>
      <button className="animal-public-share-button" onClick={() => setOpen(true)}>
        <span><QrCode size={20} /></span>
        <div><strong>Hydra ID · NFC / QR</strong><small>Abra a ficha pública do animal sem entrar na conta</small></div>
        <ChevronRight size={18} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} eyebrow="HYDRA ID" title="Identidade digital do animal" wide dismissible={!writing && !photoBusy}>
        <div className="public-share-modal">
          <p className="public-share-intro">O mesmo link pode ser usado no QR Code e gravado dentro da etiqueta NFC. Ao aproximar um celular da tag, a ficha pública abre no navegador com os dados de identificação e a propriedade de origem do animal.</p>

          <div className="public-share-photo-status ready"><MapPin size={18} /><span><strong>{originBusy ? "Localizando origem…" : origin.propertyName || "Origem identificada"}</strong><small>{origin.municipality ? `${origin.municipality} · referência de origem do animal` : "A propriedade vinculada aparece na identidade digital."}</small></span></div>

          {hasPhoto && <div className={`public-share-photo-status ${publicPhotoPath ? "ready" : photoError ? "error" : ""}`}>{photoBusy ? <LoaderCircle size={18} className="spin" /> : <ImageIcon size={18} />}<span><strong>{publicPhotoPath ? "Identificação visual pronta" : photoError ? "Identificação visual indisponível" : "Preparando identificação visual"}</strong><small>{publicPhotoPath ? "O retrato deste animal já faz parte da Hydra ID." : photoError ? "A identidade digital continua disponível normalmente, mesmo sem imagem." : "Deixando a ficha pronta para reconhecimento visual."}</small></span></div>}

          <div className="public-share-qr-wrap"><img src={qrUrl} alt={`QR Code da ficha pública de ${animal.name || animal.identification}`} /></div>
          <div className="public-share-link">{publicUrl}</div>

          <div className="public-share-actions">
            <button className="secondary-button" onClick={() => void copyLink()} disabled={photoBusy || writing || originBusy}><Copy size={17} /> Copiar link</button>
            <button className="secondary-button" onClick={() => void shareLink()} disabled={photoBusy || writing || originBusy}><Share2 size={17} /> Compartilhar</button>
            {canWriteNfc && <button className="primary-button full" onClick={() => void writeTag()} disabled={writing || photoBusy || originBusy}><Radio size={17} /> {writing ? "Aproxime a etiqueta…" : "Gravar Hydra ID na etiqueta"}</button>}
          </div>

          <p className="public-share-note"><Nfc size={15} /> A Hydra ID pode mostrar o nome da fazenda e o município para facilitar a identificação de animais que escaparem. Telefone, e-mail, endereço detalhado e dados privados continuam escondidos.</p>
        </div>
      </Modal>
    </>
  );
}
