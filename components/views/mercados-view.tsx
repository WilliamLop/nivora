"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { DashboardLead, OpsStatus, Stage, TeamMember } from "@/lib/types";
import type {
  MarketSummary,
  SegmentSummary,
  BatchSummary,
  FollowUpTimingFilter,
  SubnicheSummary,
  MetricCard,
  ResponsibleFilterOption,
} from "@/lib/component-types";
import { badgeClass } from "@/lib/ui-helpers";
import { STAGES } from "@/lib/dashboard";
import { labelForOpsStatus, labelForStage, compactPainPoints } from "@/lib/dashboard";

type MercadosViewProps = {
  focus: { city: string; niche: string; marketId: string; segmentId: string; batchId: string };
  marketSummaries: MarketSummary[];
  segmentSummaries: SegmentSummary[];
  batchSummaries: BatchSummary[];
  subnicheSummaries: SubnicheSummary[];
  highlightedSubniches: SubnicheSummary[];
  filteredLeads: DashboardLead[];
  segmentScopedLeads: DashboardLead[];
  scopeLeadCount: number;
  selectedLeadId: string;
  selectedLeadIds: string[];
  searchQuery: string;
  stageFilter: Stage | "all";
  opsStatusFilter: OpsStatus | "all";
  followUpTimingFilter: FollowUpTimingFilter;
  subnicheFilter: string;
  batchFilter: string;
  tableQuickStats: MetricCard[];
  scopeDescription: string;
  isSaving: boolean;
  workspaceImportLabel: string;
  teamMembers: TeamMember[];
  canManageCatalog: boolean;
  canCreateLead: boolean;
  canDeleteLead: boolean;
  canAssignLeads: boolean;
  canFilterByResponsible: boolean;
  selectedAssignmentUserId: string;
  responsibleFilter: string;
  responsibleOptions: ResponsibleFilterOption[];
  onSelectMarket: (id: string) => void;
  onSelectSegment: (id: string) => void;
  onSelectBatch: (id: string) => void;
  onSelectLead: (id: string) => void;
  onToggleLeadSelection: (id: string) => void;
  onToggleVisibleLeadSelection: () => void;
  onClearSelectedLeadIds: () => void;
  onEditLead: (lead: DashboardLead) => void;
  onDeleteLead: () => void;
  onRequestDeleteSelectedLeads: () => void;
  onSearchChange: (value: string) => void;
  onStageFilterChange: (value: Stage | "all") => void;
  onOpsStatusFilterChange: (value: OpsStatus | "all") => void;
  onFollowUpTimingFilterChange: (value: FollowUpTimingFilter) => void;
  onSubnicheFilterChange: (value: string) => void;
  onBatchFilterChange: (value: string) => void;
  onResponsibleFilterChange: (value: string) => void;
  onSelectedAssignmentUserIdChange: (value: string) => void;
  onAssignSelectedLeads: () => Promise<void>;
  onNewLead: () => void;
  onImport: () => void;
  onCreateSegment: (name: string) => Promise<void>;
  onMergeSegment: (sourceSegmentId: string, targetSegmentId: string) => Promise<void>;
};

