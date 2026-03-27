import {
  buildBatchId,
  buildMarketId,
  buildSegmentId,
  createLeadFingerprint,
  normalizeActivityType,
  normalizeFocus,
  normalizeLead,
  normalizeOpsStatus,
  normalizeStage,
} from "@/lib/dashboard";
import { enrichImportedLeadsWithAi } from "@/lib/ai";
import {
  SAMPLE_BATCHES,
  SAMPLE_FOCUS,
  SAMPLE_LEADS,
  SAMPLE_MARKETS,
  SAMPLE_SEGMENTS,
} from "@/lib/sample-data";
import type { AppSession } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import { createSupabaseUserClient } from "@/lib/supabase-auth";
import type {
  AppRole,
  AuthenticatedUser,
  Batch,
  DashboardBootstrap,
  LeadActivity,
  LeadActivityType,
  ImportResult,
  Lead,
  Market,
  OpsStatus,
  Segment,
  SegmentAssignment,
  Stage,
  TeamMember,
  WorkspaceFocus,
} from "@/lib/types";

type WorkspaceRow = {
  id: string;
  market_id?: string | null;
  segment_id?: string | null;
  batch_id?: string | null;
  city: string;
  niche: string;
  batch_name?: string | null;
  offer_base_id?: string | null;
  offer_addons?: string[] | null;
  offer: string;
  batch_size: number;
};

type LeadRow = {
  id: string;
  market_id?: string | null;
  segment_id?: string | null;
  batch_id?: string | null;
  business_name: string;
  city: string;
  niche: string;
  subniche?: string | null;
  batch_name?: string | null;
  phone: string;
  email: string;
  website: string;
  source: string;
  website_status: Lead["websiteStatus"];
  digital_presence: Lead["digitalPresence"];
  pain_points: string[];
  offer_type: string;
  stage: Stage;
  ops_status?: OpsStatus | null;
  notes: string;
  last_touch: string;
  assigned_user_id?: string | null;
  assigned_at?: string | null;
  assigned_by_user_id?: string | null;
  next_follow_up_at?: string | null;
  last_activity_at?: string | null;
  last_activity_summary?: string | null;
  ai_service_id?: Lead["aiServiceId"] | null;
  ai_service_reason?: string | null;
  ai_confidence?: number | null;
  ai_pain_points?: string[] | null;
  ai_audit?: string | null;
  ai_scope?: string[] | null;
  ai_whatsapp?: string | null;
  ai_email?: string | null;
  ai_call?: string | null;
  ai_model_classify?: string | null;
  ai_model_copy?: string | null;
  ai_enriched_at?: string | null;
  fingerprint?: string;
  created_at: string;
  updated_at?: string;
};

