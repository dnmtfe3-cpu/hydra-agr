import type { User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import {
  createEmptyAccount,
  makeId,
  type AdminData,
  type Announcement,
  type AppLink,
  type CommunityPost,
  type HydraAccount,
  type SignupPayload,
  type StaffRole,
  type UserRole,
} from "../lib/hydra-types";
import { signedPrivateUrl, uploadPublicImage } from "./media-service";
import { publicMediaUrl, requireSupabase } from "./supabase";

type Row = Record<string, unknown>;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Não foi possível concluir a operação.";
}

function throwIfError(error: unknown) {
  if (error) throw new Error(errorMessage(error));
}

function numberString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function dateString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function optionalPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function loadCommunityFeed(): Promise<CommunityPost[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("community_feed");
  throwIfError(error);
  return ((data ?? []) as Row[]).map((post) => ({
    id: String(post.id),
    authorId: String(post.authorId),
    author: String(post.author || "Produtor"),
    authorAvatarUrl: publicMediaUrl("avatars", post.authorAvatarPath as string | undefined),
    propertyName: post.propertyName ? String(post.propertyName) : undefined,
    municipality: post.municipality ? String(post.municipality) : undefined,
    text: String(post.text ?? ""),
    date: String(post.date),
    image: publicMediaUrl("community-media", post.imagePath as string | undefined),
    likes: Number(post.likes ?? 0),
    liked: Boolean(post.liked),
    moderationStatus: (post.moderationStatus as CommunityPost["moderationStatus"]) ?? "published",
    comments: ((post.comments ?? []) as Row[]).map((comment) => ({
      id: String(comment.id),
      authorId: String(comment.authorId),
      author: String(comment.author || "Produtor"),
      text: String(comment.text),
      date: String(comment.date),
    })),
  }));
}

