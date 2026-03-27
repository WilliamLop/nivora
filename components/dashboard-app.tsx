"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import {
  STAGES,
  buildBatchId,
  buildMarketId,
  buildProposal,
  buildSegmentId,
  createLeadFingerprint,
  dedupeIncomingLeads,
  decorateLeads,
  labelForAppRole,
  mapCsvRowToLead,
  normalizeFocus,
  parseCsv,
} from "@/lib/dashboard";
import type {
  AppRole,
  AiImportStatus,
  AuthenticatedUser,
  Batch,
  DashboardBootstrap,
  DashboardLead,
  DashboardStatus,
  DataMode,
  Lead,
  LeadActivity,
  Market,
  OpsStatus,
  Segment,
  SegmentAssignment,
  Stage,
  TeamMember,
  WorkspaceFocus,
} from "@/lib/types";
import type {
  DashboardView,
  FollowUpTimingFilter,
  LeadEditorMode,
  LeadEditorState,
  NavItem,
  MarketSummary,
  ResponsibleFilterOption,
  SegmentSummary,
  TeamTrackingSummary,
  ProposalScopeMode,
} from "@/lib/component-types";
import {
  buildMarketSummaries,
  buildSegmentSummaries,
  buildBatchSummaries,
  buildSubnicheSummaries,
  resolveOperationalFocus,
  createMarketFromFocus,
  createSegmentFromFocus,
  createBatchFromFocus,
  upsertMarket,
  upsertSegment,
  upsertBatch,
  mergeCatalogFromLead,
  createLeadEditorState,
  buildLeadPayload,
  apiRequest,
  getErrorMessage,
  escapeHtml,
  isCsvLikeFile,
  formatFileSize,
  formatSkippedDuplicates,
} from "@/lib/component-helpers";
import {
  getOperationalStatus,
  getActivityFeedback,
  getBottleneck,
  getTopPainPoints,
  getTopCity,
  getImmediateTasks,
  buildImportPreview,
  buildImportReadyMessage,
  cleanStatusTitle,
  statusChipClass,
} from "@/lib/ui-helpers";

import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { LeadDrawer } from "@/components/lead-drawer";
import { BulkDeleteModal } from "@/components/bulk-delete-modal";
import { WorkspaceSwitcherDrawer } from "@/components/workspace-switcher-drawer";
import { OverviewView } from "@/components/views/overview-view";
import { MercadosView } from "@/components/views/mercados-view";
import { PipelineView } from "@/components/views/pipeline-view";
import { ImportsView } from "@/components/views/imports-view";
import { StudioView } from "@/components/views/studio-view";
import { SettingsView } from "@/components/views/settings-view";
import { TeamView } from "@/components/views/team-view";

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Inicio",
    eyebrow: "Panel",
    description: "Panorama breve del mercado activo y lo que conviene mover hoy.",
  },
  {
    id: "leads",
    label: "Mercados",
    eyebrow: "CRM",
    description: "Base principal para trabajar negocios por ciudad, nicho e importacion.",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    eyebrow: "Seguimiento",
    description: "Vista por etapas para mover la conversacion comercial con claridad.",
  },
  {
    id: "imports",
    label: "Importaciones",
    eyebrow: "Carga",
    description: "Carga un CSV y ubicalo en la ciudad y nicho correctos.",
  },
  {
    id: "studio",
    label: "Propuestas",
    eyebrow: "Mensajes",
    description: "Guiones y materiales listos para WhatsApp, email y PDF.",
  },
  {
    id: "settings",
    label: "Configuracion",
    eyebrow: "Sistema",
    description: "Ajusta estructura, capacidad y contexto persistido del tablero.",
  },
  {
    id: "team",
    label: "Equipo",
    eyebrow: "CRM",
    description: "Crea usuarios, asigna nichos y administra acceso operativo.",
  },
];

const SETTER_NAV_ITEMS: NavItem[] = [
  {
    id: "leads",
    label: "Mi cartera",
    eyebrow: "CRM",
    description: "Trabaja solamente los leads asignados a tu operación.",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    eyebrow: "Seguimiento",
    description: "Mueve tus leads por etapa sin salir de tu cartera.",
  },
  {
    id: "studio",
    label: "Propuestas",
    eyebrow: "Mensajes",
    description: "Abre materiales y guiones solo para los leads que te pertenecen.",
  },
];

function getNavItemsForRole(role?: AppRole | null) {
  if (role === "setter") {
    return SETTER_NAV_ITEMS;
  }

  if (role === "admin") {
    return ADMIN_NAV_ITEMS;
  }

  return ADMIN_NAV_ITEMS.filter((item) => item.id !== "team");
}

const CSV_INPUT_ID = "dashboard-csv-input";
const RESPONSIBLE_FILTER_ALL = "all";
const RESPONSIBLE_FILTER_UNASSIGNED = "__unassigned__";
const TEAM_ACTIONABLE_OPS_STATUSES = new Set<OpsStatus>([
  "pending",
  "no_answer",
  "contacted",
  "callback_requested",
  "interested",
]);

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLeadActivityTimestamp(lead: Lead | DashboardLead) {
  const timestamp = lead.lastActivityAt || lead.assignedAt || lead.lastTouch;
  const millis = timestamp ? new Date(timestamp).getTime() : 0;
  return Number.isFinite(millis) ? millis : 0;
}

function getLeadFollowUpTiming(
  lead: Pick<Lead | DashboardLead, "nextFollowUpAt">,
  todayKey = getLocalDateKey()
): Exclude<FollowUpTimingFilter, "all"> {
  const followUpKey = lead.nextFollowUpAt?.slice(0, 10) || "";

  if (!followUpKey) {
    return "unscheduled";
  }

  if (followUpKey < todayKey) {
    return "overdue";
  }

  if (followUpKey === todayKey) {
    return "today";
  }

  return "upcoming";
}

