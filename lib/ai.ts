import type { AiImportStatus, Lead, ProposalServiceId } from "@/lib/types";

const OPENAI_API_URL = process.env.OPENAI_API_URL?.trim() || "https://api.openai.com/v1/responses";
const OPENAI_CLASSIFIER_MODEL = process.env.OPENAI_CLASSIFIER_MODEL?.trim() || "gpt-5-nano";
const OPENAI_WRITER_MODEL =
  process.env.OPENAI_WRITER_MODEL?.trim() || process.env.OPENAI_COPY_MODEL?.trim() || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = clampNumber(process.env.OPENAI_TIMEOUT_MS, 4_000, 60_000, 45_000);
const OPENAI_IMPORT_CHUNK_SIZE = clampNumber(process.env.OPENAI_IMPORT_CHUNK_SIZE, 4, 20, 8);

const PROPOSAL_SERVICE_IDS: ProposalServiceId[] = [
  "landing_conversion",
  "website_redesign",
  "conversion_audit",
  "whatsapp_followup",
  "google_business_profile",
  "booking_funnel",
];

const PROPOSAL_SERVICE_BRIEFS: Record<
  ProposalServiceId,
  {
    label: string;
    outcome: string;
  }
> = {
  landing_conversion: {
    label: "Landing de conversión",
    outcome: "convertir visitas de cualquier canal en consultas",
  },
  website_redesign: {
    label: "Rediseño web enfocado en conversión",
    outcome: "ordenar la presencia digital y subir conversión",
  },
  conversion_audit: {
    label: "Auditoría y plan de conversión",
    outcome: "encontrar fricción y liberar conversión",
  },
  whatsapp_followup: {
    label: "Automatización de WhatsApp y seguimiento",
    outcome: "responder más rápido y no perder oportunidades",
  },
  google_business_profile: {
    label: "Presencia local y conversión",
    outcome: "convertir tráfico local y externo en consultas",
  },
  booking_funnel: {
    label: "Sistema de captación y agenda",
    outcome: "llevar interés a una cita agendada",
  },
};

const PROPOSAL_SERVICE_COPY_GUIDES: Record<
  ProposalServiceId,
  {
    angle: string;
    hook: string;
    cta: string;
  }
> = {
  landing_conversion: {
    angle: "convertir visitas de cualquier canal en consultas con una sola página clara",
    hook: "No vendas diseño; vende claridad, confianza y una ruta de contacto simple que puedas distribuir desde redes, WhatsApp, QR y anuncios.",
    cta: "Propón ver un boceto corto y una ruta de contacto directa.",
  },
  website_redesign: {
    angle: "ordenar la presencia digital para que convierta mejor desde cualquier canal",
    hook: "Habla de claridad, velocidad, CTA y confianza, no de estética por estética.",
    cta: "Invita a revisar el sitio actual y el rediseño propuesto.",
  },
  conversion_audit: {
    angle: "detectar dónde se pierde la consulta y qué mover primero",
    hook: "Habla de fricción, fugas y quick wins con impacto comercial.",
    cta: "Invita a revisar un diagnóstico breve y priorizado.",
  },
  whatsapp_followup: {
    angle: "responder más rápido y no perder leads calientes",
    hook: "Habla de seguimiento, respuesta oportuna y rescate de oportunidades.",
    cta: "Propón ver un flujo simple de seguimiento y recuperación.",
  },
  google_business_profile: {
    angle: "ganar confianza local y usar la ficha como punto de entrada hacia el sitio o landing central",
    hook: "Habla de reseñas, categorías, fotos y CTA local, pero deja claro que la ficha lleva al activo central de conversión.",
    cta: "Invita a revisar la ficha y cómo conecta con la landing o sitio.",
  },
  booking_funnel: {
    angle: "llevar interés a una cita sin fricción",
    hook: "Habla de agenda, formulario y recordatorios para convertir el interés.",
    cta: "Invita a ver el flujo de reserva y cómo baja el no-show.",
  },
};

