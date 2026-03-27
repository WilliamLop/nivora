import type {
  Batch,
  DashboardLead,
  DashboardStatus,
  Lead,
  Market,
  OpsStatus,
  Segment,
  Stage,
  WorkspaceFocus,
} from "./types";

// ── Navigation ───────────────────────────────────────────────────────────────
export type DashboardView = "overview" | "pipeline" | "leads" | "studio" | "imports" | "settings" | "team";
export type ProposalScopeMode = "segment" | "batch";

export type NavItem = {
  id: DashboardView;
  label: string;
  eyebrow: string;
  description: string;
};

// ── Lead editor form state ────────────────────────────────────────────────────
export type LeadEditorMode = "create" | "edit" | "ops";

export type LeadEditorState = {
  businessName: string;
  city: string;
  niche: string;
  subniche: string;
  batchName: string;
  phone: string;
  email: string;
  website: string;
  source: string;
  websiteStatus: Lead["websiteStatus"];
  digitalPresence: Lead["digitalPresence"];
  painPointsInput: string;
  offerType: string;
  stage: Stage;
  opsStatus: OpsStatus;
  notes: string;
  lastTouch: string;
  assignedUserId: string;
  nextFollowUpAt: string;
  lastActivitySummary: string;
};

// ── Display / status helpers ──────────────────────────────────────────────────
export type DisplayStatus = {
  label: string;
  message: string;
  tone: DashboardStatus["tone"];
};

export type InternalChecklistItem = {
  title: string;
  badge: string;
  tone: DashboardStatus["tone"];
  body: string;
};

// ── CSV import preview ────────────────────────────────────────────────────────
export type ImportPreview = {
  totalRows: number;
  detectedSource: string;
  topSubniches: Array<{ label: string; total: number }>;
  sampleBusinesses: string[];
};

// ── Catalog summaries (enriched views of raw data) ───────────────────────────
export type MarketSummary = Market & {
  total: number;
  hot: number;
  segmentCount: number;
  batchCount: number;
};

export type SegmentSummary = Segment & {
  total: number;
  hot: number;
  batchCount: number;
  subnicheCount: number;
};

export type BatchSummary = Batch & {
  total: number;
  hot: number;
  stageCount: number;
};

export type SubnicheSummary = {
  label: string;
  total: number;
};

export type ResponsibleFilterOption = {
  value: string;
  label: string;
  total: number;
};

export type FollowUpTimingFilter = "all" | "overdue" | "today" | "upcoming" | "unscheduled";

export type TeamTrackingSummary = {
  memberId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  assignmentCount: number;
  assignmentLabels: string[];
  assignedLeadCount: number;
  actionableLeadCount: number;
  hotLeadCount: number;
  pendingCount: number;
  contactedCount: number;
  callbackRequestedCount: number;
  interestedCount: number;
  bookedCount: number;
  overdueCount: number;
  dueTodayCount: number;
  unscheduledCount: number;
  untouchedCount: number;
  lastActivityAt?: string;
  lastOperationalActivityAt?: string;
  lastActivitySummary?: string;
  lastActivityLeadName?: string;
  primaryScopeLabel?: string;
  targetFocus?: WorkspaceFocus;
};

// ── Derived metrics ───────────────────────────────────────────────────────────
export type MetricCard = {
  label: string;
  value: number;
  foot?: string;
};

export type InsightData = {
  bottleneck: { label: string; tip: string };
  topPainPoints: string[];
  topCity: { city: string; tip: string };
  tasks: Array<{ title: string; body: string }>;
};

export type StageSummary = {
  id: Stage;
  label: string;
  total: number;
};

export type BoardColumn = {
  stage: { id: Stage; label: string };
  leads: DashboardLead[];
};