export function MercadosView({
  focus,
  marketSummaries,
  segmentSummaries,
  batchSummaries,
  subnicheSummaries,
  highlightedSubniches,
  filteredLeads,
  segmentScopedLeads,
  scopeLeadCount,
  selectedLeadId,
  selectedLeadIds,
  searchQuery,
  stageFilter,
  opsStatusFilter,
  followUpTimingFilter,
  subnicheFilter,
  batchFilter,
  tableQuickStats,
  scopeDescription,
  isSaving,
  workspaceImportLabel,
  teamMembers,
  canManageCatalog,
  canCreateLead,
  canDeleteLead,
  canAssignLeads,
  canFilterByResponsible,
  selectedAssignmentUserId,
  responsibleFilter,
  responsibleOptions,
  onSelectMarket,
  onSelectSegment,
  onSelectBatch,
  onSelectLead,
  onToggleLeadSelection,
  onToggleVisibleLeadSelection,
  onClearSelectedLeadIds,
  onEditLead,
  onDeleteLead,
  onRequestDeleteSelectedLeads,
  onSearchChange,
  onStageFilterChange,
  onOpsStatusFilterChange,
  onFollowUpTimingFilterChange,
  onSubnicheFilterChange,
  onBatchFilterChange,
  onResponsibleFilterChange,
  onSelectedAssignmentUserIdChange,
  onAssignSelectedLeads,
  onNewLead,
  onImport,
  onCreateSegment,
  onMergeSegment,
}: MercadosViewProps) {
  const [isCreateSegmentOpen, setIsCreateSegmentOpen] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState("");
  const [mergeSourceSegmentId, setMergeSourceSegmentId] = useState("");
  const [mergeTargetSegmentId, setMergeTargetSegmentId] = useState("");
  const [segmentActionError, setSegmentActionError] = useState("");
  const [isSegmentBusy, setIsSegmentBusy] = useState(false);
  const selectedLeadIdSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const selectedLeadCount = selectedLeadIds.length;
  const selectedLeads = useMemo(
    () => filteredLeads.filter((lead) => selectedLeadIdSet.has(lead.id)),
    [filteredLeads, selectedLeadIdSet]
  );
  const selectedLeadPreview = selectedLeads.slice(0, 3);
  const hasSelectedVisibleLeads = filteredLeads.some((lead) => selectedLeadIdSet.has(lead.id));
  const allVisibleLeadsSelected = filteredLeads.length > 0 && filteredLeads.every((lead) => selectedLeadIdSet.has(lead.id));
  const teamMemberNameById = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member.fullName])),
    [teamMembers]
  );

  const selectedLead = filteredLeads.find((l) => l.id === selectedLeadId) ?? null;
  const mergeSourceSegment = segmentSummaries.find((segment) => segment.id === mergeSourceSegmentId) ?? null;
  const mergeTargetSegment = segmentSummaries.find((segment) => segment.id === mergeTargetSegmentId) ?? null;
  const mergeTargetOptions = segmentSummaries.filter((segment) => segment.id !== mergeSourceSegmentId);

  async function handleCreateSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newSegmentName.trim();
    if (!name) return;

    setSegmentActionError("");
    setIsSegmentBusy(true);

    try {
      await onCreateSegment(name);
      setNewSegmentName("");
      setIsCreateSegmentOpen(false);
    } catch (error) {
      setSegmentActionError(error instanceof Error ? error.message : "No se pudo crear el nicho.");
    } finally {
      setIsSegmentBusy(false);
    }
  }

  function startMergeSegment(segmentId: string) {
    const target = segmentSummaries.find((segment) => segment.id !== segmentId) ?? null;

    setMergeSourceSegmentId(segmentId);
    setMergeTargetSegmentId(target?.id ?? "");
    setIsCreateSegmentOpen(false);
    setSegmentActionError("");
  }

  async function handleMergeSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mergeSourceSegmentId || !mergeTargetSegmentId || mergeSourceSegmentId === mergeTargetSegmentId) {
      setSegmentActionError("Elige dos nichos distintos para fusionar.");
      return;
    }

    setSegmentActionError("");
    setIsSegmentBusy(true);

    try {
      await onMergeSegment(mergeSourceSegmentId, mergeTargetSegmentId);
      setMergeSourceSegmentId("");
      setMergeTargetSegmentId("");
    } catch (error) {
      setSegmentActionError(error instanceof Error ? error.message : "No se pudo fusionar el nicho.");
    } finally {
      setIsSegmentBusy(false);
    }
  }

  return (
    <section className="ops-view ops-view-v3">
      {/* Context board */}
      <section className="panel ops-card ops-market-console">
        <div className="ops-section-head">
          <div>
            <p className="mini-label">Contexto de trabajo</p>
            <h3>Elige donde quieres operar</h3>
            <p className="muted ops-console-copy">
              Primero defines ciudad, luego el nicho principal y por ultimo la importacion que quieres revisar.
            </p>
          </div>
          <div className="ops-button-row">
            {canManageCatalog ? (
              <button className="button button-secondary" type="button" onClick={onImport}>
                Importar CSV
              </button>
            ) : null}
            {canCreateLead ? (
              <button className="button button-primary" type="button" onClick={onNewLead}>
                Nuevo negocio
              </button>
            ) : null}
          </div>
        </div>

        <div className="ops-context-board">
          <article className="ops-context-card">
            <div className="ops-context-card-head">
              <span className="mini-label">Ciudad</span>
              <strong>{focus.city}</strong>
            </div>
            <div className="ops-tree-list">
              {marketSummaries.map((market) => (
                <button
                  key={market.id}
                  type="button"
                  className={`ops-tree-button ${focus.marketId === market.id ? "ops-tree-button-active" : ""}`}
                  onClick={() => onSelectMarket(market.id)}
                >
                  <span>{market.name}</span>
                  <small>
                    {market.total} negocios · {market.segmentCount} nichos
                  </small>
                </button>
              ))}
            </div>
          </article>

          <article className="ops-context-card">
            <div className="ops-context-card-head">
              <div>
                <span className="mini-label">Nicho principal</span>
                <strong>{focus.niche}</strong>
              </div>
              <div className="ops-button-row">
                {canManageCatalog ? (
                  <button
                    className="button button-secondary table-button"
                    type="button"
                    onClick={() =>
                      setIsCreateSegmentOpen((current) => {
                        const next = !current;
                        if (next) {
                          setMergeSourceSegmentId("");
                          setMergeTargetSegmentId("");
                        }
                        return next;
                      })
                    }
                  >
                    {isCreateSegmentOpen ? "Cerrar" : "+ Nuevo nicho"}
                  </button>
                ) : null}
              </div>
            </div>

            {isCreateSegmentOpen && canManageCatalog ? (
              <form className="ops-inline-panel" onSubmit={handleCreateSegment}>
                <label>
                  Nombre del nicho
                  <input
                    value={newSegmentName}
                    onChange={(event) => setNewSegmentName(event.target.value)}
                    placeholder="Odontologia"
                    required
                  />
                </label>
                <div className="ops-button-row">
                  <button className="button button-primary" type="submit" disabled={isSegmentBusy}>
                    {isSegmentBusy ? "Creando..." : "Crear nicho"}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      setIsCreateSegmentOpen(false);
                      setNewSegmentName("");
                    }}
                    disabled={isSegmentBusy}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}

            <div className="ops-chip-cluster ops-chip-cluster-v3 ops-context-chip-grid ops-segment-list">
              {segmentSummaries.map((segment) => (
                <div key={segment.id} className="ops-segment-row">
                  <button
                    type="button"
                    className={`ops-compact-chip ${focus.segmentId === segment.id ? "ops-compact-chip-active" : ""}`}
                    onClick={() => onSelectSegment(segment.id)}
                  >
                    {segment.name} ({segment.total})
                  </button>
                  <button
                    className="button button-secondary table-button ops-segment-action"
                    type="button"
                    onClick={() => startMergeSegment(segment.id)}
                    disabled={!canManageCatalog || isSegmentBusy || segmentSummaries.length < 2}
                  >
                    Fusionar
                  </button>
                </div>
              ))}
            </div>

            {mergeSourceSegment ? (
              <form className="ops-inline-panel" onSubmit={handleMergeSegment}>
                <div className="ops-section-head">
                  <div>
                    <p className="mini-label">Fusionar nicho</p>
                    <h3>{mergeSourceSegment.name}</h3>
                    <p className="muted ops-inline-note">
                      Origen: {mergeSourceSegment.total} negocios · {mergeSourceSegment.batchCount} importaciones.
                    </p>
                  </div>
                </div>

                <label>
                  Nicho destino
                  <p className="muted ops-inline-note" style={{ marginTop: 4 }}>
                    {mergeTargetSegment
                      ? `Destino actual: ${mergeTargetSegment.name}`
                      : "Elige el nicho que absorberá este origen."}
                  </p>
                  <select
                    value={mergeTargetSegmentId}
                    onChange={(event) => setMergeTargetSegmentId(event.target.value)}
                    required
                  >
                    {mergeTargetOptions.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ops-button-row">
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={isSegmentBusy || !mergeTargetSegmentId}
                  >
                    {isSegmentBusy ? "Fusionando..." : "Fusionar"}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      setMergeSourceSegmentId("");
                      setMergeTargetSegmentId("");
                      setSegmentActionError("");
                    }}
                    disabled={isSegmentBusy}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}

            {segmentActionError ? <p className="ops-city-error">{segmentActionError}</p> : null}
          </article>

          <article className="ops-context-card">
            <div className="ops-context-card-head">
              <span className="mini-label">Importacion</span>
              <strong>{workspaceImportLabel}</strong>
            </div>
            <div className="ops-tree-list">
              {batchSummaries.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`ops-tree-button ${focus.batchId === batch.id ? "ops-tree-button-active" : ""}`}
                  onClick={() => onSelectBatch(batch.id)}
                >
                  <span>{batch.name}</span>
                  <small>
                    {batch.total} negocios · {batch.hot} urgentes
                  </small>
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* CRM table */}
      <section className="panel ops-card ops-crm-card">
        <div className="ops-crm-header">
          <div>
            <p className="mini-label">CRM operativo</p>
            <h3>Negocios dentro del contexto actual</h3>
            <p className="muted ops-inline-note">
              {scopeDescription}. La tabla ocupa todo el ancho y la ficha se abre aparte.
            </p>
          </div>
          <div className="ops-button-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => selectedLead && onEditLead(selectedLead)}
              disabled={!selectedLead}
            >
              Abrir seguimiento
            </button>
            {canDeleteLead ? (
              <button
                className="button button-danger"
                type="button"
                onClick={onDeleteLead}
                disabled={!selectedLead || isSaving}
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </div>

        <div className="ops-quick-stats">
          {tableQuickStats.map((stat) => (
            <article className="ops-quick-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>

        <div className="ops-filter-shell ops-filter-shell-tight">
          <div className={`ops-filter-grid-v3 ${canFilterByResponsible ? "ops-filter-grid-v3-wide" : ""}`}>
            <label>
              Buscar
              <input
                type="search"
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
                placeholder="Negocio, especialidad o importacion"
              />
            </label>
            <label>
              Etapa
              <select
                value={stageFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onStageFilterChange(e.target.value as Stage | "all")}
              >
                <option value="all">Todas</option>
                {STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seguimiento
              <select
                value={opsStatusFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  onOpsStatusFilterChange(e.target.value as OpsStatus | "all")
                }
              >
                <option value="all">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="no_answer">No contestó</option>
                <option value="contacted">Contactado</option>
                <option value="callback_requested">Devolver llamada</option>
                <option value="interested">Interesado</option>
                <option value="booked">Agendada</option>
                <option value="not_interested">Sin interés</option>
                <option value="do_not_contact">No contactar</option>
              </select>
            </label>
            <label>
              Agenda
              <select
                value={followUpTimingFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  onFollowUpTimingFilterChange(e.target.value as FollowUpTimingFilter)
                }
              >
                <option value="all">Todas</option>
                <option value="overdue">Vencidas</option>
                <option value="today">Hoy</option>
                <option value="upcoming">Próximas</option>
                <option value="unscheduled">Sin fecha</option>
              </select>
            </label>
            <label>
              Especialidad
              <select
                value={subnicheFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onSubnicheFilterChange(e.target.value)}
              >
                <option value="all">Todas</option>
                {subnicheSummaries.map((subniche) => (
                  <option key={subniche.label} value={subniche.label}>
                    {subniche.label} ({subniche.total})
                  </option>
                ))}
              </select>
            </label>
            {canFilterByResponsible ? (
              <label>
                Responsable
                <select
                  value={responsibleFilter}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => onResponsibleFilterChange(e.target.value)}
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

          <div className="ops-filter-row">
            <span className="mini-label">Importaciones visibles</span>
            <div className="ops-chip-cluster ops-chip-cluster-v3">
              <button
                className={`ops-compact-chip ${batchFilter === "all" ? "ops-compact-chip-active" : ""}`}
                type="button"
                onClick={() => onBatchFilterChange("all")}
              >
                Todas ({scopeLeadCount})
              </button>
              {batchSummaries.map((batch) => (
                <button
                  key={batch.id}
                  className={`ops-compact-chip ${batchFilter === batch.id ? "ops-compact-chip-active" : ""}`}
                  type="button"
                  onClick={() => onBatchFilterChange(batch.id)}
                >
                  {batch.name} ({batch.total})
                </button>
              ))}
            </div>
          </div>

          {highlightedSubniches.length ? (
            <div className="ops-filter-row">
              <span className="mini-label">Especialidades más visibles</span>
              <div className="ops-chip-cluster ops-chip-cluster-v3 ops-chip-cluster-soft">
                {highlightedSubniches.map((subniche) => (
                  <button
                    key={subniche.label}
                    type="button"
                    className={`ops-static-chip ${
                      subnicheFilter === subniche.label ? "ops-static-chip-active" : ""
                    }`}
                    aria-pressed={subnicheFilter === subniche.label}
                    title={`Filtrar por ${subniche.label}`}
                    onClick={() =>
                      onSubnicheFilterChange(subnicheFilter === subniche.label ? "all" : subniche.label)
                    }
                  >
                    {subniche.label} ({subniche.total})
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="table-wrap ops-table-wrap-wide ops-table-wrap-clean">
          <table>
            <thead>
              <tr>
                <th className="ops-table-select-head" aria-label="Seleccionar">
                  Sel.
                </th>
                <th>Negocio</th>
                <th>Especialidad</th>
                <th>Importacion</th>
                <th>Etapa</th>
                <th>Seguimiento</th>
                {canAssignLeads ? <th>Responsable</th> : null}
                <th>Score</th>
                <th>Contacto</th>
                <th>Web</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length ? (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`${selectedLeadId === lead.id ? "ops-row-active" : ""} ${
                      selectedLeadIdSet.has(lead.id) ? "ops-row-selected" : ""
                    }`}
                    onClick={() => onSelectLead(lead.id)}
                  >
                    <td className="ops-row-select-cell" onClick={(event) => event.stopPropagation()}>
                      <input
                        className="ops-row-checkbox-input"
                        type="checkbox"
                        checked={selectedLeadIdSet.has(lead.id)}
                        aria-label={`Seleccionar ${lead.businessName}`}
                        onChange={() => onToggleLeadSelection(lead.id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td>
                      <strong>{lead.businessName}</strong>
                      <div className="muted">{compactPainPoints(lead.painPoints)}</div>
                    </td>
                    <td>{lead.subniche}</td>
                    <td>{lead.batchName}</td>
                    <td>{labelForStage(lead.stage)}</td>
                    <td>{labelForOpsStatus(lead.opsStatus)}</td>
                    {canAssignLeads ? (
                      <td>{lead.assignedUserId ? teamMemberNameById.get(lead.assignedUserId) || "Asignado" : "Sin asignar"}</td>
                    ) : null}
                    <td>
                      <span className={`badge ${badgeClass(lead.priority)}`}>{lead.score}</span>
                    </td>
                    <td>
                      <div>{lead.email || "Sin email"}</div>
                      <div className="muted">{lead.phone || "Sin teléfono"}</div>
                    </td>
                    <td>
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button button-secondary table-button"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Web
                        </a>
                      ) : (
                        <span className="muted">Sin web</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="button button-secondary table-button"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditLead(lead);
                        }}
                      >
                        Abrir ficha
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canAssignLeads ? 11 : 10}>
                    <div className="empty-state">
                      No hay negocios que coincidan con los filtros actuales en {scopeDescription}.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`ops-bulk-actions ${selectedLeadCount ? "ops-bulk-actions-active" : ""}`}>
          <div className="ops-bulk-actions-head">
            <div className="ops-bulk-actions-copy">
              <span className="mini-label">Operación en lote</span>
              <strong>
                {selectedLeadCount
                  ? `${selectedLeadCount} negocio${selectedLeadCount === 1 ? "" : "s"} seleccionados`
                  : "Selecciona varios negocios"}
              </strong>
              <p>
                {selectedLeadCount
                  ? "Puedes borrarlos juntos o limpiar la selección sin abrir cada ficha."
                  : "Marca filas en la tabla o usa el atajo para preparar acciones rápidas."}
              </p>
            </div>
            <span
              className={`ops-bulk-actions-pill ${selectedLeadCount ? "ops-bulk-actions-pill-active" : ""}`}
              aria-live="polite"
            >
              {selectedLeadCount ? `${selectedLeadCount} activo${selectedLeadCount === 1 ? "" : "s"}` : "0 activos"}
            </span>
          </div>
          {selectedLeadCount ? (
            <div className="ops-bulk-actions-preview">
              <div className="ops-bulk-actions-preview-head">
                <strong>Muestra seleccionada</strong>
                <span className="status-chip status-chip-local">
                  {selectedLeadCount} fila{selectedLeadCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="ops-bulk-actions-preview-list">
                {selectedLeadPreview.map((lead) => (
                  <span className="ops-bulk-actions-preview-item" key={lead.id}>
                    {lead.businessName}
                  </span>
                ))}
                {selectedLeadCount > selectedLeadPreview.length ? (
                  <span className="ops-bulk-actions-preview-item ops-bulk-actions-preview-item-more">
                    +{selectedLeadCount - selectedLeadPreview.length} más
                  </span>
                ) : null}
              </div>
              <p>El botón de borrar abre una tarjeta de confirmación con esta misma selección.</p>
            </div>
          ) : null}
          <div className="ops-button-row ops-bulk-actions-actions">
            <button className="button button-secondary" type="button" onClick={onToggleVisibleLeadSelection}>
              {allVisibleLeadsSelected ? "Quitar visibles" : "Marcar visibles"}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onClearSelectedLeadIds}
              disabled={!hasSelectedVisibleLeads}
            >
              Limpiar selección
            </button>
            {canAssignLeads ? (
              <>
                <label>
                  Responsable
                  <select
                    value={selectedAssignmentUserId}
                    onChange={(event) => onSelectedAssignmentUserIdChange(event.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {teamMembers
                      .filter((member) => member.role === "setter" && member.isActive)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => void onAssignSelectedLeads()}
                  disabled={!hasSelectedVisibleLeads || isSaving}
                >
                  Aplicar responsable
                </button>
              </>
            ) : null}
            {canDeleteLead ? (
              <button
                className="button button-danger"
                type="button"
                onClick={onRequestDeleteSelectedLeads}
                disabled={!hasSelectedVisibleLeads || isSaving}
              >
                Eliminar seleccionados
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}