const AI_STAGE_COPY_GUIDES: Record<
  Lead["stage"],
  {
    label: string;
    cta: string;
    tone: string;
  }
> = {
  sourced: {
    label: "Primer contacto",
    cta: "Busca una llamada corta de 10 a 15 minutos para validar si encaja.",
    tone: "directo, breve y con una oportunidad clara",
  },
  qualified: {
    label: "Lead calificado",
    cta: "Valida si encaja y pide la llamada corta de seguimiento.",
    tone: "más específico, con criterio comercial",
  },
  contacted: {
    label: "Seguimiento",
    cta: "Reabre la conversación sin sonar insistente y busca respuesta.",
    tone: "cálido, breve y orientado a reactivar interés",
  },
  booked: {
    label: "Llamada agendada",
    cta: "Prepara la reunión y deja claro el siguiente paso.",
    tone: "seguro, preparado y sin rodeos",
  },
  demo: {
    label: "Demo",
    cta: "Cierra objeciones y deja el siguiente paso definido.",
    tone: "preciso, visual y orientado a cierre",
  },
  proposal: {
    label: "Propuesta",
    cta: "Cierra fecha y resuelve objeciones para no enfriar el interés.",
    tone: "más firme, de cierre y concreción",
  },
  closed: {
    label: "Cliente",
    cta: "Explora una expansión coherente sin distraer el núcleo.",
    tone: "consultivo, de expansión y valor adicional",
  },
};

type ClassificationRow = {
  id: string;
  serviceId: ProposalServiceId;
  serviceReason: string;
  confidence: number;
  subniche: string;
  painPoints: string[];
};

type ClassificationPayload = {
  leads: ClassificationRow[];
};

type DraftRow = {
  id: string;
  serviceLabel: string;
  serviceOutcome: string;
  offerType: string;
  audit: string;
  scope: string[];
  whatsapp: string;
  email: string;
  call: string;
};

type DraftPayload = {
  leads: DraftRow[];
};

type AiEnrichmentResult = {
  leads: Lead[];
  status: AiImportStatus;
};

export async function enrichImportedLeadsWithAi(leads: Lead[]): Promise<AiEnrichmentResult> {
  if (!leads.length || !process.env.OPENAI_API_KEY) {
    return {
      leads,
      status: buildAiImportStatus({
        phase: "disabled",
        attempted: false,
        totalLeads: leads.length,
        enrichedLeads: 0,
        classifierModel: OPENAI_CLASSIFIER_MODEL,
        writerModel: OPENAI_WRITER_MODEL,
        message: leads.length
          ? "IA desactivada: falta OPENAI_API_KEY. La importación se guardó sin enriquecimiento."
          : "IA desactivada: no hay leads para enriquecer.",
      }),
    };
  }

  const enriched: Lead[] = [];
  const errors: string[] = [];

  for (const chunk of sliceBySize(leads, OPENAI_IMPORT_CHUNK_SIZE)) {
    const result = await enrichAiChunk(chunk);
    enriched.push(...result.leads);
    errors.push(...result.errors);
  }

  const enrichedCount = enriched.filter(hasAiSignals).length;

  return {
    leads: enriched,
    status: buildAiImportStatus({
      phase:
        errors.length || enrichedCount < leads.length
          ? enrichedCount > 0
            ? "partial"
            : "fallback"
          : "success",
      attempted: true,
      totalLeads: leads.length,
      enrichedLeads: enrichedCount,
      classifierModel: OPENAI_CLASSIFIER_MODEL,
      writerModel: OPENAI_WRITER_MODEL,
      message: buildAiStatusMessage({
        totalLeads: leads.length,
        enrichedLeads: enrichedCount,
        classifierModel: OPENAI_CLASSIFIER_MODEL,
        writerModel: OPENAI_WRITER_MODEL,
        errors,
      }),
      error: errors[0] ? trimLimit(errors[0], 240) : undefined,
    }),
  };
}

