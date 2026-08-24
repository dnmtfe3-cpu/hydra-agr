export type MainTab = "home" | "water" | "herd" | "monitor" | "profile";

export type AppRoute =
  | MainTab
  | "community"
  | "challenges"
  | "property"
  | "activities"
  | "operations"
  | "assistant"
  | "today"
  | "history"
  | "nfc"
  | "notifications"
  | "plus"
  | "production"
  | "admin";

export type UserRole = "user" | "moderator" | "admin" | "owner";
export type StaffRole = "employee" | "manager";

export type PropertyAccess = {
  kind: "owner" | "staff";
  ownerUserId: string;
  memberId?: string;
  staffRole?: StaffRole;
  area?: string;
};

export type WaterSource = {
  id: string;
  name: string;
  type: string;
  status: "ativa" | "atenção" | "inativa";
};

export type WaterRecord = {
  id: string;
  date: string;
  amount: number;
  sourceId: string;
  purpose: string;
  note?: string;
};

export type AnimalHistoryEntry = {
  id: string;
  date: string;
  type: string;
  description: string;
  weight?: number;
  reminderAt?: string;
  done?: boolean;
};

export type Animal = {
  id: string;
  identification: string;
  name?: string;
  species: string;
  breed?: string;
  sex?: string;
  birthDate?: string;
  weight?: number;
  photoPath?: string;
  photoUrl?: string;
  status: string;
  electronicId?: string;
  notes?: string;
  history?: AnimalHistoryEntry[];
};

export type Sector = {
  id: string;
  name: string;
  kind: string;
  note?: string;
};

export type Activity = {
  id: string;
  title: string;
  category: string;
  date: string;
  sectorId?: string;
  animalId?: string;
  note?: string;
  done: boolean;
};

export type MonitoringRecord = {
  id: string;
  date: string;
  sectorId?: string;
  type: string;
  duration?: string;
  note?: string;
  occurrence?: string;
  photoPaths?: string[];
  photoUrls?: string[];
};

export type ProductionRecord = {
  id: string;
  product: string;
  quantity: number;
  unit: string;
  date: string;
  sectorId?: string;
  animalId?: string;
  activityId?: string;
  note?: string;
};

export type SaleRecord = {
  id: string;
  product: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  buyer?: string;
  saleType: string;
  date: string;
  productionId?: string;
};

export type ProductionExpense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  productionId?: string;
};

export type FamilyWorkRecord = {
  id: string;
  activityName: string;
  activityId?: string;
  productionId?: string;
  participants: string[];
  durationHours?: number;
  date: string;
  note?: string;
};

export type ProductionNotebook = {
  production: ProductionRecord[];
  sales: SaleRecord[];
  expenses: ProductionExpense[];
  familyWork: FamilyWorkRecord[];
};

export type CommunityComment = {
  id: string;
  authorId: string;
  author: string;
  text: string;
  date: string;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  author: string;
  authorAvatarUrl?: string;
  propertyName?: string;
  municipality?: string;
  text: string;
  date: string;
  image?: string;
  likes: number;
  liked: boolean;
  comments: CommunityComment[];
  moderationStatus: "published" | "hidden" | "removed";
};

export type Property = {
  id?: string;
  name: string;
  municipality: string;
  state: string;
  locationDetails?: string;
  coverPath?: string;
  coverUrl?: string;
  area: string;
  areaUnit: string;
  type: string;
  mainActivity: string;
  otherActivities: string[];
  approximateAnimals: string;
  waterKinds: string[];
};

export type HydraAccount = {
  id: string;
  email: string;
  phone: string;
  access: PropertyAccess;
  profile: {
    name: string;
    plan: "Gratuito" | "Hydra Agro+";
    avatarUrl?: string;
    bio?: string;
  };
  subscription: {
    status: string;
    createdAt?: string;
    premiumStartedAt?: string;
    premiumExpiresAt?: string;
    premiumDeactivatedAt?: string;
  };
  property: Property;
  waterSources: WaterSource[];
  waterRecords: WaterRecord[];
  animals: Animal[];
  sectors: Sector[];
  activities: Activity[];
  monitoring: MonitoringRecord[];
  nfcReadCount: number;
  posts: CommunityPost[];
  notifications: string[];
  settings: {
    waterAlerts: boolean;
    pushNotifications: boolean;
    premiumGoals: {
      monthlyWater?: number;
      monthlyActivities?: number;
      identifiedAnimals?: number;
    };
  };
  role: UserRole;
  bannedAt?: string;
  banReason?: string;
};

export type UpdateAccountOptions = {
  requireRemote?: boolean;
};

export type UpdateAccount = (
  updater: (current: HydraAccount) => HydraAccount,
  options?: UpdateAccountOptions,
) => Promise<void>;

export type SignupPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  property: Property;
};

export type AuthResult = {
  ok: boolean;
  message: string;
  needsEmailConfirmation?: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  level: "info" | "attention" | "critical";
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
};

export type AppLink = {
  id: string;
  label: string;
  url: string;
  description?: string;
  active: boolean;
  position: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  propertyName?: string;
  municipality?: string;
  role: UserRole;
  plan: "Gratuito" | "Hydra Agro+";
  subscriptionStatus: string;
  subscriptionCreatedAt?: string;
  premiumStartedAt?: string;
  premiumExpiresAt?: string;
  premiumDeactivatedAt?: string;
  createdAt: string;
  bannedAt?: string;
  banReason?: string;
};

export type AdminMetrics = {
  users: number;
  properties: number;
  animals: number;
  waterRecords: number;
  posts: number;
  activeSubscriptions: number;
};

export type AdminData = {
  users: AdminUser[];
  announcements: Announcement[];
  links: AppLink[];
  metrics: AdminMetrics;
};

export function makeId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

export const emptyProperty: Property = {
  name: "",
  municipality: "",
  state: "BA",
  area: "",
  areaUnit: "hectares",
  type: "",
  mainActivity: "",
  otherActivities: [],
  approximateAnimals: "",
  waterKinds: [],
};

export function createEmptyAccount(user: {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}): HydraAccount {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? "",
    access: { kind: "owner", ownerUserId: user.id },
    profile: { name: user.name?.trim() || "Produtor", plan: "Gratuito" },
    subscription: { status: "active" },
    property: { ...emptyProperty, otherActivities: [], waterKinds: [] },
    waterSources: [],
    waterRecords: [],
    animals: [],
    sectors: [],
    activities: [],
    monitoring: [],
    nfcReadCount: 0,
    posts: [],
    notifications: [],
    settings: { waterAlerts: true, pushNotifications: true, premiumGoals: {} },
    role: "user",
  };
}
