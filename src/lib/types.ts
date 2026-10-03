// Response shapes from PulseBackend/docs/reference/models.md.
import type {
  Category,
  FlagReason,
  FlagTarget,
  PoiType,
  QuestionSource,
  QuestionStatus,
  PlaceType,
  Profile,
  ReportKind,
  ReportSource,
  ReportStatus,
  Role,
  Severity,
  Wheelchair,
} from "./enums";

export type Page<T> = { data: T[]; nextCursor: string | null };

export type AdminUser = {
  id: number;
  username: string | null;
  displayName: string | null;
  role: Role;
  isAnonymous: boolean;
  disabled: boolean;
  cities: string[];
  createdAt: string;
};

export type AdminUserDetail = AdminUser & {
  stats: {
    reports: number;
    hiddenReports: number;
    comments: number;
    hiddenComments: number;
    flagsFiled: number;
    devices: number;
    reputation: number;
    activeSessions: number;
    lastSeenAt: string | null;
  };
};

export type AuthSession = { user: AdminUser; accessToken: string; refreshToken: string };

export type Report = {
  id: string;
  cityId: string;
  createdAt: string;
  updatedAt: string;
  kind: ReportKind;
  category: Category;
  severity: Severity;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  photoUrl: string | null;
  affects: Profile[];
  status: ReportStatus;
  confirmations: number;
  resolvedVotes: number;
  source: ReportSource;
  aiConfidence: number | null;
  // transit_delay only
  line: string | null;
  delayMinutes: number | null;
  lastConfirmedAt: string | null;
  expiresAt: string | null;
};

export type AdminReport = Report & { authorId: number | null; hidden: boolean; openFlags: number };

export type AdminComment = {
  id: number;
  reportId: string;
  userId: number;
  displayName: string | null;
  body: string;
  hidden: boolean;
  createdAt: string;
};

export type AdminPlace = {
  id: string;
  cityId: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address: string | null;
  wheelchair: Wheelchair;
  accessibility: string;
  facilities: Category[];
  barriers: Category[];
  verified: boolean;
  source: "seed" | "osm";
  createdAt: string;
  updatedAt: string;
};

export type { FlagTarget };

export type FlagGroup = {
  targetType: FlagTarget;
  targetId: string;
  flagCount: number;
  reasons: Partial<Record<FlagReason, number>>;
  firstFlaggedAt: string;
  lastFlaggedAt: string;
  hidden: boolean;
  preview:
    | { title: string; category: Category; description: string | null; address: string | null }
    | { body: string; reportId: string }
    | { text: string; lat: number; lng: number }
    | { answer: "yes" | "no" | null; text: string | null; questionId: number }
    | null;
};

export type FlagAction = "dismiss" | "hide" | "restore";

export type AuditEntry = {
  id: number;
  actorId: number | null;
  action: string;
  targetType: "user" | "report" | "comment" | "place" | "question" | "answer" | "poi";
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type Dashboard = {
  users: { total: number; newLast7Days: number; staff: number; disabled: number };
  reports: {
    total: number;
    active: number;
    resolved: number;
    unverified: number;
    hidden: number;
    newLast7Days: number;
  };
  comments: { total: number; hidden: number };
  openFlags: number;
  llm: { callsToday: number; dailyLimit: number };
  reportsPerDay: { date: string; count: number }[];
  topCategories: { category: Category; count: number }[];
  community: {
    questions: { open: number; last24h: number; answersLast24h: number; hidden: number };
    presenceNow: number;
    detection: { unverified: number; confirmedLast7Days: number; signalsLast24h: number };
    transit: { feeds: number; stops: number };
    pois: number;
  };
};

export type AdminQuestion = {
  id: number;
  cityId: string;
  lat: number;
  lng: number;
  placeId: string | null;
  reportId: string | null;
  text: string;
  radiusM: number;
  source: QuestionSource;
  status: QuestionStatus;
  userId: number | null;
  displayName: string | null;
  answers: number;
  hiddenAnswers: number;
  openFlags: number;
  hidden: boolean;
  createdAt: string;
  expiresAt: string;
};

export type AdminAnswer = {
  id: number;
  questionId: number;
  userId: number;
  displayName: string | null;
  answer: "yes" | "no" | null;
  text: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminPoi = {
  id: string;
  osmId: string;
  cityId: string;
  type: PoiType;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  wheelchair: Wheelchair;
  openingHours: string | null;
  phone: string | null;
  votes: number;
  createdAt: string;
  updatedAt: string;
};

export type TransitFeed = {
  id: string;
  cityId: string;
  name: string;
  version: string | null;
  importedAt: string;
  stops: number;
  trips: number;
  servesFrom: string | null;
  servesTo: string | null;
  realtimeUrl: string | null;
  realtime: {
    fetchedAt: string | null;
    feedTimestamp: string | null;
    trips: number | null;
    lastError: { at: string; message: string } | null;
  };
};

export type SignalSpot = {
  lat: number;
  lng: number;
  category: Category;
  signals: number;
  devices: number;
  lastAt: string;
};

export type City = {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  center: { lat: number; lng: number };
  bbox: [number, number, number, number];
  timezone: string;
  locale: "pl" | "en";
  features: { tours: boolean; cityStats: boolean; weather: boolean };
};

export type CategoryCount = { category: Category; label: string; count: number; blocking: number };

export type CityStats = {
  summary: {
    activeBarriers: number;
    blockingBarriers: number;
    facilities: number;
    resolved: number;
    lastMonth: number;
    avgDaysToResolve: number | null;
  };
  barriers: CategoryCount[];
  facilities: CategoryCount[];
  problemStreets: { name: string; barriers: number; blocking: number; confirmations: number; topReportId: string }[];
  monthly: { key: string; label: string; longLabel: string; created: number; resolved: number }[];
  generatedAt: string;
};

export type Hotspot = {
  lat: number;
  lng: number;
  barriers: number;
  blocking: number;
  confirmations: number;
  topReportId: string;
  categories: { category: Category; count: number }[];
};