type MarketRow = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type SegmentRow = {
  id: string;
  market_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type BatchRow = {
  id: string;
  market_id: string;
  segment_id: string;
  name: string;
  source: string;
  import_file_name: string;
  status: Batch["status"];
  target_size: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type TeamMemberRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

type SegmentAssignmentRow = {
  id: string;
  user_id: string;
  market_id: string;
  segment_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LeadActivityRow = {
  id: string;
  lead_id: string;
  user_id: string;
  user_name: string;
  activity_type: LeadActivityType;
  outcome: string;
  summary: string;
  next_follow_up_at?: string | null;
  created_at: string;
};

type MergeBatchMapping = {
  fromId: string;
  toId: string;
  name: string;
};

type LoadBootstrapOptions = {
  session?: AppSession | null;
};

export type MergeSegmentsResult = {
  segment: Segment;
  batchMappings: MergeBatchMapping[];
};

const RECOVERABLE_LEAD_WRITE_OPTIONS = [
  { includeFingerprint: true, includeStructure: true, includeAi: true },
  { includeFingerprint: false, includeStructure: true, includeAi: true },
  { includeFingerprint: true, includeStructure: false, includeAi: true },
  { includeFingerprint: false, includeStructure: false, includeAi: true },
  { includeFingerprint: true, includeStructure: true, includeAi: false },
  { includeFingerprint: false, includeStructure: true, includeAi: false },
  { includeFingerprint: true, includeStructure: false, includeAi: false },
  { includeFingerprint: false, includeStructure: false, includeAi: false },
] as const;

export async function loadDashboardBootstrap(options?: LoadBootstrapOptions): Promise<DashboardBootstrap> {
  if (!isSupabaseConfigured()) {
    return buildPreviewBootstrap({
      storageTone: "preview",
      storageTitle: "Modo preview activo",
      storageMessage: "La app esta usando datos de muestra. Configura Supabase para guardar cambios reales.",
      accessTone: "preview",
      accessTitle: "Sin login",
      accessMessage: "Conecta Supabase Auth para activar acceso por usuario, equipo y cartera.",
    });
  }

  if (!options?.session) {
    return buildPreviewBootstrap({
      storageTone: "preview",
      storageTitle: "Login requerido",
      storageMessage: "La app necesita una sesion valida para cargar el CRM multiusuario.",
      accessTone: "preview",
      accessTitle: "Acceso protegido",
      accessMessage: "Inicia sesion para ver tu cartera o administrar el equipo.",
    });
  }

  try {
    return await loadDashboardBootstrapForSession(options.session);
  } catch (error) {
    const message = getErrorMessage(error, "No pude cargar el CRM autenticado.");

    return buildPreviewBootstrap({
      storageTone: "error",
      storageTitle: "Hubo un problema con Supabase",
      storageMessage: message,
      accessTone: "error",
      accessTitle: "Error de acceso",
      accessMessage: "No pude cargar la sesion operativa con los permisos actuales.",
      currentUser: options.session.member,
    });
  }
}

function buildPreviewBootstrap(options: {
  storageTone: DashboardBootstrap["storageStatus"]["tone"];
  storageTitle: string;
  storageMessage: string;
  accessTone: DashboardBootstrap["accessStatus"]["tone"];
  accessTitle: string;
  accessMessage: string;
  currentUser?: AuthenticatedUser;
}): DashboardBootstrap {
  return {
    focus: SAMPLE_FOCUS,
    leads: SAMPLE_LEADS,
    markets: SAMPLE_MARKETS,
    segments: SAMPLE_SEGMENTS,
    batches: SAMPLE_BATCHES,
    currentUser: options.currentUser,
    teamMembers: [],
    segmentAssignments: [],
    dataMode: options.storageTone === "error" ? "error" : "preview",
    storageStatus: {
      tone: options.storageTone,
      title: options.storageTitle,
      message: options.storageMessage,
    },
    accessStatus: {
      tone: options.accessTone,
      title: options.accessTitle,
      message: options.accessMessage,
    },
  };
}

async function loadDashboardBootstrapForSession(session: AppSession): Promise<DashboardBootstrap> {
  const userClient = createSupabaseUserClient(session.accessToken);
  const adminClient = requireSupabase();

  await ensureWorkspaceSettings(adminClient);

  const [leadsResult, structured, teamMembers, segmentAssignments, workspaceResult] = await Promise.all([
    userClient.from("leads").select("*").order("created_at", { ascending: false }).returns<LeadRow[]>(),
    loadStructuredRows(userClient),
    loadTeamMembersForSession(userClient, session),
    loadSegmentAssignmentsForSession(userClient, session),
    session.member.role === "admin"
      ? userClient.from("workspace_settings").select("*").eq("id", "default").maybeSingle<WorkspaceRow>()
      : Promise.resolve({ data: null, error: null as unknown }),
  ]);

  if (leadsResult.error) {
    throw leadsResult.error;
  }

  if (workspaceResult && "error" in workspaceResult && workspaceResult.error) {
    throw workspaceResult.error;
  }

  const leads = (leadsResult.data || []).map(mapLeadRowToLead);
  const teamMemberMap = new Map(teamMembers.map((member) => [member.id, member]));
  const focus =
    session.member.role === "admin"
      ? workspaceResult.data
        ? mapWorkspaceRowToFocus(workspaceResult.data)
        : SAMPLE_FOCUS
      : deriveSetterFocus(leads, segmentAssignments, structured, session.member);
  const catalog = buildCatalogSnapshot(focus, leads, structured);

  return {
    focus,
    leads,
    markets: catalog.markets,
    segments: catalog.segments,
    batches: catalog.batches,
    currentUser: session.member,
    teamMembers:
      session.member.role === "admin"
        ? teamMembers
        : [teamMemberMap.get(session.member.id) || mapAuthenticatedUserToTeamMember(session.member)],
    segmentAssignments,
    dataMode: "cloud",
    storageStatus: {
      tone: "cloud",
      title: "Supabase conectado",
      message:
        session.member.role === "admin"
          ? "El CRM ya esta sincronizado y puedes administrar equipo, estructura y cartera."
          : "Tu cartera ya esta cargada y lista para seguimiento operativo.",
    },
    accessStatus: {
      tone: "cloud",
      title: session.member.role === "admin" ? "Sesion admin activa" : "Sesion setter activa",
      message:
        session.member.role === "admin"
          ? "Puedes crear usuarios, asignar nichos y ver toda la operacion."
          : "Solo ves los leads y segmentos que te fueron asignados.",
    },
  };
}

function deriveSetterFocus(
  leads: Lead[],
  assignments: SegmentAssignment[],
  structured: { markets: Market[]; segments: Segment[]; batches: Batch[] },
  currentUser: AuthenticatedUser
): WorkspaceFocus {
  const firstLead = leads[0];

  if (firstLead) {
    return normalizeFocus({
      marketId: firstLead.marketId,
      segmentId: firstLead.segmentId,
      batchId: firstLead.batchId,
      city: firstLead.city,
      niche: firstLead.niche,
      batchName: firstLead.batchName,
      offer: firstLead.offerType,
      batchSize:
        structured.batches.find((batch) => batch.id === firstLead.batchId)?.targetSize || SAMPLE_FOCUS.batchSize,
    });
  }

  const activeAssignment = assignments.find((assignment) => assignment.userId === currentUser.id && assignment.isActive);

  if (activeAssignment) {
    const market = structured.markets.find((entry) => entry.id === activeAssignment.marketId);
    const segment = structured.segments.find((entry) => entry.id === activeAssignment.segmentId);
    const batch =
      structured.batches.find((entry) => entry.segmentId === activeAssignment.segmentId) || structured.batches[0];

    return normalizeFocus({
      marketId: activeAssignment.marketId,
      segmentId: activeAssignment.segmentId,
      batchId: batch?.id || buildBatchId(market?.name || SAMPLE_FOCUS.city, segment?.name || SAMPLE_FOCUS.niche, SAMPLE_FOCUS.batchName),
      city: market?.name || SAMPLE_FOCUS.city,
      niche: segment?.name || SAMPLE_FOCUS.niche,
      batchName: batch?.name || SAMPLE_FOCUS.batchName,
      batchSize: batch?.targetSize || SAMPLE_FOCUS.batchSize,
      offer: SAMPLE_FOCUS.offer,
    });
  }

  return SAMPLE_FOCUS;
}

export async function saveWorkspaceFocus(focus: Partial<WorkspaceFocus>) {
  const supabase = requireSupabase();
  const normalizedFocus = normalizeFocus(focus);

  await ensureFocusStructure(supabase, normalizedFocus);

  const savedRow = await upsertWorkspaceRow(supabase, normalizedFocus);

  return savedRow ? mapWorkspaceRowToFocus(savedRow) : normalizedFocus;
}

export async function createLead(lead: Lead, actorUserId?: string) {
  const supabase = requireSupabase();
  const normalizedLead = normalizeLead(lead, SAMPLE_FOCUS);
  const fingerprint = createLeadFingerprint(normalizedLead);

  const { data: existingLead, error: existingError } = await supabase
    .from("leads")
    .select("id")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  let duplicateLead: { id: string } | null = existingLead ? { id: String(existingLead.id) } : null;

  if (existingError) {
    if (isMissingFingerprintColumn(existingError)) {
      duplicateLead = await findExistingLeadWithoutFingerprint(supabase, normalizedLead);
    } else {
      throw existingError;
    }
  }

  if (duplicateLead) {
    throw new Error("Ya existe un lead con ese negocio y datos de contacto.");
  }

  const [assignedLead] = await applySegmentAssignmentsToLeads(supabase, [normalizedLead], actorUserId);

  await ensureStructureFromLeads(supabase, [assignedLead]);

  const { leads: enrichedLeads } = await enrichImportedLeadsWithAi([assignedLead]).catch((error) => ({
    leads: [assignedLead],
    status: {
      phase: "fallback" as const,
      attempted: true,
      totalLeads: 1,
      enrichedLeads: 0,
      classifierModel: "gpt-5-nano",
      writerModel: "gpt-4o-mini",
      message: error instanceof Error ? error.message : "No pude enriquecer el lead con OpenAI.",
      error: error instanceof Error ? error.message : "No pude enriquecer el lead con OpenAI.",
    },
  }));
  const enrichedLead = enrichedLeads[0];
  const insertedRows = await insertLeadRowsWithFallback(supabase, [enrichedLead]);

  return mapLeadRowToLead(insertedRows[0]);
}

export async function importLeads(leads: Lead[], actorUserId?: string): Promise<ImportResult> {
  const supabase = requireSupabase();
  const normalizedLeads = leads.map((lead) => normalizeLead(lead, SAMPLE_FOCUS));
  const fingerprints = normalizedLeads.map(createLeadFingerprint);

  const { data: existingRows, error: existingError } = await supabase
    .from("leads")
    .select("fingerprint")
    .in("fingerprint", fingerprints);

  let existingFingerprints = new Set((existingRows || []).map((row) => String(row.fingerprint || "")));

  if (existingError) {
    if (isMissingFingerprintColumn(existingError)) {
      existingFingerprints = await loadExistingFingerprintsWithoutFingerprint(supabase);
    } else {
      throw existingError;
    }
  }

  const uniqueLeads = normalizedLeads.filter((lead) => !existingFingerprints.has(createLeadFingerprint(lead)));

  if (!uniqueLeads.length) {
    return {
      leads: [],
      skippedDuplicates: normalizedLeads.length,
      aiStatus: {
        phase: "disabled",
        attempted: false,
        totalLeads: 0,
        enrichedLeads: 0,
        classifierModel: "gpt-5-nano",
        writerModel: "gpt-4o-mini",
        message: "No había leads nuevos para enriquecer con IA.",
      },
    };
  }

  const assignedLeads = await applySegmentAssignmentsToLeads(supabase, uniqueLeads, actorUserId);

  const enrichment = await enrichImportedLeadsWithAi(assignedLeads).catch((error) => ({
    leads: assignedLeads,
    status: {
      phase: "fallback" as const,
      attempted: true,
      totalLeads: assignedLeads.length,
      enrichedLeads: 0,
      classifierModel: "gpt-5-nano",
      writerModel: "gpt-4o-mini",
      message: error instanceof Error ? error.message : "No pude enriquecer los leads con OpenAI.",
      error: error instanceof Error ? error.message : "No pude enriquecer los leads con OpenAI.",
    },
  }));
  const { leads: enrichedLeads, status: aiStatus } = enrichment;

  await ensureStructureFromLeads(supabase, enrichedLeads);

  const insertedRows = await insertLeadRowsWithFallback(supabase, enrichedLeads);

  return {
    leads: insertedRows.map(mapLeadRowToLead),
    skippedDuplicates: normalizedLeads.length - uniqueLeads.length,
    aiStatus,
  };
}

type LeadOpsInput = {
  assignedUserId?: string | null;
  opsStatus?: OpsStatus | string;
  nextFollowUpAt?: string | null;
  summary?: string | null;
};

type CreateLeadActivityInput = {
  activityType?: LeadActivityType | string;
  outcome?: string;
  summary: string;
  nextFollowUpAt?: string | null;
  opsStatus?: OpsStatus | string;
  stage?: Stage | string;
};

export async function loadLeadActivitiesForSession(session: AppSession, leadId: string) {
  const supabase = createSupabaseUserClient(session.accessToken);
  const { data, error } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .returns<LeadActivityRow[]>();

  if (error) {
    throw error;
  }

  return (data || []).map(mapLeadActivityRowToLeadActivity);
}

export async function updateLeadStageForSession(session: AppSession, leadId: string, stage: Stage) {
  const supabase = createSupabaseUserClient(session.accessToken);
  const { data, error } = await supabase
    .from("leads")
    .update({
      stage,
      ops_status: stage === "booked" ? "booked" : undefined,
      last_touch: new Date().toISOString().slice(0, 10),
    })
    .eq("id", leadId)
    .select()
    .single<LeadRow>();

  if (error) {
    throw error;
  }

  await supabase.from("lead_activities").insert([
    {
      lead_id: leadId,
      user_id: session.userId,
      user_name: session.member.fullName,
      activity_type: "stage_change",
      outcome: stage,
      summary: `Etapa actualizada a ${stage}.`,
      next_follow_up_at: null,
    },
  ]);

  return mapLeadRowToLead(data);
}

export async function updateLeadOpsForSession(session: AppSession, leadId: string, input: LeadOpsInput) {
  const supabase = createSupabaseUserClient(session.accessToken);
  const { data: currentRow, error: currentError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle<LeadRow>();

  if (currentError) {
    throw currentError;
  }

  if (!currentRow) {
    throw new Error("No encontre el lead.");
  }

  if (input.assignedUserId !== undefined && session.member.role !== "admin") {
    throw new Error("Solo admin puede reasignar leads.");
  }

  const nextOpsStatus = input.opsStatus
    ? normalizeOpsStatus(input.opsStatus, currentRow.stage)
    : normalizeOpsStatus(currentRow.ops_status ?? undefined, currentRow.stage);
  const nextStage = nextOpsStatus === "booked" ? "booked" : currentRow.stage;
  const summary = String(input.summary || "").trim();
  const updateRow = {
    assigned_user_id: input.assignedUserId === undefined ? currentRow.assigned_user_id || null : input.assignedUserId || null,
    assigned_at: input.assignedUserId === undefined ? currentRow.assigned_at || null : input.assignedUserId ? new Date().toISOString() : null,
    assigned_by_user_id:
      input.assignedUserId === undefined ? currentRow.assigned_by_user_id || null : input.assignedUserId ? session.userId : null,
    ops_status: nextOpsStatus,
    next_follow_up_at: input.nextFollowUpAt || null,
    stage: nextStage,
    last_touch: nextStage === "booked" ? new Date().toISOString().slice(0, 10) : currentRow.last_touch,
    last_activity_summary: summary || currentRow.last_activity_summary || "",
  };

  const { data, error } = await supabase
    .from("leads")
    .update(updateRow)
    .eq("id", leadId)
    .select()
    .single<LeadRow>();

  if (error) {
    throw error;
  }

  return mapLeadRowToLead(data);
}

export async function createLeadActivityForSession(
  session: AppSession,
  leadId: string,
  input: CreateLeadActivityInput
) {
  const supabase = createSupabaseUserClient(session.accessToken);
  const { data: currentRow, error: currentError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle<LeadRow>();

  if (currentError) {
    throw currentError;
  }

  if (!currentRow) {
    throw new Error("No encontre el lead.");
  }

  const nextStage = input.stage
    ? normalizeStage(input.stage)
    : input.opsStatus && normalizeOpsStatus(input.opsStatus, currentRow.stage) === "booked"
      ? "booked"
      : currentRow.stage;
  const nextOpsStatus = normalizeOpsStatus(input.opsStatus ?? currentRow.ops_status ?? undefined, nextStage);
  const nextFollowUpAt = input.nextFollowUpAt || null;
  const summary = String(input.summary || "").trim();

  if (!summary) {
    throw new Error("El resumen del seguimiento es obligatorio.");
  }

  const { data: activityRow, error: activityError } = await supabase
    .from("lead_activities")
    .insert([
      {
        lead_id: leadId,
        user_id: session.userId,
        user_name: session.member.fullName,
        activity_type: normalizeActivityType(input.activityType),
        outcome: String(input.outcome || nextOpsStatus || "").trim(),
        summary,
        next_follow_up_at: nextFollowUpAt,
      },
    ])
    .select()
    .single<LeadActivityRow>();

  if (activityError) {
    throw activityError;
  }

  const { data: updatedLeadRow, error: updateError } = await supabase
    .from("leads")
    .update({
      ops_status: nextOpsStatus,
      next_follow_up_at: nextFollowUpAt,
      last_activity_at: new Date().toISOString(),
      last_activity_summary: summary,
      stage: nextStage,
      last_touch: new Date().toISOString().slice(0, 10),
    })
    .eq("id", leadId)
    .select()
    .single<LeadRow>();

  if (updateError) {
    throw updateError;
  }

  return {
    lead: mapLeadRowToLead(updatedLeadRow),
    activity: mapLeadActivityRowToLeadActivity(activityRow),
  };
}

export async function assignLeadsToUserAsAdmin(
  actorUserId: string,
  leadIds: string[],
  assignedUserId?: string | null
) {
  const supabase = requireSupabase();
  const uniqueLeadIds = [...new Set(leadIds.map((leadId) => leadId.trim()).filter(Boolean))];

  if (!uniqueLeadIds.length) {
    return 0;
  }

  const { data: rows, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .in("id", uniqueLeadIds)
    .returns<LeadRow[]>();

  if (leadsError) {
    throw leadsError;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("leads")
    .update({
      assigned_user_id: assignedUserId || null,
      assigned_at: assignedUserId ? now : null,
      assigned_by_user_id: assignedUserId ? actorUserId : null,
      last_activity_at: now,
      last_activity_summary: assignedUserId ? "Lead reasignado." : "Lead liberado.",
    })
    .in("id", uniqueLeadIds);

  if (updateError) {
    throw updateError;
  }

  const activityRows = (rows || []).map((lead) => ({
    lead_id: lead.id,
    user_id: actorUserId,
    user_name: "Admin",
    activity_type: "assignment_change",
    outcome: assignedUserId ? "assigned" : "unassigned",
    summary: assignedUserId ? "Lead reasignado manualmente." : "Lead liberado y quedó sin responsable.",
    next_follow_up_at: null,
  }));

  if (activityRows.length) {
    const { error: activityError } = await supabase.from("lead_activities").insert(activityRows);
    if (activityError) {
      throw activityError;
    }
  }

  return uniqueLeadIds.length;
}

export async function createTeamMemberAsAdmin(
  email: string,
  fullName: string,
  password: string,
  role: AppRole
) {
  const supabase = requireSupabase();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: normalizedName,
    },
  });

  if (authError) {
    throw authError;
  }

  const userId = authUser.user?.id;

  if (!userId) {
    throw new Error("No pude crear el usuario en Auth.");
  }

  const { data, error } = await supabase
    .from("team_members")
    .insert([
      {
        id: userId,
        email: normalizedEmail,
        full_name: normalizedName,
        role,
        is_active: true,
        must_change_password: true,
      },
    ])
    .select("*")
    .single<TeamMemberRow>();

  if (error) {
    throw error;
  }

  return mapTeamMemberRowToTeamMember(data);
}

export async function resetTeamMemberPasswordAsAdmin(userId: string, password: string) {
  const supabase = requireSupabase();
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, { password });

  if (authError) {
    throw authError;
  }

  const { data, error } = await supabase
    .from("team_members")
    .update({ must_change_password: true })
    .eq("id", userId)
    .select("*")
    .single<TeamMemberRow>();

  if (error) {
    throw error;
  }

  return mapTeamMemberRowToTeamMember(data);
}

export async function upsertSegmentAssignmentAsAdmin(userId: string, marketId: string, segmentId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("segment_assignments")
    .upsert(
      [
        {
          user_id: userId,
          market_id: marketId,
          segment_id: segmentId,
          is_active: true,
        },
      ],
      { onConflict: "user_id,segment_id" }
    )
    .select("*")
    .single<SegmentAssignmentRow>();

  if (error) {
    throw error;
  }

  return mapSegmentAssignmentRowToSegmentAssignment(data);
}

export async function deleteSegmentAssignmentAsAdmin(actorUserId: string, assignmentId: string) {
  const supabase = requireSupabase();
  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("segment_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle<SegmentAssignmentRow>();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignmentRow) {
    throw new Error("No encontre la asignación.");
  }

  const { data: assignedLeads, error: assignedLeadsError } = await supabase
    .from("leads")
    .select("id")
    .eq("segment_id", assignmentRow.segment_id)
    .eq("assigned_user_id", assignmentRow.user_id)
    .returns<Array<{ id: string }>>();

  if (assignedLeadsError) {
    throw assignedLeadsError;
  }

  const releasedLeadCount = await assignLeadsToUserAsAdmin(
    actorUserId,
    (assignedLeads || []).map((lead) => lead.id),
    null
  );

  const { error } = await supabase.from("segment_assignments").delete().eq("id", assignmentId);

  if (error) {
    throw error;
  }

  return {
    assignment: mapSegmentAssignmentRowToSegmentAssignment(assignmentRow),
    releasedLeadCount,
  };
}

export async function updateLeadStage(leadId: string, stage: Stage) {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("leads")
    .update({
      stage,
      last_touch: new Date().toISOString().slice(0, 10),
    })
    .eq("id", leadId)
    .select()
    .single<LeadRow>();

  if (error) {
    throw error;
  }

  return mapLeadRowToLead(data);
}

export async function updateLead(leadId: string, lead: Lead) {
  const supabase = requireSupabase();

  const { data: existingLeadRow, error: existingLeadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle<LeadRow>();

  if (existingLeadError) {
    throw existingLeadError;
  }

  const existingLead = existingLeadRow ? mapLeadRowToLead(existingLeadRow) : null;
  const normalizedLead = normalizeLead(
    {
      ...lead,
      id: leadId,
      aiServiceId: lead.aiServiceId ?? existingLead?.aiServiceId,
      aiServiceReason: lead.aiServiceReason ?? existingLead?.aiServiceReason,
      aiConfidence: lead.aiConfidence ?? existingLead?.aiConfidence,
      aiPainPoints: lead.aiPainPoints ?? existingLead?.aiPainPoints,
      aiAudit: lead.aiAudit ?? existingLead?.aiAudit,
      aiScope: lead.aiScope ?? existingLead?.aiScope,
      aiWhatsapp: lead.aiWhatsapp ?? existingLead?.aiWhatsapp,
      aiEmail: lead.aiEmail ?? existingLead?.aiEmail,
      aiCall: lead.aiCall ?? existingLead?.aiCall,
      aiModelClassify: lead.aiModelClassify ?? existingLead?.aiModelClassify,
      aiModelCopy: lead.aiModelCopy ?? existingLead?.aiModelCopy,
      aiEnrichedAt: lead.aiEnrichedAt ?? existingLead?.aiEnrichedAt,
    },
    SAMPLE_FOCUS
  );

  const fingerprint = createLeadFingerprint(normalizedLead);

  const { data: existingLeadMatch, error: existingError } = await supabase
    .from("leads")
    .select("id")
    .eq("fingerprint", fingerprint)
    .neq("id", leadId)
    .maybeSingle();

  let duplicateLead: { id: string } | null = existingLeadMatch ? { id: String(existingLeadMatch.id) } : null;

  if (existingError) {
    if (isMissingFingerprintColumn(existingError)) {
      duplicateLead = await findExistingLeadWithoutFingerprint(supabase, normalizedLead, leadId);
    } else {
      throw existingError;
    }
  }

  if (duplicateLead) {
    throw new Error("Ya existe otro lead con ese negocio y datos de contacto.");
  }

  await ensureStructureFromLeads(supabase, [normalizedLead]);

  const updatedLead = await updateLeadRowWithFallback(supabase, leadId, normalizedLead);

  return mapLeadRowToLead(updatedLead);
}

export async function deleteLead(leadId: string) {
  await deleteLeads([leadId]);
}

export async function deleteLeads(leadIds: string[]) {
  const supabase = requireSupabase();
  const uniqueLeadIds = [...new Set(leadIds.map((leadId) => leadId.trim()).filter(Boolean))];

  if (!uniqueLeadIds.length) {
    return 0;
  }

  const { data, error } = await supabase.from("leads").delete().in("id", uniqueLeadIds).select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

export async function createMarket(name: string): Promise<Market> {
  const supabase = requireSupabase();
  const id = buildMarketId(name);

  const { data, error } = await supabase
    .from("markets")
    .upsert([{ id, name, description: "" }], { onConflict: "id" })
    .select()
    .single<MarketRow>();

  if (error) throw error;
  return mapMarketRowToMarket(data);
}

export async function updateMarket(id: string, name: string): Promise<Market> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("markets")
    .update({ name, description: "", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single<MarketRow>();

  if (error) throw error;
  return mapMarketRowToMarket(data);
}

export async function deleteMarket(id: string): Promise<WorkspaceFocus | null> {
  const supabase = requireSupabase();

  const { count, error: countError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("market_id", id);

  if (countError) throw countError;

  if ((count ?? 0) > 0) {
    throw new Error(`Esta ciudad tiene ${count} negocios. Elimina los negocios primero.`);
  }

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle<WorkspaceRow>();

  if (workspaceError) {
    throw workspaceError;
  }

  const { data: remainingMarkets, error: remainingMarketsError } = await supabase
    .from("markets")
    .select("*")
    .neq("id", id)
    .order("name", { ascending: true })
    .returns<MarketRow[]>();

  if (remainingMarketsError) {
    throw remainingMarketsError;
  }

  const { data: remainingLeadRows, error: remainingLeadRowsError } = await supabase
    .from("leads")
    .select("market_id")
    .neq("market_id", id)
    .returns<Array<{ market_id: string | null }>>();

  if (remainingLeadRowsError) {
    throw remainingLeadRowsError;
  }

  const remainingMarketCounts = new Map<string, number>();
  (remainingLeadRows || []).forEach((row) => {
    if (!row.market_id) return;
    remainingMarketCounts.set(row.market_id, (remainingMarketCounts.get(row.market_id) || 0) + 1);
  });

  const preferredMarkets = [...remainingMarkets].sort((left, right) => {
    const leftCount = remainingMarketCounts.get(left.id) || 0;
    const rightCount = remainingMarketCounts.get(right.id) || 0;
    if (rightCount !== leftCount) return rightCount - leftCount;
    return left.name.localeCompare(right.name);
  });

  let nextFocus: WorkspaceFocus | null = null;

  if (workspaceRow?.market_id === id) {
    const currentFocus = mapWorkspaceRowToFocus(workspaceRow);
    nextFocus = await resolveFallbackFocusAfterMarketDeletion(supabase, currentFocus, preferredMarkets);
    await upsertWorkspaceRow(supabase, nextFocus);
  }

  const { error: deleteBatchesError } = await supabase.from("batches").delete().eq("market_id", id);
  if (deleteBatchesError) {
    throw deleteBatchesError;
  }

  const { error: deleteSegmentsError } = await supabase.from("segments").delete().eq("market_id", id);
  if (deleteSegmentsError) {
    throw deleteSegmentsError;
  }

  const { error: deleteMarketError } = await supabase.from("markets").delete().eq("id", id);
  if (deleteMarketError) {
    throw deleteMarketError;
  }

  return nextFocus;
}

export async function createSegment(marketId: string, marketName: string, name: string): Promise<Segment> {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const id = buildSegmentId(marketName, name);

  const marketResult = await supabase.from("markets").upsert(
    [
      {
        id: marketId,
        name: marketName,
        description: "",
        updated_at: now,
      },
    ],
    { onConflict: "id" }
  );

  if (marketResult.error) {
    throw marketResult.error;
  }

  const { data, error } = await supabase
    .from("segments")
    .upsert(
      [
        {
          id,
          market_id: marketId,
          name,
          description: "",
          updated_at: now,
        },
      ],
      { onConflict: "id" }
    )
    .select()
    .single<SegmentRow>();

  if (error) {
    throw error;
  }

  return mapSegmentRowToSegment(data);
}

export async function deleteSegment(id: string): Promise<void> {
  const supabase = requireSupabase();

  const [leadsResult, batchesResult] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("segment_id", id),
    supabase.from("batches").select("id", { count: "exact", head: true }).eq("segment_id", id),
  ]);

  if (leadsResult.error) {
    throw leadsResult.error;
  }

  if (batchesResult.error) {
    throw batchesResult.error;
  }

  const leadCount = leadsResult.count ?? 0;
  const batchCount = batchesResult.count ?? 0;

  if (leadCount > 0 || batchCount > 0) {
    throw new Error(
      `Este nicho todavia tiene ${leadCount} negocios y ${batchCount} importaciones. Fusionalo antes de eliminarlo.`
    );
  }

  const { error } = await supabase.from("segments").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function mergeSegments(
  sourceSegmentId: string,
  targetSegmentId: string
): Promise<MergeSegmentsResult> {
  const supabase = requireSupabase();

  if (sourceSegmentId === targetSegmentId) {
    throw new Error("No puedes fusionar un nicho consigo mismo.");
  }

  const [sourceSegment, targetSegment] = await Promise.all([
    loadSegmentById(supabase, sourceSegmentId),
    loadSegmentById(supabase, targetSegmentId),
  ]);

  if (!sourceSegment) {
    throw new Error("No encontre el nicho origen.");
  }

  if (!targetSegment) {
    throw new Error("No encontre el nicho destino.");
  }

  if (sourceSegment.marketId !== targetSegment.marketId) {
    throw new Error("Solo puedo fusionar nichos dentro de la misma ciudad.");
  }

  const targetMarket = await loadMarketById(supabase, targetSegment.marketId);

  if (!targetMarket) {
    throw new Error("No encontre la ciudad asociada al nicho destino.");
  }

  const [sourceBatchesResult, workspaceResult] = await Promise.all([
    supabase
      .from("batches")
      .select("*")
      .eq("segment_id", sourceSegment.id)
      .order("created_at", { ascending: true })
      .returns<BatchRow[]>(),
    supabase.from("workspace_settings").select("*").eq("id", "default").maybeSingle<WorkspaceRow>(),
  ]);

  if (sourceBatchesResult.error) {
    throw sourceBatchesResult.error;
  }

  if (workspaceResult.error) {
    throw workspaceResult.error;
  }

  const batchMappings: MergeBatchMapping[] = [];
  const sourceBatches = sourceBatchesResult.data || [];
  const now = new Date().toISOString();

  for (const batch of sourceBatches) {
    const nextBatchId = buildBatchId(targetMarket.name, targetSegment.name, batch.name);
    batchMappings.push({ fromId: batch.id, toId: nextBatchId, name: batch.name });

    const { data: existingBatch, error: existingBatchError } = await supabase
      .from("batches")
      .select("id")
      .eq("id", nextBatchId)
      .maybeSingle<{ id: string }>();

    if (existingBatchError) {
      throw existingBatchError;
    }

    if (!existingBatch) {
      const { error: insertError } = await supabase.from("batches").insert([
        {
          id: nextBatchId,
          market_id: targetMarket.id,
          segment_id: targetSegment.id,
          name: batch.name,
          source: batch.source,
          import_file_name: batch.import_file_name,
          status: batch.status,
          target_size: batch.target_size,
          notes: batch.notes,
        },
      ]);

      if (insertError) {
        throw insertError;
      }
    }

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        market_id: targetMarket.id,
        segment_id: targetSegment.id,
        niche: targetSegment.name,
        batch_id: nextBatchId,
        updated_at: now,
      })
      .eq("batch_id", batch.id);

    if (leadUpdateError) {
      throw leadUpdateError;
    }

    const { error: deleteBatchError } = await supabase.from("batches").delete().eq("id", batch.id);

    if (deleteBatchError) {
      throw deleteBatchError;
    }
  }

  const { error: sourceLeadUpdateError } = await supabase
    .from("leads")
    .update({
      market_id: targetMarket.id,
      segment_id: targetSegment.id,
      niche: targetSegment.name,
      updated_at: now,
    })
    .eq("segment_id", sourceSegment.id);

  if (sourceLeadUpdateError) {
    throw sourceLeadUpdateError;
  }

  const workspaceNeedsUpdate =
    workspaceResult.data &&
    (workspaceResult.data.segment_id === sourceSegment.id || workspaceResult.data.niche === sourceSegment.name);

  if (workspaceNeedsUpdate) {
    const workspaceBatchId =
      batchMappings.find((mapping) => mapping.fromId === workspaceResult.data?.batch_id)?.toId || batchMappings[0]?.toId;
    const workspaceUpdate: Partial<WorkspaceRow> & { updated_at: string } = {
      market_id: targetMarket.id,
      segment_id: targetSegment.id,
      niche: targetSegment.name,
      updated_at: now,
    };

    if (workspaceBatchId) {
      workspaceUpdate.batch_id = workspaceBatchId;
    }

    const { error: workspaceUpdateError } = await supabase
      .from("workspace_settings")
      .update(workspaceUpdate)
      .eq("id", "default");

    if (workspaceUpdateError) {
      throw workspaceUpdateError;
    }
  }

  const { error: deleteSegmentError } = await supabase.from("segments").delete().eq("id", sourceSegment.id);

  if (deleteSegmentError) {
    throw deleteSegmentError;
  }

  return {
    segment: targetSegment,
    batchMappings,
  };
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(
      "Supabase no esta configurado. Revisa SUPABASE_URL y la llave de servidor en SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY."
    );
  }

  return supabase;
}

async function loadMarketById(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  id: string
) {
  const { data, error } = await supabase.from("markets").select("*").eq("id", id).maybeSingle<MarketRow>();

  if (error) {
    throw error;
  }

  return data ? mapMarketRowToMarket(data) : null;
}

async function loadSegmentById(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  id: string
) {
  const { data, error } = await supabase.from("segments").select("*").eq("id", id).maybeSingle<SegmentRow>();

  if (error) {
    throw error;
  }

  return data ? mapSegmentRowToSegment(data) : null;
}

async function resolveFallbackFocusAfterMarketDeletion(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  currentFocus: WorkspaceFocus,
  remainingMarkets: MarketRow[]
): Promise<WorkspaceFocus> {
  const fallbackMarket = remainingMarkets[0];

  if (!fallbackMarket) {
    return normalizeFocus({
      ...currentFocus,
      city: SAMPLE_FOCUS.city,
      niche: SAMPLE_FOCUS.niche,
      batchName: SAMPLE_FOCUS.batchName,
    });
  }

  const { data: segmentRows, error: segmentError } = await supabase
    .from("segments")
    .select("*")
    .eq("market_id", fallbackMarket.id)
    .order("name", { ascending: true })
    .returns<SegmentRow[]>();

  if (segmentError) {
    throw segmentError;
  }

  const fallbackSegment = segmentRows?.[0] ?? null;
  const segmentName = fallbackSegment?.name || currentFocus.niche || SAMPLE_FOCUS.niche;

  const { data: batchRows, error: batchError } = await supabase
    .from("batches")
    .select("*")
    .eq("market_id", fallbackMarket.id)
    .order("created_at", { ascending: true })
    .returns<BatchRow[]>();

  if (batchError) {
    throw batchError;
  }

  const fallbackBatch =
    batchRows?.find((batch) => !fallbackSegment || batch.segment_id === fallbackSegment.id) ||
    batchRows?.[0] ||
    null;

  return normalizeFocus({
    ...currentFocus,
    city: fallbackMarket.name,
    niche: segmentName,
    batchName: fallbackBatch?.name || currentFocus.batchName || SAMPLE_FOCUS.batchName,
  });
}

async function loadStructuredRows(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const [marketsResult, segmentsResult, batchesResult] = await Promise.all([
    supabase.from("markets").select("*").order("name", { ascending: true }).returns<MarketRow[]>(),
    supabase.from("segments").select("*").order("name", { ascending: true }).returns<SegmentRow[]>(),
    supabase.from("batches").select("*").order("created_at", { ascending: false }).returns<BatchRow[]>(),
  ]);

  const structuredErrors = [marketsResult.error, segmentsResult.error, batchesResult.error].filter(Boolean);

  if (structuredErrors.length) {
    if (structuredErrors.every((error) => isMissingStructuredSchemaError(error))) {
      return { markets: [] as Market[], segments: [] as Segment[], batches: [] as Batch[] };
    }

    throw structuredErrors[0];
  }

  return {
    markets: (marketsResult.data || []).map(mapMarketRowToMarket),
    segments: (segmentsResult.data || []).map(mapSegmentRowToSegment),
    batches: (batchesResult.data || []).map(mapBatchRowToBatch),
  };
}

async function loadTeamMembersForSession(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  session: AppSession
) {
  const query =
    session.member.role === "admin"
      ? supabase.from("team_members").select("*").order("full_name", { ascending: true })
      : supabase.from("team_members").select("*").eq("id", session.userId).order("full_name", { ascending: true });

  const { data, error } = await query.returns<TeamMemberRow[]>();

  if (error) {
    throw error;
  }

  return (data || []).map(mapTeamMemberRowToTeamMember);
}

async function loadSegmentAssignmentsForSession(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  session: AppSession
) {
  const query =
    session.member.role === "admin"
      ? supabase.from("segment_assignments").select("*").order("created_at", { ascending: false })
      : supabase
          .from("segment_assignments")
          .select("*")
          .eq("user_id", session.userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

  const { data, error } = await query.returns<SegmentAssignmentRow[]>();

  if (error) {
    throw error;
  }

  return (data || []).map(mapSegmentAssignmentRowToSegmentAssignment);
}

async function ensureWorkspaceSettings(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data, error } = await supabase.from("workspace_settings").select("id").eq("id", "default").maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return;
  }

  await upsertWorkspaceRow(supabase, SAMPLE_FOCUS);
}

async function ensureFocusStructure(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  focus: WorkspaceFocus
) {
  try {
    const marketResult = await supabase.from("markets").upsert(
      [
        {
          id: focus.marketId,
          name: focus.city,
          description: "",
        },
      ],
      { onConflict: "id" }
    );

    if (marketResult.error) {
      throw marketResult.error;
    }

    const segmentResult = await supabase.from("segments").upsert(
      [
        {
          id: focus.segmentId,
          market_id: focus.marketId,
          name: focus.niche,
          description: "",
        },
      ],
      { onConflict: "id" }
    );

    if (segmentResult.error) {
      throw segmentResult.error;
    }

    const batchResult = await supabase.from("batches").upsert(
      [
        {
          id: focus.batchId,
          market_id: focus.marketId,
          segment_id: focus.segmentId,
          name: focus.batchName,
          source: "Workspace selection",
          import_file_name: "",
          status: "active",
          target_size: focus.batchSize,
          notes: "",
        },
      ],
      { onConflict: "id" }
    );

    if (batchResult.error) {
      throw batchResult.error;
    }
  } catch (error) {
    if (!isMissingStructuredSchemaError(error)) {
      throw error;
    }
  }
}

async function ensureStructureFromLeads(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  leads: Lead[]
) {
  const focusMap = new Map<string, WorkspaceFocus>();

  leads.forEach((lead) => {
    const focus = normalizeFocus({
      marketId: lead.marketId,
      segmentId: lead.segmentId,
      batchId: lead.batchId,
      city: lead.city,
      niche: lead.niche,
      batchName: lead.batchName,
      offer: lead.offerType,
      batchSize: SAMPLE_FOCUS.batchSize,
    });

    focusMap.set(focus.batchId, focus);
  });

  for (const focus of focusMap.values()) {
    await ensureFocusStructure(supabase, focus);
  }
}

async function applySegmentAssignmentsToLeads(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  leads: Lead[],
  actorUserId?: string
) {
  if (!leads.length) {
    return leads;
  }

  const segmentIds = [...new Set(leads.map((lead) => lead.segmentId).filter(Boolean))];
  const { data, error } = await supabase
    .from("segment_assignments")
    .select("*")
    .in("segment_id", segmentIds)
    .eq("is_active", true)
    .returns<SegmentAssignmentRow[]>();

  if (error) {
    throw error;
  }

  const assignmentBySegment = new Map<string, SegmentAssignmentRow>();
  (data || []).forEach((row) => {
    if (!assignmentBySegment.has(row.segment_id)) {
      assignmentBySegment.set(row.segment_id, row);
    }
  });

  return leads.map((lead) => {
    const assignment = assignmentBySegment.get(lead.segmentId);

    if (!assignment || lead.assignedUserId) {
      return normalizeLead(
        {
          ...lead,
          opsStatus: lead.opsStatus || "pending",
        },
        SAMPLE_FOCUS
      );
    }

    return normalizeLead(
      {
        ...lead,
        assignedUserId: assignment.user_id,
        assignedAt: new Date().toISOString(),
        assignedByUserId: actorUserId,
        opsStatus: lead.opsStatus || "pending",
      },
      SAMPLE_FOCUS
    );
  });
}

async function upsertWorkspaceRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  focus: WorkspaceFocus
) {
  const attempts = [true, false] as const;
  let lastError: unknown = null;

  for (const includeStructure of attempts) {
    const { data, error } = await supabase
      .from("workspace_settings")
      .upsert([mapWorkspaceToRow(focus, { includeStructure })])
      .select()
      .single<WorkspaceRow>();

    if (!error) {
      return data;
    }

    lastError = error;

    if (!isMissingWorkspaceStructureColumns(error)) {
      throw error;
    }
  }

  throw lastError;
}

function mapWorkspaceToRow(focus: WorkspaceFocus, options?: { includeStructure?: boolean }) {
  const baseRow = {
    id: "default",
    city: focus.city,
    niche: focus.niche,
    batch_name: focus.batchName,
    offer_base_id: focus.offerBaseId,
    offer_addons: focus.offerAddons,
    offer: focus.offer,
    batch_size: focus.batchSize,
  };

  if (options?.includeStructure === false) {
    const {
      batch_name: _ignoredBatchName,
      offer_base_id: _ignoredOfferBaseId,
      offer_addons: _ignoredOfferAddons,
      ...legacyRow
    } = baseRow;
    return legacyRow;
  }

  return {
    ...baseRow,
    market_id: focus.marketId,
    segment_id: focus.segmentId,
    batch_id: focus.batchId,
  };
}

async function insertLeadRowsWithFallback(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  leads: Lead[]
) {
  let lastError: unknown = null;

  for (const options of RECOVERABLE_LEAD_WRITE_OPTIONS) {
    const { data, error } = await supabase
      .from("leads")
      .insert(leads.map((lead) => mapLeadToInsertRow(lead, options)))
      .select()
      .returns<LeadRow[]>();

    if (!error) {
      return data || [];
    }

    lastError = error;

    if (!isRecoverableLeadWriteError(error)) {
      throw error;
    }
  }

  throw lastError;
}

async function updateLeadRowWithFallback(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  leadId: string,
  lead: Lead
) {
  let lastError: unknown = null;

  for (const options of RECOVERABLE_LEAD_WRITE_OPTIONS) {
    const { id: _ignoredId, ...updateRow } = mapLeadToInsertRow(lead, options);
    const { data, error } = await supabase
      .from("leads")
      .update(updateRow)
      .eq("id", leadId)
      .select()
      .single<LeadRow>();

    if (!error) {
      return data;
    }

    lastError = error;

    if (!isRecoverableLeadWriteError(error)) {
      throw error;
    }
  }

  throw lastError;
}

function buildCatalogSnapshot(
  focus: WorkspaceFocus,
  leads: Lead[],
  structured: { markets: Market[]; segments: Segment[]; batches: Batch[] }
) {
  const now = new Date().toISOString();
  const markets = new Map<string, Market>();
  const segments = new Map<string, Segment>();
  const batches = new Map<string, Batch>();

  const upsertMarket = (market: Market) => {
    markets.set(market.id, market);
  };

  const upsertSegment = (segment: Segment) => {
    segments.set(segment.id, segment);
  };

  const upsertBatch = (batch: Batch) => {
    batches.set(batch.id, batch);
  };

  structured.markets.forEach(upsertMarket);
  structured.segments.forEach(upsertSegment);
  structured.batches.forEach(upsertBatch);

  upsertMarket({
    id: focus.marketId || buildMarketId(focus.city),
    name: focus.city,
    description: "",
    createdAt: now,
    updatedAt: now,
  });

  upsertSegment({
    id: focus.segmentId || buildSegmentId(focus.city, focus.niche),
    marketId: focus.marketId || buildMarketId(focus.city),
    name: focus.niche,
    description: "",
    createdAt: now,
    updatedAt: now,
  });

  upsertBatch({
    id: focus.batchId || buildBatchId(focus.city, focus.niche, focus.batchName),
    marketId: focus.marketId || buildMarketId(focus.city),
    segmentId: focus.segmentId || buildSegmentId(focus.city, focus.niche),
    name: focus.batchName,
    source: "Workspace selection",
    importFileName: "",
    status: "active",
    targetSize: focus.batchSize,
    notes: "",
    createdAt: now,
    updatedAt: now,
  });

  leads.forEach((lead) => {
    upsertMarket({
      id: lead.marketId || buildMarketId(lead.city),
      name: lead.city,
      description: "",
      createdAt: now,
      updatedAt: now,
    });

    upsertSegment({
      id: lead.segmentId || buildSegmentId(lead.city, lead.niche),
      marketId: lead.marketId || buildMarketId(lead.city),
      name: lead.niche,
      description: "",
      createdAt: now,
      updatedAt: now,
    });

    upsertBatch({
      id: lead.batchId || buildBatchId(lead.city, lead.niche, lead.batchName),
      marketId: lead.marketId || buildMarketId(lead.city),
      segmentId: lead.segmentId || buildSegmentId(lead.city, lead.niche),
      name: lead.batchName,
      source: lead.source,
      importFileName: "",
      status: "active",
      targetSize: focus.batchSize,
      notes: "",
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    markets: [...markets.values()].sort((left, right) => left.name.localeCompare(right.name)),
    segments: [...segments.values()].sort((left, right) => left.name.localeCompare(right.name)),
    batches: [...batches.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  };
}

function mapWorkspaceRowToFocus(row: WorkspaceRow): WorkspaceFocus {
  return normalizeFocus({
    marketId: row.market_id || buildMarketId(row.city),
    segmentId: row.segment_id || buildSegmentId(row.city, row.niche),
    batchId:
      row.batch_id ||
      buildBatchId(row.city, row.niche, row.batch_name || SAMPLE_FOCUS.batchName),
    city: row.city,
    niche: row.niche,
    batchName: row.batch_name || SAMPLE_FOCUS.batchName,
    offerBaseId: row.offer_base_id || undefined,
    offerAddons: row.offer_addons || undefined,
    offer: row.offer,
    batchSize: row.batch_size,
  });
}

function mapLeadRowToLead(row: LeadRow): Lead {
  return normalizeLead(
    {
      id: row.id,
      marketId: row.market_id || buildMarketId(row.city),
      segmentId: row.segment_id || buildSegmentId(row.city, row.niche),
      batchId:
        row.batch_id ||
        buildBatchId(row.city, row.niche, row.batch_name || SAMPLE_FOCUS.batchName),
      businessName: row.business_name,
      city: row.city,
      niche: row.niche,
      subniche: row.subniche || row.niche,
      batchName: row.batch_name || SAMPLE_FOCUS.batchName,
      phone: row.phone,
      email: row.email,
      website: row.website,
      source: row.source,
      websiteStatus: row.website_status,
      digitalPresence: row.digital_presence,
      painPoints: row.pain_points,
      offerType: row.offer_type,
      stage: row.stage,
      opsStatus: row.ops_status || undefined,
      notes: row.notes,
      lastTouch: row.last_touch,
      assignedUserId: row.assigned_user_id || undefined,
      assignedAt: row.assigned_at || undefined,
      assignedByUserId: row.assigned_by_user_id || undefined,
      nextFollowUpAt: row.next_follow_up_at || undefined,
      lastActivityAt: row.last_activity_at || undefined,
      lastActivitySummary: row.last_activity_summary || undefined,
      aiServiceId: row.ai_service_id || undefined,
      aiServiceReason: row.ai_service_reason || undefined,
      aiConfidence: row.ai_confidence ?? undefined,
      aiPainPoints: row.ai_pain_points || undefined,
      aiAudit: row.ai_audit || undefined,
      aiScope: row.ai_scope || undefined,
      aiWhatsapp: row.ai_whatsapp || undefined,
      aiEmail: row.ai_email || undefined,
      aiCall: row.ai_call || undefined,
      aiModelClassify: row.ai_model_classify || undefined,
      aiModelCopy: row.ai_model_copy || undefined,
      aiEnrichedAt: row.ai_enriched_at || undefined,
    },
    SAMPLE_FOCUS
  );
}

function mapLeadToInsertRow(
  lead: Lead,
  options?: { includeFingerprint?: boolean; includeStructure?: boolean; includeAi?: boolean }
) {
  const insertRow = {
    id: lead.id,
    market_id: lead.marketId,
    segment_id: lead.segmentId,
    batch_id: lead.batchId,
    business_name: lead.businessName,
    city: lead.city,
    niche: lead.niche,
    subniche: lead.subniche,
    batch_name: lead.batchName,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    source: lead.source,
    website_status: lead.websiteStatus,
    digital_presence: lead.digitalPresence,
    pain_points: lead.painPoints,
    offer_type: lead.offerType,
    stage: lead.stage,
    ops_status: lead.opsStatus,
    notes: lead.notes,
    last_touch: lead.lastTouch,
    assigned_user_id: lead.assignedUserId || null,
    assigned_at: lead.assignedAt || null,
    assigned_by_user_id: lead.assignedByUserId || null,
    next_follow_up_at: lead.nextFollowUpAt || null,
    last_activity_at: lead.lastActivityAt || null,
    last_activity_summary: lead.lastActivitySummary || "",
    ai_service_id: lead.aiServiceId || null,
    ai_service_reason: lead.aiServiceReason || "",
    ai_confidence: lead.aiConfidence ?? null,
    ai_pain_points: lead.aiPainPoints || [],
    ai_audit: lead.aiAudit || "",
    ai_scope: lead.aiScope || [],
    ai_whatsapp: lead.aiWhatsapp || "",
    ai_email: lead.aiEmail || "",
    ai_call: lead.aiCall || "",
    ai_model_classify: lead.aiModelClassify || "",
    ai_model_copy: lead.aiModelCopy || "",
    ai_enriched_at: lead.aiEnrichedAt || null,
  };

  const structuredRow =
    options?.includeStructure === false
      ? {
          id: insertRow.id,
          business_name: insertRow.business_name,
          city: insertRow.city,
          niche: insertRow.niche,
          phone: insertRow.phone,
          email: insertRow.email,
          website: insertRow.website,
          source: insertRow.source,
          website_status: insertRow.website_status,
          digital_presence: insertRow.digital_presence,
          pain_points: insertRow.pain_points,
          offer_type: insertRow.offer_type,
          stage: insertRow.stage,
          notes: insertRow.notes,
          last_touch: insertRow.last_touch,
          ops_status: insertRow.ops_status,
          assigned_user_id: insertRow.assigned_user_id,
          assigned_at: insertRow.assigned_at,
          assigned_by_user_id: insertRow.assigned_by_user_id,
          next_follow_up_at: insertRow.next_follow_up_at,
          last_activity_at: insertRow.last_activity_at,
          last_activity_summary: insertRow.last_activity_summary,
        }
      : insertRow;

  const baseRow =
    options?.includeAi === false
      ? {
          ...structuredRow,
          ai_service_id: undefined,
          ai_service_reason: undefined,
          ai_confidence: undefined,
          ai_pain_points: undefined,
          ai_audit: undefined,
          ai_scope: undefined,
          ai_whatsapp: undefined,
          ai_email: undefined,
          ai_call: undefined,
          ai_model_classify: undefined,
          ai_model_copy: undefined,
          ai_enriched_at: undefined,
        }
      : structuredRow;

  if (options?.includeFingerprint === false) {
    return baseRow;
  }

  return {
    ...baseRow,
    fingerprint: createLeadFingerprint(lead),
  };
}

function mapMarketRowToMarket(row: MarketRow): Market {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSegmentRowToSegment(row: SegmentRow): Segment {
  return {
    id: row.id,
    marketId: row.market_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBatchRowToBatch(row: BatchRow): Batch {
  return {
    id: row.id,
    marketId: row.market_id,
    segmentId: row.segment_id,
    name: row.name,
    source: row.source,
    importFileName: row.import_file_name,
    status: row.status,
    targetSize: row.target_size,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTeamMemberRowToTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuthenticatedUserToTeamMember(user: AuthenticatedUser): TeamMember {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapSegmentAssignmentRowToSegmentAssignment(row: SegmentAssignmentRow): SegmentAssignment {
  return {
    id: row.id,
    userId: row.user_id,
    marketId: row.market_id,
    segmentId: row.segment_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadActivityRowToLeadActivity(row: LeadActivityRow): LeadActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    userName: row.user_name,
    activityType: normalizeActivityType(row.activity_type),
    outcome: row.outcome,
    summary: row.summary,
    nextFollowUpAt: row.next_follow_up_at || undefined,
    createdAt: row.created_at,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

async function findExistingLeadWithoutFingerprint(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  lead: Lead,
  excludeLeadId?: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,business_name,city,phone,email,website")
    .limit(5000);

  if (error) {
    throw error;
  }

  const match = (data || []).find((row) => {
    const existingFingerprint = createLeadFingerprint({
      businessName: String(row.business_name || ""),
      city: String(row.city || ""),
      phone: String(row.phone || ""),
      email: String(row.email || ""),
      website: String(row.website || ""),
    });

    return existingFingerprint === createLeadFingerprint(lead);
  });

  if (!match) {
    return null;
  }

  if (excludeLeadId && String(match.id) === excludeLeadId) {
    return null;
  }

  return { id: String(match.id) };
}

async function loadExistingFingerprintsWithoutFingerprint(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>
) {
  const { data, error } = await supabase
    .from("leads")
    .select("business_name,city,phone,email,website")
    .limit(5000);

  if (error) {
    throw error;
  }

  return new Set(
    (data || []).map((row) =>
      createLeadFingerprint({
        businessName: String(row.business_name || ""),
        city: String(row.city || ""),
        phone: String(row.phone || ""),
        email: String(row.email || ""),
        website: String(row.website || ""),
      })
    )
  );
}

function isMissingFingerprintColumn(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();

  return (
    message.includes("fingerprint") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function isMissingStructuredSchemaError(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();

  return (
    message.includes("markets") ||
    message.includes("segments") ||
    message.includes("batches") ||
    message.includes("relation") ||
    message.includes("schema cache")
  );
}

function isMissingStructuredLeadColumns(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  const trackedColumns = ["market_id", "segment_id", "batch_id", "subniche", "batch_name"];

  return (
    trackedColumns.some((column) => message.includes(column)) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

function isMissingAiLeadColumns(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  const trackedColumns = [
    "ai_service_id",
    "ai_service_reason",
    "ai_confidence",
    "ai_pain_points",
    "ai_audit",
    "ai_scope",
    "ai_whatsapp",
    "ai_email",
    "ai_call",
    "ai_model_classify",
    "ai_model_copy",
    "ai_enriched_at",
  ];

  return (
    trackedColumns.some((column) => message.includes(column)) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

function isMissingWorkspaceStructureColumns(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  const trackedColumns = ["market_id", "segment_id", "batch_id", "batch_name", "offer_base_id", "offer_addons"];

  return trackedColumns.some((column) => message.includes(column)) && !message.includes("workspace_settings row");
}

function isRecoverableLeadWriteError(error: unknown) {
  return (
    isMissingFingerprintColumn(error) ||
    isMissingStructuredLeadColumns(error) ||
    isMissingAiLeadColumns(error)
  );
}
