import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { requireSupabase } from "./supabase";

function extensionFor(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

function validateImage(file: File, maxBytes: number) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > maxBytes) {
    throw new Error(`A imagem deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
}

export async function capturePhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const photo = await Camera.getPhoto({
    quality: 82,
    allowEditing: true,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
    saveToGallery: false,
    correctOrientation: true,
  });
  if (!photo.webPath) return null;
  const blob = await fetch(photo.webPath).then((response) => response.blob());
  return new File([blob], `photo.${photo.format || extensionFor(blob.type)}`, { type: blob.type || "image/jpeg" });
}

export async function uploadPublicImage(
  bucket: "avatars" | "community-media",
  userId: string,
  file: File,
  stem: string,
) {
  validateImage(file, bucket === "avatars" ? 5 * 1024 * 1024 : 10 * 1024 * 1024);
  const client = requireSupabase();
  const extension = extensionFor(file.type);
  const path = `${userId}/${stem}.${extension}`;
  const isHydraIdPhoto = bucket === "community-media" && stem.startsWith("public-animal-");
  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: isHydraIdPhoto ? "0" : "3600",
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function uploadPrivateImage(userId: string, file: File, stem: string) {
  validateImage(file, 10 * 1024 * 1024);
  const client = requireSupabase();
  const extension = extensionFor(file.type);
  const path = `${userId}/${stem}.${extension}`;
  const { error } = await client.storage.from("farm-media").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function signedPrivateUrl(path?: string | null) {
  if (!path) return undefined;
  const { data, error } = await requireSupabase().storage.from("farm-media").createSignedUrl(path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}
