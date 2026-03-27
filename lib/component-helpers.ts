import type { Dispatch, SetStateAction } from "react";
import {
  buildBatchId,
  buildMarketId,
  buildSegmentId,
  normalizeFocus,
  normalizeLead,
  normalizePainPoints,
} from "./dashboard";
import type { Batch, DashboardLead, Lead, Market, Segment, WorkspaceFocus } from "./types";
import type {
  BatchSummary,
  LeadEditorState,
  MarketSummary,
  SegmentSummary,
  SubnicheSummary,
} from "./component-types";

// ── Catalog summary builders ──────────────────────────────────────────────────

export function buildMarketSummaries(
  markets: Market[],
  leads: DashboardLead[],
  focus: WorkspaceFocus
): MarketSummary[] {
  const grouped = new Map<string, MarketSummary>();

  const ensureMarket = (market: Market | MarketSummary) => {
    const current = grouped.get(market.id);
    if (current) return current;

    const next: MarketSummary = {
      id: market.id,
      name: market.name,
      description: market.description,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
      total: 0,
      hot: 0,
      segmentCount: 0,
      batchCount: 0,
    };
    grouped.set(market.id, next);
    return next;
  };

  markets.forEach(ensureMarket);
  ensureMarket(createMarketFromFocus(focus));

  leads.forEach((lead) => {
    const current = ensureMarket({
      id: lead.marketId,
      name: lead.city,
      description: "",
      createdAt: lead.lastTouch,
      updatedAt: lead.lastTouch,
      total: 0,
      hot: 0,
      segmentCount: 0,
      batchCount: 0,
    });
    current.total += 1;
    current.hot += lead.priority === "hot" ? 1 : 0;
  });

  grouped.forEach((market) => {
    const mLeads = leads.filter((l) => l.marketId === market.id);
    market.segmentCount = new Set(mLeads.map((l) => l.segmentId)).size;
    market.batchCount = new Set(mLeads.map((l) => l.batchId)).size;
  });

  return [...grouped.values()].sort((a, b) =>
    b.total !== a.total ? b.total - a.total : a.name.localeCompare(b.name)
  );
}

export function buildSegmentSummaries(
  segments: Segment[],
  leads: DashboardLead[],
  focus: WorkspaceFocus
): SegmentSummary[] {
  const grouped = new Map<string, SegmentSummary>();

  const ensureSegment = (segment: Segment | SegmentSummary) => {
    if (segment.marketId !== focus.marketId) return null;
    const current = grouped.get(segment.id);
    if (current) return current;

    const next: SegmentSummary = {
      id: segment.id,
      marketId: segment.marketId,
      name: segment.name,
      description: segment.description,
      createdAt: segment.createdAt,
      updatedAt: segment.updatedAt,
      total: 0,
      hot: 0,
      batchCount: 0,
      subnicheCount: 0,
    };
    grouped.set(segment.id, next);
    return next;
  };

  segments.forEach(ensureSegment);
  ensureSegment(createSegmentFromFocus(focus));

  leads
    .filter((l) => l.marketId === focus.marketId)
    .forEach((lead) => {
      const current = ensureSegment({
        id: lead.segmentId,
        marketId: lead.marketId,
        name: lead.niche,
        description: "",
        createdAt: lead.lastTouch,
        updatedAt: lead.lastTouch,
        total: 0,
        hot: 0,
        batchCount: 0,
        subnicheCount: 0,
      });
      if (!current) return;
      current.total += 1;
      current.hot += lead.priority === "hot" ? 1 : 0;
    });

  grouped.forEach((segment) => {
    const sLeads = leads.filter((l) => l.segmentId === segment.id);
    segment.batchCount = new Set(sLeads.map((l) => l.batchId)).size;
    segment.subnicheCount = new Set(sLeads.map((l) => l.subniche)).size;
  });

  return [...grouped.values()].sort((a, b) =>
    b.total !== a.total ? b.total - a.total : a.name.localeCompare(b.name)
  );
}

