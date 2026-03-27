"use client";

import { useState, type DragEvent } from "react";

import type { DashboardLead, Stage } from "@/lib/types";
import type { BoardColumn, ResponsibleFilterOption, StageSummary } from "@/lib/component-types";
import { badgeClass } from "@/lib/ui-helpers";
import { STAGES } from "@/lib/dashboard";

type PipelineViewProps = {
  boardColumns: BoardColumn[];
  stageSummary: StageSummary[];
  selectedLeadId: string;
  batchFilter: string;
  focus: { niche: string };
  workspaceImportLabel: string;
  isSaving: boolean;
  canFilterByResponsible?: boolean;
  responsibleFilter?: string;
  responsibleOptions?: ResponsibleFilterOption[];
  editActionLabel?: string;
  onResponsibleFilterChange?: (value: string) => void;
  onSelectLead: (id: string) => void;
  onEditLead: (lead: DashboardLead) => void;
  onStageChange: (leadId: string, stage: Stage) => void;
};

export function PipelineView({
  boardColumns,
  stageSummary,
  selectedLeadId,
  batchFilter,
  focus,
  workspaceImportLabel,
  isSaving,
  canFilterByResponsible = false,
  responsibleFilter = "all",
  responsibleOptions = [],
  editActionLabel = "Editar",
  onResponsibleFilterChange,
  onSelectLead,
  onEditLead,
  onStageChange,
}: PipelineViewProps) {
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const allLeads = boardColumns.flatMap(({ leads }) => leads);

  function clearDragState() {
    setDraggingLeadId(null);
    setDropStageId(null);
  }

  function isInteractiveElement(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      ["BUTTON", "SELECT", "OPTION", "INPUT", "TEXTAREA", "A", "LABEL"].includes(target.tagName)
    );
  }

  function handleDragStart(lead: DashboardLead) {
    return (event: DragEvent<HTMLElement>) => {
      if (isInteractiveElement(event.target) && event.target !== event.currentTarget) {
        return;
      }

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", lead.id);
      event.dataTransfer.setData("application/x-nivora-lead-id", lead.id);
      event.dataTransfer.setData("application/x-nivora-stage-id", lead.stage);
      setDraggingLeadId(lead.id);
      setDropStageId(lead.stage);
    };
  }

  function handleDragOver(stageId: Stage) {
    return (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropStageId !== stageId) {
        setDropStageId(stageId);
      }
    };
  }

  function handleDrop(stageId: Stage) {
    return (event: DragEvent<HTMLElement>) => {
      event.preventDefault();

      const leadId =
        event.dataTransfer.getData("application/x-nivora-lead-id") ||
        event.dataTransfer.getData("text/plain") ||
        draggingLeadId;

      if (!leadId) {
        clearDragState();
        return;
      }

      const sourceLead = allLeads.find((lead) => lead.id === leadId);
      if (!sourceLead || sourceLead.stage === stageId) {
        clearDragState();
        return;
      }

      onStageChange(leadId, stageId);
      clearDragState();
    };
  }

  return (
    <section className="ops-view ops-view-v3">
      <section className="panel ops-card">
        <div className="ops-section-head">
          <div>
            <p className="mini-label">Seguimiento comercial</p>
            <h3>Pipeline por etapa</h3>
          </div>
          <div className="pipeline-head-aside">
            <p className="muted ops-inline-note">
              {batchFilter === "all"
                ? `Estas viendo todas las importaciones de ${focus.niche}.`
                : `Estas viendo la importacion ${workspaceImportLabel}.`}
            </p>
            {canFilterByResponsible ? (
              <label className="pipeline-responsible-filter">
                Responsable
                <select
                  value={responsibleFilter}
                  onChange={(event) => onResponsibleFilterChange?.(event.target.value)}
                >
                  {responsibleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.total})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
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

      <section className="pipeline-board pipeline-board-v3">
        {boardColumns.map(({ stage, leads: stageLeads }) => (
          <section
            className={`board-column ${dropStageId === stage.id ? "board-column-drop-target" : ""}`}
            key={stage.id}
            onDragOver={handleDragOver(stage.id)}
            onDrop={handleDrop(stage.id)}
          >
            <h3>
              {stage.label} <span className="column-count">({stageLeads.length})</span>
            </h3>

            {stageLeads.length ? (
              stageLeads.map((lead) => (
                <article
                  className={[
                    "lead-card",
                    selectedLeadId === lead.id ? "lead-card-active" : "",
                    draggingLeadId === lead.id ? "lead-card-dragging" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={lead.id}
                  data-lead-id={lead.id}
                  data-stage={lead.stage}
                  data-dragging={draggingLeadId === lead.id ? "true" : "false"}
                  aria-selected={selectedLeadId === lead.id}
                  aria-grabbed={draggingLeadId === lead.id}
                  tabIndex={0}
                  draggable={!isSaving}
                  onClick={() => onSelectLead(lead.id)}
                  onDragStart={handleDragStart(lead)}
                  onDragEnd={clearDragState}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectLead(lead.id);
                    }
                  }}
                >
                  <header>
                    <div className="lead-card-copy">
                      <h4 title={lead.businessName}>{lead.businessName}</h4>
                      <div className="lead-card-meta">
                        {lead.subniche} / {lead.batchName}
                      </div>
                    </div>
                    <span className={`badge ${badgeClass(lead.priority)}`}>{lead.priority.toUpperCase()}</span>
                  </header>
                  <p className="lead-card-summary">{lead.nextMove}</p>
                  <footer className="lead-card-footer">
                    <div className="lead-card-status-row">
                      <span className="badge score-pill">Score {lead.score}</span>
                      <label
                        className="lead-card-stage-control"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="lead-card-stage-label">Mover a</span>
                        <select
                          className="card-select"
                          value={lead.stage}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(e) => onStageChange(lead.id, e.target.value as Stage)}
                          disabled={isSaving}
                        >
                          {STAGES.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="ops-inline-actions lead-card-actions">
                      <button
                        className="button button-secondary table-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectLead(lead.id);
                        }}
                      >
                        Seleccionar
                      </button>
                      <button
                        className="button button-primary table-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditLead(lead);
                        }}
                      >
                        {editActionLabel}
                      </button>
                    </div>
                  </footer>
                </article>
              ))
            ) : (
              <div className="empty-state">Sin negocios en esta etapa por ahora.</div>
            )}
          </section>
        ))}
      </section>
    </section>
  );
}