export async function loadAccount(user: User): Promise<HydraAccount> {
  const client = requireSupabase();
  const [profileResult, roleResult, subscriptionResult, memberResult] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).single(),
    client.from("roles").select("role").eq("user_id", user.id).single(),
    client.from("subscriptions").select("plan,status,created_at,premium_started_at,premium_expires_at,premium_deactivated_at").eq("user_id", user.id).single(),
    client.from("property_members").select("id,property_id,owner_user_id,member_role,area,active").eq("user_id", user.id).eq("active", true).maybeSingle(),
  ]);
  throwIfError(profileResult.error);
  throwIfError(roleResult.error);
  throwIfError(subscriptionResult.error);
  throwIfError(memberResult.error);

  const member = memberResult.data as Row | null;
  const isStaffAccount = String(user.user_metadata?.account_type || "") === "staff";
  if (isStaffAccount && !member) {
    throw new Error("Seu acesso de funcionário foi desativado. Peça ao dono da propriedade para liberar um novo código.");
  }

  const dataOwnerId = member ? String(member.owner_user_id) : user.id;
  const profile = profileResult.data as Row;
  const base = createEmptyAccount({
    id: user.id,
    email: isStaffAccount ? "" : (user.email ?? ""),
    name: String(profile.full_name || user.user_metadata.full_name || "Produtor"),
    phone: String(profile.phone || ""),
  });
  base.access = member
    ? {
        kind: "staff",
        ownerUserId: dataOwnerId,
        memberId: String(member.id),
        staffRole: (String(member.member_role) === "manager" ? "manager" : "employee") as StaffRole,
        area: String(member.area || "Geral"),
      }
    : { kind: "owner", ownerUserId: user.id };

  const subscription = subscriptionResult.data as Row | null;
  const premiumExpiresAt = subscription?.premium_expires_at ? String(subscription.premium_expires_at) : undefined;
  const plusActive = String(subscription?.plan) === "plus"
    && String(subscription?.status) === "active"
    && (!premiumExpiresAt || new Date(premiumExpiresAt).getTime() > Date.now());
  base.role = String((roleResult.data as Row)?.role || "user") as UserRole;
  base.profile.plan = plusActive ? "Hydra Agro+" : "Gratuito";
  base.subscription = {
    status: String(subscription?.status || "active"),
    createdAt: subscription?.created_at ? String(subscription.created_at) : undefined,
    premiumStartedAt: subscription?.premium_started_at ? String(subscription.premium_started_at) : undefined,
    premiumExpiresAt,
    premiumDeactivatedAt: subscription?.premium_deactivated_at ? String(subscription.premium_deactivated_at) : undefined,
  };
  base.profile.avatarUrl = publicMediaUrl("avatars", profile.avatar_path as string | undefined);
  base.profile.bio = profile.bio ? String(profile.bio) : undefined;
  const goals = typeof profile.premium_goals === "object" && profile.premium_goals
    ? profile.premium_goals as Row
    : {};
  base.settings = {
    waterAlerts: profile.water_alerts !== false,
    pushNotifications: profile.push_notifications !== false,
    premiumGoals: {
      monthlyWater: optionalPositiveNumber(goals.monthlyWater),
      monthlyActivities: optionalPositiveNumber(goals.monthlyActivities),
      identifiedAnimals: optionalPositiveNumber(goals.identifiedAnimals),
    },
  };
  base.bannedAt = profile.banned_at ? String(profile.banned_at) : undefined;
  base.banReason = profile.ban_reason ? String(profile.ban_reason) : undefined;

  if (base.bannedAt) return base;

  const propertyResult = await client.from("properties").select("*").eq("owner_user_id", dataOwnerId).maybeSingle();
  throwIfError(propertyResult.error);
  const property = propertyResult.data as Row | null;
  if (member && !property) throw new Error("A propriedade vinculada a este funcionário não está disponível.");
  const propertyId = String(property?.id ?? `property-${dataOwnerId}`);
  base.property = {
    id: propertyId,
    name: String(property?.name ?? ""),
    municipality: String(property?.municipality ?? ""),
    state: String(property?.state ?? "BA"),
    locationDetails: property?.location_details ? String(property.location_details) : undefined,
    coverPath: property?.cover_path ? String(property.cover_path) : undefined,
    coverUrl: await signedPrivateUrl(property?.cover_path as string | undefined),
    area: numberString(property?.area),
    areaUnit: String(property?.area_unit ?? "hectares"),
    type: String(property?.property_type ?? ""),
    mainActivity: String(property?.main_activity ?? ""),
    otherActivities: (property?.other_activities as string[] | undefined) ?? [],
    approximateAnimals: numberString(property?.approximate_animals),
    waterKinds: (property?.water_kinds as string[] | undefined) ?? [],
  };

  const [sources, records, animals, sectors, activities, monitoring, tags, notifications, posts] = await Promise.all([
    client.from("water_sources").select("*").eq("owner_user_id", dataOwnerId).order("created_at"),
    client.from("water_records").select("*").eq("owner_user_id", dataOwnerId).order("recorded_on", { ascending: false }),
    client.from("animals").select("*").eq("owner_user_id", dataOwnerId).order("created_at", { ascending: false }),
    client.from("property_sectors").select("*").eq("owner_user_id", dataOwnerId).order("created_at"),
    client.from("activities").select("*").eq("owner_user_id", dataOwnerId).order("activity_date", { ascending: false }),
    client.from("monitoring_records").select("*").eq("owner_user_id", dataOwnerId).order("monitored_on", { ascending: false }),
    client.from("nfc_tags").select("read_count").eq("owner_user_id", dataOwnerId),
    client.from("notifications").select("*").eq("recipient_user_id", user.id).order("created_at", { ascending: false }),
    loadCommunityFeed(),
  ]);
  [sources, records, animals, sectors, activities, monitoring, tags, notifications].forEach((result) => throwIfError(result.error));

  base.waterSources = ((sources.data ?? []) as Row[]).map((row) => ({
    id: String(row.id), name: String(row.name), type: String(row.source_type), status: row.status as "ativa" | "atenção" | "inativa",
  }));
  base.waterRecords = ((records.data ?? []) as Row[]).map((row) => ({
    id: String(row.id), date: dateString(row.recorded_on), amount: Number(row.amount), sourceId: String(row.source_id), purpose: String(row.purpose), note: row.note ? String(row.note) : undefined,
  }));
  base.animals = await Promise.all(((animals.data ?? []) as Row[]).map(async (row) => ({
    id: String(row.id),
    identification: String(row.identification),
    name: row.name ? String(row.name) : undefined,
    species: String(row.species),
    breed: row.breed ? String(row.breed) : undefined,
    sex: row.sex ? String(row.sex) : undefined,
    birthDate: row.birth_date ? dateString(row.birth_date) : undefined,
    weight: row.weight === null || row.weight === undefined ? undefined : Number(row.weight),
    photoPath: row.photo_path ? String(row.photo_path) : undefined,
    photoUrl: await signedPrivateUrl(row.photo_path as string | undefined),
    status: String(row.status),
    electronicId: row.electronic_id ? String(row.electronic_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    history: Array.isArray(row.history) ? row.history as never[] : [],
  })));
  base.sectors = ((sectors.data ?? []) as Row[]).map((row) => ({
    id: String(row.id), name: String(row.name), kind: String(row.kind), note: row.note ? String(row.note) : undefined,
  }));
  base.activities = ((activities.data ?? []) as Row[]).map((row) => ({
    id: String(row.id), title: String(row.title), category: String(row.category), date: dateString(row.activity_date), sectorId: row.sector_id ? String(row.sector_id) : undefined, animalId: row.animal_id ? String(row.animal_id) : undefined, note: row.note ? String(row.note) : undefined, done: Boolean(row.done),
  }));
  base.monitoring = await Promise.all(((monitoring.data ?? []) as Row[]).map(async (row) => {
    const photoPaths = (row.photo_paths as string[] | undefined) ?? [];
    return {
      id: String(row.id), date: dateString(row.monitored_on), sectorId: row.sector_id ? String(row.sector_id) : undefined, type: String(row.monitoring_type), duration: row.duration ? String(row.duration) : undefined, note: row.note ? String(row.note) : undefined, occurrence: row.occurrence ? String(row.occurrence) : undefined,
      photoPaths,
      photoUrls: (await Promise.all(photoPaths.map(signedPrivateUrl))).filter(Boolean) as string[],
    };
  }));
  base.nfcReadCount = ((tags.data ?? []) as Row[]).reduce((total, row) => total + Number(row.read_count ?? 0), 0);
  base.notifications = ((notifications.data ?? []) as Row[]).map((row) => `${String(row.title)} — ${String(row.body)}`);
  base.posts = posts;
  return base;
}

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