export function buildBatchSummaries(
  batches: Batch[],
  leads: DashboardLead[],
  focus: WorkspaceFocus
): BatchSummary[] {
  const grouped = new Map<string, BatchSummary>();

  const ensureBatch = (batch: Batch | BatchSummary) => {
    if (batch.marketId !== focus.marketId || batch.segmentId !== focus.segmentId) return null;
    const current = grouped.get(batch.id);
    if (current) return current;

    const next: BatchSummary = {
      id: batch.id,
      marketId: batch.marketId,
      segmentId: batch.segmentId,
      name: batch.name,
      source: batch.source,
      importFileName: batch.importFileName,
      status: batch.status,
      targetSize: batch.targetSize,
      notes: batch.notes,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      total: 0,
      hot: 0,
      stageCount: 0,
    };
    grouped.set(batch.id, next);
    return next;
  };

  batches.forEach(ensureBatch);
  ensureBatch(createBatchFromFocus(focus));

  leads
    .filter((l) => l.marketId === focus.marketId && l.segmentId === focus.segmentId)
    .forEach((lead) => {
      const current = ensureBatch({
        id: lead.batchId,
        marketId: lead.marketId,
        segmentId: lead.segmentId,
        name: lead.batchName,
        source: lead.source,
        importFileName: "",
        status: "active",
        targetSize: focus.batchSize,
        notes: "",
        createdAt: lead.lastTouch,
        updatedAt: lead.lastTouch,
        total: 0,
        hot: 0,
        stageCount: 0,
      });
      if (!current) return;
      current.total += 1;
      current.hot += lead.priority === "hot" ? 1 : 0;
    });

  grouped.forEach((batch) => {
    batch.stageCount = new Set(
      leads.filter((l) => l.batchId === batch.id).map((l) => l.stage)
    ).size;
  });

  return [...grouped.values()].sort((a, b) =>
    b.total !== a.total ? b.total - a.total : a.name.localeCompare(b.name)
  );
}

