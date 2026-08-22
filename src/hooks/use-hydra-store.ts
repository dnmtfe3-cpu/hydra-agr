import { useCallback, useEffect, useRef, useState } from "react";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import type { User } from "@supabase/supabase-js";
import type {
  Announcement,
  AppLink,
  AuthResult,
  CommunityPost,
  HydraAccount,
  SignupPayload,
} from "../lib/hydra-types";
import {
  createComment,
  createPost,
  loadAccount,
  loadCommunityFeed,
  loadPublicAdminContent,
  removePost,
  recordNfcReading,
  resetPassword as requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  syncAccountDelta,
  togglePostLike,
  updateCredentials,
  uploadAvatar,
} from "../services/hydra-repository";
import { capturePhoto, signedPrivateUrl, uploadPrivateImage } from "../services/media-service";
import { signInWithStaffCode } from "../services/staff-service";
import { backendConfigured, supabase } from "../services/supabase";

export type SyncStatus = "saved" | "saving" | "offline" | "error";

export const accountCacheKey = (userId: string) => `hydra.account.cache.${userId}`;
export const accountPendingKey = (userId: string) => `hydra.account.pending.${userId}`;

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (normalized.includes("already registered") || normalized.includes("already been registered")) return "Já existe uma conta com este e-mail.";
  if (normalized.includes("password should be")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (normalized.includes("failed to fetch") || normalized.includes("network")) return "Sem conexão com o servidor. Seus dados locais continuam protegidos.";
  if (normalized.includes("row-level security")) return "O servidor recusou a operação por segurança.";
  return message || "Não foi possível concluir a operação.";
}

async function readCachedAccount(userId: string) {
  const { value } = await Preferences.get({ key: accountCacheKey(userId) });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as HydraAccount;
    return {
      ...parsed,
      access: parsed.access ?? { kind: "owner", ownerUserId: parsed.id },
      nfcReadCount: Number(parsed.nfcReadCount ?? 0),
      subscription: parsed.subscription ?? { status: "active" },
      settings: {
        waterAlerts: parsed.settings?.waterAlerts !== false,
        pushNotifications: parsed.settings?.pushNotifications !== false,
        premiumGoals: parsed.settings?.premiumGoals ?? {},
      },
    };
  } catch {
    await Preferences.remove({ key: accountCacheKey(userId) });
    return null;
  }
}

async function cacheAccount(account: HydraAccount) {
  await Preferences.set({ key: accountCacheKey(account.id), value: JSON.stringify(account) });
}

async function finishPendingSync(userId: string, expectedValue: string, account: HydraAccount) {
  const current = await Preferences.get({ key: accountPendingKey(userId) });
  if (current.value !== expectedValue) return false;
  await Preferences.remove({ key: accountPendingKey(userId) });
  await cacheAccount(account);
  return true;
}

function applyProtectedServerFields(local: HydraAccount, remote: HydraAccount): HydraAccount {
  return {
    ...local,
    id: remote.id,
    email: remote.email,
    access: remote.access,
    role: remote.role,
    bannedAt: remote.bannedAt,
    banReason: remote.banReason,
    profile: { ...local.profile, plan: remote.profile.plan },
    subscription: remote.subscription,
  };
}