async function syncCollection<T extends { id: string }>(
  table: string,
  previous: T[],
  next: T[],
  mapRow: (item: T) => Row,
) {
  const client = requireSupabase();
  const nextIds = new Set(next.map((item) => item.id));
  const removed = previous.filter((item) => !nextIds.has(item.id)).map((item) => item.id);
  if (removed.length > 0) {
    const { error } = await client.from(table).delete().in("id", removed);
    throwIfError(error);
  }
  const previousMap = new Map(previous.map((item) => [item.id, item]));
  const rows = next.filter((item) => changed(previousMap.get(item.id), item)).map(mapRow);
  if (rows.length > 0) {
    const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
    throwIfError(error);
  }
}

export async function syncAccountDelta(previous: HydraAccount, next: HydraAccount) {
  const client = requireSupabase();
  const actor = next.id;
  const owner = next.access?.ownerUserId || next.id;
  const propertyId = next.property.id ?? `property-${owner}`;

  if (changed(previous.profile, next.profile) || previous.phone !== next.phone || changed(previous.settings, next.settings)) {
    const { error } = await client.from("profiles").update({
      full_name: next.profile.name,
      phone: next.phone,
      bio: next.profile.bio ?? null,
      water_alerts: next.settings.waterAlerts,
      push_notifications: next.settings.pushNotifications,
      premium_goals: next.settings.premiumGoals,
    }).eq("id", actor);
    throwIfError(error);
  }

  if (changed(previous.property, next.property)) {
    const area = Number(next.property.area.replace(",", "."));
    const approximate = Number(next.property.approximateAnimals);
    const { error } = await client.from("properties").upsert({
      id: propertyId,
      owner_user_id: owner,
      name: next.property.name,
      municipality: next.property.municipality,
      state: "BA",
      location_details: next.property.locationDetails ?? null,
      cover_path: next.property.coverPath ?? null,
      area: Number.isFinite(area) ? area : null,
      area_unit: next.property.areaUnit,
      property_type: next.property.type,
      main_activity: next.property.mainActivity,
      other_activities: next.property.otherActivities,
      approximate_animals: Number.isFinite(approximate) ? approximate : null,
      water_kinds: next.property.waterKinds,
    }, { onConflict: "id" });
    throwIfError(error);
  }

  const common = { owner_user_id: owner, property_id: propertyId };
  await syncCollection("property_sectors", previous.sectors, next.sectors, (item) => ({ ...common, id: item.id, name: item.name, kind: item.kind, note: item.note ?? null }));
  await syncCollection("water_sources", previous.waterSources, next.waterSources, (item) => ({ ...common, id: item.id, name: item.name, source_type: item.type, status: item.status }));
  await syncCollection("animals", previous.animals, next.animals, (item) => ({ ...common, id: item.id, identification: item.identification, name: item.name ?? null, species: item.species, breed: item.breed ?? null, sex: item.sex ?? null, birth_date: item.birthDate || null, weight: item.weight ?? null, photo_path: item.photoPath ?? null, status: item.status, electronic_id: item.electronicId ?? null, notes: item.notes ?? null, history: item.history ?? [] }));
  await syncCollection("water_records", previous.waterRecords, next.waterRecords, (item) => ({ ...common, id: item.id, source_id: item.sourceId, recorded_on: item.date, amount: item.amount, purpose: item.purpose, note: item.note ?? null }));
  await syncCollection("activities", previous.activities, next.activities, (item) => ({ ...common, id: item.id, title: item.title, category: item.category, activity_date: item.date, sector_id: item.sectorId ?? null, animal_id: item.animalId ?? null, note: item.note ?? null, done: item.done }));
  await syncCollection("monitoring_records", previous.monitoring, next.monitoring, (item) => ({ ...common, id: item.id, monitored_on: item.date, sector_id: item.sectorId ?? null, monitoring_type: item.type, duration: item.duration ?? null, note: item.note ?? null, occurrence: item.occurrence ?? null, photo_paths: item.photoPaths ?? [] }));

  const previousLinked = previous.animals.filter((item) => item.electronicId).map((item) => ({ id: `${item.id}-electronic`, animalId: item.id, code: item.electronicId! }));
  const nextLinked = next.animals.filter((item) => item.electronicId).map((item) => ({ id: `${item.id}-electronic`, animalId: item.id, code: item.electronicId! }));
  await syncCollection("animal_identifications", previousLinked, nextLinked, (item) => ({ ...common, id: item.id, animal_id: item.animalId, identification_type: "NFC", code: item.code, active: true }));
  await syncCollection(
    "nfc_tags",
    previousLinked.map((item) => ({ ...item, id: item.id.replace(/-electronic$/, "-tag") })),
    nextLinked.map((item) => ({ ...item, id: item.id.replace(/-electronic$/, "-tag") })),
    (item) => ({ owner_user_id: owner, id: item.id, animal_id: item.animalId, code: item.code, technology: "NFC/RFID" }),
  );
}

