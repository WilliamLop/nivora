"use client";

import { useEffect } from "react";
import type { DashboardLead, DashboardStatus } from "@/lib/types";
import { cleanStatusTitle, statusChipClass } from "@/lib/ui-helpers";

type BulkDeleteModalProps = {
  leads: DashboardLead[];
  storageStatus: DashboardStatus;
  isSaving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BulkDeleteModal({
  leads,
  storageStatus,
  isSaving,
  error,
  onCancel,
  onConfirm,
}: BulkDeleteModalProps) {
  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  const previewLeads = leads.slice(0, 3);
  const remainingCount = Math.max(leads.length - previewLeads.length, 0);
  const contactCount = leads.filter((lead) => Boolean(lead.email || lead.phone)).length;
  const hotCount = leads.filter((lead) => lead.priority === "hot").length;

  return (
    <div
      className="ops-delete-modal-backdrop ops-bulk-delete-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <section
        className="panel ops-delete-modal ops-bulk-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
        aria-describedby="bulk-delete-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ops-delete-modal-head">
          <div>
            <p className="mini-label">Operación en lote</p>
            <h3 id="bulk-delete-title">Confirmar eliminación</h3>
          </div>
          <span className="status-chip status-chip-alert">Irreversible</span>
        </div>

        <div className="ops-delete-modal-body">
          <article className="ops-delete-summary-card ops-bulk-delete-summary-card">
            <div className="ops-delete-summary-card-head">
              <div>
                <span className="mini-label">Resumen</span>
                <strong>
                  Vas a eliminar {leads.length} negocio{leads.length === 1 ? "" : "s"}
                </strong>
                <p id="bulk-delete-description">
                  Revisa la muestra antes de confirmar. Esta acción saca los leads seleccionados del CRM
                  y limpia la selección activa.
                </p>
              </div>
              <span className={`status-chip ${statusChipClass(storageStatus.tone)}`}>
                {cleanStatusTitle(storageStatus.title)}
              </span>
            </div>

            <div className="ops-delete-summary-metrics ops-bulk-delete-metrics">
              <article>
                <span>Seleccionados</span>
                <strong>{leads.length}</strong>
              </article>
              <article>
                <span>Con contacto</span>
                <strong>{contactCount}</strong>
              </article>
              <article>
                <span>Alta prioridad</span>
                <strong>{hotCount}</strong>
              </article>
            </div>

            <div className="ops-delete-preview-list">
              {previewLeads.map((lead) => (
                <div className="ops-delete-preview-item" key={lead.id}>
                  {lead.businessName}
                </div>
              ))}
              {remainingCount > 0 ? (
                <div className="ops-delete-preview-item ops-delete-preview-item-more">
                  +{remainingCount} más
                </div>
              ) : null}
            </div>

            <p className="ops-delete-summary-note">
              Si prefieres conservarlos, cancela y vuelve a la tabla para ajustar la selección.
            </p>
          </article>
        </div>

        {error ? <p className="ops-delete-modal-error">{error}</p> : null}

        <div className="ops-delete-modal-actions ops-bulk-delete-modal-actions">
          <button className="button button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </button>
          <button className="button button-danger" type="button" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? "Eliminando..." : `Eliminar ${leads.length} negocio${leads.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </section>
    </div>
  );
}
