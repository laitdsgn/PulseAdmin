// Response shapes from PulseBackend/docs/reference/models.md.
import type {
  Category,
  FlagReason,
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

export type FlagTarget = "report" | "comment";

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
    | null;
};

export type FlagAction = "dismiss" | "hide" | "restore";

export type AuditEntry = {
  id: number;
  actorId: number | null;
  action: string;
  targetType: "user" | "report" | "comment" | "place";
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type Dashboard = {
  users: { total: number; newLast7Days: number; staff: number; disabled: number };
  reports: { total: number; active: number; resolved: number; hidden: number; newLast7Days: number };
  comments: { total: number; hidden: number };
  openFlags: number;
  llm: { callsToday: number; dailyLimit: number };
  reportsPerDay: { date: string; count: number }[];
  topCategories: { category: Category; count: number }[];
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
