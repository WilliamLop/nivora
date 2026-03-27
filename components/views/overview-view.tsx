"use client";

import type { DashboardLead } from "@/lib/types";
import type {
  BatchSummary,
  BoardColumn,
  InsightData,
  MarketSummary,
  MetricCard,
  SegmentSummary,
  StageSummary,
} from "@/lib/component-types";
import type { WorkspaceFocus } from "@/lib/types";
import { badgeClass, statusChipClass } from "@/lib/ui-helpers";
import { labelForStage, compactPainPoints } from "@/lib/dashboard";

type OverviewViewProps = {
  focus: WorkspaceFocus;
  metrics: MetricCard[];
  insights: InsightData;
  stageSummary: StageSummary[];
  selectedLead: DashboardLead | null;
  activeMarket: MarketSummary | null;
  activeSegment: SegmentSummary | null;
  activeBatch: BatchSummary | null;
  scopeDescription: string;
  onEditLead: (lead?: DashboardLead | null) => void;
  onViewLeads: () => void;
  onViewPipeline: () => void;
  onViewSettings: () => void;
};

export function OverviewView({
  focus,
  metrics,
  insights,
  stageSummary,
  selectedLead,
  activeMarket,
  activeSegment,
  activeBatch,
  scopeDescription,
  onEditLead,
  onViewLeads,
  onViewPipeline,
  onViewSettings,
}: OverviewViewProps) {
  return (
    <section className="ops-view ops-view-v3">
      {/* KPI Hero */}
      <section className="panel ops-card ops-hero-panel-v3">
        <div className="ops-hero-panel-copy">
          <p className="mini-label">Vista general</p>
          <h3>
            {focus.city} · {focus.niche}
          </h3>
          <p className="muted">
            Tu punto de orientacion rapido — entiendes donde estas parado antes de entrar al CRM o al pipeline.
          </p>
        </div>
        <div className="ops-hero-grid ops-hero-grid-v3">
          {metrics.map((metric) => (
            <article className="ops-hero-stat" key={metric.label}>
              <p className="mini-label">{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.foot}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="ops-overview-columns-v3">
        {/* Context summary */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Contexto actual</p>
              <h3>Donde estas trabajando</h3>
            </div>
            <button className="button button-secondary" type="button" onClick={onViewSettings}>
              Ajustar contexto
            </button>
          </div>
          <div className="ops-summary-grid ops-summary-grid-v3">
            <article className="ops-summary-card">
              <span>Ciudad</span>
              <strong>{focus.city}</strong>
              <p>{activeMarket ? `${activeMarket.total} negocios guardados` : "Sin negocios todavia."}</p>
            </article>
            <article className="ops-summary-card">
              <span>Nicho</span>
              <strong>{focus.niche}</strong>
              <p>
                {activeSegment
                  ? `${activeSegment.subnicheCount} especialidades detectadas`
                  : "Sin especialidades registradas."}
              </p>
            </article>
            <article className="ops-summary-card">
              <span>Importacion</span>
              <strong>{focus.batchName}</strong>
              <p>
                {activeBatch
                  ? `${activeBatch.total} negocios en esta lista`
                  : "Lista lista para usar."}
              </p>
            </article>
          </div>
        </section>

        {/* Immediate tasks */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Lo siguiente</p>
              <h3>Prioridades inmediatas</h3>
            </div>
          </div>
          <div className="ops-stack">
            {insights.tasks.length ? (
              insights.tasks.map((task) => (
                <article className="ops-agenda-card" key={task.title}>
                  <strong>{task.title}</strong>
                  <p>{task.body}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Todavia no hay negocios visibles para sugerir acciones.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="ops-overview-columns-v3">
        {/* Pipeline insights */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Embudo</p>
              <h3>Lectura comercial del momento</h3>
            </div>
            <span className="status-chip status-chip-local">{scopeDescription}</span>
          </div>
          <div className="ops-overview-stack ops-overview-stack-v3">
            <article className="ops-insight-card">
              <span className="mini-label">Cuello principal</span>
              <strong>{insights.bottleneck.label}</strong>
              <p>{insights.bottleneck.tip}</p>
            </article>
            <article className="ops-insight-card">
              <span className="mini-label">Patrones del nicho</span>
              <strong>{insights.topPainPoints[0] || "Sin patron dominante aun"}</strong>
              <p>
                {insights.topPainPoints.length
                  ? insights.topPainPoints.join(" / ")
                  : "Cuando subas mas volumen aqui veremos que se repite."}
              </p>
            </article>
            <article className="ops-insight-card">
              <span className="mini-label">Ciudad dominante</span>
              <strong>{insights.topCity.city}</strong>
              <p>{insights.topCity.tip}</p>
            </article>
          </div>
          <div className="ops-stage-strip ops-stage-strip-v3">
            {stageSummary.map((stage) => (
              <article className="ops-stage-chip" key={stage.id}>
                <span>{stage.label}</span>
                <strong>{stage.total}</strong>
              </article>
            ))}
          </div>
        </section>

        {/* Selected lead */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Lead activo</p>
              <h3>Negocio enfocado</h3>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => onEditLead(selectedLead)}
              disabled={!selectedLead}
            >
              Abrir ficha
            </button>
          </div>
          {selectedLead ? (
            <div className="ops-selected-lead ops-selected-lead-v3">
              <div className="ops-selected-lead-head">
                <div>
                  <strong>{selectedLead.businessName}</strong>
                  <p>
                    {selectedLead.city} / {selectedLead.niche} / {selectedLead.batchName}
                  </p>
                </div>
                <span className={`badge ${badgeClass(selectedLead.priority)}`}>
                  Score {selectedLead.score}
                </span>
              </div>
              <div className="ops-chip-row">
                <span className="badge score-pill">{selectedLead.subniche}</span>
                <span className="badge score-pill">{labelForStage(selectedLead.stage)}</span>
                {selectedLead.offerType ? (
                  <span className="badge score-pill">{selectedLead.offerType}</span>
                ) : null}
              </div>
              <p className="ops-selected-lead-copy">{selectedLead.nextMove}</p>
              <div className="ops-button-row">
                <button className="button button-primary" type="button" onClick={onViewLeads}>
                  Ir al CRM
                </button>
                <button className="button button-secondary" type="button" onClick={onViewPipeline}>
                  Ver pipeline
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Selecciona un negocio para convertirlo en tu foco activo.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
