import { SAMPLE_FOCUS } from "@/lib/sample-data";
import type {
  AppRole,
  DashboardLead,
  DigitalPresence,
  Lead,
  LeadActivityType,
  OfferAddonId,
  OfferBaseId,
  OpsStatus,
  PriorityTone,
  ProposalCopy,
  ProposalService,
  ProposalServiceId,
  Stage,
  WebsiteStatus,
  WorkspaceFocus,
} from "@/lib/types";

export const STAGES: Array<{ id: Stage; label: string }> = [
  { id: "sourced", label: "Prospectado" },
  { id: "qualified", label: "Calificado" },
  { id: "contacted", label: "Contactado" },
  { id: "booked", label: "Llamada agendada" },
  { id: "demo", label: "Demo" },
  { id: "proposal", label: "Propuesta" },
  { id: "closed", label: "Cerrado" },
];

type ProposalServiceDefinition = ProposalService & {
  primaryOutcome: string;
};

const PROPOSAL_SERVICE_CATALOG: Record<ProposalServiceId, ProposalServiceDefinition> = {
  landing_conversion: {
    id: "landing_conversion",
    label: "Landing de conversión",
    primaryOutcome: "convertir visitas de cualquier canal en consultas",
  },
  website_redesign: {
    id: "website_redesign",
    label: "Rediseño web enfocado en conversión",
    primaryOutcome: "ordenar la presencia digital y subir conversión",
  },
  conversion_audit: {
    id: "conversion_audit",
    label: "Auditoría y plan de conversión",
    primaryOutcome: "encontrar fricción y liberar conversión",
  },
  whatsapp_followup: {
    id: "whatsapp_followup",
    label: "Automatización de WhatsApp y seguimiento",
    primaryOutcome: "responder más rápido y no perder oportunidades",
  },
  google_business_profile: {
    id: "google_business_profile",
    label: "Presencia local y conversión",
    primaryOutcome: "convertir tráfico local y externo en consultas",
  },
  booking_funnel: {
    id: "booking_funnel",
    label: "Sistema de captación y agenda",
    primaryOutcome: "llevar interés a una cita agendada",
  },
};

const PROPOSAL_SERVICE_TIEBREAK: ProposalServiceId[] = [
  "booking_funnel",
  "landing_conversion",
  "website_redesign",
  "whatsapp_followup",
  "conversion_audit",
  "google_business_profile",
];

function getFocusServiceBias(focus: WorkspaceFocus, service: ProposalServiceDefinition) {
  const reasons: string[] = [];
  let score = 0;

  switch (focus.offerBaseId) {
    case "landing":
      if (service.id === "landing_conversion") {
        score += 24;
        reasons.push("encaja con la base comercial configurada");
      }
      if (service.id === "booking_funnel") score += 8;
      if (service.id === "whatsapp_followup") score += 6;
      if (service.id === "conversion_audit") score += 4;
      if (service.id === "website_redesign") score -= 4;
      break;
    case "website":
      if (service.id === "website_redesign") {
        score += 26;
        reasons.push("encaja con el sitio web como oferta principal");
      }
      if (service.id === "conversion_audit") score += 10;
      if (service.id === "landing_conversion") score += 6;
      if (service.id === "booking_funnel") score += 4;
      break;
    case "redesign":
      if (service.id === "website_redesign") {
        score += 28;
        reasons.push("encaja con el rediseño como oferta principal");
      }
      if (service.id === "conversion_audit") score += 12;
      if (service.id === "landing_conversion") score += 4;
      if (service.id === "booking_funnel") score += 4;
      break;
  }

  if (focus.offerAddons.includes("whatsapp")) {
    if (service.id === "whatsapp_followup") {
      score += 22;
      reasons.push("usa el complemento de WhatsApp configurado");
    } else if (service.id === "landing_conversion") {
      score += 6;
    }
  }

  if (focus.offerAddons.includes("booking")) {
    if (service.id === "booking_funnel") {
      score += 22;
      reasons.push("usa el complemento de reservas configurado");
    } else if (service.id === "landing_conversion" || service.id === "website_redesign") {
      score += 5;
    }
  }

  if (focus.offerAddons.includes("followup")) {
    if (service.id === "whatsapp_followup") {
      score += 10;
      reasons.push("aprovecha el seguimiento configurado");
    } else if (service.id === "conversion_audit") {
      score += 8;
    }
  }

  if (focus.offerAddons.includes("leadform")) {
    if (service.id === "landing_conversion") {
      score += 12;
      reasons.push("aprovecha el formulario de captación configurado");
    } else if (service.id === "booking_funnel") {
      score += 8;
    }
  }

  return { score, reasons };
}

function normalizeLookup(value?: string | null) {
  return (value || "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function slugifyToken(value?: string) {
  const normalized = normalizeLookup(value).replace(/[^a-z0-9]+/g, "-");
  const trimmed = normalized.replace(/^-+|-+$/g, "");

  return trimmed || "item";
}

export function buildMarketId(city: string) {
  return slugifyToken(city);
}

export function buildSegmentId(city: string, niche: string) {
  return `${buildMarketId(city)}__${slugifyToken(niche)}`;
}

export function buildBatchId(city: string, niche: string, batchName: string) {
  return `${buildSegmentId(city, niche)}__${slugifyToken(batchName)}`;
}

function normalizeOfferBaseId(value?: string | null): OfferBaseId {
  const normalized = normalizeLookup(value);

  if (normalized === "landing" || normalized.includes("landing")) {
    return "landing";
  }

  if (
    normalized === "website" ||
    normalized.includes("sitio") ||
    normalized.includes("web") ||
    normalized.includes("pagina")
  ) {
    return "website";
  }

  if (normalized === "redesign" || normalized.includes("redisen") || normalized.includes("redesign")) {
    return "redesign";
  }

  return "landing";
}

function normalizeOfferAddonId(value?: string | null): OfferAddonId | null {
  const normalized = normalizeLookup(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("whatsapp") || normalized.includes("wa")) {
    return "whatsapp";
  }

  if (normalized.includes("reserv") || normalized.includes("book") || normalized.includes("agenda")) {
    return "booking";
  }

  if (normalized.includes("seguim") || normalized.includes("follow")) {
    return "followup";
  }

  if (
    normalized.includes("form") ||
    normalized.includes("captac") ||
    normalized.includes("captur") ||
    normalized.includes("lead")
  ) {
    return "leadform";
  }

  return null;
}

function normalizeOfferAddons(value?: Array<string | null> | string | null): OfferAddonId[] {
  const rawValues = Array.isArray(value) ? value : value ? value.split(/\||,/) : [];
  const addons = new Set<OfferAddonId>();

  rawValues.forEach((item) => {
    const addon = normalizeOfferAddonId(item?.trim() || "");
    if (addon) {
      addons.add(addon);
    }
  });

  return [...addons];
}

function inferOfferBlueprintFromText(value?: string | null) {
  return {
    offerBaseId: normalizeOfferBaseId(value),
    offerAddons: normalizeOfferAddons(value),
  };
}

export function getOfferBaseOption(offerBaseId: OfferBaseId) {
  return OFFER_BASE_OPTIONS.find((option) => option.id === offerBaseId) || OFFER_BASE_OPTIONS[0];
}

export function getOfferAddonOption(offerAddonId: OfferAddonId) {
  return OFFER_ADDON_OPTIONS.find((option) => option.id === offerAddonId) || OFFER_ADDON_OPTIONS[0];
}

export function toggleOfferAddon(current: OfferAddonId[], addonId: OfferAddonId) {
  return current.includes(addonId)
    ? current.filter((item) => item !== addonId)
    : [...current, addonId];
}

export function composeOfferSummary(offerBaseId: OfferBaseId, offerAddons: OfferAddonId[]) {
  const baseLabel = getOfferBaseOption(offerBaseId).label;
  const addonLabels = offerAddons.map((addonId) => getOfferAddonOption(addonId).label);

  return addonLabels.length ? `${baseLabel} + ${addonLabels.join(" + ")}` : baseLabel;
}

export const OFFER_BASE_OPTIONS: Array<{ id: OfferBaseId; label: string; description: string }> = [
  {
    id: "landing",
    label: "Landing page",
    description: "Una sola página enfocada en convertir tráfico en consultas.",
  },
  {
    id: "website",
    label: "Sitio web nuevo",
    description: "Una presencia completa para negocios que todavía no tienen una base clara.",
  },
  {
    id: "redesign",
    label: "Rediseño web",
    description: "Mejora la base existente sin rehacerla desde cero.",
  },
];

export const OFFER_ADDON_OPTIONS: Array<{ id: OfferAddonId; label: string; description: string }> = [
  {
    id: "whatsapp",
    label: "Automatización por WhatsApp",
    description: "Seguimiento y respuesta inicial automatizada.",
  },
  {
    id: "booking",
    label: "Flujo de reservas",
    description: "Puntos claros para reservar llamada o cita.",
  },
  {
    id: "followup",
    label: "Seguimiento comercial",
    description: "Recordatorios y seguimiento para no perder interesados.",
  },
  {
    id: "leadform",
    label: "Formulario de captación",
    description: "Captura de datos más ordenada y menos fricción.",
  },
];

function normalizeCsvHeader(header: string) {
  return normalizeLookup(header).replace(/[^a-z0-9]+/g, "");
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      count += 1;
    }
  }

  return count;
}