async function enrichAiChunk(leads: Lead[]): Promise<{ leads: Lead[]; errors: string[] }> {
  if (!leads.length) {
    return { leads: [], errors: [] };
  }

  const classified = await classifyChunk(leads);
  const withClassification = applyClassification(leads, classified.payload);
  const drafted = await draftChunk(withClassification);
  const withDraft = applyDraft(withClassification, drafted.payload);

  if (leads.length > 1 && shouldRetryAiChunk(leads.length, classified, drafted)) {
    const [left, right] = splitLeadsInHalf(leads);
    const [leftResult, rightResult] = await Promise.all([enrichAiChunk(left), enrichAiChunk(right)]);

    return {
      leads: [...leftResult.leads, ...rightResult.leads],
      errors: [...leftResult.errors, ...rightResult.errors],
    };
  }

  return {
    leads: withDraft,
    errors: [classified.error, drafted.error].filter(Boolean) as string[],
  };
}

function applyClassification(leads: Lead[], payload: ClassificationPayload | null) {
  if (!payload?.leads?.length) {
    return leads;
  }

  const byId = new Map(payload.leads.map((entry) => [entry.id, entry]));
  const now = new Date().toISOString();

  return leads.map((lead) => {
    const insight = byId.get(lead.id);
    if (!insight) {
      return lead;
    }

    const mergedPainPoints = dedupeStrings([...(lead.painPoints || []), ...(insight.painPoints || [])]).slice(0, 4);
    const nextSubniche = pickSubniche(lead, insight.subniche);

    return {
      ...lead,
      subniche: nextSubniche,
      painPoints: mergedPainPoints.length ? mergedPainPoints : lead.painPoints,
      aiServiceId: insight.serviceId,
      aiServiceReason: normalizeText(insight.serviceReason),
      aiConfidence: clampDecimal(insight.confidence, 0, 1),
      aiPainPoints: normalizeStringArray(insight.painPoints, 4),
      aiModelClassify: OPENAI_CLASSIFIER_MODEL,
      aiEnrichedAt: now,
    };
  });
}

function applyDraft(leads: Lead[], payload: DraftPayload | null) {
  if (!payload?.leads?.length) {
    return leads;
  }

  const byId = new Map(payload.leads.map((entry) => [entry.id, entry]));
  const now = new Date().toISOString();

  return leads.map((lead) => {
    const draft = byId.get(lead.id);
    if (!draft) {
      return lead;
    }

    return {
      ...lead,
      aiAudit: polishCommercialText(draft.audit),
      aiScope: normalizeStringArray(draft.scope, 6),
      aiWhatsapp: ensureGreeting(polishCommercialText(draft.whatsapp)),
      aiEmail: polishEmailText(draft.email),
      aiCall: ensureGreeting(polishCommercialText(draft.call)),
      aiModelCopy: OPENAI_WRITER_MODEL,
      aiEnrichedAt: now,
    };
  });
}

