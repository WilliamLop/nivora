import { STAGES } from "./dashboard";
import type { DashboardLead, DashboardStatus, DataMode, PriorityTone } from "./types";
import type { DisplayStatus, ImportPreview } from "./component-types";
import type { WorkspaceFocus } from "./types";

// ── CSS class helpers ─────────────────────────────────────────────────────────

export function badgeClass(priority: PriorityTone) {
  if (priority === "hot") return "badge-hot";
  if (priority === "warm") return "badge-warm";
  return "badge-cool";
}

export function statusChipClass(tone: DashboardStatus["tone"]) {
  if (tone === "cloud") return "status-chip-cloud";
  if (tone === "error") return "status-chip-alert";
  if (tone === "working") return "status-chip-waiting";
  return "status-chip-local";
}

export function cleanStatusTitle(title: string) {
  return title.toLowerCase().includes("supabase") ? "Sincronizacion revisada" : title;
}

// ── Operational status ────────────────────────────────────────────────────────

export function getOperationalStatus(storageStatus: DashboardStatus, dataMode: DataMode): DisplayStatus {
  if (dataMode === "cloud") {
    return { tone: "cloud", label: "Sincronizado", message: "El tablero guarda estructura, importaciones y leads reales." };
  }
  if (dataMode === "error" || storageStatus.tone === "error") {
    return { tone: "error", label: "Revisar", message: "La UI sigue operativa, pero conviene revisar sincronizacion." };
  }
  return { tone: "preview", label: "Borrador", message: "Puedes ordenar la operacion mientras configuras la plataforma." };
}

export function getActivityFeedback(storageStatus: DashboardStatus, dataMode: DataMode): DisplayStatus {
  if (dataMode === "cloud") {
    return {
      tone: storageStatus.tone,
      label: cleanStatusTitle(storageStatus.title),
      message: getSuccessMessage(storageStatus.title),
    };
  }
  if (dataMode === "error" || storageStatus.tone === "error") {
    return {
      tone: "error",
      label: "Revisar el ultimo movimiento",
      message: "La operacion sigue visible, pero el ultimo cambio no se pudo sincronizar.",
    };
  }
  return {
    tone: "preview",
    label: "Modo borrador activo",
    message: "Estas trabajando sobre una vista temporal mientras terminas los ajustes de plataforma.",
  };
}

function getSuccessMessage(title: string) {
  const messages: Record<string, string> = {
    "Lead guardado": "El negocio quedo listo para seguimiento y ya esta en el tablero compartido.",
    "Importacion guardada": "La carga masiva ya quedo disponible para trabajarla desde el CRM.",
    "Importacion guardada con IA": "La carga masiva se enriquecio con IA y ya quedo disponible en el CRM.",
    "Importacion parcial con IA": "La carga masiva se guardo, pero la IA solo enriquecio parte del lote.",
    "Importacion guardada sin IA": "La carga masiva se guardo sin enriquecimiento de IA.",
    "Pipeline actualizado": "La etapa del lead ya refleja el estado mas reciente del negocio.",
    "Lead actualizado": "La ficha del negocio quedo al dia y lista para el siguiente paso.",
    "Lead eliminado": "El registro ya no hace parte de la operacion activa.",
    "Arquitectura guardada": "La ciudad, el nicho y la importacion quedaron persistidos.",
  };
  return messages[title] || "Los ultimos cambios quedaron listos para seguir operando.";
}

// ── Overview insights ─────────────────────────────────────────────────────────

export function getBottleneck(leads: DashboardLead[]) {
  const counts = STAGES.map((stage) => ({
    ...stage,
    total: leads.filter((l) => l.stage === stage.id).length,
  })).sort((a, b) => b.total - a.total);

  const top = counts[0] || STAGES[0];
  const tips: Record<string, string> = {
    sourced: "Haz mas calificacion antes de seguir sumando negocios nuevos.",
    qualified: "Ya tienes negocios listos; empuja el primer contacto hoy.",
    contacted: "El follow-up corto puede destrabar varias llamadas.",
    booked: "Conviene preparar demos antes de meter nuevos leads.",
    demo: "Convierte las demos en propuesta clara y agenda cierre.",
    proposal: "Toca seguimiento comercial para cerrar o resolver objeciones.",
    closed: "Abre una nueva importacion manteniendo el mismo nicho ganador.",
  };

  return { label: top.label, tip: tips[top.id] || "" };
}