function detectCsvDelimiter(text: string) {
  const sampleLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!sampleLine) {
    return ",";
  }

  const candidates = [",", ";", "\t"] as const;

  return candidates.reduce(
    (best, delimiter) => {
      const count = countDelimiter(sampleLine, delimiter);

      if (count > best.count) {
        return { delimiter, count };
      }

      return best;
    },
    { delimiter: ",", count: -1 }
  ).delimiter;
}

const CSV_FIELD_ALIASES = {
  address: ["address", "direccion", "dirección", "location", "ubicacion", "ubicación"],
  businessName: [
    "businessName",
    "business_name",
    "business name",
    "name",
    "business",
    "company",
    "company name",
    "negocio",
    "empresa",
    "nombre",
    "qBF1Pd",
  ],
  city: ["city", "ciudad"],
  digitalPresence: ["digitalPresence", "digital_presence", "presencia digital"],
  email: ["email", "correo", "correo electronico", "correo electrónico"],
  explicitNiche: ["niche", "nicho", "segment", "segmento"],
  lastTouch: ["lastTouch", "last_touch", "ultimo contacto", "último contacto"],
  mapsUrl: ["mapsUrl", "maps_url", "maps url", "google maps url", "place url", "hfpxzc href"],
  notes: ["notes", "notas", "comentarios", "comments"],
  offerType: ["offerType", "offer_type", "oferta", "tipo de oferta"],
  painPoints: ["painPoints", "pain_points", "pain points", "dolores", "pain"],
  phone: ["phone", "phone_number", "phone number", "telefono", "teléfono", "mobile", "whatsapp", "UsdlK"],
  rating: ["rating", "calificacion", "calificación", "score", "MW4etd"],
  reviewSummary: ["reviewSummary", "review_summary", "review summary", "resena", "reseña", "e4rVHe", "ah5Ghc"],
  reviews: [
    "reviews",
    "review_count",
    "review count",
    "resenas",
    "reseñas",
    "numero de resenas",
    "numero de reseñas",
    "número de reseñas",
    "numero de reviews",
    "review total",
    "UY7F9",
  ],
  source: ["source", "fuente", "origen"],
  stage: ["stage", "etapa"],
  subniche: ["subniche", "sub_niche", "sub niche", "specialty", "especialidad", "categoria", "categoría", "category", "W4Efsd"],
  website: ["website", "website_url", "website url", "sitio web", "sitio", "site", "web", "url", "lcr4fd href"],
  websiteStatus: ["websiteStatus", "website_status", "estado del sitio", "estado sitio"],
  batchName: ["batchName", "batch_name", "lote", "lot", "batch"],
} as const;

export type CsvImportSkipReason = "empty" | "missing_business_name";

export type CsvImportSkippedRow = {
  rowNumber: number;
  reason: CsvImportSkipReason;
  label: string;
};

export type CsvImportAnalysis = {
  totalRows: number;
  nonEmptyRows: number;
  emptyRows: number;
  invalidRows: number;
  detectedSource: string;
  validRows: Array<Record<string, string>>;
  skippedRows: CsvImportSkippedRow[];
};

function getCsvValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const directValue = row[alias];

    if (typeof directValue === "string" && directValue.trim() !== "") {
      return directValue.trim();
    }

    const normalizedValue = row[normalizeCsvHeader(alias)];

    if (typeof normalizedValue === "string" && normalizedValue.trim() !== "") {
      return normalizedValue.trim();
    }
  }

  return "";
}

function getCanonicalCsvValue(row: Record<string, string>, field: keyof typeof CSV_FIELD_ALIASES) {
  return getCsvValue(row, [...CSV_FIELD_ALIASES[field]]);
}

function getCsvValues(row: Record<string, string>, aliases: string[]) {
  return aliases
    .map((alias) => getCsvValue(row, [alias]))
    .map((value) => value.trim())
    .filter(Boolean);
}

function isGoogleMapsExportRow(row: Record<string, string>) {
  return Boolean(
    getCsvValue(row, ["qBF1Pd", "hfpxzc href", "UsdlK", "lcr4fd href", "W4Efsd", "W4Efsd 3"])
  );
}

function isGoogleMapsNoise(value: string) {
  const normalized = normalizeLookup(value);

  return (
    normalized === "" ||
    normalized === "." ||
    normalized === "·" ||
    normalized === "sitio web" ||
    normalized === "como llegar" ||
    normalized === "cómo llegar" ||
    normalized === "" ||
    normalized === "" ||
    normalized === ""
  );
}

function cleanGoogleMapsValue(value: string) {
  return isGoogleMapsNoise(value) ? "" : value.trim();
}

function looksLikeGoogleMapsStatus(value: string) {
  const normalized = normalizeLookup(value);

  return (
    normalized.includes("abierto") ||
    normalized.includes("cerrado") ||
    normalized.includes("abre a") ||
    normalized.includes("24 horas")
  );
}

function looksLikeGoogleMapsAddress(value: string) {
  const normalized = normalizeLookup(value);

  if (!normalized || isGoogleMapsNoise(value) || looksLikeGoogleMapsStatus(value)) {
    return false;
  }

  return (
    /#|\d/.test(value) ||
    /\b(cl|calle|cra|carrera|av|avenida|diag|diagonal|transv|transversal|edificio|local|km)\b/.test(
      normalized
    )
  );
}