function labelForFollowUpTimingFilter(value: FollowUpTimingFilter) {
  switch (value) {
    case "overdue":
      return "Agenda vencida";
    case "today":
      return "Agenda para hoy";
    case "upcoming":
      return "Próximos seguimientos";
    case "unscheduled":
      return "Sin próxima fecha";
    default:
      return "Todas las fechas";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type DashboardAppProps = {
  initialData: DashboardBootstrap;
};

export function DashboardApp({ initialData }: DashboardAppProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [currentUser] = useState<AuthenticatedUser | null>(initialData.currentUser ?? null);
  const [activeView, setActiveView] = useState<DashboardView>("leads");
  const [focus, setFocus] = useState<WorkspaceFocus>(normalizeFocus(initialData.focus));
  const [focusDraft, setFocusDraft] = useState<WorkspaceFocus>(normalizeFocus(initialData.focus));
  const [leads, setLeads] = useState<Lead[]>(initialData.leads);
  const [markets, setMarkets] = useState<Market[]>(initialData.markets);
  const [segments, setSegments] = useState<Segment[]>(initialData.segments);
  const [batches, setBatches] = useState<Batch[]>(initialData.batches);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialData.teamMembers);
  const [segmentAssignments, setSegmentAssignments] = useState<SegmentAssignment[]>(initialData.segmentAssignments);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [isLoadingLeadActivities, setIsLoadingLeadActivities] = useState(false);
  const [leadActivitiesError, setLeadActivitiesError] = useState("");
  const [storageStatus, setStorageStatus] = useState<DashboardStatus>(initialData.storageStatus);
  const [dataMode, setDataMode] = useState<DataMode>(initialData.dataMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [opsStatusFilter, setOpsStatusFilter] = useState<OpsStatus | "all">("all");
  const [followUpTimingFilter, setFollowUpTimingFilter] = useState<FollowUpTimingFilter>("all");
  const [batchFilter, setBatchFilter] = useState<string>(initialData.focus.batchId || "all");
  const [subnicheFilter, setSubnicheFilter] = useState<string>("all");
  const [responsibleFilter, setResponsibleFilter] = useState<string>(RESPONSIBLE_FILTER_ALL);
  const [selectedLeadId, setSelectedLeadId] = useState(initialData.leads[0]?.id ?? "");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedAssignmentUserId, setSelectedAssignmentUserId] = useState("");
  const [proposalScopeMode, setProposalScopeMode] = useState<ProposalScopeMode>("segment");
  const [proposalMessage, setProposalMessage] = useState(
    "Selecciona un lead para preparar guion, auditoria y exportacion PDF."
  );
  const [importMessage, setImportMessage] = useState(
    "Selecciona un archivo y define ciudad, nicho e importacion antes de cargar."
  );
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ReturnType<typeof buildImportPreview> | null>(null);
  const [isImportDragOver, setIsImportDragOver] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isLeadEditorOpen, setIsLeadEditorOpen] = useState(false);
  const [leadEditorMode, setLeadEditorMode] = useState<LeadEditorMode>("create");
  const [leadEditor, setLeadEditor] = useState<LeadEditorState>(() => createLeadEditorState(initialData.focus));
  const [leadDrawerOriginView, setLeadDrawerOriginView] = useState<DashboardView | null>(null);
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<{
    ids: string[];
    leads: DashboardLead[];
  } | null>(null);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  const deferredSearch = useDeferredValue(searchQuery);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const importProgressTimerRef = useRef<number | null>(null);
  const selectedCsvFileName = selectedCsvFile?.name ?? "";
  const userRole = currentUser?.role || null;
  const isSetter = userRole === "setter";
  const isAdmin = userRole === "admin";
  const canManageWorkspace = !currentUser || isAdmin;
  const canCreateLead = !currentUser || isAdmin;
  const canDeleteLead = !currentUser || isAdmin;
  const canImport = !currentUser || isAdmin;
  const canManageTeam = isAdmin;
  const availableNavItems = useMemo(() => getNavItemsForRole(userRole), [userRole]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const dashboardLeads = useMemo(() => decorateLeads(leads), [leads]);
  const currentUserSegmentAssignments = useMemo(
    () =>
      currentUser
        ? segmentAssignments.filter(
            (assignment) => assignment.userId === currentUser.id && assignment.isActive
          )
        : [],
    [currentUser, segmentAssignments]
  );
  const scopedMarkets = useMemo(() => {
    if (!isSetter) {
      return markets;
    }

    const marketIds = new Set<string>();
    dashboardLeads.forEach((lead) => marketIds.add(lead.marketId));
    currentUserSegmentAssignments.forEach((assignment) => marketIds.add(assignment.marketId));
    return markets.filter((market) => marketIds.has(market.id));
  }, [isSetter, markets, dashboardLeads, currentUserSegmentAssignments]);
  const scopedSegments = useMemo(() => {
    if (!isSetter) {
      return segments;
    }

    const segmentIds = new Set<string>();
    dashboardLeads.forEach((lead) => segmentIds.add(lead.segmentId));
    currentUserSegmentAssignments.forEach((assignment) => segmentIds.add(assignment.segmentId));
    return segments.filter((segment) => segmentIds.has(segment.id));
  }, [isSetter, segments, dashboardLeads, currentUserSegmentAssignments]);
  const scopedBatches = useMemo(() => {
    if (!isSetter) {
      return batches;
    }

    const segmentIds = new Set(scopedSegments.map((segment) => segment.id));
    const batchIds = new Set<string>();
    dashboardLeads.forEach((lead) => batchIds.add(lead.batchId));
    batches.forEach((batch) => {
      if (segmentIds.has(batch.segmentId)) {
        batchIds.add(batch.id);
      }
    });
    return batches.filter((batch) => batchIds.has(batch.id));
  }, [isSetter, batches, dashboardLeads, scopedSegments]);

  const marketSummaries = useMemo(
    () => buildMarketSummaries(scopedMarkets, dashboardLeads, focus),
    [scopedMarkets, dashboardLeads, focus]
  );
  const segmentSummaries = useMemo(
    () => buildSegmentSummaries(scopedSegments, dashboardLeads, focus),
    [scopedSegments, dashboardLeads, focus]
  );
  const batchSummaries = useMemo(
    () => buildBatchSummaries(scopedBatches, dashboardLeads, focus),
    [scopedBatches, dashboardLeads, focus]
  );
  const teamMarketSummaries = useMemo(() => {
    const grouped = new Map<string, MarketSummary>();

    const ensureMarket = (market: Pick<MarketSummary, "id" | "name" | "description" | "createdAt" | "updatedAt">) => {
      const current = grouped.get(market.id);
      if (current) {
        return current;
      }

      const next: MarketSummary = {
        ...market,
        total: 0,
        hot: 0,
        segmentCount: 0,
        batchCount: 0,
      };
      grouped.set(market.id, next);
      return next;
    };

    markets.forEach((market) => ensureMarket(market));

    dashboardLeads.forEach((lead) => {
      const current = ensureMarket({
        id: lead.marketId,
        name: lead.city,
        description: "",
        createdAt: lead.lastTouch,
        updatedAt: lead.lastTouch,
      });
      current.total += 1;
      current.hot += lead.priority === "hot" ? 1 : 0;
    });

    grouped.forEach((market) => {
      const marketLeads = dashboardLeads.filter((lead) => lead.marketId === market.id);
      market.segmentCount = new Set(marketLeads.map((lead) => lead.segmentId)).size;
      market.batchCount = new Set(marketLeads.map((lead) => lead.batchId)).size;
    });

    return [...grouped.values()].sort((a, b) =>
      b.total !== a.total ? b.total - a.total : a.name.localeCompare(b.name)
    );
  }, [markets, dashboardLeads]);
  const teamSegmentSummaries = useMemo(() => {
    const grouped = new Map<string, SegmentSummary>();

    const ensureSegment = (
      segment: Pick<
        SegmentSummary,
        "id" | "marketId" | "name" | "description" | "createdAt" | "updatedAt"
      >
    ) => {
      const current = grouped.get(segment.id);
      if (current) {
        return current;
      }

      const next: SegmentSummary = {
        ...segment,
        total: 0,
        hot: 0,
        batchCount: 0,
        subnicheCount: 0,
      };
      grouped.set(segment.id, next);
      return next;
    };

    segments.forEach((segment) => ensureSegment(segment));

    dashboardLeads.forEach((lead) => {
      const current = ensureSegment({
        id: lead.segmentId,
        marketId: lead.marketId,
        name: lead.niche,
        description: "",
        createdAt: lead.lastTouch,
        updatedAt: lead.lastTouch,
      });
      current.total += 1;
      current.hot += lead.priority === "hot" ? 1 : 0;
    });

    grouped.forEach((segment) => {
      const segmentLeads = dashboardLeads.filter((lead) => lead.segmentId === segment.id);
      segment.batchCount = new Set(segmentLeads.map((lead) => lead.batchId)).size;
      segment.subnicheCount = new Set(segmentLeads.map((lead) => lead.subniche)).size;
    });

    return [...grouped.values()].sort((a, b) =>
      b.total !== a.total ? b.total - a.total : a.name.localeCompare(b.name)
    );
  }, [segments, dashboardLeads]);

  const marketScopedLeads = useMemo(
    () => dashboardLeads.filter((lead) => lead.marketId === focus.marketId),
    [dashboardLeads, focus.marketId]
  );
  const segmentScopedLeads = useMemo(
    () =>
      dashboardLeads.filter(
        (lead) => lead.marketId === focus.marketId && lead.segmentId === focus.segmentId
      ),
    [dashboardLeads, focus.marketId, focus.segmentId]
  );
  const activeSetterMembers = useMemo(
    () => teamMembers.filter((member) => member.isActive && member.role === "setter"),
    [teamMembers]
  );
  const teamTrackingSummaries = useMemo<TeamTrackingSummary[]>(() => {
    const todayKey = getLocalDateKey();
    const activeAssignments = segmentAssignments.filter((assignment) => assignment.isActive);
    const assignmentsByUserId = new Map<string, SegmentAssignment[]>();
    const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
    const marketById = new Map(markets.map((market) => [market.id, market]));
    const batchById = new Map(batches.map((batch) => [batch.id, batch]));

    activeAssignments.forEach((assignment) => {
      const current = assignmentsByUserId.get(assignment.userId) || [];
      current.push(assignment);
      assignmentsByUserId.set(assignment.userId, current);
    });

    return activeSetterMembers
      .map((member) => {
        const memberAssignments = assignmentsByUserId.get(member.id) || [];
        const assignedLeads = dashboardLeads.filter((lead) => lead.assignedUserId === member.id);
        const assignmentLabels = memberAssignments
          .map((assignment) => {
            const market = marketById.get(assignment.marketId);
            const segment = segmentById.get(assignment.segmentId);
            const marketName = market?.name || assignment.marketId;
            const segmentName = segment?.name || assignment.segmentId;
            return `${marketName} / ${segmentName}`;
          })
          .sort((left, right) => left.localeCompare(right));

        let pendingCount = 0;
        let contactedCount = 0;
        let callbackRequestedCount = 0;
        let interestedCount = 0;
        let bookedCount = 0;
        let overdueCount = 0;
        let dueTodayCount = 0;
        let hotLeadCount = 0;
        let actionableLeadCount = 0;
        let unscheduledCount = 0;
        let untouchedCount = 0;

        assignedLeads.forEach((lead) => {
          if (lead.priority === "hot") {
            hotLeadCount += 1;
          }

          switch (lead.opsStatus) {
            case "pending":
            case "no_answer":
              pendingCount += 1;
              break;
            case "contacted":
              contactedCount += 1;
              break;
            case "callback_requested":
              callbackRequestedCount += 1;
              break;
            case "interested":
              interestedCount += 1;
              break;
            case "booked":
              bookedCount += 1;
              break;
          }

          switch (getLeadFollowUpTiming(lead, todayKey)) {
            case "overdue":
              overdueCount += 1;
              break;
            case "today":
              dueTodayCount += 1;
              break;
          }

          if (TEAM_ACTIONABLE_OPS_STATUSES.has(lead.opsStatus)) {
            actionableLeadCount += 1;

            if (!lead.nextFollowUpAt) {
              unscheduledCount += 1;
            }

            if (!lead.lastActivityAt) {
              untouchedCount += 1;
            }
          }
        });

        const latestLead =
          [...assignedLeads].sort((left, right) => getLeadActivityTimestamp(right) - getLeadActivityTimestamp(left))[0] ||
          null;
        const latestOperationalLead =
          [...assignedLeads]
            .filter((lead) => Boolean(lead.lastActivityAt))
            .sort((left, right) => getLeadActivityTimestamp(right) - getLeadActivityTimestamp(left))[0] || null;

        const segmentBuckets = new Map<
          string,
          {
            marketId: string;
            segmentId: string;
            city: string;
            niche: string;
            leadCount: number;
            latestTimestamp: number;
            primaryLead: DashboardLead | null;
          }
        >();

        memberAssignments.forEach((assignment) => {
          const market = marketById.get(assignment.marketId);
          const segment = segmentById.get(assignment.segmentId);
          segmentBuckets.set(assignment.segmentId, {
            marketId: assignment.marketId,
            segmentId: assignment.segmentId,
            city: market?.name || assignment.marketId,
            niche: segment?.name || assignment.segmentId,
            leadCount: 0,
            latestTimestamp: 0,
            primaryLead: null,
          });
        });

        assignedLeads.forEach((lead) => {
          const current = segmentBuckets.get(lead.segmentId) || {
            marketId: lead.marketId,
            segmentId: lead.segmentId,
            city: lead.city,
            niche: lead.niche,
            leadCount: 0,
            latestTimestamp: 0,
            primaryLead: null,
          };
          current.leadCount += 1;
          const timestamp = getLeadActivityTimestamp(lead);
          if (!current.primaryLead || timestamp >= current.latestTimestamp) {
            current.latestTimestamp = timestamp;
            current.primaryLead = lead;
          }
          segmentBuckets.set(lead.segmentId, current);
        });

        const primaryBucket =
          [...segmentBuckets.values()].sort((left, right) => {
            if (right.leadCount !== left.leadCount) {
              return right.leadCount - left.leadCount;
            }
            if (right.latestTimestamp !== left.latestTimestamp) {
              return right.latestTimestamp - left.latestTimestamp;
            }
            return left.niche.localeCompare(right.niche);
          })[0] || null;

        const primaryBatch =
          (primaryBucket?.primaryLead ? batchById.get(primaryBucket.primaryLead.batchId) : null) ||
          (primaryBucket
            ? batches.find(
                (batch) =>
                  batch.marketId === primaryBucket.marketId && batch.segmentId === primaryBucket.segmentId
              ) || null
            : null);

        const targetFocus = primaryBucket
          ? normalizeFocus({
              ...focus,
              marketId: primaryBucket.marketId,
              segmentId: primaryBucket.segmentId,
              batchId:
                primaryBatch?.id ||
                buildBatchId(primaryBucket.city, primaryBucket.niche, focus.batchName || "Base activa"),
              city: primaryBucket.city,
              niche: primaryBucket.niche,
              batchName: primaryBatch?.name || focus.batchName || "Base activa",
              batchSize: primaryBatch?.targetSize || focus.batchSize,
            })
          : undefined;

        return {
          memberId: member.id,
          fullName: member.fullName,
          email: member.email,
          isActive: member.isActive,
          mustChangePassword: member.mustChangePassword,
          assignmentCount: memberAssignments.length,
          assignmentLabels,
          assignedLeadCount: assignedLeads.length,
          actionableLeadCount,
          hotLeadCount,
          pendingCount,
          contactedCount,
          callbackRequestedCount,
          interestedCount,
          bookedCount,
          overdueCount,
          dueTodayCount,
          unscheduledCount,
          untouchedCount,
          lastActivityAt: latestLead?.lastActivityAt || latestLead?.assignedAt || latestLead?.lastTouch,
          lastOperationalActivityAt: latestOperationalLead?.lastActivityAt,
          lastActivitySummary: latestLead?.lastActivitySummary,
          lastActivityLeadName: latestLead?.businessName,
          primaryScopeLabel: primaryBucket ? `${primaryBucket.city} / ${primaryBucket.niche}` : undefined,
          targetFocus,
        };
      })
      .sort((left, right) => {
        if (right.overdueCount !== left.overdueCount) {
          return right.overdueCount - left.overdueCount;
        }
        if (right.dueTodayCount !== left.dueTodayCount) {
          return right.dueTodayCount - left.dueTodayCount;
        }
        if (right.assignedLeadCount !== left.assignedLeadCount) {
          return right.assignedLeadCount - left.assignedLeadCount;
        }
        return left.fullName.localeCompare(right.fullName);
      });
  }, [activeSetterMembers, segmentAssignments, segments, markets, batches, dashboardLeads, focus]);
  const responsibleFilterOptions = useMemo<ResponsibleFilterOption[]>(() => {
    if (!isAdmin) {
      return [];
    }

    const assignedTotals = new Map<string, number>();
    let unassignedTotal = 0;

    segmentScopedLeads.forEach((lead) => {
      if (lead.assignedUserId) {
        assignedTotals.set(lead.assignedUserId, (assignedTotals.get(lead.assignedUserId) || 0) + 1);
        return;
      }

      unassignedTotal += 1;
    });

    return [
      { value: RESPONSIBLE_FILTER_ALL, label: "Todos", total: segmentScopedLeads.length },
      ...activeSetterMembers.map((member) => ({
        value: member.id,
        label: member.fullName,
        total: assignedTotals.get(member.id) || 0,
      })),
      { value: RESPONSIBLE_FILTER_UNASSIGNED, label: "Sin asignar", total: unassignedTotal },
    ];
  }, [isAdmin, segmentScopedLeads, activeSetterMembers]);
  const activeResponsibleFilter = useMemo(
    () => responsibleFilterOptions.find((option) => option.value === responsibleFilter) ?? null,
    [responsibleFilterOptions, responsibleFilter]
  );
  const responsibleScopedLeads = useMemo(() => {
    if (!isAdmin || responsibleFilter === RESPONSIBLE_FILTER_ALL) {
      return segmentScopedLeads;
    }

    if (responsibleFilter === RESPONSIBLE_FILTER_UNASSIGNED) {
      return segmentScopedLeads.filter((lead) => !lead.assignedUserId);
    }

    return segmentScopedLeads.filter((lead) => lead.assignedUserId === responsibleFilter);
  }, [isAdmin, responsibleFilter, segmentScopedLeads]);
  const responsibleBatchSummaries = useMemo(
    () => buildBatchSummaries(scopedBatches, responsibleScopedLeads, focus),
    [scopedBatches, responsibleScopedLeads, focus]
  );
  const proposalLeads = useMemo(() => {
    if (proposalScopeMode === "batch") {
      return responsibleScopedLeads.filter((lead) => lead.batchId === focus.batchId);
    }

    return responsibleScopedLeads;
  }, [proposalScopeMode, responsibleScopedLeads, focus.batchId]);
  const visibleLeads = useMemo(
    () => responsibleScopedLeads.filter((lead) => batchFilter === "all" || lead.batchId === batchFilter),
    [responsibleScopedLeads, batchFilter]
  );
  const subnicheSummaries = useMemo(() => buildSubnicheSummaries(visibleLeads), [visibleLeads]);
  const selectedLeadFromData = useMemo(
    () => dashboardLeads.find((lead) => lead.id === selectedLeadId) ?? null,
    [dashboardLeads, selectedLeadId]
  );

  const filteredLeads = useMemo(() => {
    const todayKey = getLocalDateKey();
    const q = deferredSearch.trim().toLowerCase();
    return visibleLeads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.businessName.toLowerCase().includes(q) ||
        lead.subniche.toLowerCase().includes(q) ||
        lead.batchName.toLowerCase().includes(q);
      const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
      const matchesOpsStatus = opsStatusFilter === "all" || lead.opsStatus === opsStatusFilter;
      const matchesSubniche = subnicheFilter === "all" || lead.subniche === subnicheFilter;
      const matchesFollowUpTiming =
        followUpTimingFilter === "all" || getLeadFollowUpTiming(lead, todayKey) === followUpTimingFilter;
      return matchesSearch && matchesStage && matchesOpsStatus && matchesSubniche && matchesFollowUpTiming;
    });
  }, [visibleLeads, deferredSearch, stageFilter, opsStatusFilter, subnicheFilter, followUpTimingFilter]);

  const selectionPool = useMemo(
    () =>
      activeView === "studio"
        ? proposalLeads
        : filteredLeads.length
          ? filteredLeads
          : visibleLeads.length
            ? visibleLeads
            : responsibleScopedLeads,
    [activeView, proposalLeads, filteredLeads, visibleLeads, responsibleScopedLeads]
  );
  const selectedLeadInPool = selectionPool.find((lead) => lead.id === selectedLeadId) ?? null;
  const selectedLead = activeView === "studio" ? selectedLeadFromData ?? selectedLeadInPool : selectedLeadInPool ?? selectedLeadFromData;
  const proposal = selectedLead ? buildProposal(selectedLead, focus) : null;
  const activeNavItem = availableNavItems.find((item) => item.id === activeView) ?? availableNavItems[0];
  const activeMarket = marketSummaries.find((m) => m.id === focus.marketId) ?? null;
  const activeSegment = segmentSummaries.find((s) => s.id === focus.segmentId) ?? null;
  const activeBatch = batchSummaries.find((b) => b.id === focus.batchId) ?? null;
  const workspaceImportLabel = activeBatch?.name || focus.batchName;
  const responsibleScopeSuffix =
    activeResponsibleFilter && activeResponsibleFilter.value !== RESPONSIBLE_FILTER_ALL
      ? ` · Responsable: ${activeResponsibleFilter.label}`
      : "";
  const followUpTimingScopeSuffix =
    followUpTimingFilter !== "all" ? ` · ${labelForFollowUpTimingFilter(followUpTimingFilter)}` : "";
  const proposalScopeLabel =
    proposalScopeMode === "batch"
      ? `${focus.city} / ${focus.niche} / ${workspaceImportLabel} · ${proposalLeads.length} leads${responsibleScopeSuffix}`
      : `${focus.city} / ${focus.niche} · ${proposalLeads.length} leads${responsibleScopeSuffix}`;
  const scopeDescription =
    batchFilter === "all"
      ? `${focus.city} / ${focus.niche} / todas las importaciones${responsibleScopeSuffix}${followUpTimingScopeSuffix}`
      : `${focus.city} / ${focus.niche} / ${activeBatch?.name || focus.batchName}${responsibleScopeSuffix}${followUpTimingScopeSuffix}`;
  const highlightedSubniches = subnicheSummaries.slice(0, 6);

  const operationalStatus = useMemo(
    () => getOperationalStatus(storageStatus, dataMode),
    [storageStatus, dataMode]
  );
  const activityFeedback = useMemo(
    () => getActivityFeedback(storageStatus, dataMode),
    [storageStatus, dataMode]
  );

  const activeBatchLeadCount = useMemo(
    () => dashboardLeads.filter((lead) => lead.batchId === focus.batchId).length,
    [dashboardLeads, focus.batchId]
  );
  const completionRate = useMemo(() => {
    if (!focus.batchSize) return 0;
    return Math.min(Math.round((activeBatchLeadCount / focus.batchSize) * 100), 100);
  }, [activeBatchLeadCount, focus.batchSize]);

  const metrics = useMemo(() => {
    const hotLeads = visibleLeads.filter((l) => l.priority === "hot").length;
    const advancedPipeline = visibleLeads.filter((l) =>
      ["booked", "demo", "proposal", "closed"].includes(l.stage)
    ).length;
    const pendingDemos = visibleLeads.filter((l) => ["booked", "demo"].includes(l.stage)).length;
    const closeReady = visibleLeads.filter((l) => ["demo", "proposal"].includes(l.stage)).length;
    return [
      {
        label: "Leads visibles",
        value: visibleLeads.length,
        foot:
          batchFilter === "all"
            ? "Vista consolidada del nicho activo"
            : "Vista enfocada en la importacion activa",
      },
      { label: "Alta prioridad", value: hotLeads, foot: "Negocios con mas urgencia de seguimiento comercial" },
      { label: "Pipeline avanzado", value: advancedPipeline, foot: "Leads desde llamada agendada hasta cierre" },
      {
        label: "Listos para cierre",
        value: closeReady,
        foot: `${pendingDemos} oportunidades necesitan demo o propuesta`,
      },
    ];
  }, [visibleLeads, batchFilter]);

  const insights = useMemo(
    () => ({
      bottleneck: getBottleneck(visibleLeads),
      topPainPoints: getTopPainPoints(visibleLeads),
      topCity: getTopCity(marketScopedLeads, focus),
      tasks: getImmediateTasks(visibleLeads),
    }),
    [visibleLeads, marketScopedLeads, focus]
  );

  const stageSummary = useMemo(
    () => STAGES.map((stage) => ({ ...stage, total: visibleLeads.filter((l) => l.stage === stage.id).length })),
    [visibleLeads]
  );

  const boardColumns = useMemo(
    () => STAGES.map((stage) => ({ stage, leads: visibleLeads.filter((l) => l.stage === stage.id) })),
    [visibleLeads]
  );

  const tableQuickStats = useMemo(
    () => [
      { label: "Visibles", value: filteredLeads.length },
      { label: "Urgentes", value: filteredLeads.filter((l) => l.priority === "hot").length },
      { label: "Con web", value: filteredLeads.filter((l) => Boolean(l.website)).length },
      { label: "Sin contacto", value: filteredLeads.filter((l) => !l.email && !l.phone).length },
    ],
    [filteredLeads]
  );

  const resolvedFocus = useMemo(
    () => resolveOperationalFocus(focus, dashboardLeads, scopedMarkets, scopedSegments, scopedBatches),
    [focus, dashboardLeads, scopedMarkets, scopedSegments, scopedBatches]
  );

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isSameFocus(focusDraft, focus)) return;
    setFocusDraft(focus);
    // Only sync from persisted focus when that source changes; let draft edits live in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    if (!availableNavItems.some((item) => item.id === activeView)) {
      setActiveView(availableNavItems[0]?.id ?? "leads");
    }
  }, [availableNavItems, activeView]);

  useEffect(() => {
    if (!selectionPool.length) {
      setSelectedLeadId("");
      return;
    }

    if (activeView === "studio") {
      if (!selectedLeadFromData) {
        setSelectedLeadId(selectionPool[0]?.id ?? "");
      }
      return;
    }

    if (!selectionPool.some((l) => l.id === selectedLeadId)) {
      setSelectedLeadId(selectionPool[0]?.id ?? "");
    }
  }, [selectionPool, selectedLeadId, activeView, selectedLeadFromData]);

  useEffect(() => {
    if (!selectedLeadIds.length) return;

    const visibleLeadIds = new Set(filteredLeads.map((lead) => lead.id));
    setSelectedLeadIds((curr) => {
      const next = curr.filter((id) => visibleLeadIds.has(id));
      return next.length === curr.length ? curr : next;
    });
  }, [filteredLeads, selectedLeadIds.length]);

  useEffect(() => {
    if (!isLeadEditorOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsLeadEditorOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isLeadEditorOpen]);

  useEffect(() => {
    if (isLeadEditorOpen || !leadDrawerOriginView) return;
    setActiveView(leadDrawerOriginView);
    setLeadDrawerOriginView(null);
  }, [isLeadEditorOpen, leadDrawerOriginView]);

  useEffect(() => {
    if (!isLeadEditorOpen || !selectedLead?.id || dataMode !== "cloud") {
      if (!isLeadEditorOpen) {
        setLeadActivities([]);
        setLeadActivitiesError("");
        setIsLoadingLeadActivities(false);
      }
      return;
    }

    let cancelled = false;
    setIsLoadingLeadActivities(true);
    setLeadActivitiesError("");
    setLeadActivities([]);

    void apiRequest<{ activities: LeadActivity[] }>(`/api/leads/${selectedLead.id}/activities`, {
      method: "GET",
    })
      .then((response) => {
        if (cancelled) return;
        setLeadActivities(response.activities);
      })
      .catch((error) => {
        if (cancelled) return;
        setLeadActivities([]);
        setLeadActivitiesError(getErrorMessage(error));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingLeadActivities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLeadEditorOpen, selectedLead?.id, dataMode]);

  useEffect(() => {
    if (subnicheFilter === "all") return;
    if (!subnicheSummaries.some((s) => s.label === subnicheFilter)) setSubnicheFilter("all");
  }, [subnicheFilter, subnicheSummaries]);

  useEffect(() => {
    if (selectedAssignmentUserId && !activeSetterMembers.some((member) => member.id === selectedAssignmentUserId)) {
      setSelectedAssignmentUserId("");
    }
  }, [selectedAssignmentUserId, activeSetterMembers]);

  useEffect(() => {
    if (!isAdmin) {
      if (responsibleFilter !== RESPONSIBLE_FILTER_ALL) {
        setResponsibleFilter(RESPONSIBLE_FILTER_ALL);
      }
      return;
    }

    if (responsibleFilter === RESPONSIBLE_FILTER_ALL || responsibleFilter === RESPONSIBLE_FILTER_UNASSIGNED) {
      return;
    }

    if (!activeSetterMembers.some((member) => member.id === responsibleFilter)) {
      setResponsibleFilter(RESPONSIBLE_FILTER_ALL);
    }
  }, [isAdmin, responsibleFilter, activeSetterMembers]);

  useEffect(() => {
    if (batchFilter === "all") return;
    if (!batchSummaries.some((b) => b.id === batchFilter)) setBatchFilter("all");
  }, [batchFilter, batchSummaries]);

  useEffect(() => {
    if (!resolvedFocus) return;
    applyLocalFocus(resolvedFocus, { nextBatchFilter: "all" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedFocus]);

  useEffect(() => () => clearImportProgressTimer(), []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isSameFocus(left: WorkspaceFocus | null | undefined, right: WorkspaceFocus | null | undefined) {
    if (!left || !right) return false;

    return (
      left.marketId === right.marketId &&
      left.segmentId === right.segmentId &&
      left.batchId === right.batchId &&
      left.city === right.city &&
      left.niche === right.niche &&
      left.batchName === right.batchName &&
      left.offerBaseId === right.offerBaseId &&
      left.offer === right.offer &&
      left.batchSize === right.batchSize &&
      left.offerAddons.length === right.offerAddons.length &&
      left.offerAddons.every((addon, index) => addon === right.offerAddons[index])
    );
  }

  function resolveMarketFocus(marketId: string, baseFocus: WorkspaceFocus = focus): WorkspaceFocus | null {
    const market = marketSummaries.find((entry) => entry.id === marketId);
    if (!market) return null;

    const nextMarketFocus = normalizeFocus({
      ...baseFocus,
      marketId: market.id,
      city: market.name,
    });
    const nextSegments = buildSegmentSummaries(segments, dashboardLeads, nextMarketFocus);
    const nextSegment = nextSegments[0];
    const nextSegmentFocus = normalizeFocus({
      ...nextMarketFocus,
      segmentId: nextSegment?.id || buildSegmentId(market.name, nextMarketFocus.niche),
      niche: nextSegment?.name || nextMarketFocus.niche,
    });
    const nextBatches = nextSegment ? buildBatchSummaries(batches, dashboardLeads, nextSegmentFocus) : [];
    const nextBatch = nextBatches[0];

    return normalizeFocus({
      ...nextSegmentFocus,
      batchId:
        nextBatch?.id ||
        buildBatchId(nextSegmentFocus.city, nextSegmentFocus.niche, nextSegmentFocus.batchName),
      batchName: nextBatch?.name || nextSegmentFocus.batchName,
      batchSize: nextBatch?.targetSize || nextSegmentFocus.batchSize,
    });
  }

  function resolveFallbackFocusAfterMarketDeletion(
    excludedMarketId: string,
    candidateMarkets: MarketSummary[] = marketSummaries
  ): WorkspaceFocus | null {
    const fallbackMarket =
      candidateMarkets.find((market) => market.id !== excludedMarketId && market.total > 0) ||
      candidateMarkets.find((market) => market.id !== excludedMarketId) ||
      null;

    if (!fallbackMarket) {
      return normalizeFocus({
        ...focus,
        city: "",
        niche: "",
        batchName: "",
      });
    }

    const nextMarketFocus = normalizeFocus({
      ...focus,
      city: fallbackMarket.name,
    });
    const nextSegments = buildSegmentSummaries(segments, dashboardLeads, nextMarketFocus);
    const nextSegment = nextSegments.find((segment) => segment.total > 0) || nextSegments[0] || null;
    const nextSegmentFocus = normalizeFocus({
      ...nextMarketFocus,
      niche: nextSegment?.name || nextMarketFocus.niche,
    });
    const nextBatches = buildBatchSummaries(batches, dashboardLeads, nextSegmentFocus);
    const nextBatch = nextBatches.find((batch) => batch.total > 0) || nextBatches[0] || null;

    return normalizeFocus({
      ...nextSegmentFocus,
      batchName: nextBatch?.name || nextSegmentFocus.batchName,
      batchSize: nextBatch?.targetSize || nextSegmentFocus.batchSize,
    });
  }

  function applyLocalFocus(
    nextFocus: WorkspaceFocus,
    options?: { syncDraft?: boolean; nextBatchFilter?: string }
  ) {
    const normalized = normalizeFocus(nextFocus);
    if (!isSameFocus(focus, normalized)) setFocus(normalized);
    if (options?.syncDraft !== false && !isSameFocus(focusDraft, normalized)) setFocusDraft(normalized);
    setMarkets((curr) => upsertMarket(curr, createMarketFromFocus(normalized)));
    setSegments((curr) => upsertSegment(curr, createSegmentFromFocus(normalized)));
    setBatches((curr) => upsertBatch(curr, createBatchFromFocus(normalized)));
    setBatchFilter(options?.nextBatchFilter ?? normalized.batchId);
    setSubnicheFilter("all");
    setSearchQuery("");
    setStageFilter("all");
    setOpsStatusFilter("all");
    setFollowUpTimingFilter("all");
  }

  function commitLeadDeletion(
    leadIds: string[],
    options?: { preserveEditorIfSurviving?: boolean }
  ): number {
    const deletedIds = new Set(leadIds.map((leadId) => leadId.trim()).filter(Boolean));

    if (!deletedIds.size) {
      return 0;
    }

    const nextLeads = leads.filter((lead) => !deletedIds.has(lead.id));
    const currentEditorLead = leads.find((lead) => lead.id === selectedLeadId) ?? selectedLead ?? null;
    const nextSelectedLead = nextLeads.find((lead) => lead.id === selectedLeadId) ?? nextLeads[0] ?? null;

    setLeads(nextLeads);
    setSelectedLeadIds((curr) => curr.filter((id) => !deletedIds.has(id)));
    setSelectedLeadId(nextSelectedLead?.id ?? "");

    const shouldPreserveEditor =
      options?.preserveEditorIfSurviving !== false &&
      isLeadEditorOpen &&
      currentEditorLead &&
      !deletedIds.has(currentEditorLead.id);

    if (shouldPreserveEditor) {
      setLeadEditor(createLeadEditorState(focus, currentEditorLead));
      return deletedIds.size;
    }

    setLeadEditor(nextSelectedLead ? createLeadEditorState(focus, nextSelectedLead) : createLeadEditorState(focus));
    setIsLeadEditorOpen(false);
    return deletedIds.size;
  }

  function handleProposalScopeModeChange(nextMode: ProposalScopeMode) {
    setProposalScopeMode(nextMode);

    const nextProposalLeads =
      nextMode === "batch"
        ? segmentScopedLeads.filter((lead) => lead.batchId === focus.batchId)
        : segmentScopedLeads;

    if (!nextProposalLeads.length) {
      setSelectedLeadId("");
      return;
    }

    const preservedLeadId = dashboardLeads.some((lead) => lead.id === selectedLeadId)
      ? selectedLeadId
      : nextProposalLeads[0]?.id ?? "";
    setSelectedLeadId(preservedLeadId);
  }

  async function persistWorkspaceFocus(
    candidateFocus: WorkspaceFocus,
    options?: { syncDraft?: boolean; nextBatchFilter?: string }
  ) {
    const normalized = normalizeFocus(candidateFocus);

    if (dataMode !== "cloud") {
      applyLocalFocus(normalized, options);
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Estructura guardada en borrador",
        message:
          dataMode === "error"
            ? "La estructura quedo visible localmente, pero no logre confirmar la sincronizacion."
            : "Ciudad, nicho e importacion ya quedaron listos en esta sesion local.",
      });
      return normalized;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest<{ focus: WorkspaceFocus }>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify(normalized),
      });
      applyLocalFocus(response.focus, options);
      setStorageStatus({
        tone: "cloud",
        title: "Arquitectura guardada",
        message: "La ciudad, el nicho y la importacion quedaron guardados en la base de datos.",
      });
      return response.focus;
    } catch (error) {
      setDataMode("error");
      setStorageStatus({ tone: "error", title: "No se pudo guardar la estructura", message: getErrorMessage(error) });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSelectMarket(marketId: string) {
    const nextFocus = resolveMarketFocus(marketId);
    if (!nextFocus) return;

    applyLocalFocus(nextFocus, { nextBatchFilter: "all" });
  }

  function handleSelectSegment(segmentId: string) {
    const segment = segmentSummaries.find((s) => s.id === segmentId);
    if (!segment) return;

    const nextBatches = buildBatchSummaries(batches, dashboardLeads, {
      ...focus,
      segmentId: segment.id,
      niche: segment.name,
    });
    const nextBatch = nextBatches[0];

    applyLocalFocus(
      normalizeFocus({
        ...focus,
        segmentId: segment.id,
        niche: segment.name,
        batchId: nextBatch?.id || buildBatchId(focus.city, segment.name, focus.batchName),
        batchName: nextBatch?.name || focus.batchName,
      }),
      { nextBatchFilter: "all" }
    );
  }

  function handleSelectBatch(batchId: string) {
    const batch = batchSummaries.find((b) => b.id === batchId);
    if (!batch) return;

    applyLocalFocus(
      normalizeFocus({
        ...focus,
        batchId: batch.id,
        batchName: batch.name,
        batchSize: batch.targetSize || focus.batchSize,
      })
    );
  }

  function handleOpenTeamMemberView(
    memberId: string,
    destination: "leads" | "pipeline",
    targetFocus?: WorkspaceFocus,
    nextFollowUpTimingFilter: FollowUpTimingFilter = "all"
  ) {
    if (!isAdmin) return;

    setResponsibleFilter(memberId);

    if (targetFocus) {
      applyLocalFocus(targetFocus, { nextBatchFilter: "all" });
    } else {
      setBatchFilter("all");
      setSearchQuery("");
      setStageFilter("all");
      setOpsStatusFilter("all");
      setSubnicheFilter("all");
    }

    setFollowUpTimingFilter(destination === "leads" ? nextFollowUpTimingFilter : "all");
    setActiveView(destination);
  }

  async function handleFocusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWorkspace) return;
    const candidateFocus = normalizeFocus(focusDraft);

    try {
      await persistWorkspaceFocus(candidateFocus);
    } catch {
      // El helper ya deja el estado de error listo para la UI.
    }
  }

  async function handleWorkspaceSwitcherApply(candidateFocus: WorkspaceFocus) {
    if (!canManageWorkspace) return;
    await persistWorkspaceFocus(candidateFocus, { nextBatchFilter: "all" });
    setIsWorkspaceSwitcherOpen(false);
  }

  function handleStartNewLead() {
    if (!canCreateLead) return;
    setLeadDrawerOriginView(activeView);
    setLeadEditorMode("create");
    setLeadEditor(createLeadEditorState(focus));
    setIsLeadEditorOpen(true);
    setActiveView("leads");
  }

  function handleOpenWorkspaceSwitcher() {
    if (!canManageWorkspace) return;
    setIsWorkspaceSwitcherOpen(true);
  }

  function handleOpenMercadosFromSwitcher() {
    setIsWorkspaceSwitcherOpen(false);
    setActiveView("leads");
  }

  function handleStartEditLead(lead: DashboardLead | null = selectedLead) {
    if (!lead) return;
    setLeadDrawerOriginView(activeView);
    setSelectedLeadId(lead.id);
    setLeadEditorMode(isSetter ? "ops" : "edit");
    setLeadEditor(createLeadEditorState(focus, lead));
    setIsLeadEditorOpen(true);
  }

  function handleCloseLeadEditor() {
    setIsLeadEditorOpen(false);
    if (selectedLead) {
      setLeadEditorMode(isSetter ? "ops" : "edit");
      setLeadEditor(createLeadEditorState(focus, selectedLead));
      return;
    }
    setLeadEditorMode("create");
    setLeadEditor(createLeadEditorState(focus));
  }

  function handleCancelLeadEditor() {
    if (leadEditorMode !== "create" && selectedLead) {
      setLeadEditor(createLeadEditorState(focus, selectedLead));
      return;
    }
    setLeadEditor(createLeadEditorState(focus));
  }

  function updateLeadEditor<K extends keyof LeadEditorState>(field: K, value: LeadEditorState[K]) {
    setLeadEditor((curr) => ({ ...curr, [field]: value }));
  }

  async function handleLeadEditorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const leadId = leadEditorMode === "edit" ? selectedLead?.id : undefined;
    const operationalLeadId = leadEditorMode === "ops" ? selectedLead?.id : leadId;

    if (leadEditorMode === "ops" && operationalLeadId) {
      const nextLastTouch = new Date().toISOString().slice(0, 10);
      const nextStage = leadEditor.opsStatus === "booked" ? "booked" : selectedLead?.stage || "sourced";
      const nextLead: Lead = selectedLead
        ? {
            ...selectedLead,
            opsStatus: leadEditor.opsStatus,
            nextFollowUpAt: leadEditor.nextFollowUpAt || undefined,
            lastActivitySummary: leadEditor.lastActivitySummary || selectedLead.lastActivitySummary,
            lastActivityAt: new Date().toISOString(),
            stage: nextStage,
            lastTouch: nextLastTouch,
          }
        : buildLeadPayload(leadEditor, focus, operationalLeadId, selectedLead);

      if (!leadEditor.lastActivitySummary.trim()) {
        setStorageStatus({
          tone: "error",
          title: "Falta el resumen",
          message: "Escribe un resumen corto para guardar el seguimiento del lead.",
        });
        return;
      }

      if (dataMode !== "cloud") {
        setLeads((curr) => curr.map((lead) => (lead.id === operationalLeadId ? nextLead : lead)));
        setLeadEditor(createLeadEditorState(focus, nextLead));
        setIsLeadEditorOpen(false);
        setStorageStatus({
          tone: dataMode === "error" ? "error" : "preview",
          title: dataMode === "error" ? "Sincronizacion pendiente" : "Seguimiento guardado en borrador",
          message:
            dataMode === "error"
              ? "La gestión quedó visible aquí, pero no pude confirmar el guardado en la base."
              : "El seguimiento quedó actualizado en esta sesión local.",
        });
        return;
      }

      setIsSaving(true);
      try {
        const response = await apiRequest<{ lead: Lead; activity: LeadActivity }>(`/api/leads/${operationalLeadId}/activities`, {
          method: "POST",
          body: JSON.stringify({
            activityType: "note",
            summary: leadEditor.lastActivitySummary.trim(),
            nextFollowUpAt: leadEditor.nextFollowUpAt || null,
            opsStatus: leadEditor.opsStatus,
            stage: leadEditor.opsStatus === "booked" ? "booked" : undefined,
          }),
        });
        setLeads((curr) => curr.map((lead) => (lead.id === operationalLeadId ? response.lead : lead)));
        setLeadActivities((curr) => [
          response.activity,
          ...curr.filter((activity) => activity.id !== response.activity.id),
        ]);
        setLeadEditor(createLeadEditorState(focus, response.lead));
        setIsLeadEditorOpen(false);
        setStorageStatus({
          tone: "cloud",
          title: "Seguimiento guardado",
          message: "La gestión operativa quedó registrada y auditada en el historial del lead.",
        });
      } catch (error) {
        setDataMode("error");
        setStorageStatus({
          tone: "error",
          title: "No se pudo guardar el seguimiento",
          message: getErrorMessage(error),
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const candidateLead = buildLeadPayload(leadEditor, focus, leadId, leadEditorMode === "edit" ? selectedLead : null);
    const fingerprint = createLeadFingerprint(candidateLead);
    const isDuplicate = leads.some(
      (l) => l.id !== candidateLead.id && createLeadFingerprint(l) === fingerprint
    );

    if (isDuplicate) {
      setStorageStatus({
        tone: "error",
        title: "Lead duplicado",
        message: "Ese negocio ya existe con los mismos datos de contacto en esta ciudad.",
      });
      return;
    }

    if (dataMode !== "cloud") {
      if (leadEditorMode === "edit" && leadId) {
        setLeads((curr) => curr.map((l) => (l.id === leadId ? candidateLead : l)));
        setSelectedLeadId(candidateLead.id);
      } else {
        setLeads((curr) => [candidateLead, ...curr]);
        setSelectedLeadId(candidateLead.id);
      }
      mergeCatalogFromLead(candidateLead, setMarkets, setSegments, setBatches);
      setLeadEditorMode("edit");
      setLeadEditor(createLeadEditorState(focus, candidateLead));
      setIsLeadEditorOpen(false);
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Lead guardado en borrador",
        message:
          dataMode === "error"
            ? "El lead se ve en esta sesion, pero no pude dejarlo sincronizado."
            : "La ficha ya quedo lista para seguir operando localmente.",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (leadEditorMode === "edit" && leadId) {
        const response = await apiRequest<{ lead: Lead }>(`/api/leads/${leadId}`, {
          method: "PUT",
          body: JSON.stringify({ lead: candidateLead }),
        });
        setLeads((curr) => curr.map((l) => (l.id === leadId ? response.lead : l)));
        mergeCatalogFromLead(response.lead, setMarkets, setSegments, setBatches);
        setSelectedLeadId(response.lead.id);
        setLeadEditor(createLeadEditorState(focus, response.lead));
        setIsLeadEditorOpen(false);
        setStorageStatus({ tone: "cloud", title: "Lead actualizado", message: "La ficha quedo sincronizada." });
      } else {
        const response = await apiRequest<{ lead: Lead }>("/api/leads", {
          method: "POST",
          body: JSON.stringify({ lead: candidateLead }),
        });
        setLeads((curr) => [response.lead, ...curr]);
        mergeCatalogFromLead(response.lead, setMarkets, setSegments, setBatches);
        setSelectedLeadId(response.lead.id);
        setLeadEditorMode("edit");
        setLeadEditor(createLeadEditorState(focus, response.lead));
        setIsLeadEditorOpen(false);
        setStorageStatus({ tone: "cloud", title: "Lead guardado", message: "El negocio ya forma parte de la importacion activa." });
      }
    } catch (error) {
      setDataMode("error");
      setStorageStatus({
        tone: "error",
        title: leadEditorMode === "edit" ? "No se pudo actualizar el lead" : "No se pudo guardar el lead",
        message: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteLead() {
    if (!canDeleteLead) return;
    if (!selectedLead) return;
    if (!window.confirm(`Eliminar a ${selectedLead.businessName} del CRM?`)) return;

    if (dataMode !== "cloud") {
      commitLeadDeletion([selectedLead.id], { preserveEditorIfSurviving: true });
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Lead eliminado en borrador",
        message:
          dataMode === "error"
            ? "Lo quite de esta vista, pero no pude confirmar el borrado en la base."
            : "El lead salio correctamente del tablero local.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest<{ success: boolean }>(`/api/leads/${selectedLead.id}`, { method: "DELETE" });
      commitLeadDeletion([selectedLead.id], { preserveEditorIfSurviving: true });
      setStorageStatus({ tone: "cloud", title: "Lead eliminado", message: "El negocio ya no hace parte del CRM." });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({ tone: "error", title: "No se pudo eliminar el lead", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  function handleToggleLeadSelection(leadId: string) {
    setSelectedLeadIds((curr) =>
      curr.includes(leadId) ? curr.filter((id) => id !== leadId) : [...curr, leadId]
    );
  }

  function handleToggleVisibleLeadSelection() {
    if (!filteredLeads.length) return;

    setSelectedLeadIds((curr) => {
      const visibleIds = filteredLeads.map((lead) => lead.id);
      const visibleSet = new Set(visibleIds);
      const allVisibleSelected = visibleIds.every((id) => curr.includes(id));

      if (allVisibleSelected) {
        return curr.filter((id) => !visibleSet.has(id));
      }

      return [...new Set([...curr, ...visibleIds])];
    });
  }

  function handleClearSelectedLeads() {
    setSelectedLeadIds([]);
  }

  function handleRequestDeleteSelectedLeads() {
    if (!selectedLeadIds.length) return;

    const selectedLeads = filteredLeads.filter((lead) => selectedLeadIds.includes(lead.id));
    setPendingBulkDelete({
      ids: [...selectedLeadIds],
      leads: selectedLeads,
    });
    setBulkDeleteError("");
  }

  async function handleConfirmBulkDeleteSelectedLeads() {
    if (!pendingBulkDelete?.ids.length) return;

    const { ids } = pendingBulkDelete;
    setBulkDeleteError("");

    if (dataMode !== "cloud") {
      commitLeadDeletion(ids, { preserveEditorIfSurviving: true });
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Leads eliminados en borrador",
        message:
          dataMode === "error"
            ? "Los quite de esta vista, pero no pude confirmar el borrado en la base."
            : `${ids.length} negocios salieron del tablero local.`,
      });
      setPendingBulkDelete(null);
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest<{ success: boolean; count: number }>("/api/leads", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
      commitLeadDeletion(ids, { preserveEditorIfSurviving: true });
      setStorageStatus({
        tone: "cloud",
        title: "Leads eliminados",
        message: `${response.count} negocios ya no hacen parte del CRM.`,
      });
      setPendingBulkDelete(null);
    } catch (error) {
      setDataMode("error");
      setBulkDeleteError(getErrorMessage(error));
      setStorageStatus({
        tone: "error",
        title: "No se pudieron eliminar los leads",
        message: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStageChange(leadId: string, stage: Stage) {
    const nextLastTouch = new Date().toISOString().slice(0, 10);

    if (dataMode !== "cloud") {
      setLeads((curr) => curr.map((l) => (l.id === leadId ? { ...l, stage, lastTouch: nextLastTouch } : l)));
      if (selectedLead?.id === leadId && isLeadEditorOpen && leadEditorMode !== "create") {
        setLeadEditor((curr) => ({ ...curr, stage, lastTouch: nextLastTouch }));
      }
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Pipeline actualizado en borrador",
        message:
          dataMode === "error"
            ? "La etapa cambio aqui, pero conviene revisar la conexion."
            : "El pipeline quedo actualizado localmente.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest<{ lead: Lead }>(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      setLeads((curr) => curr.map((l) => (l.id === leadId ? response.lead : l)));
      if (selectedLead?.id === leadId && isLeadEditorOpen && leadEditorMode !== "create") {
        setLeadEditor(createLeadEditorState(focus, response.lead));
      }
      setStorageStatus({ tone: "cloud", title: "Pipeline actualizado", message: "La etapa comercial ya refleja el estado mas reciente." });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({ tone: "error", title: "No se pudo actualizar la etapa", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  function handleCsvSelection(event: ChangeEvent<HTMLInputElement>) {
    void updateCsvFile(event.target.files?.[0] ?? null);
  }

  function handleImportDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsImportDragOver(true);
  }

  function handleImportDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsImportDragOver(false);
    }
  }

  function handleImportDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsImportDragOver(false);
    void updateCsvFile(event.dataTransfer.files?.[0] ?? null);
  }

  function clearImportProgressTimer() {
    if (importProgressTimerRef.current !== null) {
      window.clearInterval(importProgressTimerRef.current);
      importProgressTimerRef.current = null;
    }
  }

  function startImportProgressAnimation() {
    clearImportProgressTimer();
    setImportProgress(8);
    importProgressTimerRef.current = window.setInterval(() => {
      setImportProgress((current) => {
        if (current >= 92) return current;
        const step = current < 30 ? 7 : current < 65 ? 4 : 2;
        return Math.min(92, current + step);
      });
    }, 120);
  }

  function stopImportProgressAnimation() {
    clearImportProgressTimer();
  }

  function formatAiImportNote(status: AiImportStatus) {
    if (!status.attempted || status.phase === "disabled") {
      return status.message;
    }

    const base = status.message;
    if (status.error) {
      return `${base} Detalle: ${status.error}`;
    }

    return base;
  }

  function buildAiImportTitle(status: AiImportStatus) {
    if (status.phase === "success") {
      return "Importacion guardada con IA";
    }

    if (status.phase === "partial") {
      return "Importacion parcial con IA";
    }

    return "Importacion guardada sin IA";
  }

  async function tickImportProgress(nextProgress: number, message: string, pauseMs = 110) {
    setImportProgress(nextProgress);
    setImportMessage(message);
    await new Promise<void>((resolve) => window.setTimeout(resolve, pauseMs));
  }

  async function updateCsvFile(file: File | null) {
    if (!file) {
      clearCsvInput();
      setImportMessage("Selecciona un archivo y define ciudad, nicho e importacion antes de cargar.");
      return;
    }
    if (!isCsvLikeFile(file)) {
      clearCsvInput();
      setImportMessage("Elige un archivo .csv o .txt con columnas delimitadas.");
      return;
    }
    setSelectedCsvFile(file);
    try {
      const rows = parseCsv(await file.text());
      setImportPreview(buildImportPreview(rows, focusDraft));
      setImportMessage(buildImportReadyMessage(file.name, rows, focusDraft));
    } catch {
      setImportPreview(null);
      setImportMessage(`Archivo listo para importar: ${file.name}`);
    }
  }

  async function handleImportCsv() {
    if (!canImport) return;
    const file = selectedCsvFile;
    if (!file) { setImportMessage("Selecciona un archivo CSV antes de importar."); return; }

    const destinationFocus = normalizeFocus(focusDraft);
    try {
      setIsSaving(true);
      startImportProgressAnimation();
      await tickImportProgress(14, `Abriendo ${file.name}...`, 90);
      const rows = parseCsv(await file.text());
      await tickImportProgress(28, `Leyendo ${rows.length} filas...`, 90);
      if (!rows.length) throw new Error("El archivo no trae filas para importar.");

      await tickImportProgress(48, "Detectando negocios y especialidades...", 80);
      const parsedLeads = rows
        .map((row) => mapCsvRowToLead(row, destinationFocus))
        .filter((l) => Boolean(l.businessName && l.city));
      await tickImportProgress(64, "Filtrando duplicados y preparando destino...", 80);
      if (!parsedLeads.length) throw new Error("No encontre leads validos en el CSV.");

      const uniqueLeads = dedupeIncomingLeads(parsedLeads, leads);
      const localDuplicates = parsedLeads.length - uniqueLeads.length;
      if (!uniqueLeads.length) throw new Error("Todos los leads del CSV ya existen en el tablero actual.");

      await tickImportProgress(78, "Aplicando contexto de ciudad y nicho...", 80);
      applyLocalFocus(destinationFocus);

      if (dataMode !== "cloud") {
        setLeads((curr) => [...uniqueLeads, ...curr]);
        uniqueLeads.forEach((l) => mergeCatalogFromLead(l, setMarkets, setSegments, setBatches));
        setSelectedLeadId(uniqueLeads[0]?.id ?? "");
        const aiStatus: AiImportStatus = {
          phase: "disabled",
          attempted: false,
          totalLeads: uniqueLeads.length,
          enrichedLeads: 0,
          classifierModel: "gpt-5-nano",
          writerModel: "gpt-4o-mini",
          message: "IA no ejecutada en modo borrador. La importación se guardó localmente sin enriquecimiento.",
        };
        await tickImportProgress(100, `${uniqueLeads.length} leads cargados en borrador dentro de ${destinationFocus.batchName}.`, 180);
        setImportMessage(
          `${uniqueLeads.length} leads cargados en borrador dentro de ${destinationFocus.batchName}.${formatSkippedDuplicates(localDuplicates)} ${formatAiImportNote(aiStatus)}`
        );
        setStorageStatus({
          tone: dataMode === "error" ? "error" : "preview",
          title: dataMode === "error" ? "Sincronizacion pendiente sin IA" : "CSV cargado en borrador sin IA",
          message:
            dataMode === "error"
              ? `${aiStatus.message} El archivo se proceso, pero conviene revisar la conexion antes de continuar.`
              : aiStatus.message,
        });
        clearCsvInput({ resetProgress: false });
        setActiveView("leads");
        return;
      }

      await tickImportProgress(86, "Guardando importacion en la base...", 90);
      const response = await apiRequest<{ leads: Lead[]; skippedDuplicates: number; aiStatus: AiImportStatus }>("/api/leads", {
        method: "POST",
        body: JSON.stringify({ leads: uniqueLeads }),
      });
      const totalSkipped = localDuplicates + response.skippedDuplicates;
      setLeads((curr) => [...response.leads, ...curr]);
      response.leads.forEach((l) => mergeCatalogFromLead(l, setMarkets, setSegments, setBatches));
      setSelectedLeadId(response.leads[0]?.id ?? "");
      const aiStatus: AiImportStatus =
        response.aiStatus ?? {
          phase: "disabled",
          attempted: false,
          totalLeads: response.leads.length,
          enrichedLeads: 0,
          classifierModel: "gpt-5-nano",
          writerModel: "gpt-4o-mini",
          message: "IA no disponible en la respuesta del servidor. La importación se guardó sin enriquecimiento.",
        };
      const aiNote = formatAiImportNote(aiStatus);
      await tickImportProgress(
        100,
        `${response.leads.length} leads importados en ${destinationFocus.batchName}. ${aiNote}`,
        180
      );
      setImportMessage(
        `${response.leads.length} leads importados en ${destinationFocus.batchName}.${formatSkippedDuplicates(totalSkipped)} ${aiNote}`
      );
      setStorageStatus({
        tone: aiStatus.phase === "success" ? "cloud" : "working",
        title: buildAiImportTitle(aiStatus),
        message: `${aiStatus.message} Guardado en ${destinationFocus.city} / ${destinationFocus.niche} / ${destinationFocus.batchName}.`,
      });
      clearCsvInput({ resetProgress: false });
      setActiveView("leads");
    } catch (error) {
      setImportMessage(getErrorMessage(error));
      setStorageStatus({ tone: "error", title: "No se pudo importar el CSV", message: getErrorMessage(error) });
    } finally {
      stopImportProgressAnimation();
      setIsSaving(false);
      setImportProgress(0);
    }
  }

  function clearCsvInput(options?: { resetProgress?: boolean }) {
    if (csvInputRef.current) csvInputRef.current.value = "";
    setSelectedCsvFile(null);
    setImportPreview(null);
    setIsImportDragOver(false);
    if (options?.resetProgress !== false) {
      setImportProgress(0);
    }
  }

  async function handleCopy(field: "whatsapp" | "email" | "call") {
    if (!proposal) return;
    const value =
      field === "whatsapp" ? proposal.whatsapp : field === "email" ? proposal.email : proposal.call;
    try {
      await navigator.clipboard.writeText(value);
      setProposalMessage(
        field === "whatsapp"
          ? "Guion de WhatsApp copiado."
          : field === "email"
            ? "Email copiado al portapapeles."
            : "Guion de llamada copiado."
      );
    } catch {
      setProposalMessage("No pude copiar desde este navegador. Puedes hacerlo manualmente desde el panel.");
    }
  }

  function handleExportProposal() {
    if (!selectedLead || !proposal) return;
    const recommendedService = proposal.service.label;
    const recommendedReason = proposal.serviceReason;

    const printWindow = window.open("", "_blank", "width=1080,height=760");
    if (!printWindow) {
      setProposalMessage("El navegador bloqueo la ventana de impresion. Revisa los permisos emergentes.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Proposal - ${escapeHtml(selectedLead.businessName)}</title>
          <style>
            body { margin: 0; padding: 40px; font-family: Arial, sans-serif; color: #0f172a; background: #fff; line-height: 1.6; }
            h1, h2 { margin-bottom: 0.4rem; }
            .eyebrow { text-transform: uppercase; font-size: 12px; letter-spacing: 0.12em; color: #0f766e; }
            .section { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            ul { padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="eyebrow">Nivora / Proposal desk</div>
          <h1>${escapeHtml(selectedLead.businessName)}</h1>
          <p>${escapeHtml(proposal.audit)}</p>
          <div class="section">
            <h2>Contexto comercial</h2>
            <p>${escapeHtml(`${selectedLead.city} / ${selectedLead.niche} / ${selectedLead.batchName}`)}</p>
            <p>${escapeHtml(`Subnicho: ${selectedLead.subniche}`)}</p>
          </div>
          <div class="section">
            <h2>Servicio recomendado</h2>
            <p><strong>${escapeHtml(recommendedService)}</strong></p>
            <p>${escapeHtml(recommendedReason)}</p>
          </div>
          <div class="section">
            <h2>Propuesta sugerida</h2>
            <ul>${proposal.scope.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
          <div class="section">
            <h2>Guion para contacto</h2>
            <p><strong>WhatsApp:</strong><br />${escapeHtml(proposal.whatsapp)}</p>
            <p><strong>Email:</strong><br />${escapeHtml(proposal.email).replace(/\n/g, "<br />")}</p>
            <p><strong>Llamada:</strong><br />${escapeHtml(proposal.call).replace(/\n/g, "<br />")}</p>
          </div>
          <div class="section">
            <h2>Checklist de demo</h2>
            <ul>${proposal.demoChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
          <div class="section">
            <h2>Objetivo de reunion</h2>
            <p>${escapeHtml(proposal.meetingGoal)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setProposalMessage("Ventana de impresion abierta. Puedes guardarla como PDF desde el navegador.");
  }

  // ── City CRUD handlers ────────────────────────────────────────────────────
  async function handleCreateCity(name: string) {
    if (!canManageWorkspace) return;
    const now = new Date().toISOString();
    const id = buildMarketId(name);
    const newMarket: Market = { id, name, description: "", createdAt: now, updatedAt: now };

    if (dataMode !== "cloud") {
      setMarkets((curr) => upsertMarket(curr, newMarket));
      return;
    }

    const response = await apiRequest<{ market: Market }>("/api/markets", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setMarkets((curr) => upsertMarket(curr, response.market));
  }

  async function handleUpdateCity(id: string, name: string) {
    if (!canManageWorkspace) return;
    const now = new Date().toISOString();

    if (dataMode !== "cloud") {
      setMarkets((curr) =>
        curr.map((m) => (m.id === id ? { ...m, name, updatedAt: now } : m))
      );
      if (focus.marketId === id) {
        applyLocalFocus(normalizeFocus({ ...focus, city: name }));
      }
      return;
    }

    const response = await apiRequest<{ market: Market }>(`/api/markets/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    setMarkets((curr) => curr.map((m) => (m.id === id ? response.market : m)));
    if (focus.marketId === id) {
      applyLocalFocus(normalizeFocus({ ...focus, city: response.market.name }));
    }
  }

  async function handleDeleteCity(id: string) {
    if (!canManageWorkspace) return;
    if (dataMode !== "cloud") {
      const remainingMarkets = marketSummaries.filter((market) => market.id !== id);
      setMarkets((curr) => curr.filter((m) => m.id !== id));

      if (focus.marketId === id) {
        const nextFocus = resolveFallbackFocusAfterMarketDeletion(id, remainingMarkets);
        if (nextFocus) {
          applyLocalFocus(nextFocus, { nextBatchFilter: "all" });
        }
      }

      return;
    }

    const response = await apiRequest<{ success: boolean; focus?: WorkspaceFocus | null }>(`/api/markets/${id}`, {
      method: "DELETE",
    });
    const remainingMarkets = marketSummaries.filter((market) => market.id !== id);
    setMarkets((curr) => curr.filter((m) => m.id !== id));

    if (response.focus) {
      applyLocalFocus(response.focus, { nextBatchFilter: "all" });
      return;
    }

    if (focus.marketId === id) {
      const nextFocus = resolveFallbackFocusAfterMarketDeletion(id, remainingMarkets);
      if (nextFocus) {
        applyLocalFocus(nextFocus, { nextBatchFilter: "all" });
      }
    }
  }

  function applyMergedSegmentState(
    sourceSegmentId: string,
    targetSegment: Segment,
    batchMappings: Array<{ fromId: string; toId: string; name: string }>
  ) {
    const now = new Date().toISOString();
    const batchIdMap = new Map(batchMappings.map((mapping) => [mapping.fromId, mapping.toId]));
    const sourceBatches = batches.filter((batch) => batch.segmentId === sourceSegmentId);

    setSegments((curr) => upsertSegment(curr.filter((segment) => segment.id !== sourceSegmentId), targetSegment));

    setBatches((curr) => {
      const next = curr.filter((batch) => batch.segmentId !== sourceSegmentId);
      const byId = new Map(next.map((batch) => [batch.id, batch]));

      for (const mapping of batchMappings) {
        const existingTarget = byId.get(mapping.toId);

        if (existingTarget) {
          byId.set(mapping.toId, {
            ...existingTarget,
            marketId: targetSegment.marketId,
            segmentId: targetSegment.id,
            updatedAt: now,
          });
          continue;
        }

        const sourceBatch = sourceBatches.find((batch) => batch.id === mapping.fromId);
        if (!sourceBatch) continue;

        byId.set(mapping.toId, {
          ...sourceBatch,
          id: mapping.toId,
          marketId: targetSegment.marketId,
          segmentId: targetSegment.id,
          updatedAt: now,
        });
      }

      return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });

    setLeads((curr) =>
      curr.map((lead) => {
        const nextBatchId = batchIdMap.get(lead.batchId);
        if (lead.segmentId !== sourceSegmentId && !nextBatchId) {
          return lead;
        }

        return {
          ...lead,
          marketId: targetSegment.marketId,
          segmentId: targetSegment.id,
          niche: targetSegment.name,
          batchId: nextBatchId || lead.batchId,
        };
      })
    );

    if (focus.segmentId === sourceSegmentId) {
      applyLocalFocus(
        normalizeFocus({
          ...focus,
          niche: targetSegment.name,
          batchName: focus.batchName,
        }),
        { nextBatchFilter: "all" }
      );
    }
  }

  async function handleCreateSegment(name: string) {
    if (!canManageWorkspace) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (dataMode !== "cloud") {
      const nextFocus = normalizeFocus({ ...focus, niche: trimmedName });
      setSegments((curr) => upsertSegment(curr, createSegmentFromFocus(nextFocus)));
      applyLocalFocus(nextFocus, { nextBatchFilter: "all" });
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Nicho creado en borrador",
        message:
          dataMode === "error"
            ? "El nicho quedo visible aqui, pero conviene revisar la conexion."
            : "El nuevo nicho ya aparece en el tablero local.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest<{ segment: Segment }>("/api/segments", {
        method: "POST",
        body: JSON.stringify({ marketId: focus.marketId, marketName: focus.city, name: trimmedName }),
      });

      setSegments((curr) => upsertSegment(curr, response.segment));
      applyLocalFocus(normalizeFocus({ ...focus, niche: response.segment.name }), { nextBatchFilter: "all" });
      setStorageStatus({
        tone: "cloud",
        title: "Nicho creado",
        message: `El nicho ${response.segment.name} ya quedo listo en ${focus.city}.`,
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({ tone: "error", title: "No se pudo crear el nicho", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMergeSegment(sourceSegmentId: string, targetSegmentId: string) {
    if (!canManageWorkspace) return;
    if (!sourceSegmentId || !targetSegmentId || sourceSegmentId === targetSegmentId) {
      return;
    }

    const targetSegment = segmentSummaries.find((segment) => segment.id === targetSegmentId);
    if (!targetSegment) {
      setStorageStatus({
        tone: "error",
        title: "No encontre el nicho destino",
        message: "Elige un nicho principal que exista en la ciudad actual.",
      });
      return;
    }

    const batchMappings = batches
      .filter((batch) => batch.segmentId === sourceSegmentId)
      .map((batch) => ({
        fromId: batch.id,
        toId: buildBatchId(focus.city, targetSegment.name, batch.name),
        name: batch.name,
      }));

    if (dataMode !== "cloud") {
      applyMergedSegmentState(sourceSegmentId, targetSegment, batchMappings);
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Nicho fusionado en borrador",
        message:
          dataMode === "error"
            ? "La fusion se ve aqui, pero conviene revisar la conexion."
            : `El nicho ${targetSegment.name} ya absorbio el origen dentro de esta sesion local.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest<{ segment: Segment; batchMappings: Array<{ fromId: string; toId: string; name: string }> }>(
        `/api/segments/${sourceSegmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ mergeIntoSegmentId: targetSegmentId }),
        }
      );

      applyMergedSegmentState(sourceSegmentId, response.segment, response.batchMappings);
      setStorageStatus({
        tone: "cloud",
        title: "Nicho fusionado",
        message: `El nicho ${response.segment.name} ya absorbio el segmento anterior.`,
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({ tone: "error", title: "No se pudo fusionar el nicho", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignSelectedLeads() {
    if (!canManageTeam || !selectedLeadIds.length || !currentUser) return;

    const assignedUserId = selectedAssignmentUserId || null;
    const now = new Date().toISOString();
    const selectedIdSet = new Set(selectedLeadIds);

    if (dataMode !== "cloud") {
      setLeads((curr) =>
        curr.map((lead) =>
          selectedIdSet.has(lead.id)
            ? {
                ...lead,
                assignedUserId: assignedUserId || undefined,
                assignedAt: assignedUserId ? now : undefined,
                assignedByUserId: assignedUserId ? currentUser.id : undefined,
                lastActivityAt: now,
                lastActivitySummary: assignedUserId ? "Lead reasignado." : "Lead liberado.",
              }
            : lead
        )
      );
      setSelectedLeadIds([]);
      setSelectedAssignmentUserId("");
      setStorageStatus({
        tone: dataMode === "error" ? "error" : "preview",
        title: dataMode === "error" ? "Sincronizacion pendiente" : "Asignación actualizada en borrador",
        message:
          dataMode === "error"
            ? "La reasignación quedó visible aquí, pero no pude confirmar la auditoría en la base."
            : "La cartera quedó actualizada localmente.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest<{ success: boolean; count: number }>("/api/leads/assign", {
        method: "POST",
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          assignedUserId,
        }),
      });
      setLeads((curr) =>
        curr.map((lead) =>
          selectedIdSet.has(lead.id)
            ? {
                ...lead,
                assignedUserId: assignedUserId || undefined,
                assignedAt: assignedUserId ? now : undefined,
                assignedByUserId: assignedUserId ? currentUser.id : undefined,
                lastActivityAt: now,
                lastActivitySummary: assignedUserId ? "Lead reasignado." : "Lead liberado.",
              }
            : lead
        )
      );
      setSelectedLeadIds([]);
      setSelectedAssignmentUserId("");
      setStorageStatus({
        tone: "cloud",
        title: "Cartera actualizada",
        message: assignedUserId
          ? "Los leads seleccionados ya quedaron reasignados al setter elegido."
          : "Los leads seleccionados quedaron liberados y visibles solo para admin.",
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({
        tone: "error",
        title: "No se pudo reasignar la cartera",
        message: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTeamMember(input: {
    email: string;
    fullName: string;
    password: string;
    role: AppRole;
  }) {
    if (!canManageTeam) return;

    setIsSaving(true);
    try {
      const response = await apiRequest<{ member: TeamMember }>("/api/team-members", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setTeamMembers((curr) =>
        [...curr.filter((member) => member.id !== response.member.id), response.member].sort((left, right) =>
          left.fullName.localeCompare(right.fullName)
        )
      );
      setStorageStatus({
        tone: "cloud",
        title: "Usuario creado",
        message: `${response.member.fullName} ya puede entrar al CRM con su contraseña temporal.`,
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({
        tone: "error",
        title: "No se pudo crear el usuario",
        message: getErrorMessage(error),
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetTeamMemberPassword(memberId: string, password: string) {
    if (!canManageTeam) return;

    setIsSaving(true);
    try {
      const response = await apiRequest<{ member: TeamMember }>(`/api/team-members/${memberId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setTeamMembers((curr) =>
        curr.map((member) => (member.id === response.member.id ? response.member : member))
      );
      setStorageStatus({
        tone: "cloud",
        title: "Contraseña reseteada",
        message: `Se marcó un nuevo acceso temporal para ${response.member.fullName}.`,
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({
        tone: "error",
        title: "No se pudo resetear la contraseña",
        message: getErrorMessage(error),
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSegmentAssignment(input: {
    userId: string;
    marketId: string;
    segmentId: string;
  }) {
    if (!canManageTeam) return;

    setIsSaving(true);
    try {
      const response = await apiRequest<{ assignment: SegmentAssignment }>("/api/segment-assignments", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setSegmentAssignments((curr) => [response.assignment, ...curr.filter((item) => item.id !== response.assignment.id)]);
      setStorageStatus({
        tone: "cloud",
        title: "Asignación guardada",
        message: "El nicho ya quedó conectado al setter seleccionado.",
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({
        tone: "error",
        title: "No se pudo guardar la asignación",
        message: getErrorMessage(error),
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSegmentAssignment(assignmentId: string) {
    if (!canManageTeam) return;

    const assignment = segmentAssignments.find((item) => item.id === assignmentId);

    setIsSaving(true);
    try {
      const response = await apiRequest<{
        success: boolean;
        releasedLeadCount: number;
      }>("/api/segment-assignments", {
        method: "DELETE",
        body: JSON.stringify({ assignmentId }),
      });
      setSegmentAssignments((curr) => curr.filter((assignment) => assignment.id !== assignmentId));
      if (assignment) {
        const now = new Date().toISOString();
        setLeads((curr) =>
          curr.map((lead) =>
            lead.segmentId === assignment.segmentId && lead.assignedUserId === assignment.userId
              ? {
                  ...lead,
                  assignedUserId: undefined,
                  assignedAt: undefined,
                  assignedByUserId: undefined,
                  lastActivityAt: now,
                  lastActivitySummary: "Lead liberado.",
                }
              : lead
          )
        );
      }
      setStorageStatus({
        tone: "cloud",
        title: "Asignación eliminada",
        message:
          response.releasedLeadCount > 0
            ? `El nicho se quitó y ${response.releasedLeadCount} lead${response.releasedLeadCount === 1 ? "" : "s"} quedaron liberados.`
            : "El nicho ya no queda enrutado automáticamente para ese setter.",
      });
    } catch (error) {
      setDataMode("error");
      setStorageStatus({
        tone: "error",
        title: "No se pudo quitar la asignación",
        message: getErrorMessage(error),
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    if (!currentUser) return;

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ops-shell ops-shell-v3">
      <Sidebar
        navItems={availableNavItems}
        activeView={activeView}
        setActiveView={setActiveView}
        focus={focus}
        storageStatus={storageStatus}
        dataMode={dataMode}
        visibleLeadCount={visibleLeads.length}
        urgentLeadCount={visibleLeads.filter((l) => l.priority === "hot").length}
        completionRate={completionRate}
        activeBatchLeadCount={activeBatchLeadCount}
        workspaceImportLabel={workspaceImportLabel}
        currentUser={currentUser}
        canChangeWorkspace={canManageWorkspace}
        canCreateLead={canCreateLead}
        canImport={canImport}
        onOpenWorkspaceSwitcher={handleOpenWorkspaceSwitcher}
        onNewLead={handleStartNewLead}
        onImport={() => setActiveView("imports")}
        onLogout={() => void handleLogout()}
      />

      <main className="ops-main ops-main-v3">
        <Topbar
          activeNavItem={activeNavItem}
          focus={focus}
          workspaceImportLabel={workspaceImportLabel}
          storageStatus={storageStatus}
          selectedLead={selectedLead}
          currentUser={currentUser}
          canCreateLead={canCreateLead}
          canImport={canImport}
          onNewLead={handleStartNewLead}
          onImport={() => setActiveView("imports")}
          onViewStudio={() => setActiveView("studio")}
          onLogout={() => void handleLogout()}
        />

        {activeView === "overview" && (
          <OverviewView
            focus={focus}
            metrics={metrics}
            insights={insights}
            stageSummary={stageSummary}
            selectedLead={selectedLead}
            activeMarket={activeMarket}
            activeSegment={activeSegment}
            activeBatch={activeBatch}
            scopeDescription={scopeDescription}
            onEditLead={handleStartEditLead}
            onViewLeads={() => setActiveView("leads")}
            onViewPipeline={() => setActiveView("pipeline")}
            onViewSettings={() => setActiveView("settings")}
          />
        )}

        {activeView === "leads" && (
          <MercadosView
            focus={focus}
            marketSummaries={marketSummaries}
            segmentSummaries={segmentSummaries}
            batchSummaries={responsibleBatchSummaries}
            subnicheSummaries={subnicheSummaries}
            highlightedSubniches={highlightedSubniches}
            filteredLeads={filteredLeads}
            segmentScopedLeads={segmentScopedLeads}
            scopeLeadCount={responsibleScopedLeads.length}
            selectedLeadId={selectedLeadId}
            selectedLeadIds={selectedLeadIds}
            searchQuery={searchQuery}
            stageFilter={stageFilter}
            opsStatusFilter={opsStatusFilter}
            followUpTimingFilter={followUpTimingFilter}
            subnicheFilter={subnicheFilter}
            batchFilter={batchFilter}
            tableQuickStats={tableQuickStats}
            scopeDescription={scopeDescription}
            isSaving={isSaving}
            workspaceImportLabel={workspaceImportLabel}
            teamMembers={activeSetterMembers}
            canManageCatalog={canManageWorkspace}
            canCreateLead={canCreateLead}
            canDeleteLead={canDeleteLead}
            canAssignLeads={canManageTeam}
            canFilterByResponsible={isAdmin}
            selectedAssignmentUserId={selectedAssignmentUserId}
            responsibleFilter={responsibleFilter}
            responsibleOptions={responsibleFilterOptions}
            onSelectMarket={handleSelectMarket}
            onSelectSegment={handleSelectSegment}
            onSelectBatch={handleSelectBatch}
            onSelectLead={setSelectedLeadId}
            onToggleLeadSelection={handleToggleLeadSelection}
            onToggleVisibleLeadSelection={handleToggleVisibleLeadSelection}
            onClearSelectedLeadIds={handleClearSelectedLeads}
            onEditLead={handleStartEditLead}
            onDeleteLead={() => void handleDeleteLead()}
            onRequestDeleteSelectedLeads={handleRequestDeleteSelectedLeads}
            onSearchChange={setSearchQuery}
            onStageFilterChange={setStageFilter}
            onOpsStatusFilterChange={setOpsStatusFilter}
            onFollowUpTimingFilterChange={setFollowUpTimingFilter}
            onSubnicheFilterChange={setSubnicheFilter}
            onBatchFilterChange={setBatchFilter}
            onResponsibleFilterChange={setResponsibleFilter}
            onSelectedAssignmentUserIdChange={setSelectedAssignmentUserId}
            onAssignSelectedLeads={handleAssignSelectedLeads}
            onNewLead={handleStartNewLead}
            onImport={() => setActiveView("imports")}
            onCreateSegment={handleCreateSegment}
            onMergeSegment={handleMergeSegment}
          />
        )}

        {activeView === "pipeline" && (
          <PipelineView
            boardColumns={boardColumns}
            stageSummary={stageSummary}
            selectedLeadId={selectedLeadId}
            batchFilter={batchFilter}
            focus={focus}
            workspaceImportLabel={workspaceImportLabel}
            isSaving={isSaving}
            canFilterByResponsible={isAdmin}
            responsibleFilter={responsibleFilter}
            responsibleOptions={responsibleFilterOptions}
            editActionLabel={isSetter ? "Seguimiento" : "Editar"}
            onResponsibleFilterChange={setResponsibleFilter}
            onSelectLead={setSelectedLeadId}
            onEditLead={handleStartEditLead}
            onStageChange={(id, stage) => void handleStageChange(id, stage)}
          />
        )}

        {activeView === "imports" && (
          <ImportsView
            focusDraft={focusDraft}
            focus={focus}
            marketSummaries={marketSummaries}
            selectedCsvFile={selectedCsvFile}
            selectedCsvFileName={selectedCsvFileName}
            importPreview={importPreview}
            importMessage={importMessage}
            isImportDragOver={isImportDragOver}
            isSaving={isSaving}
            importProgress={importProgress}
            csvInputId={CSV_INPUT_ID}
            csvInputRef={csvInputRef}
            onFocusDraftChange={setFocusDraft}
            onFocusSubmit={handleFocusSubmit}
            onCsvSelection={handleCsvSelection}
            onImportCsv={() => void handleImportCsv()}
            onImportDragOver={handleImportDragOver}
            onImportDragLeave={handleImportDragLeave}
            onImportDrop={handleImportDrop}
            formatFileSize={formatFileSize}
          />
        )}

        {activeView === "studio" && (
          <StudioView
            proposalLeads={proposalLeads}
            segmentSummaries={segmentSummaries}
            proposalScopeMode={proposalScopeMode}
            activeSegmentId={focus.segmentId}
            selectedLead={selectedLead}
            proposal={proposal}
            proposalMessage={proposalMessage}
            isSaving={isSaving}
            onSelectLead={setSelectedLeadId}
            onSelectSegment={handleSelectSegment}
            onProposalScopeModeChange={handleProposalScopeModeChange}
            onCopyWhatsapp={() => void handleCopy("whatsapp")}
            onCopyEmail={() => void handleCopy("email")}
            onCopyCall={() => void handleCopy("call")}
            onExportPdf={handleExportProposal}
            scopeLabel={proposalScopeLabel}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            focusDraft={focusDraft}
            focus={focus}
            marketSummaries={marketSummaries}
            segmentSummaries={segmentSummaries}
            batchSummaries={batchSummaries}
            activityFeedback={activityFeedback}
            isSaving={isSaving}
            onFocusDraftChange={setFocusDraft}
            onFocusSubmit={handleFocusSubmit}
            onCreateCity={handleCreateCity}
            onUpdateCity={handleUpdateCity}
            onDeleteCity={handleDeleteCity}
          />
        )}

        {activeView === "team" && canManageTeam && (
          <TeamView
            teamMembers={teamMembers}
            segmentAssignments={segmentAssignments}
            trackingSummaries={teamTrackingSummaries}
            marketSummaries={teamMarketSummaries}
            segmentSummaries={teamSegmentSummaries}
            isSaving={isSaving}
            onCreateMember={handleCreateTeamMember}
            onResetPassword={handleResetTeamMemberPassword}
            onCreateAssignment={handleCreateSegmentAssignment}
            onDeleteAssignment={handleDeleteSegmentAssignment}
            onOpenMemberLeads={(memberId, targetFocus) =>
              handleOpenTeamMemberView(memberId, "leads", targetFocus)
            }
            onOpenMemberOverdueLeads={(memberId, targetFocus) =>
              handleOpenTeamMemberView(memberId, "leads", targetFocus, "overdue")
            }
            onOpenMemberTodayLeads={(memberId, targetFocus) =>
              handleOpenTeamMemberView(memberId, "leads", targetFocus, "today")
            }
            onOpenMemberUnscheduledLeads={(memberId, targetFocus) =>
              handleOpenTeamMemberView(memberId, "leads", targetFocus, "unscheduled")
            }
            onOpenMemberPipeline={(memberId, targetFocus) =>
              handleOpenTeamMemberView(memberId, "pipeline", targetFocus)
            }
          />
        )}
      </main>

      {isLeadEditorOpen && (
        <LeadDrawer
          mode={leadEditorMode}
          state={leadEditor}
          selectedLead={selectedLead}
          isSaving={isSaving}
          leadActivities={leadActivities}
          isLoadingActivities={isLoadingLeadActivities}
          leadActivitiesError={leadActivitiesError}
          teamMembers={activeSetterMembers}
          canManageAssignment={isAdmin}
          onUpdate={updateLeadEditor}
          onSubmit={(e) => void handleLeadEditorSubmit(e)}
          onCancel={handleCancelLeadEditor}
          onClose={handleCloseLeadEditor}
          onDelete={() => void handleDeleteLead()}
        />
      )}

      {pendingBulkDelete ? (
        <BulkDeleteModal
          leads={pendingBulkDelete.leads}
          storageStatus={storageStatus}
          isSaving={isSaving}
          error={bulkDeleteError}
          onCancel={() => {
            setPendingBulkDelete(null);
            setBulkDeleteError("");
          }}
          onConfirm={() => void handleConfirmBulkDeleteSelectedLeads()}
        />
      ) : null}

      {isWorkspaceSwitcherOpen && (
        <WorkspaceSwitcherDrawer
          currentFocus={focus}
          marketSummaries={marketSummaries}
          storageStatus={storageStatus}
          isSaving={isSaving}
          resolveMarketFocus={resolveMarketFocus}
          onApplyFocus={handleWorkspaceSwitcherApply}
          onOpenMarkets={handleOpenMercadosFromSwitcher}
          onClose={() => setIsWorkspaceSwitcherOpen(false)}
        />
      )}
    </div>
  );
}