export function buildSubnicheSummaries(leads: DashboardLead[]): SubnicheSummary[] {
  const grouped = new Map<string, number>();
  leads.forEach((l) => grouped.set(l.subniche, (grouped.get(l.subniche) || 0) + 1));
  return [...grouped.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

// ── Focus resolution ──────────────────────────────────────────────────────────

export function resolveOperationalFocus(
  currentFocus: WorkspaceFocus,
  leads: DashboardLead[],
  markets: Market[],
  segments: Segment[],
  batches: Batch[]
): WorkspaceFocus | null {
  if (!leads.length) return null;

  const hasExactMatch = leads.some(
    (l) =>
      l.marketId === currentFocus.marketId &&
      l.segmentId === currentFocus.segmentId &&
      l.batchId === currentFocus.batchId
  );
  if (hasExactMatch) return null;

  const marketOptions = buildMarketSummaries(markets, leads, currentFocus);
  const selectedMarket = marketOptions.find((m) => m.id === currentFocus.marketId);
  if (selectedMarket && selectedMarket.total === 0) {
    return null;
  }

  const nextMarket =
    marketOptions.find((m) => m.id === currentFocus.marketId && m.total > 0) ||
    marketOptions.find((m) => m.total > 0);
  if (!nextMarket) return null;

  const marketFocus = normalizeFocus({ ...currentFocus, marketId: nextMarket.id, city: nextMarket.name });
  const segmentOptions = buildSegmentSummaries(segments, leads, marketFocus);
  const selectedSegment = segmentOptions.find(
    (s) => s.id === currentFocus.segmentId && s.marketId === nextMarket.id
  );
  if (selectedSegment && selectedSegment.total === 0) {
    return marketFocus;
  }

  const nextSegment =
    segmentOptions.find(
      (s) => s.id === currentFocus.segmentId && s.marketId === nextMarket.id && s.total > 0
    ) || segmentOptions.find((s) => s.total > 0);
  if (!nextSegment) return marketFocus;

  const segmentFocus = normalizeFocus({ ...marketFocus, segmentId: nextSegment.id, niche: nextSegment.name });
  const batchOptions = buildBatchSummaries(batches, leads, segmentFocus);
  const nextBatch =
    batchOptions.find((b) => b.id === currentFocus.batchId && b.total > 0) ||
    batchOptions.find((b) => b.total > 0) ||
    batchOptions[0];

  const nextFocus = normalizeFocus({
    ...segmentFocus,
    batchId: nextBatch?.id,
    batchName: nextBatch?.name || segmentFocus.batchName,
    batchSize: nextBatch?.targetSize || segmentFocus.batchSize,
  });

  if (
    nextFocus.marketId === currentFocus.marketId &&
    nextFocus.segmentId === currentFocus.segmentId &&
    nextFocus.batchId === currentFocus.batchId
  ) {
    return null;
  }

  return nextFocus;
}

// ── Catalog entity factories ──────────────────────────────────────────────────

export function createMarketFromFocus(focus: WorkspaceFocus): Market {
  return {
    id: focus.marketId || buildMarketId(focus.city),
    name: focus.city,
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createSegmentFromFocus(focus: WorkspaceFocus): Segment {
  return {
    id: focus.segmentId || buildSegmentId(focus.city, focus.niche),
    marketId: focus.marketId || buildMarketId(focus.city),
    name: focus.niche,
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createBatchFromFocus(focus: WorkspaceFocus): Batch {
  return {
    id: focus.batchId || buildBatchId(focus.city, focus.niche, focus.batchName),
    marketId: focus.marketId || buildMarketId(focus.city),
    segmentId: focus.segmentId || buildSegmentId(focus.city, focus.niche),
    name: focus.batchName,
    source: "Workspace selection",
    importFileName: "",
    status: "active",
    targetSize: focus.batchSize,
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertMarket(collection: Market[], market: Market): Market[] {
  return collection.some((m) => m.id === market.id) ? collection : [market, ...collection];
}

export function upsertSegment(collection: Segment[], segment: Segment): Segment[] {
  return collection.some((s) => s.id === segment.id) ? collection : [segment, ...collection];
}

export function upsertBatch(collection: Batch[], batch: Batch): Batch[] {
  return collection.some((b) => b.id === batch.id) ? collection : [batch, ...collection];
}

export function mergeCatalogFromLead(
  lead: Lead,
  setMarkets: Dispatch<SetStateAction<Market[]>>,
  setSegments: Dispatch<SetStateAction<Segment[]>>,
  setBatches: Dispatch<SetStateAction<Batch[]>>
) {
  const focus = normalizeFocus({
    marketId: lead.marketId,
    segmentId: lead.segmentId,
    batchId: lead.batchId,
    city: lead.city,
    niche: lead.niche,
    batchName: lead.batchName,
    offer: lead.offerType,
    batchSize: 25,
  });
  setMarkets((c) => upsertMarket(c, createMarketFromFocus(focus)));
  setSegments((c) => upsertSegment(c, createSegmentFromFocus(focus)));
  setBatches((c) => upsertBatch(c, createBatchFromFocus(focus)));
}

// ── Lead editor helpers ───────────────────────────────────────────────────────

export function createLeadEditorState(
  focus: WorkspaceFocus,
  lead?: Lead | DashboardLead | null
): LeadEditorState {
  if (lead) {
    return {
      businessName: lead.businessName,
      city: lead.city,
      niche: lead.niche,
      subniche: lead.subniche,
      batchName: lead.batchName,
      phone: lead.phone,
      email: lead.email,
      website: lead.website,
      source: lead.source,
      websiteStatus: lead.websiteStatus,
      digitalPresence: lead.digitalPresence,
      painPointsInput: lead.painPoints.join(" | "),
      offerType: lead.offerType,
      stage: lead.stage,
      opsStatus: lead.opsStatus,
      notes: lead.notes,
      lastTouch: lead.lastTouch,
      assignedUserId: lead.assignedUserId || "",
      nextFollowUpAt: lead.nextFollowUpAt || "",
      lastActivitySummary: lead.lastActivitySummary || "",
    };
  }

  return {
    businessName: "",
    city: focus.city,
    niche: focus.niche,
    subniche: focus.niche,
    batchName: focus.batchName,
    phone: "",
    email: "",
    website: "",
    source: "Manual intake",
    websiteStatus: "none",
    digitalPresence: "low",
    painPointsInput: "",
    offerType: focus.offer,
    stage: "sourced",
    opsStatus: "pending",
    notes: "",
    lastTouch: new Date().toISOString().slice(0, 10),
    assignedUserId: "",
    nextFollowUpAt: "",
    lastActivitySummary: "",
  };
}

export function buildLeadPayload(
  draft: LeadEditorState,
  focus: WorkspaceFocus,
  leadId?: string,
  existingLead?: Lead | DashboardLead | null
) {
  return normalizeLead(
    {
      id: leadId,
      businessName: draft.businessName,
      city: draft.city,
      niche: draft.niche,
      subniche: draft.subniche,
      batchName: draft.batchName,
      phone: draft.phone,
      email: draft.email,
      website: draft.website,
      source: draft.source,
      websiteStatus: draft.websiteStatus,
      digitalPresence: draft.digitalPresence,
      painPoints: normalizePainPoints(draft.painPointsInput),
      offerType: draft.offerType,
      stage: draft.stage,
      opsStatus: draft.opsStatus,
      notes: draft.notes,
      lastTouch: draft.lastTouch,
      assignedUserId: draft.assignedUserId || existingLead?.assignedUserId,
      assignedAt: existingLead?.assignedAt,
      assignedByUserId: existingLead?.assignedByUserId,
      nextFollowUpAt: draft.nextFollowUpAt || undefined,
      lastActivityAt: existingLead?.lastActivityAt,
      lastActivitySummary: draft.lastActivitySummary || existingLead?.lastActivitySummary,
      aiServiceId: existingLead?.aiServiceId,
      aiServiceReason: existingLead?.aiServiceReason,
      aiConfidence: existingLead?.aiConfidence,
      aiPainPoints: existingLead?.aiPainPoints,
      aiAudit: existingLead?.aiAudit,
      aiScope: existingLead?.aiScope,
      aiWhatsapp: existingLead?.aiWhatsapp,
      aiEmail: existingLead?.aiEmail,
      aiCall: existingLead?.aiCall,
      aiModelClassify: existingLead?.aiModelClassify,
      aiModelCopy: existingLead?.aiModelCopy,
      aiEnrichedAt: existingLead?.aiEnrichedAt,
    },
    focus
  );
}

export function removeLeadFromState(
  leadId: string,
  leads: Lead[],
  focus: WorkspaceFocus,
  setLeads: Dispatch<SetStateAction<Lead[]>>,
  setSelectedLeadId: Dispatch<SetStateAction<string>>,
  setLeadEditor: Dispatch<SetStateAction<LeadEditorState>>,
  setIsLeadEditorOpen: Dispatch<SetStateAction<boolean>>
) {
  const nextLeads = leads.filter((l) => l.id !== leadId);
  const nextSelected = nextLeads[0] || null;
  setLeads(nextLeads);
  setSelectedLeadId(nextSelected?.id || "");
  setLeadEditor(
    nextSelected ? createLeadEditorState(focus, nextSelected) : createLeadEditorState(focus)
  );
  setIsLeadEditorOpen(false);
}

// ── General utilities ─────────────────────────────────────────────────────────

export async function apiRequest<T>(input: string, init: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "La solicitud fallo.");
  return payload;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado.";
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isCsvLikeFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.type === "text/plain"
  );
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSkippedDuplicates(total: number) {
  return total > 0 ? ` ${total} duplicados fueron omitidos.` : "";
}