function getGoogleMapsAddress(row: Record<string, string>) {
  return (
    getCsvValues(row, ["W4Efsd 3", "W4Efsd 5", "W4Efsd 6"])
      .map(cleanGoogleMapsValue)
      .find(looksLikeGoogleMapsAddress) || ""
  );
}

function getGoogleMapsStatus(row: Record<string, string>) {
  return getCsvValues(row, ["W4Efsd 4", "W4Efsd 5", "W4Efsd 6"])
    .map(cleanGoogleMapsValue)
    .filter(looksLikeGoogleMapsStatus)
    .join(" | ");
}

function parseGoogleMapsReviewsCount(value: string) {
  const normalized = value.replace(/[()]/g, "").trim();
  const parsed = Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

function isDirectoryOrSocialWebsite(url: string) {
  const normalized = normalizeLookup(url);

  return ["facebook.com", "instagram.com", "doctoralia", "whatsapp.com", "wa.me", "linktr.ee"].some((token) =>
    normalized.includes(token)
  );
}

function inferGoogleMapsWebsiteStatus(website: string) {
  if (!website) {
    return "none";
  }

  return isDirectoryOrSocialWebsite(website) ? "weak" : "strong";
}

function inferGoogleMapsDigitalPresence(website: string, reviewsCount: number, reviewSummary: string) {
  if (website && reviewsCount >= 10) {
    return "high";
  }

  if (
    website ||
    reviewsCount > 0 ||
    (reviewSummary && !normalizeLookup(reviewSummary).includes("no hay resenas"))
  ) {
    return "medium";
  }

  return "low";
}

function inferGoogleMapsPainPoints(
  website: string,
  phone: string,
  reviewSummary: string,
  reviewsCount: number
) {
  const painPoints: string[] = [];

  if (!website) {
    painPoints.push("Sin sitio web o landing propia visible");
  } else if (isDirectoryOrSocialWebsite(website)) {
    painPoints.push("El enlace principal no lleva a una página propia de captación");
  }

  if (!phone) {
    painPoints.push("Teléfono o canal principal de contacto poco visible");
  }

  if (normalizeLookup(reviewSummary).includes("no hay resenas") || reviewsCount === 0) {
    painPoints.push("Sin prueba social visible en la presencia digital");
  } else if (reviewsCount > 0 && reviewsCount <= 3) {
    painPoints.push("Muy pocas reseñas visibles en la presencia local");
  }

  return painPoints;
}

function buildGoogleMapsNotes(
  address: string,
  mapsStatus: string,
  reviewSummary: string,
  rating: string,
  reviewsCount: number,
  mapsUrl: string,
  rawNotes: string
) {
  const notes: string[] = [];

  if (rawNotes.trim()) {
    notes.push(rawNotes.trim());
  }

  if (address) {
    notes.push(`Dirección: ${address}`);
  }

  if (mapsStatus) {
    notes.push(`Estado en Google Maps: ${mapsStatus}`);
  }

  if (rating) {
    const reviewLabel =
      reviewsCount > 0 ? `${rating} con ${reviewsCount} reseña${reviewsCount === 1 ? "" : "s"}` : rating;
    notes.push(`Rating en Google Maps: ${reviewLabel}`);
  } else if (reviewSummary.trim()) {
    notes.push(`Google Maps: ${reviewSummary.trim()}`);
  }

  if (mapsUrl) {
    notes.push(`Perfil de Google Maps: ${mapsUrl}`);
  }

  return notes.join("\n");
}

type WorkspaceFocusInput = Omit<Partial<WorkspaceFocus>, "offerBaseId" | "offerAddons"> & {
  offerBaseId?: OfferBaseId | string | null;
  offerAddons?: OfferAddonId[] | Array<string | null> | string | null;
};

export function normalizeFocus(rawFocus?: WorkspaceFocusInput | null): WorkspaceFocus {
  const city = rawFocus?.city?.trim() || SAMPLE_FOCUS.city;
  const niche = rawFocus?.niche?.trim() || SAMPLE_FOCUS.niche;
  const batchName = rawFocus?.batchName?.trim() || SAMPLE_FOCUS.batchName;
  const inferredOffer = inferOfferBlueprintFromText(rawFocus?.offer);
  const offerBaseId = normalizeOfferBaseId(rawFocus?.offerBaseId ?? inferredOffer.offerBaseId);
  const offerAddons = normalizeOfferAddons(rawFocus?.offerAddons ?? inferredOffer.offerAddons);
  const hasStructuredOffer = rawFocus?.offerBaseId !== undefined || rawFocus?.offerAddons !== undefined;

  return {
    marketId: buildMarketId(city),
    segmentId: buildSegmentId(city, niche),
    batchId: buildBatchId(city, niche, batchName),
    city,
    niche,
    batchName,
    offerBaseId,
    offerAddons,
    offer: hasStructuredOffer ? composeOfferSummary(offerBaseId, offerAddons) : rawFocus?.offer?.trim() || composeOfferSummary(offerBaseId, offerAddons),
    batchSize: clampNumber(rawFocus?.batchSize, 1, 500, SAMPLE_FOCUS.batchSize),
  };
}

export function normalizeLead(rawLead: Partial<Lead>, fallbackFocus: WorkspaceFocus = SAMPLE_FOCUS): Lead {
  const city = rawLead.city?.trim() || fallbackFocus.city;
  const niche = rawLead.niche?.trim() || fallbackFocus.niche;
  const batchName = rawLead.batchName?.trim() || fallbackFocus.batchName;
  const subniche =
    rawLead.subniche?.trim() || rawLead.niche?.trim() || fallbackFocus.niche;
  const aiConfidenceValue = clampNumber(rawLead.aiConfidence, 0, 1, -1);
  const normalizedStage = normalizeStage(rawLead.stage);

  return {
    id: rawLead.id || crypto.randomUUID(),
    marketId: buildMarketId(city),
    segmentId: buildSegmentId(city, niche),
    batchId: buildBatchId(city, niche, batchName),
    businessName: rawLead.businessName?.trim() || "Lead sin nombre",
    city,
    niche,
    subniche,
    batchName,
    phone: rawLead.phone?.trim() || "",
    email: rawLead.email?.trim() || "",
    website: rawLead.website?.trim() || "",
    source: rawLead.source?.trim() || "Manual intake",
    websiteStatus: normalizeWebsiteStatus(rawLead.websiteStatus),
    digitalPresence: normalizeDigitalPresence(rawLead.digitalPresence),
    painPoints: normalizePainPoints(rawLead.painPoints),
    offerType: rawLead.offerType?.trim() || fallbackFocus.offer,
    stage: normalizedStage,
    opsStatus: normalizeOpsStatus(rawLead.opsStatus, normalizedStage),
    notes: rawLead.notes?.trim() || "",
    lastTouch: normalizeDate(rawLead.lastTouch),
    assignedUserId: normalizeOptionalText(rawLead.assignedUserId, 80),
    assignedAt: normalizeOptionalText(rawLead.assignedAt, 80),
    assignedByUserId: normalizeOptionalText(rawLead.assignedByUserId, 80),
    nextFollowUpAt: normalizeOptionalText(rawLead.nextFollowUpAt, 40),
    lastActivityAt: normalizeOptionalText(rawLead.lastActivityAt, 80),
    lastActivitySummary: normalizeOptionalText(rawLead.lastActivitySummary, 320),
    aiServiceId: normalizeProposalServiceId(rawLead.aiServiceId),
    aiServiceReason: normalizeOptionalText(rawLead.aiServiceReason, 280),
    aiConfidence: aiConfidenceValue >= 0 ? aiConfidenceValue : undefined,
    aiPainPoints: normalizeOptionalList(rawLead.aiPainPoints, 4),
    aiAudit: normalizeOptionalText(rawLead.aiAudit, 1400),
    aiScope: normalizeOptionalList(rawLead.aiScope, 8),
    aiWhatsapp: normalizeOptionalText(rawLead.aiWhatsapp, 1600),
    aiEmail: normalizeOptionalText(rawLead.aiEmail, 2600),
    aiCall: normalizeOptionalText(rawLead.aiCall, 1800),
    aiModelClassify: normalizeOptionalText(rawLead.aiModelClassify, 120),
    aiModelCopy: normalizeOptionalText(rawLead.aiModelCopy, 120),
    aiEnrichedAt: normalizeOptionalText(rawLead.aiEnrichedAt, 80),
  };
}

export function normalizeOpsStatus(value?: OpsStatus | string, stage?: Stage): OpsStatus {
  const normalized = normalizeLookup(value).replace(/[^a-z0-9]+/g, "");
  const opsStatusMap: Record<string, OpsStatus> = {
    pending: "pending",
    pendiente: "pending",
    noanswer: "no_answer",
    nocontesta: "no_answer",
    sinrespuesta: "no_answer",
    contacted: "contacted",
    contactado: "contacted",
    callbackrequested: "callback_requested",
    devolverllamada: "callback_requested",
    rellamar: "callback_requested",
    interested: "interested",
    interesado: "interested",
    booked: "booked",
    agendado: "booked",
    notinterested: "not_interested",
    nointeresado: "not_interested",
    dnc: "do_not_contact",
    donotcontact: "do_not_contact",
    nocontactar: "do_not_contact",
  };

  if (opsStatusMap[normalized]) {
    return opsStatusMap[normalized];
  }

  if (stage === "booked" || stage === "demo" || stage === "proposal" || stage === "closed") {
    return "booked";
  }

  return "pending";
}

export function labelForOpsStatus(status: OpsStatus): string {
  const labels: Record<OpsStatus, string> = {
    pending: "Pendiente",
    no_answer: "No contesto",
    contacted: "Contactado",
    callback_requested: "Devolver llamada",
    interested: "Interesado",
    booked: "Agendada",
    not_interested: "Sin interes",
    do_not_contact: "No contactar",
  };

  return labels[status] || status;
}

export function normalizeActivityType(value?: LeadActivityType | string): LeadActivityType {
  const normalized = normalizeLookup(value).replace(/[^a-z0-9]+/g, "");
  const activityMap: Record<string, LeadActivityType> = {
    call: "call",
    llamada: "call",
    whatsapp: "whatsapp",
    email: "email",
    note: "note",
    nota: "note",
    assignmentchange: "assignment_change",
    reasignacion: "assignment_change",
    stagechange: "stage_change",
    cambioetapa: "stage_change",
  };

  return activityMap[normalized] || "note";
}

export function labelForAppRole(role: AppRole): string {
  return role === "admin" ? "Admin" : "Setter";
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeOptionalList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return normalized.length ? normalized : undefined;
}

function normalizeProposalServiceId(value: unknown): ProposalServiceId | undefined {
  const normalized = normalizeLookup(String(value || "")) as ProposalServiceId;
  return PROPOSAL_SERVICE_CATALOG[normalized] ? normalized : undefined;
}

export function normalizePainPoints(value: Lead["painPoints"] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return (value || "")
    .split(/\||\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeWebsiteStatus(value?: WebsiteStatus | string): WebsiteStatus {
  const normalized = normalizeLookup(value);

  if (
    ["weak", "debil", "viejo", "dated", "outdated", "flojo", "antiguo"].includes(normalized) ||
    normalized.includes("debil") ||
    normalized.includes("viejo")
  ) {
    return "weak";
  }

  if (
    ["strong", "fuerte", "aceptable", "acceptable", "good", "bueno"].includes(normalized) ||
    normalized.includes("aceptable")
  ) {
    return "strong";
  }

  return "none";
}

export function normalizeDigitalPresence(value?: DigitalPresence | string): DigitalPresence {
  const normalized = normalizeLookup(value);

  if (normalized === "high" || normalized === "alta") {
    return "high";
  }

  if (normalized === "medium" || normalized === "media") {
    return "medium";
  }

  return "low";
}

export function normalizeStage(value?: Stage | string): Stage {
  const normalized = normalizeLookup(value).replace(/[^a-z0-9]+/g, "");

  const stageMap: Record<string, Stage> = {
    sourced: "sourced",
    prospectado: "sourced",
    qualified: "qualified",
    calificado: "qualified",
    contacted: "contacted",
    contactado: "contacted",
    booked: "booked",
    llamadaagendada: "booked",
    agendado: "booked",
    demo: "demo",
    proposal: "proposal",
    propuesta: "proposal",
    closed: "closed",
    cerrado: "closed",
  };

  return stageMap[normalized] || "sourced";
}

export function normalizeDate(value?: string): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function createLeadFingerprint(lead: Pick<Lead, "businessName" | "city" | "phone" | "email" | "website">) {
  return [
    lead.businessName.toLowerCase().trim(),
    lead.city.toLowerCase().trim(),
    lead.phone.toLowerCase().trim(),
    lead.email.toLowerCase().trim(),
    lead.website.toLowerCase().trim(),
  ].join("::");
}

export function decorateLeads(leads: Lead[]): DashboardLead[] {
  return leads
    .map((lead) => {
      const score = calculateOpportunityScore(lead);
      const priority: PriorityTone = score >= 78 ? "hot" : score >= 58 ? "warm" : "cool";

      return {
        ...lead,
        score,
        priority,
        nextMove: getNextMove(lead.stage),
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function calculateOpportunityScore(lead: Lead): number {
  let score = 18;

  if (lead.websiteStatus === "none") {
    score += 34;
  } else if (lead.websiteStatus === "weak") {
    score += 24;
  } else {
    score += 8;
  }

  if (lead.digitalPresence === "low") {
    score += 24;
  } else if (lead.digitalPresence === "medium") {
    score += 14;
  } else {
    score += 6;
  }

  score += Math.min(lead.painPoints.length * 6, 18);

  if (lead.phone) {
    score += 8;
  }

  if (lead.email) {
    score += 8;
  }

  if (lead.stage === "booked" || lead.stage === "demo" || lead.stage === "proposal") {
    score += 4;
  }

  return Math.min(score, 100);
}

export function getNextMove(stage: Stage): string {
  switch (stage) {
    case "sourced":
      return "Revisar el sitio y validar si merece primer contacto.";
    case "qualified":
      return "Enviar el primer mensaje con demo o adelanto de auditoría.";
    case "contacted":
      return "Hacer seguimiento corto y buscar respuesta o llamada.";
    case "booked":
      return "Preparar demo de IA antes de la reunión.";
    case "demo":
      return "Enviar PDF y guion para cerrar en la llamada.";
    case "proposal":
      return "Resolver objeciones y cerrar el trato.";
    case "closed":
      return "Ofrecer upsell de automatizaciones y creativos.";
  }
}

export function compactPainPoints(painPoints: string[]): string {
  return painPoints.length ? painPoints.slice(0, 2).join(" / ") : "Sin pain points cargados todavía.";
}

export function labelForStage(stageId: Stage): string {
  return STAGES.find((stage) => stage.id === stageId)?.label || stageId;
}

function getProposalLocation(lead: Pick<Lead, "city">, focus: WorkspaceFocus) {
  return lead.city.trim() || focus.city;
}

function getProposalStageGuidance(stage: Stage, service: ProposalServiceDefinition) {
  switch (stage) {
    case "qualified":
    case "contacted":
      return {
        whatsappCta: `¿Te va bien una llamada corta de 15 minutos esta semana para mostrarte la idea de ${service.label} y ver si encaja?`,
        emailClose: `Si te encaja, agendamos una llamada breve y te muestro la idea de ${service.label} con calma.`,
        callClose: `¿Te parece si dejamos 15 minutos esta semana y te muestro la idea de ${service.label}?`,
        meetingGoal: `Conseguir la reunión, validar el dolor principal y confirmar si ${service.label} es el siguiente paso.`,
      };
    case "booked":
      return {
        whatsappCta: `Como ya tienes la llamada reservada, la usamos para revisar el enfoque de ${service.label} y salir con un siguiente paso claro.`,
        emailClose: `Como ya tienes la llamada reservada, la usamos para aterrizar el siguiente paso de ${service.label}.`,
        callClose: `Voy directo al punto: revisamos ${service.label} y definimos si avanzamos.`,
        meetingGoal: `Llegar con claridad, mostrar ${service.label} sin rodeos y salir con el siguiente paso definido.`,
      };
    case "demo":
      return {
        whatsappCta: `Tengo una demo breve de ${service.label} lista para revisarla contigo y resolver dudas.`,
        emailClose: `La idea es usar la llamada para revisar ${service.label} y salir con una decisión clara.`,
        callClose: `Te muestro ${service.label}, resolvemos objeciones y dejamos el siguiente paso acordado.`,
        meetingGoal: `Mostrar ${service.label}, resolver objeciones y cerrar el siguiente paso.`,
      };
    case "proposal":
      return {
        whatsappCta: `Tengo la propuesta de ${service.label} lista; si te encaja el enfoque, la revisamos y cerramos el siguiente paso.`,
        emailClose: `Si el enfoque de ${service.label} te encaja, agendamos una revisión breve y dejamos el siguiente paso cerrado.`,
        callClose: `Ya estamos cerca del cierre: revisamos ${service.label} y dejamos fecha concreta.`,
        meetingGoal: `Cerrar el siguiente paso de ${service.label} y evitar que el interés se enfríe.`,
      };
    case "closed":
      return {
        whatsappCta: `Si quieres ampliar con ${service.label}, lo vemos en una llamada breve.`,
        emailClose: `Si te interesa ampliar con ${service.label}, lo revisamos y te propongo la siguiente oportunidad.`,
        callClose: `Podemos usar la llamada para explorar ${service.label} como upsell útil.`,
        meetingGoal: `Abrir una expansión coherente con ${service.label} sin distraer del núcleo del proyecto.`,
      };
    case "sourced":
    default:
      return {
        whatsappCta: `¿Te va bien una llamada corta de 15 minutos para mostrarte una idea de ${service.label} y ver si encaja?`,
        emailClose: `Si te encaja, agendamos una llamada breve y te muestro la idea de ${service.label}.`,
        callClose: `¿Te parece si agendamos una llamada breve para revisar ${service.label}?`,
        meetingGoal: `Conseguir la reunión y confirmar si ${service.label} vale la pena como siguiente paso.`,
      };
  }
}

function inferVerticalHints(lead: Pick<Lead, "niche" | "subniche">) {
  const niche = normalizeLookup(lead.niche);
  const subniche = normalizeLookup(lead.subniche);
  const combined = `${niche} ${subniche}`.trim();

  const isMedical = ["clinica", "medic", "odont", "dermat", "psicol", "fisiot", "pediatr", "ginec", "doctor"].some(
    (token) => combined.includes(token)
  );
  const isDental = ["odont", "dental", "ortodon", "endodon"].some((token) => combined.includes(token));
  const isBeauty = ["estet", "spa", "salon", "barber", "unas", "cosmet"].some((token) => combined.includes(token));
  const isRestaurant = ["restaur", "cafe", "bar", "pizzeria", "comida"].some((token) => combined.includes(token));
  const isHomeService = ["plomer", "electric", "cerraj", "mudanza", "pintur", "repar", "limpiez"].some((token) =>
    combined.includes(token)
  );

  return { isMedical, isDental, isBeauty, isRestaurant, isHomeService };
}

function normalizePainPointTokens(painPoints: string[]) {
  return painPoints.map((p) => normalizeLookup(p));
}

function includesAnyToken(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

type ProposalServiceScore = {
  service: ProposalServiceDefinition;
  score: number;
  reasons: string[];
};

function scoreProposalService(
  lead: Lead,
  service: ProposalServiceDefinition,
  focus: WorkspaceFocus
): ProposalServiceScore {
  const offerType = normalizeLookup(lead.offerType);
  const painTokens = normalizePainPointTokens(lead.painPoints);
  const painCombined = painTokens.join(" | ");
  const vertical = inferVerticalHints(lead);

  let score = 0;
  const reasons: string[] = [];

  const hasWebsite = lead.websiteStatus !== "none";
  const hasPhone = Boolean(lead.phone && lead.phone.trim());

  const stageIsAdvanced = ["booked", "demo", "proposal", "closed"].includes(lead.stage);

  switch (service.id) {
    case "landing_conversion": {
      if (lead.websiteStatus === "none") {
        score += 55;
        reasons.push("no hay sitio web que convierta");
      }
      if (includesAnyToken(offerType, ["landing", "pagina", "page"])) {
        score += 25;
        reasons.push("ya hay señales de que una landing es el siguiente paso");
      }
      if (includesAnyToken(painCombined, ["sin sitio", "no vi un sitio", "sitio web", "website"])) {
        score += 10;
      }
      if (lead.digitalPresence === "low") {
        score += 8;
      }
      if (lead.websiteStatus === "strong") {
        score -= 18;
      }
      break;
    }
    case "website_redesign": {
      if (lead.websiteStatus === "weak") {
        score += 55;
        reasons.push("el sitio actual parece perder conversión");
      }
      if (includesAnyToken(offerType, ["web", "sitio", "website", "redisen", "disen"])) {
        score += 18;
        reasons.push("ya hay interés en mejorar el sitio actual");
      }
      if (includesAnyToken(painCombined, ["movil", "cta", "conversion", "claridad", "friccion"])) {
        score += 12;
      }
      if (lead.websiteStatus === "none") {
        score -= 25;
      }
      break;
    }
    case "conversion_audit": {
      if (lead.websiteStatus === "strong") {
        score += 35;
        reasons.push("ya hay base; conviene destrabar conversión");
      }
      if (lead.digitalPresence === "high") {
        score += 12;
      }
      if (includesAnyToken(offerType, ["audit", "cro", "conversion", "optimiz"])) {
        score += 22;
        reasons.push("hay una oportunidad clara de optimización y conversión");
      }
      if (includesAnyToken(painCombined, ["cta", "conversion", "tracking", "form", "whatsapp"])) {
        score += 10;
      }
      if (!hasWebsite) {
        score -= 10;
      }
      if (stageIsAdvanced) {
        score += 6;
      }
      break;
    }
    case "whatsapp_followup": {
      if (includesAnyToken(offerType, ["whatsapp", "automat", "follow", "seguim"])) {
        score += 30;
        reasons.push("WhatsApp y seguimiento pueden rescatar oportunidades");
      }
      if (includesAnyToken(painCombined, ["whatsapp", "seguim", "respuesta", "contestar", "contacto"])) {
        score += 18;
      }
      if (lead.digitalPresence === "high" || lead.digitalPresence === "medium") {
        score += 10;
      }
      if (vertical.isMedical || vertical.isDental || vertical.isBeauty) {
        score += 8;
      }
      if (!hasPhone) {
        score -= 35;
        reasons.push("no hay teléfono; WhatsApp pierde fuerza");
      }
      if (stageIsAdvanced) {
        score += 8;
      }
      break;
    }
    case "google_business_profile": {
      if (lead.digitalPresence === "low") {
        score += 28;
        reasons.push("presencia digital baja; GBP puede levantar captación local");
      }
      if (includesAnyToken(painCombined, ["sin prueba social", "sin resen", "pocas resen", "google maps"])) {
        score += 18;
        reasons.push("faltan reseñas/prueba social en Google");
      }
      if (lead.websiteStatus === "none") {
        score += 10;
      }
      if (vertical.isRestaurant || vertical.isHomeService) {
        score += 6;
      }
      if (lead.digitalPresence === "high") {
        score -= 10;
      }
      if (includesAnyToken(offerType, ["google", "maps", "resen", "perfil"])) {
        score += 16;
      }
      break;
    }
    case "booking_funnel": {
      if (vertical.isMedical || vertical.isDental || vertical.isBeauty) {
        score += 18;
        reasons.push("el nicho depende de citas; conviene un flujo a agenda");
      }
      if (includesAnyToken(painCombined, ["cta", "flujo", "contacto", "seguim", "friccion"])) {
        score += 12;
      }
      if (lead.websiteStatus === "none" || lead.websiteStatus === "weak") {
        score += 18;
      }
      if (lead.digitalPresence === "low" || lead.digitalPresence === "medium") {
        score += 10;
      }
      if (includesAnyToken(offerType, ["agenda", "cita", "funnel", "captacion", "sistema"])) {
        score += 24;
        reasons.push("conviene convertir interés en una cita agendada");
      }
      if (!hasPhone) {
        score -= 12;
      }
      if (stageIsAdvanced) {
        score -= 6;
      }
      break;
    }
  }

  const focusBias = getFocusServiceBias(focus, service);
  score += focusBias.score;
  reasons.push(...focusBias.reasons);

  if (lead.stage === "closed") {
    score -= 8;
  }

  // Keep a small nudge toward simpler services if there is already a website.
  if (hasWebsite && service.id === "landing_conversion") {
    score -= 6;
  }

  return { service, score, reasons };
}

function selectBestProposalService(
  lead: Lead,
  focus: WorkspaceFocus
): { service: ProposalServiceDefinition; serviceReason: string } {
  const scored = (Object.values(PROPOSAL_SERVICE_CATALOG) as ProposalServiceDefinition[]).map((service) =>
    scoreProposalService(lead, service, focus)
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return PROPOSAL_SERVICE_TIEBREAK.indexOf(a.service.id) - PROPOSAL_SERVICE_TIEBREAK.indexOf(b.service.id);
  });

  const winner = scored[0] || {
    service: PROPOSAL_SERVICE_CATALOG.booking_funnel,
    score: 0,
    reasons: [],
  };

  const topReasons = winner.reasons.length ? winner.reasons.slice(0, 2) : [];
  const reasonCore = topReasons.length ? topReasons.join(" y ") : "encaja con el estado actual del lead";
  const serviceReason = `${winner.service.label} encaja porque ${reasonCore}.`;

  return { service: winner.service, serviceReason };
}

function buildServiceScope(
  service: ProposalServiceDefinition,
  lead: Lead,
  location: string,
  nicheLabel: string,
  painPoints: string[],
  focus: WorkspaceFocus
) {
  const pain2 = painPoints[1] ? painPoints[1].toLowerCase() : "fricción en el contacto";

  const withFocusAddons = (scope: string[]) => appendFocusAddonScope(scope, service, focus);

  switch (service.id) {
    case "landing_conversion":
      return withFocusAddons([
        "Landing de una sola página como centro de conversión para Google, redes, WhatsApp Business, QR y anuncios.",
        `Sección de confianza para ${nicheLabel.toLowerCase()} en ${location} (prueba social, casos, evidencias).`,
        `Ruta de contacto simple (WhatsApp, llamada o formulario) para bajar ${pain2}.`,
        "Tracking básico de conversión (clicks y formularios) para medir respuesta.",
      ]);
    case "website_redesign":
      return withFocusAddons([
        "Auditoría rápida del sitio actual: fricción, velocidad, CTA, estructura y confianza.",
        "Rediseño de la página principal o landing clave para que sea el centro de entrada y conversión.",
        `Mensaje y CTA pensados para distribuir desde Google, redes, WhatsApp Business, QR y anuncios.`,
        "Ajustes técnicos básicos (móvil, performance, formularios) para reducir fuga.",
      ]);
    case "conversion_audit":
      return withFocusAddons([
        "Auditoría de conversión: mapa de fricción, mensajes, CTA y ruta de contacto.",
        "Plan priorizado de mejoras (quick wins primero) con impacto esperado.",
        `Propuesta de test A/B o iteraciones rápidas enfocadas en ${service.primaryOutcome}.`,
        "Checklist de medición para saber qué cambio realmente mueve la aguja.",
      ]);
    case "whatsapp_followup":
      return withFocusAddons([
        "Flujo de WhatsApp para captar datos mínimos, calificar y dirigir a cita.",
        "Mensajes de seguimiento (rescate, recordatorios, reactivación) sin sonar robot.",
        `Plantillas adaptadas a ${nicheLabel.toLowerCase()} y a los dolores detectados.`,
        "Reglas simples para derivar a humano cuando el lead está listo para comprar.",
      ]);
    case "google_business_profile":
      return withFocusAddons([
        "Optimizar la ficha: categorías, descripción, servicios, fotos y CTA.",
        "Usarla como canal de entrada hacia la landing o sitio central de conversión.",
        `Mejorar prueba social y confianza local en ${location}.`,
        "Checklist de publicaciones/ofertas para sostener visibilidad sin quemar tiempo.",
      ]);
    case "booking_funnel":
    default:
      return withFocusAddons([
        "Mini embudo a agenda: mensaje claro, CTA y ruta directa a una cita.",
        "Landing simple + WhatsApp (o formulario) + recordatorios para reducir no-show.",
        `Copy y oferta adaptados a ${nicheLabel.toLowerCase()} en ${location}.`,
        "Seguimiento para no perder leads tibios y convertirlos en citas.",
      ]);
  }
}

function appendFocusAddonScope(
  scope: string[],
  service: ProposalServiceDefinition,
  focus: WorkspaceFocus
) {
  const additions: string[] = [];

  if (focus.offerAddons.includes("whatsapp") && service.id !== "whatsapp_followup") {
    additions.push("Seguimiento por WhatsApp para responder más rápido y no perder solicitudes.");
  }

  if (focus.offerAddons.includes("booking") && service.id !== "booking_funnel") {
    additions.push("Flujo de reservas para llevar el interés a una cita con menos fricción.");
  }

  if (focus.offerAddons.includes("followup") && service.id !== "whatsapp_followup") {
    additions.push("Seguimiento comercial para reactivar leads tibios sin sonar insistente.");
  }

  if (focus.offerAddons.includes("leadform") && service.id !== "landing_conversion") {
    additions.push("Formulario de captación corto para ordenar mejor los datos del lead.");
  }

  return additions.length ? [...scope, ...additions] : scope;
}

function buildServiceDemoChecklist(service: ProposalServiceDefinition) {
  switch (service.id) {
    case "landing_conversion":
      return [
        "Abrir con el dolor principal y la oportunidad más clara.",
        "Mostrar la estructura de la landing: mensaje, CTA y confianza.",
        "Alinear la ruta de contacto (WhatsApp/llamada/formulario) con el negocio real.",
        "Cerrar con decisión concreta y siguiente paso.",
      ];
    case "website_redesign":
      return [
        "Mostrar 2-3 problemas concretos del sitio actual y cuánto cuestan en conversión.",
        "Enseñar el rediseño propuesto y por qué mejora claridad.",
        "Conectar CTA, confianza y velocidad con más consultas.",
        "Cerrar con decisión concreta y fecha de seguimiento.",
      ];
    case "conversion_audit":
      return [
        "Presentar el mapa de fricción (dónde se cae la gente).",
        "Revisar quick wins y cambios de alto impacto.",
        "Acordar cómo mediremos conversión desde el día 1.",
        "Cerrar con el plan de 7-14 días y siguiente paso.",
      ];
    case "whatsapp_followup":
      return [
        "Mostrar el flujo: primer mensaje, calificacion y derivacion a cita.",
        "Revisar seguimiento y recordatorios (sin sonar robot).",
        "Definir el momento exacto de handoff a humano.",
        "Cerrar con el siguiente paso y métricas de respuesta.",
      ];
    case "google_business_profile":
      return [
        "Mostrar brechas de la ficha y oportunidades rápidas de visibilidad.",
        "Revisar el plan de reseñas: guion, timing y volumen objetivo.",
        "Definir qué CTA usaremos para convertir búsquedas en contactos.",
        "Cerrar con el plan de 2 semanas y siguiente paso.",
      ];
    case "booking_funnel":
    default:
      return [
        "Mostrar el flujo completo: anuncio/entrada -> landing -> WhatsApp -> agenda.",
        "Alinear el mensaje con el dolor principal del nicho.",
        "Definir preguntas mínimas para calificar antes de agendar.",
        "Cerrar con fecha y responsable del siguiente paso.",
      ];
  }
}

export function buildProposal(lead: DashboardLead | Lead, focus: WorkspaceFocus): ProposalCopy {
  const location = getProposalLocation(lead, focus);
  const nicheLabel = lead.subniche || lead.niche;
  const selected = selectBestProposalService(lead as Lead, focus);
  const selectedService =
    (lead.aiServiceId && PROPOSAL_SERVICE_CATALOG[lead.aiServiceId]) || selected.service;
  const serviceReason = lead.aiServiceReason?.trim() || selected.serviceReason;
  const stageGuidance = getProposalStageGuidance(lead.stage, selectedService);

  const leadPainPoints = lead.aiPainPoints?.length ? lead.aiPainPoints : lead.painPoints;
  const fallbackPainPoints = [
    "Sitio o presencia digital con margen claro de mejora",
    "CTA y flujo de contacto poco visibles",
    "Espacio para una propuesta más moderna y enfocada en resultados",
  ];
  const painPoints = leadPainPoints.length ? leadPainPoints.slice(0, 3) : fallbackPainPoints;
  while (painPoints.length < 3) {
    painPoints.push(fallbackPainPoints[painPoints.length]);
  }

  const weakSiteLine =
    lead.websiteStatus === "none"
      ? `No vi una página propia activa que ayude a convertir visitas en consultas en ${location}.`
      : lead.websiteStatus === "weak"
        ? "El sitio actual todavía deja conversiones sobre la mesa por claridad, CTA y recorrido."
        : "Aunque ya existe una base, todavía hay espacio para una experiencia más enfocada en conversión.";

  const painSummary = `En concreto, aparecen ${painPoints.join(", ")}.`;

  const openingLine = `Hola ${lead.businessName}. Vi una oportunidad concreta para convertir mejor tu presencia digital en ${location}.`;
  const serviceLine = `Mi recomendación es ${selectedService.label}, enfocada en ${selectedService.primaryOutcome}.`;
  const generatedScope = buildServiceScope(selectedService, lead as Lead, location, nicheLabel, painPoints, focus);
  const scope = lead.aiScope?.length ? lead.aiScope : generatedScope;

  return {
    service: { id: selectedService.id, label: selectedService.label },
    serviceReason,
    audit: lead.aiAudit?.trim() || `${weakSiteLine} ${painSummary} ${serviceLine} ${serviceReason}`,
    scope,
    whatsapp:
      lead.aiWhatsapp?.trim() ||
      `${openingLine} ${painSummary} ${serviceLine} ${stageGuidance.whatsappCta}`,
    email: lead.aiEmail?.trim() || `Asunto: Idea rápida de ${selectedService.label} para ${nicheLabel} en ${location}

Hola,

Revisé ${lead.businessName} y vi una oportunidad concreta para ${selectedService.primaryOutcome}.

${serviceLine} ${serviceReason}

Puntos clave:
- ${painPoints[0]}
- ${painPoints[1]}
- ${painPoints[2]}

${stageGuidance.emailClose}

Saludos,`,
    call:
      lead.aiCall?.trim() ||
      `${openingLine} La idea es mostrarte ${selectedService.label} y, si te hace sentido, dejamos el siguiente paso cerrado. ${stageGuidance.callClose}`,
    demoChecklist: buildServiceDemoChecklist(selectedService),
    meetingGoal: stageGuidance.meetingGoal,
  };
}

function parseCsvMatrix(text: string) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(normalizedText);
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const nextChar = normalizedText[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  while (rows.length && rows[0].every((cell) => cell.trim() === "")) {
    rows.shift();
  }

  while (rows.length && rows[rows.length - 1].every((cell) => cell.trim() === "")) {
    rows.pop();
  }

  if (!rows.length) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  return {
    headers: rows[0].map((header) => header.trim()),
    rows: rows.slice(1),
  };
}

function mapCsvCellsToRow(headers: string[], row: string[]) {
  const mapped: Record<string, string> = {};

  headers.forEach((header, headerIndex) => {
    const value = (row[headerIndex] || "").trim();
    const normalizedHeader = normalizeCsvHeader(header);

    if (header) {
      mapped[header] = value;
    }

    if (normalizedHeader) {
      mapped[normalizedHeader] = value;
    }
  });

  return mapped;
}

function isCsvRowEmpty(row: Record<string, string>) {
  return !Object.values(row).some((value) => value.trim() !== "");
}

function canonizeCsvRow(row: Record<string, string>) {
  const canonicalRow: Record<string, string> = { ...row };
  const reviewSummary = getCanonicalCsvValue(row, "reviewSummary");
  const address = getCanonicalCsvValue(row, "address") || getGoogleMapsAddress(row);

  const canonicalValues: Array<[string, string]> = [
    ["businessName", getCanonicalCsvValue(row, "businessName")],
    ["subniche", getCanonicalCsvValue(row, "subniche")],
    ["phone", getCanonicalCsvValue(row, "phone")],
    ["website", getCanonicalCsvValue(row, "website")],
    ["city", getCanonicalCsvValue(row, "city")],
    ["address", address],
    ["rating", getCanonicalCsvValue(row, "rating")],
    ["reviews", getCanonicalCsvValue(row, "reviews")],
    ["notes", getCanonicalCsvValue(row, "notes")],
    ["mapsUrl", getCanonicalCsvValue(row, "mapsUrl")],
    ["reviewSummary", reviewSummary],
  ];

  canonicalValues.forEach(([key, value]) => {
    if (value) {
      canonicalRow[key] = value;
    }
  });

  return canonicalRow;
}

function getCsvSkipLabel(reason: CsvImportSkipReason) {
  return reason === "empty" ? "Filas vacias" : "Filas sin nombre reconocible";
}

export function analyzeCsvImport(text: string): CsvImportAnalysis {
  const { headers, rows } = parseCsvMatrix(text);

  if (!headers.length) {
    return {
      totalRows: 0,
      nonEmptyRows: 0,
      emptyRows: 0,
      invalidRows: 0,
      detectedSource: "CSV estructurado",
      validRows: [],
      skippedRows: [],
    };
  }

  const rawRows = rows.map((row) => mapCsvCellsToRow(headers, row));
  const firstNonEmptyRow = rawRows.find((row) => !isCsvRowEmpty(row));
  const detectedSource = firstNonEmptyRow && isGoogleMapsExportRow(firstNonEmptyRow) ? "Google Maps export" : "CSV estructurado";
  const skippedRows: CsvImportSkippedRow[] = [];
  const validRows: Array<Record<string, string>> = [];
  let emptyRows = 0;
  let invalidRows = 0;

  rawRows.forEach((row, rowIndex) => {
    if (isCsvRowEmpty(row)) {
      emptyRows += 1;
      skippedRows.push({
        rowNumber: rowIndex + 2,
        reason: "empty",
        label: getCsvSkipLabel("empty"),
      });
      return;
    }

    const canonicalRow = canonizeCsvRow(row);

    if (!getCanonicalCsvValue(canonicalRow, "businessName")) {
      invalidRows += 1;
      skippedRows.push({
        rowNumber: rowIndex + 2,
        reason: "missing_business_name",
        label: getCsvSkipLabel("missing_business_name"),
      });
      return;
    }

    validRows.push(canonicalRow);
  });

  return {
    totalRows: rawRows.length,
    nonEmptyRows: rawRows.length - emptyRows,
    emptyRows,
    invalidRows,
    detectedSource,
    validRows,
    skippedRows,
  };
}

export function parseCsv(text: string): Array<Record<string, string>> {
  return analyzeCsvImport(text).validRows;
}

export function mapCsvRowToLead(row: Record<string, string>, focus: WorkspaceFocus): Lead {
  const mapsUrl = getCanonicalCsvValue(row, "mapsUrl");
  const googleMapsBusinessName = getCsvValue(row, ["qBF1Pd", "businessName"]);
  const googleMapsCategory = getCsvValue(row, ["W4Efsd", "subniche"]);
  const googleMapsPhone = getCanonicalCsvValue(row, "phone");
  const googleMapsWebsite = getCanonicalCsvValue(row, "website");
  const googleMapsReviewSummary = getCanonicalCsvValue(row, "reviewSummary");
  const googleMapsRating = getCanonicalCsvValue(row, "rating");
  const googleMapsReviewsCount = parseGoogleMapsReviewsCount(getCanonicalCsvValue(row, "reviews"));
  const googleMapsAddress = getCanonicalCsvValue(row, "address") || getGoogleMapsAddress(row);
  const googleMapsStatus = getGoogleMapsStatus(row);
  const isGoogleMapsRow = isGoogleMapsExportRow(row);
  const city = getCanonicalCsvValue(row, "city") || focus.city;
  const macroNiche =
    getCsvValue(row, ["macroNiche", "macro_niche", "macro niche", "vertical", "vertical principal"]) || focus.niche;
  const batchName = getCanonicalCsvValue(row, "batchName") || focus.batchName;
  const explicitNiche = getCanonicalCsvValue(row, "explicitNiche");
  const csvSubniche = getCanonicalCsvValue(row, "subniche");
  const website = getCanonicalCsvValue(row, "website") || googleMapsWebsite;
  const phone = getCanonicalCsvValue(row, "phone") || googleMapsPhone;
  const notes = getCanonicalCsvValue(row, "notes");
  const inferredPainPoints = inferGoogleMapsPainPoints(
    website,
    phone,
    googleMapsReviewSummary,
    googleMapsReviewsCount
  );

  return normalizeLead(
    {
      businessName: getCanonicalCsvValue(row, "businessName") || googleMapsBusinessName,
      city,
      niche: macroNiche,
      subniche: csvSubniche || googleMapsCategory || explicitNiche || macroNiche,
      batchName,
      phone,
      email: getCanonicalCsvValue(row, "email"),
      website,
      source:
        getCanonicalCsvValue(row, "source") ||
        (isGoogleMapsRow ? "Google Maps export" : "CSV import"),
      websiteStatus: normalizeWebsiteStatus(
        getCanonicalCsvValue(row, "websiteStatus") ||
          (isGoogleMapsRow ? inferGoogleMapsWebsiteStatus(website) : "")
      ),
      digitalPresence: normalizeDigitalPresence(
        getCanonicalCsvValue(row, "digitalPresence") ||
          (isGoogleMapsRow
            ? inferGoogleMapsDigitalPresence(website, googleMapsReviewsCount, googleMapsReviewSummary)
            : "")
      ),
      painPoints: normalizePainPoints(
        getCanonicalCsvValue(row, "painPoints") ||
          (isGoogleMapsRow ? inferredPainPoints.join(" | ") : "")
      ),
      offerType: getCanonicalCsvValue(row, "offerType") || focus.offer,
      stage: normalizeStage(getCanonicalCsvValue(row, "stage") || "sourced"),
      notes: isGoogleMapsRow
        ? buildGoogleMapsNotes(
            googleMapsAddress,
            googleMapsStatus,
            googleMapsReviewSummary,
            googleMapsRating,
            googleMapsReviewsCount,
            mapsUrl,
            notes
          )
        : notes,
      lastTouch: getCanonicalCsvValue(row, "lastTouch") || new Date().toISOString().slice(0, 10),
    },
    focus
  );
}

export function dedupeIncomingLeads(incomingLeads: Lead[], existingLeads: Lead[]) {
  const fingerprints = new Set(existingLeads.map(createLeadFingerprint));
  const uniqueLeads: Lead[] = [];

  incomingLeads.forEach((lead) => {
    const fingerprint = createLeadFingerprint(lead);

    if (fingerprints.has(fingerprint)) {
      return;
    }

    fingerprints.add(fingerprint);
    uniqueLeads.push(lead);
  });

  return uniqueLeads;
}
