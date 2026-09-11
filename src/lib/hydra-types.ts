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
  | "found-animal"
  | "notifications"
  | "climate"
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
  state?: string;
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
  municipalityIbgeCode?: string;
  state: string;
  stateName?: string;
  postalCode: string;
  region?: string;
  street?: string;
  district?: string;
  addressComplement?: string;
  ddd?: string;
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
  productionNotebook: ProductionNotebook;
  posts: CommunityPost[];
  notifications: string[];
  settings: {
    waterAlerts: boolean;
    pushNotifications: boolean;
    premiumGoals: Record<string, boolean>;
  };
  role: UserRole;
  nfcReadCount: number;
  bannedAt?: string;
  banReason?: string;
};