export async function recordNfcReading(code: string) {
  const { data, error } = await requireSupabase().rpc("record_nfc_read", { tag_code: code.trim() });
  throwIfError(error);
  return Boolean(data);
}

export async function signUp(payload: SignupPayload) {
  const client = requireSupabase();
  const email = payload.email.trim().toLowerCase();
  const { data: result, error: invokeError } = await client.functions.invoke("signup-no-confirmation", {
    body: {
      name: payload.name.trim(),
      email,
      phone: payload.phone.trim(),
      password: payload.password,
      property: payload.property,
    },
  });
  throwIfError(invokeError);

  const response = result as { ok?: boolean; message?: string; code?: string } | null;
  if (!response?.ok) {
    throw new Error(response?.message || "Não foi possível criar a conta.");
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: payload.password,
  });
  throwIfError(error);
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  throwIfError(error);
  return data;
}

export async function signInWithGoogle() {
  const redirectTo = Capacitor.isNativePlatform()
    ? "br.com.hydraagro.app://auth/oauth"
    : window.location.origin;
  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  throwIfError(error);
  return data;
}

export async function resetPassword(email: string) {
  const redirectTo = Capacitor.isNativePlatform()
    ? "br.com.hydraagro.app://auth/recovery"
    : new URL("/auth/recovery", window.location.origin).toString();
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  throwIfError(error);
}

