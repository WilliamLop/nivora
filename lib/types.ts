export type WebsiteStatus = "none" | "weak" | "strong";
export type DigitalPresence = "low" | "medium" | "high";
export type BatchStatus = "active" | "archived";
export type AppRole = "admin" | "setter";
export type Stage =
  | "sourced"
  | "qualified"
  | "contacted"
  | "booked"
  | "demo"
  | "proposal"
  | "closed";
export type OpsStatus =
  | "pending"
  | "no_answer"
  | "contacted"
  | "callback_requested"
  | "interested"
  | "booked"
  | "not_interested"
  | "do_not_contact";
export type LeadActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "note"
  | "assignment_change"
  | "stage_change";

export type PriorityTone = "hot" | "warm" | "cool";
export type DataMode = "preview" | "cloud" | "error";
export type StatusTone = "preview" | "cloud" | "error" | "working";
export type OfferBaseId = "landing" | "website" | "redesign";
export type OfferAddonId = "whatsapp" | "booking" | "followup" | "leadform";

export interface WorkspaceFocus {
  marketId: string;
  segmentId: string;
  batchId: string;
  city: string;
  niche: string;
  batchName: string;
  offerBaseId: OfferBaseId;
  offerAddons: OfferAddonId[];
  offer: string;
  batchSize: number;
}

export interface Market {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Segment {
  id: string;
  marketId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  marketId: string;
  segmentId: string;
  name: string;
  source: string;
  importFileName: string;
  status: BatchStatus;
  targetSize: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  marketId: string;
  segmentId: string;
  batchId: string;
  businessName: string;
  city: string;
  niche: string;
  subniche: string;
  batchName: string;
  phone: string;
  email: string;
  website: string;
  source: string;
  websiteStatus: WebsiteStatus;
  digitalPresence: DigitalPresence;
  painPoints: string[];
  offerType: string;
  stage: Stage;
  opsStatus: OpsStatus;
  notes: string;
  lastTouch: string;
  assignedUserId?: string;
  assignedAt?: string;
  assignedByUserId?: string;
  nextFollowUpAt?: string;
  lastActivityAt?: string;
  lastActivitySummary?: string;
  aiServiceId?: ProposalServiceId;
  aiServiceReason?: string;
  aiConfidence?: number;
  aiPainPoints?: string[];
  aiAudit?: string;
  aiScope?: string[];
  aiWhatsapp?: string;
  aiEmail?: string;
  aiCall?: string;
  aiModelClassify?: string;
  aiModelCopy?: string;
  aiEnrichedAt?: string;
}

export type AiImportPhase = "disabled" | "success" | "partial" | "fallback";

export interface AiImportStatus {
  phase: AiImportPhase;
  attempted: boolean;
  totalLeads: number;
  enrichedLeads: number;
  classifierModel: string;
  writerModel: string;
  message: string;
  error?: string;
}

export interface DashboardLead extends Lead {
  score: number;
  priority: PriorityTone;
  nextMove: string;
}

export interface DashboardStatus {
  tone: StatusTone;
  title: string;
  message: string;
}

export interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentAssignment {
  id: string;
  userId: string;
  marketId: string;
  segmentId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  userId: string;
  userName: string;
  activityType: LeadActivityType;
  outcome: string;
  summary: string;
  nextFollowUpAt?: string;
  createdAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface DashboardBootstrap {
  focus: WorkspaceFocus;
  leads: Lead[];
  markets: Market[];
  segments: Segment[];
  batches: Batch[];
  currentUser?: AuthenticatedUser;
  teamMembers: TeamMember[];
  segmentAssignments: SegmentAssignment[];
  dataMode: DataMode;
  storageStatus: DashboardStatus;
  accessStatus: DashboardStatus;
}

export type ProposalServiceId =
  | "landing_conversion"
  | "website_redesign"
  | "conversion_audit"
  | "whatsapp_followup"
  | "google_business_profile"
  | "booking_funnel";

export interface ProposalService {
  id: ProposalServiceId;
  label: string;
}

export interface ProposalCopy {
  service: ProposalService;
  serviceReason: string;
  audit: string;
  scope: string[];
  whatsapp: string;
  email: string;
  call: string;
  demoChecklist: string[];
  meetingGoal: string;
}

export interface ImportResult {
  leads: Lead[];
  skippedDuplicates: number;
  aiStatus: AiImportStatus;
}