async function classifyChunk(leads: Lead[]) {
  const input = leads.map((lead) => ({
    id: lead.id,
    businessName: lead.businessName,
    city: lead.city,
    niche: lead.niche,
    subniche: lead.subniche,
    websiteStatus: lead.websiteStatus,
    digitalPresence: lead.digitalPresence,
    stage: lead.stage,
    source: lead.source,
    painPoints: (lead.painPoints || []).slice(0, 4),
    notes: trimLimit(lead.notes, 220),
  }));

  try {
    const response = await runStructuredResponse<ClassificationPayload>({
      model: OPENAI_CLASSIFIER_MODEL,
      reasoningEffort: "low",
      schemaName: "lead_import_classification_v1",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["leads"],
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "serviceId", "serviceReason", "confidence", "subniche", "painPoints"],
              properties: {
                id: { type: "string" },
                serviceId: { type: "string", enum: PROPOSAL_SERVICE_IDS },
                serviceReason: { type: "string" },
                confidence: { type: "number" },
                subniche: { type: "string" },
                painPoints: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                  maxItems: 3,
                },
              },
            },
          },
        },
      },
      system:
        "Clasifica leads para ventas consultivas. Responde solo JSON válido. Mantente breve, accionable y con ortografía correcta. Si el negocio no tiene sitio o landing visible, prioriza landing_conversion o website_redesign como solución central. Usa google_business_profile solo como canal de apoyo o entrada, no como la solución completa.",
      userPayload: {
        instructions: [
          "Para cada lead, define el servicio recomendado y una razón de máximo 180 caracteres.",
          "La confianza debe ir entre 0 y 1.",
          "Subniche debe ser corto, concreto y comercial.",
          "Pain points deben ser máximo 3 items cortos en español, con tildes y ortografía correcta.",
          "La propuesta central debe ser un sitio o landing que funcione como centro de conversión y pueda distribuirse desde Google, redes, WhatsApp Business, anuncios y QR.",
          "Solo usa google_business_profile cuando la oportunidad principal sea reforzar la presencia local; aun así, el mensaje debe asumir que existe un sitio o landing como centro.",
        ],
        leads: input,
      },
      maxOutputTokens: 2_800,
    });

    return { payload: sanitizeClassificationPayload(response, leads), error: "" };
  } catch (error) {
    return { payload: null, error: getAiErrorMessage(error, "No pude clasificar el lote con OpenAI.") };
  }
}