export async function updateCredentials(values: { email?: string; password?: string }) {
  const { error } = await requireSupabase().auth.updateUser(values);
  throwIfError(error);
}

export async function uploadAvatar(userId: string, file: File) {
  const client = requireSupabase();
  const path = await uploadPublicImage("avatars", userId, file, "avatar");
  const { error } = await client.from("profiles").update({ avatar_path: path }).eq("id", userId);
  throwIfError(error);
  return `${publicMediaUrl("avatars", path)}?v=${Date.now()}`;
}

export async function createPost(account: HydraAccount, text: string, imageFile?: File) {
  const client = requireSupabase();
  const id = makeId("post");
  const imagePath = imageFile ? await uploadPublicImage("community-media", account.id, imageFile, id) : null;
  const { error } = await client.from("posts").insert({ id, author_user_id: account.id, property_id: account.property.id ?? null, body: text.trim(), image_path: imagePath, moderation_status: "published" });
  throwIfError(error);
  return loadCommunityFeed();
}

export async function removePost(postId: string) {
  const { error } = await requireSupabase().from("posts").delete().eq("id", postId);
  throwIfError(error);
  return loadCommunityFeed();
}

export async function togglePostLike(userId: string, post: CommunityPost) {
  const client = requireSupabase();
  const operation = post.liked
    ? client.from("likes").delete().eq("post_id", post.id).eq("user_id", userId)
    : client.from("likes").insert({ post_id: post.id, user_id: userId });
  const { error } = await operation;
  throwIfError(error);
  return loadCommunityFeed();
}

export async function createComment(userId: string, postId: string, text: string) {
  const { error } = await requireSupabase().from("comments").insert({ id: makeId("comment"), post_id: postId, author_user_id: userId, body: text.trim(), moderation_status: "published" });
  throwIfError(error);
  return loadCommunityFeed();
}

export async function loadPublicAdminContent() {
  const client = requireSupabase();
  const [announcements, links] = await Promise.all([
    client.from("admin_announcements").select("*").eq("active", true).order("created_at", { ascending: false }),
    client.from("admin_links").select("*").eq("active", true).order("position"),
  ]);
  throwIfError(announcements.error);
  throwIfError(links.error);
  return {
    announcements: ((announcements.data ?? []) as Row[]).map(mapAnnouncement),
    links: ((links.data ?? []) as Row[]).map(mapLink),
  };
}

function mapAnnouncement(row: Row): Announcement {
  return { id: String(row.id), title: String(row.title), body: String(row.body), level: row.level as Announcement["level"], active: Boolean(row.active), startsAt: row.starts_at ? String(row.starts_at) : undefined, endsAt: row.ends_at ? String(row.ends_at) : undefined, createdAt: String(row.created_at) };
}