export function getTopPainPoints(leads: DashboardLead[]) {
  const counts = new Map<string, number>();
  leads.forEach((l) =>
    l.painPoints.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1))
  );
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, total]) => `${label} (${total})`);
}

export function getTopCity(leads: DashboardLead[], focus: WorkspaceFocus) {
  const counts = new Map<string, number>();
  leads.forEach((l) => counts.set(l.city, (counts.get(l.city) || 0) + 1));
  const [city = focus.city, total = 0] =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return {
    city,
    tip:
      total >= 3
        ? "Vale la pena seguir con este cluster antes de abrir otra ciudad."
        : "Todavia puedes concentrar mas volumen en una sola zona.",
  };
}

export function getImmediateTasks(leads: DashboardLead[]) {
  const { labelForStage } = require("./dashboard") as { labelForStage: (s: string) => string };
  return leads.slice(0, 4).map((lead) => ({
    title: `${lead.businessName} / ${labelForStage(lead.stage)}`,
    body: `${lead.nextMove} Prioridad ${lead.priority.toUpperCase()} con score ${lead.score}.`,
  }));
}

// ── Import helpers ────────────────────────────────────────────────────────────

export function buildImportPreview(
  rows: Array<Record<string, string>>,
  focus: WorkspaceFocus
): ImportPreview {
  const counts = new Map<string, number>();
  const sampleBusinesses: string[] = [];
  const detectedSource = rows[0] && isGoogleMapsCsvRow(rows[0]) ? "Google Maps export" : "CSV estructurado";

  rows.forEach((row, index) => {
    const subniche =
      readCsvField(row, ["subniche", "subnicho", "specialty", "niche", "nicho", "segment", "segmento"]) ||
      readCsvField(row, ["category", "categoria", "categoría"]) ||
      readCsvField(row, ["W4Efsd", "w4efsd"]) ||
      focus.niche;
    counts.set(subniche, (counts.get(subniche) || 0) + 1);

    if (index < 3) {
      sampleBusinesses.push(
        readCsvField(row, ["businessName", "business_name", "company", "nombre", "qBF1Pd", "qbf1pd"]) ||
          "Lead sin nombre"
      );
    }
  });

  return {
    totalRows: rows.length,
    detectedSource,
    topSubniches: [...counts.entries()]
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4),
    sampleBusinesses,
  };
}

export function buildImportReadyMessage(
  fileName: string,
  rows: Array<Record<string, string>>,
  focus: WorkspaceFocus
) {
  const totalRows = rows.length;
  const sampleRow = rows[0];
  if (!sampleRow) return `Archivo listo para importar: ${fileName}`;

  if (isGoogleMapsCsvRow(sampleRow)) {
    const category =
      readCsvField(sampleRow, ["W4Efsd", "w4efsd"]) ||
      readCsvField(sampleRow, ["category", "categoria", "categoría"]);
    return `Archivo listo: ${fileName}. Detectados ${totalRows} negocios desde Google Maps${category ? ` (${category})` : ""}. Se guardaran en ${focus.city} / ${focus.niche} / ${focus.batchName}.`;
  }

  return `Archivo listo: ${fileName}. ${totalRows} filas listas para importar en ${focus.batchName}.`;
}

function isGoogleMapsCsvRow(row: Record<string, string>) {
  return Boolean(readCsvField(row, ["qBF1Pd", "qbf1pd", "hfpxzc href", "hfpxzchref", "UsdlK", "usdlk"]));
}

function readCsvField(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}