async function draftChunk(leads: Lead[]) {
  const input = leads.map((lead) => ({
    id: lead.id,
    businessName: lead.businessName,
    city: lead.city,
    niche: lead.niche,
    subniche: lead.subniche,
    stage: lead.stage,
    serviceId: lead.aiServiceId || null,
    serviceLabel: PROPOSAL_SERVICE_BRIEFS[lead.aiServiceId || "booking_funnel"].label,
    serviceOutcome: PROPOSAL_SERVICE_BRIEFS[lead.aiServiceId || "booking_funnel"].outcome,
    serviceAngle: PROPOSAL_SERVICE_COPY_GUIDES[lead.aiServiceId || "booking_funnel"].angle,
    serviceHook: PROPOSAL_SERVICE_COPY_GUIDES[lead.aiServiceId || "booking_funnel"].hook,
    serviceCta: PROPOSAL_SERVICE_COPY_GUIDES[lead.aiServiceId || "booking_funnel"].cta,
    serviceReason: trimLimit(lead.aiServiceReason || "", 220),
    painPoints: (lead.aiPainPoints?.length ? lead.aiPainPoints : lead.painPoints).slice(0, 3),
    websiteStatus: lead.websiteStatus,
    digitalPresence: lead.digitalPresence,
    offerType: lead.offerType,
    stageLabel: AI_STAGE_COPY_GUIDES[lead.stage].label,
    stageCta: AI_STAGE_COPY_GUIDES[lead.stage].cta,
    stageTone: AI_STAGE_COPY_GUIDES[lead.stage].tone,
  }));

  try {
    const response = await runStructuredResponse<DraftPayload>({
      model: OPENAI_WRITER_MODEL,
      schemaName: "lead_import_copy_v1",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["leads"],
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "serviceLabel", "serviceOutcome", "offerType", "audit", "scope", "whatsapp", "email", "call"],
              properties: {
                id: { type: "string" },
                serviceLabel: { type: "string" },
                serviceOutcome: { type: "string" },
                offerType: { type: "string" },
                audit: { type: "string" },
                scope: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                },
                whatsapp: { type: "string" },
                email: { type: "string" },
                call: { type: "string" },
              },
            },
          },
        },
      },
      system:
        "Redacta mensajes comerciales en español para outbound consultivo de negocios locales. Responde solo JSON válido. Escribe como un closer senior: directo, humano, persuasivo y específico. La prioridad es sonar útil y natural, no académico ni genérico. Usa ortografía impecable, tildes, eñes y puntuación limpia. La pieza central debe ser un sitio o landing que se pueda distribuir desde Google, redes, WhatsApp Business, anuncios y QR; Google Business Profile solo es un canal de entrada, no la solución completa.",
      userPayload: {
        instructions: [
          "El copy debe sonar humano y comercial, no técnico ni robótico.",
          "WhatsApp sí debe saludar con un 'Hola' o 'Buen día' breve antes de entrar a la oportunidad.",
          "No te presentes como consultor ni uses frases vacías como 'he observado', 'he notado', 'he estado viendo', 'me encantaría' o 'soy [Tu Nombre]'.",
          "No repitas 'red social' ni 'directorio'; si el hallazgo viene de un enlace externo, tradúcelo a 'canal externo' o 'página propia de captación'.",
          "No inventes sectores, audiencias ni beneficios que no estén respaldados por el lead; evita palabras como 'educativa', 'funnel' o 'boceto' si no aportan una venta más clara.",
          "Evita anglicismos como 'visibility', 'landing page', 'call-to-action' o 'leads'; usa 'visibilidad', 'landing', 'CTA' y 'consultas' cuando corresponda.",
          "Evita frases genéricas como 'espacio para una propuesta más moderna' si no añaden un beneficio concreto.",
          "Usa este orden: diagnóstico corto -> oportunidad concreta -> propuesta -> CTA.",
          "Audit debe sonar como diagnóstico de negocio, no como checklist, y abrir con la oportunidad comercial.",
          "WhatsApp debe ser breve, natural y con un solo CTA. Máximo 2 frases después del saludo.",
          "Email debe leerse como un correo de prospección bien escrito, con asunto concreto y 2 o 3 párrafos cortos. No alargues el saludo ni la introducción.",
          "Call debe sonar como una apertura verbal de 3 a 5 frases, como si estuvieras al teléfono de verdad.",
          "Si la señal es débil, conviértela en una oportunidad comercial específica y no la repitas de forma abstracta.",
          "Usa serviceAngle y serviceHook como columna vertebral del mensaje.",
          "Ajusta el CTA al stageTone y stageCta, sin sonar forzado.",
          "WhatsApp máximo 320 caracteres idealmente, email máximo 850, call máximo 450.",
          "Scope debe ser accionable y concreto para una propuesta inicial.",
          "No uses fórmulas repetidas como 'hola, soy [Tu Nombre]' en todas las piezas.",
          "Plantilla guía para WhatsApp: saludo breve + oportunidad concreta + CTA corto.",
          "Plantilla guía para email: asunto claro + 1 párrafo de diagnóstico + 1 párrafo de propuesta + CTA corto.",
          "Plantilla guía para call: 1 frase de observación + 1 frase de propuesta + 1 frase de CTA.",
          "Ejemplo de tono: vi una oportunidad clara para convertir más consultas con una landing más simple, un CTA directo y seguimiento rápido.",
        ],
        leads: input,
      },
      maxOutputTokens: 2_800,
    });

    return { payload: sanitizeDraftPayload(response, leads), error: "" };
  } catch (error) {
    return { payload: null, error: getAiErrorMessage(error, "No pude redactar el lote con OpenAI.") };
  }
}

function shouldRetryAiChunk(
  totalLeads: number,
  classified: { payload: ClassificationPayload | null; error: string },
  drafted: { payload: DraftPayload | null; error: string }
) {
  if (isRetryableAiError(classified.error) || isRetryableAiError(drafted.error)) {
    return true;
  }

  if ((classified.payload?.leads?.length || 0) < totalLeads) {
    return true;
  }

  if ((drafted.payload?.leads?.length || 0) < totalLeads) {
    return true;
  }

  return false;
}

function isRetryableAiError(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("aborted") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("max_output_tokens") ||
    normalized.includes("incomplete") ||
    normalized.includes("structured output text") ||
    normalized.includes("did not include structured output")
  );
}

function splitLeadsInHalf(leads: Lead[]) {
  const midpoint = Math.ceil(leads.length / 2);
  return [leads.slice(0, midpoint), leads.slice(midpoint)] as const;
}