function mapLink(row: Row): AppLink {
  return { id: String(row.id), label: String(row.label), url: String(row.url), description: row.description ? String(row.description) : undefined, active: Boolean(row.active), position: Number(row.position ?? 0) };
}

export async function loadAdminData(): Promise<AdminData> {
  const { data, error } = await requireSupabase().rpc("admin_dashboard");
  throwIfError(error);
  return data as AdminData;
}

export async function loadModerationPosts(): Promise<CommunityPost[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("posts").select("*").order("created_at", { ascending: false });
  throwIfError(error);
  const rows = (data ?? []) as Row[];
  const authorIds = [...new Set(rows.map((row) => String(row.author_user_id)))];
  const { data: profileData, error: profileError } = authorIds.length
    ? await client.from("profiles").select("id,full_name,avatar_path").in("id", authorIds)
    : { data: [], error: null };
  throwIfError(profileError);
  const profiles = new Map(((profileData ?? []) as Row[]).map((row) => [String(row.id), row]));
  return rows.map((row) => {
    const authorId = String(row.author_user_id);
    const profile = profiles.get(authorId);
    return {
      id: String(row.id),
      authorId,
      author: String(profile?.full_name || "Produtor"),
      authorAvatarUrl: publicMediaUrl("avatars", profile?.avatar_path as string | undefined),
      text: String(row.body ?? ""),
      date: String(row.created_at),
      image: publicMediaUrl("community-media", row.image_path as string | undefined),
      likes: 0,
      liked: false,
      comments: [],
      moderationStatus: row.moderation_status as CommunityPost["moderationStatus"],
    };
  });
}

export async function setUserBan(userId: string, banned: boolean, reason?: string) {
  const { error } = await requireSupabase().rpc("admin_set_user_ban", { target_user_id: userId, should_ban: banned, reason: reason ?? null });
  throwIfError(error);
}

export async function setUserRole(userId: string, role: Exclude<UserRole, "owner">) {
  const { error } = await requireSupabase().rpc("admin_set_user_role", { target_user_id: userId, next_role: role });
  throwIfError(error);
}

export async function setUserSubscription(userId: string, enablePlus: boolean, premiumUntil?: string) {
  const { error } = await requireSupabase().rpc("admin_set_subscription", {
    target_user_id: userId,
    enable_plus: enablePlus,
    premium_until: premiumUntil ? new Date(`${premiumUntil}T23:59:59-03:00`).toISOString() : null,
  });
  throwIfError(error);
}

export async function sendAdminNotification(userId: string, title: string, body: string) {
  const { error } = await requireSupabase().rpc("admin_send_notification", { target_user_id: userId, notification_title: title, notification_body: body });
  throwIfError(error);
}

export async function moderatePost(postId: string, status: "published" | "hidden" | "removed") {
  const { error } = await requireSupabase().rpc("admin_moderate_post", { target_post_id: postId, next_status: status });
  throwIfError(error);
}

export async function saveAnnouncement(userId: string, value: Omit<Announcement, "createdAt">) {
  const { error } = await requireSupabase().from("admin_announcements").upsert({ id: value.id, title: value.title.trim(), body: value.body.trim(), level: value.level, active: value.active, starts_at: value.startsAt || null, ends_at: value.endsAt || null, created_by: userId }, { onConflict: "id" });
  throwIfError(error);
}

export async function deleteAnnouncement(id: string) {
  const { error } = await requireSupabase().from("admin_announcements").delete().eq("id", id);
  throwIfError(error);
}

export async function saveAppLink(userId: string, value: AppLink) {
  const { error } = await requireSupabase().from("admin_links").upsert({ id: value.id, label: value.label.trim(), url: value.url.trim(), description: value.description?.trim() || null, active: value.active, position: value.position, created_by: userId }, { onConflict: "id" });
  throwIfError(error);
}

export async function deleteAppLink(id: string) {
  const { error } = await requireSupabase().from("admin_links").delete().eq("id", id);
  throwIfError(error);
}