export function useHydraStore() {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<HydraAccount | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [links, setLinks] = useState<AppLink[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [lastError, setLastError] = useState("");
  const accountRef = useRef<HydraAccount | null>(null);
  const userRef = useRef<User | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const bootId = useRef(0);

  const applyAccount = useCallback((next: HydraAccount | null) => {
    accountRef.current = next;
    setAccount(next);
  }, []);

  const refreshPublicContent = useCallback(async () => {
    if (!backendConfigured || !accountRef.current || accountRef.current.bannedAt) return;
    try {
      const content = await loadPublicAdminContent();
      setAnnouncements(content.announcements);
      setLinks(content.links);
    } catch {
      // Conteúdo administrativo é complementar; o restante do app continua disponível.
    }
  }, []);

  const loadUser = useCallback(async (user: User) => {
    const currentBoot = ++bootId.current;
    if (accountRef.current && accountRef.current.id !== user.id) {
      applyAccount(null);
      setAnnouncements([]);
      setLinks([]);
      setReady(false);
    }
    userRef.current = user;
    setLastError("");
    const cached = await readCachedAccount(user.id);
    if (cached && currentBoot === bootId.current) {
      applyAccount({
        ...cached,
        role: "user",
        profile: { ...cached.profile, plan: "Gratuito" },
        subscription: { status: "unverified" },
      });
      setReady(true);
    }

    try {
      const remote = await loadAccount(user);
      if (currentBoot !== bootId.current) return;
      const pendingValue = (await Preferences.get({ key: accountPendingKey(user.id) })).value;
      if (pendingValue && !remote.bannedAt) {
        const pending = applyProtectedServerFields(JSON.parse(pendingValue) as HydraAccount, remote);
        applyAccount(pending);
        setSyncStatus("saving");
        await syncAccountDelta(remote, pending);
        setSyncStatus(await finishPendingSync(user.id, pendingValue, pending) ? "saved" : "saving");
      } else {
        applyAccount(remote);
        if (remote.bannedAt) await Preferences.remove({ key: accountPendingKey(user.id) });
        await cacheAccount(remote);
        setSyncStatus("saved");
      }
      await refreshPublicContent();
    } catch (error) {
      if (currentBoot !== bootId.current) return;
      setLastError(friendlyError(error));
      setSyncStatus(cached ? "offline" : "error");
      if (!cached) applyAccount(null);
    } finally {
      if (currentBoot === bootId.current) setReady(true);
    }
  }, [applyAccount, refreshPublicContent]);

  const retrySync = useCallback(async () => {
    const user = userRef.current;
    const local = accountRef.current;
    if (!user || !local || local.bannedAt) return;
    const pendingValue = (await Preferences.get({ key: accountPendingKey(user.id) })).value;
    if (!pendingValue) {
      await refreshPublicContent();
      return;
    }
    try {
      setSyncStatus("saving");
      const remote = await loadAccount(user);
      if (remote.bannedAt) { applyAccount(remote); await Preferences.remove({ key: accountPendingKey(user.id) }); await cacheAccount(remote); setSyncStatus("saved"); return; }
      const pending = applyProtectedServerFields(JSON.parse(pendingValue) as HydraAccount, remote);
      await syncAccountDelta(remote, pending);
      setSyncStatus(await finishPendingSync(user.id, pendingValue, pending) ? "saved" : "saving");
      setLastError("");
      await refreshPublicContent();
    } catch (error) {
      setSyncStatus("offline");
      setLastError(friendlyError(error));
    }
  }, [refreshPublicContent]);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) void loadUser(data.session.user);
      else setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!active) return;
        if (event === "SIGNED_OUT" || !session?.user) {
          bootId.current += 1;
          userRef.current = null;
          applyAccount(null);
          setAnnouncements([]);
          setLinks([]);
          setSyncStatus("saved");
          setReady(true);
        } else if (session.user.id !== userRef.current?.id) {
          void loadUser(session.user);
        }
      }, 0);
    });

    let networkHandle: { remove: () => Promise<void> } | undefined;
    void Network.addListener("networkStatusChange", (status) => {
      if (status.connected) void retrySync();
      else if (accountRef.current) setSyncStatus("offline");
    }).then((handle) => { networkHandle = handle; });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      void networkHandle?.remove();
    };
  }, [applyAccount, loadUser, retrySync]);

  useEffect(() => {
    const userId = account?.id;
    const client = supabase;
    if (!client || !userId) return;
    const channel = client
      .channel(`hydra-subscription-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => { if (userRef.current) void loadUser(userRef.current); },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [account?.id, loadUser]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      setReady(false);
      const data = await signIn(email, password);
      if (!data.user) throw new Error("Sessão inválida.");
      await loadUser(data.user);
      return { ok: true, message: "Login realizado." };
    } catch (error) {
      setReady(true);
      return { ok: false, message: friendlyError(error) };
    }
  }, [loadUser]);

  const loginStaff = useCallback(async (code: string): Promise<AuthResult> => {
    try {
      setReady(false);
      const data = await signInWithStaffCode(code);
      if (!data.user) throw new Error("Sessão de funcionário inválida.");
      await loadUser(data.user);
      return { ok: true, message: "Acesso de funcionário liberado." };
    } catch (error) {
      setReady(true);
      return { ok: false, message: friendlyError(error) };
    }
  }, [loadUser]);

  const loginGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      await signInWithGoogle();
      return { ok: true, message: "Abrindo o acesso seguro do Google…" };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, []);

  const createAccount = useCallback(async (payload: SignupPayload): Promise<AuthResult> => {
    try {
      setReady(false);
      const data = await signUp(payload);
      if (!data.session || !data.user) {
        setReady(true);
        return { ok: true, needsEmailConfirmation: true, message: "Conta criada. Confirme o link enviado ao seu e-mail para entrar." };
      }
      await loadUser(data.user);
      return { ok: true, message: "Conta criada com segurança." };
    } catch (error) {
      setReady(true);
      return { ok: false, message: friendlyError(error) };
    }
  }, [loadUser]);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      if (!email.trim()) return { ok: false, message: "Informe seu e-mail primeiro." };
      await requestPasswordReset(email);
      return { ok: true, message: "Se a conta existir, você receberá um link seguro para redefinir a senha." };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, []);

  const updateAccount = useCallback((
    updater: (current: HydraAccount) => HydraAccount,
    options: { requireRemote?: boolean } = {},
  ): Promise<void> => {
    const previous = accountRef.current;
    if (!previous || previous.bannedAt) return Promise.resolve();
    const proposed = updater(previous);
    const next: HydraAccount = {
      ...proposed,
      id: previous.id,
      email: previous.email,
      access: previous.access,
      role: previous.role,
      bannedAt: previous.bannedAt,
      banReason: previous.banReason,
      profile: { ...proposed.profile, plan: previous.profile.plan },
      subscription: previous.subscription,
    };
    applyAccount(next);
    setSyncStatus("saving");
    const serializedNext = JSON.stringify(next);
    const localPersistence = Promise.all([
      cacheAccount(next),
      Preferences.set({ key: accountPendingKey(next.id), value: serializedNext }),
    ]).then(() => undefined);

    const syncOperation = syncQueue.current
      .catch(() => undefined)
      .then(async () => {
        await localPersistence;
        await syncAccountDelta(previous, next);
        setSyncStatus(await finishPendingSync(next.id, serializedNext, next) ? "saved" : "saving");
        setLastError("");
      });

    syncQueue.current = syncOperation.catch((error) => {
        setSyncStatus(navigator.onLine ? "error" : "offline");
        setLastError(friendlyError(error));
      });

    if (!options.requireRemote) return syncQueue.current;
    return syncOperation.catch(async (error) => {
      if (accountRef.current === next) applyAccount(previous);
      const pending = await Preferences.get({ key: accountPendingKey(next.id) });
      if (pending.value === serializedNext) {
        await Preferences.remove({ key: accountPendingKey(next.id) });
        await cacheAccount(previous);
      }
      throw new Error(friendlyError(error));
    });
  }, [applyAccount]);

  const logout = useCallback(async () => {
    const userId = userRef.current?.id ?? accountRef.current?.id;
    bootId.current += 1;
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
    } finally {
      userRef.current = null;
      applyAccount(null);
      setAnnouncements([]);
      setLinks([]);
      setLastError("");
      setSyncStatus("saved");
      if (userId) {
        await Promise.all([
          Preferences.remove({ key: accountCacheKey(userId) }),
          Preferences.remove({ key: accountPendingKey(userId) }),
        ]);
      }
    }
  }, [applyAccount]);

  const saveAvatar = useCallback(async (file?: File) => {
    const current = accountRef.current;
    if (!current) throw new Error("Sessão inválida.");
    const selected = file ?? await capturePhoto();
    if (!selected) return false;
    const url = await uploadAvatar(current.id, selected);
    const next = { ...current, profile: { ...current.profile, avatarUrl: url } };
    applyAccount(next);
    await cacheAccount(next);
    return true;
  }, [applyAccount]);

  const saveAnimalPhoto = useCallback(async (animalId: string, file?: File) => {
    const current = accountRef.current;
    if (!current) throw new Error("Sessão inválida.");
    if (current.access.kind === "staff" && current.access.staffRole !== "manager") throw new Error("Somente o dono ou gerente pode alterar fotos do rebanho.");
    const selected = file ?? await capturePhoto();
    if (!selected) return false;
    const path = await uploadPrivateImage(current.access.ownerUserId, selected, `animals/${animalId}-${Date.now()}`);
    const url = await signedPrivateUrl(path);
    await updateAccount((value) => ({ ...value, animals: value.animals.map((animal) => animal.id === animalId ? { ...animal, photoPath: path, photoUrl: url } : animal) }), { requireRemote: true });
    return true;
  }, [updateAccount]);

  const saveMonitoringPhoto = useCallback(async (recordId: string, file?: File) => {
    const current = accountRef.current;
    if (!current) throw new Error("Sessão inválida.");
    const selected = file ?? await capturePhoto();
    if (!selected) return false;
    const path = await uploadPrivateImage(current.access.ownerUserId, selected, `monitoring/${recordId}-${Date.now()}`);
    const url = await signedPrivateUrl(path);
    await updateAccount((value) => ({ ...value, monitoring: value.monitoring.map((record) => record.id === recordId ? { ...record, photoPaths: [...(record.photoPaths ?? []), path], photoUrls: url ? [...(record.photoUrls ?? []), url] : record.photoUrls } : record) }), { requireRemote: true });
    return true;
  }, [updateAccount]);

  const savePropertyCover = useCallback(async (file?: File) => {
    const current = accountRef.current;
    if (!current) throw new Error("Sessão inválida.");
    if (current.access.kind === "staff" && current.access.staffRole !== "manager") throw new Error("Somente o dono ou gerente pode alterar a propriedade.");
    const selected = file ?? await capturePhoto();
    if (!selected) return false;
    const propertyId = current.property.id ?? `property-${current.access.ownerUserId}`;
    const path = await uploadPrivateImage(current.access.ownerUserId, selected, `property/${propertyId}-cover-${Date.now()}`);
    const url = await signedPrivateUrl(path);
    await updateAccount((value) => ({ ...value, property: { ...value.property, coverPath: path, coverUrl: url } }), { requireRemote: true });
    return true;
  }, [updateAccount]);

  const changeCredentials = useCallback(async (values: { email?: string; password?: string }): Promise<AuthResult> => {
    try {
      if (accountRef.current?.access.kind === "staff") return { ok: false, message: "Funcionários entram usando o código fornecido pelo dono da propriedade." };
      await updateCredentials(values);
      return { ok: true, message: values.email ? "Confirme a alteração no novo e-mail." : "Senha atualizada." };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, []);

  const registerNfcRead = useCallback(async (code: string) => {
    const recorded = await recordNfcReading(code);
    const current = accountRef.current;
    if (recorded && current) {
      const next = { ...current, nfcReadCount: current.nfcReadCount + 1 };
      applyAccount(next);
      await cacheAccount(next);
    }
    return recorded;
  }, [applyAccount]);

  const replacePosts = useCallback((posts: CommunityPost[]) => {
    const current = accountRef.current;
    if (!current) return;
    const next = { ...current, posts };
    applyAccount(next);
    void cacheAccount(next);
  }, [applyAccount]);

  const refreshCommunity = useCallback(async () => {
    try {
      replacePosts(await loadCommunityFeed());
      return { ok: true, message: "Feed atualizado." };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, [replacePosts]);

  const publishPost = useCallback(async (text: string, file?: File) => {
    const current = accountRef.current;
    if (!current) return { ok: false, message: "Sessão inválida." };
    try {
      replacePosts(await createPost(current, text, file));
      return { ok: true, message: "Publicação enviada." };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, [replacePosts]);

  const likePost = useCallback(async (post: CommunityPost) => {
    const current = accountRef.current;
    if (!current) return;
    try { replacePosts(await togglePostLike(current.id, post)); }
    catch (error) { setLastError(friendlyError(error)); }
  }, [replacePosts]);

  const commentPost = useCallback(async (postId: string, text: string) => {
    const current = accountRef.current;
    if (!current) return { ok: false, message: "Sessão inválida." };
    try {
      replacePosts(await createComment(current.id, postId, text));
      return { ok: true, message: "Comentário enviado." };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, [replacePosts]);

  const deletePost = useCallback(async (postId: string) => {
    try {
      replacePosts(await removePost(postId));
      return { ok: true, message: "Publicação removida." };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  }, [replacePosts]);

  return {
    configured: backendConfigured,
    ready,
    account,
    announcements,
    links,
    syncStatus,
    lastError,
    login,
    loginGoogle,
    loginStaff,
    createAccount,
    resetPassword,
    updateAccount,
    logout,
    retrySync,
    refreshPublicContent,
    saveAvatar,
    saveAnimalPhoto,
    saveMonitoringPhoto,
    savePropertyCover,
    changeCredentials,
    registerNfcRead,
    refreshCommunity,
    publishPost,
    likePost,
    commentPost,
    deletePost,
  };
}