async function runStructuredResponse<T>({
  model,
  reasoningEffort,
  schemaName,
  schema,
  system,
  userPayload,
  maxOutputTokens,
}: {
  model: string;
  reasoningEffort?: "low" | "medium" | "high" | "minimal" | "xhigh" | "none";
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  userPayload: Record<string, unknown>;
  maxOutputTokens: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(userPayload) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            schema,
            strict: true,
          },
        },
        max_output_tokens: maxOutputTokens,
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message = extractErrorMessage(data) || `OpenAI request failed with status ${response.status}`;
      throw new Error(message);
    }

    const outputText = extractOutputText(data);
    if (!outputText) {
      throw new Error("OpenAI response did not include structured output text.");
    }

    return JSON.parse(outputText) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeClassificationPayload(payload: ClassificationPayload, leads: Lead[]): ClassificationPayload {
  const knownLeadIds = new Set(leads.map((lead) => lead.id));

  return {
    leads: (payload.leads || [])
      .filter((entry) => knownLeadIds.has(String(entry.id || "")))
      .map((entry) => ({
        id: String(entry.id || ""),
        serviceId: normalizeServiceId(entry.serviceId),
        serviceReason: trimLimit(entry.serviceReason, 240),
        confidence: clampDecimal(entry.confidence, 0, 1),
        subniche: trimLimit(entry.subniche, 80),
        painPoints: normalizeStringArray(entry.painPoints, 3),
      })),
  };
}

function sanitizeDraftPayload(payload: DraftPayload, leads: Lead[]): DraftPayload {
  const knownLeadIds = new Set(leads.map((lead) => lead.id));

  return {
    leads: (payload.leads || [])
      .filter((entry) => knownLeadIds.has(String(entry.id || "")))
      .map((entry) => ({
        id: String(entry.id || ""),
        serviceLabel: trimLimit(entry.serviceLabel, 120),
        serviceOutcome: trimLimit(entry.serviceOutcome, 160),
        offerType: trimLimit(entry.offerType, 160),
        audit: trimLimit(entry.audit, 900),
        scope: normalizeStringArray(entry.scope, 6),
        whatsapp: trimLimit(entry.whatsapp, 1_200),
        email: trimLimit(entry.email, 2_200),
        call: trimLimit(entry.call, 1_600),
      })),
  };
}

function hasAiSignals(lead: Lead) {
  return Boolean(
    lead.aiServiceId ||
      lead.aiServiceReason ||
      lead.aiConfidence !== undefined ||
      (lead.aiPainPoints || []).length ||
      lead.aiAudit ||
      (lead.aiScope || []).length ||
      lead.aiWhatsapp ||
      lead.aiEmail ||
      lead.aiCall ||
      lead.aiModelClassify ||
      lead.aiModelCopy
  );
}

function buildAiImportStatus({
  phase,
  attempted,
  totalLeads,
  enrichedLeads,
  classifierModel,
  writerModel,
  message,
  error,
}: {
  phase: AiImportStatus["phase"];
  attempted: boolean;
  totalLeads: number;
  enrichedLeads: number;
  classifierModel: string;
  writerModel: string;
  message: string;
  error?: string;
}): AiImportStatus {
  return {
    phase,
    attempted,
    totalLeads,
    enrichedLeads,
    classifierModel,
    writerModel,
    message,
    error,
  };
}

function buildAiStatusMessage({
  totalLeads,
  enrichedLeads,
  classifierModel,
  writerModel,
  errors,
}: {
  totalLeads: number;
  enrichedLeads: number;
  classifierModel: string;
  writerModel: string;
  errors: string[];
}) {
  if (!totalLeads) {
    return "IA desactivada: no hay leads para enriquecer.";
  }

  if (!enrichedLeads && errors.length) {
    return `IA intentada, pero el lote terminó sin enriquecimiento. Modelos: ${classifierModel} + ${writerModel}.`;
  }

  if (errors.length || enrichedLeads < totalLeads) {
    return `IA parcial: ${enrichedLeads}/${totalLeads} leads enriquecidos con ${classifierModel} + ${writerModel}. El resto quedó con fallback.`;
  }

  return `IA activa: ${enrichedLeads}/${totalLeads} leads enriquecidos con ${classifierModel} + ${writerModel}.`;
}

function getAiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function normalizeServiceId(value: unknown): ProposalServiceId {
  const normalized = String(value || "").trim().toLowerCase() as ProposalServiceId;
  return PROPOSAL_SERVICE_IDS.includes(normalized) ? normalized : "booking_funnel";
}

function pickSubniche(lead: Lead, candidate: string) {
  const cleaned = normalizeText(candidate);
  if (!cleaned) {
    return lead.subniche;
  }

  return cleaned;
}

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(String(item || "")))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function polishCommercialText(value: string) {
  let text = normalizeText(value);

  text = text
    .replace(/\bHe notado que\b/gi, "Veo que")
    .replace(/\bHe observado que\b/gi, "Veo que")
    .replace(/\bHe estado viendo\b/gi, "Revisé")
    .replace(/\bHe estado revisando\b/gi, "Revisé")
    .replace(/\bHe revisado\b/gi, "Revisé")
    .replace(/\bHe visto que\b/gi, "Veo que")
    .replace(/\bSoy \[Tu Nombre\]\.?/gi, "")
    .replace(/\bme gustaría\b/gi, "te propongo")
    .replace(/\bme encantaría\b/gi, "te propongo")
    .replace(/\bestoy seguro de que\b/gi, "")
    .replace(/\bte prometo que\b/gi, "")
    .replace(/\bte prometo\b/gi, "")
    .replace(/\bboceto\b/gi, "propuesta breve")
    .replace(/\bfunnel\b/gi, "ruta")
    .replace(/\blanding page\b/gi, "landing")
    .replace(/\bcall-to-action\b/gi, "CTA")
    .replace(/\bcall to action\b/gi, "CTA")
    .replace(/\bvisibility\b/gi, "visibilidad")
    .replace(/\bleads\b/gi, "consultas")
    .replace(/\bwebsite\b/gi, "sitio")
    .replace(/\bOptimizen\b/gi, "Optimiza")
    .replace(/\bcomo ya\b/gi, "si ya")
    .replace(/\btuviéramosuna\b/gi, "tuviéramos una")
    .replace(/\bHablemos\.\s*$/gi, "Hablemos.")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(\S)/g, "$1 $2");

  return normalizeText(text);
}

function ensureGreeting(value: string) {
  const text = normalizeText(value);
  if (!text) {
    return text;
  }

  const greetingPattern =
    /^[¡!¿?\s"'“”(\[]*(hola|buen\s*(día|dia)|buenas\s*(tardes|noches|días|dias)|saludos?)\b[\s,.:;!?¡¿"'“”(\[]*/i;
  const greetingMatch = text.match(greetingPattern);

  if (greetingMatch) {
    const remainder = text.slice(greetingMatch[0].length).trim();
    return remainder ? `Hola, ${remainder}` : "Hola";
  }

  return `Hola, ${text}`;
}

function polishEmailText(value: string) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const transformed = normalized
    .split("\n")
    .map((line) => polishCommercialText(line))
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  return transformed;
}

function trimLimit(value: unknown, limit: number) {
  return normalizeText(String(value || "")).slice(0, limit);
}

function clampDecimal(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(Math.max(parsed, min), max);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function sliceBySize<T>(items: T[], size: number) {
  const slices: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    slices.push(items.slice(index, index + size));
  }

  return slices;
}

function extractErrorMessage(data: Record<string, unknown>) {
  const errorValue = data.error;
  if (!errorValue || typeof errorValue !== "object") {
    return "";
  }

  const message = (errorValue as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function extractOutputText(data: Record<string, unknown>) {
  const direct = data.output_text;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const output = data.output;
  if (!Array.isArray(output)) {
    return "";
  }

  let collected = "";

  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        collected += text;
      }
    }
  }

  return collected.trim();
}
