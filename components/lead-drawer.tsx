"use client";

import { useEffect, type ChangeEvent, type FormEvent } from "react";
import { STAGES, labelForOpsStatus, labelForStage } from "@/lib/dashboard";
import type { DashboardLead, LeadActivity, OpsStatus, Stage, TeamMember } from "@/lib/types";
import type { LeadEditorMode, LeadEditorState } from "@/lib/component-types";
import { badgeClass } from "@/lib/ui-helpers";

type LeadDrawerProps = {
  mode: LeadEditorMode;
  state: LeadEditorState;
  selectedLead: DashboardLead | null;
  isSaving: boolean;
  leadActivities?: LeadActivity[];
  isLoadingActivities?: boolean;
  leadActivitiesError?: string;
  teamMembers?: TeamMember[];
  canManageAssignment?: boolean;
  onUpdate: <K extends keyof LeadEditorState>(field: K, value: LeadEditorState[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onClose: () => void;
  onDelete: () => void;
};

export function LeadDrawer({
  mode,
  state,
  selectedLead,
  isSaving,
  leadActivities = [],
  isLoadingActivities = false,
  leadActivitiesError = "",
  teamMembers = [],
  canManageAssignment = false,
  onUpdate,
  onSubmit,
  onCancel,
  onClose,
  onDelete,
}: LeadDrawerProps) {
  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function field<K extends keyof LeadEditorState>(
    key: K,
    handler?: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  ) {
    return {
      value: state[key] as string,
      onChange: handler ?? ((e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        onUpdate(key, e.target.value as LeadEditorState[K])),
    };
  }

  const isOperationalOnly = mode === "ops";
  const submitLabel =
    mode === "create" ? "Crear lead" : isOperationalOnly ? "Guardar seguimiento" : "Actualizar lead";
  const resetLabel = mode === "create" ? "Limpiar formulario" : isOperationalOnly ? "Restaurar seguimiento" : "Restaurar ficha";

  function labelForActivityType(activityType: LeadActivity["activityType"]) {
    switch (activityType) {
      case "call":
        return "Llamada";
      case "whatsapp":
        return "WhatsApp";
      case "email":
        return "Email";
      case "assignment_change":
        return "Cambio de responsable";
      case "stage_change":
        return "Cambio de etapa";
      default:
        return "Nota";
    }
  }

  function labelForActivityOutcome(activity: LeadActivity) {
    if (!activity.outcome) {
      return "";
    }

    if (activity.outcome === "assigned") {
      return "Asignado";
    }

    if (activity.outcome === "unassigned") {
      return "Liberado";
    }

    if (activity.activityType === "stage_change") {
      return labelForStage(activity.outcome as Stage);
    }

    const normalizedOpsStatus = activity.outcome as OpsStatus;
    if (
      [
        "pending",
        "no_answer",
        "contacted",
        "callback_requested",
        "interested",
        "booked",
        "not_interested",
        "do_not_contact",
      ].includes(normalizedOpsStatus)
    ) {
      return labelForOpsStatus(normalizedOpsStatus);
    }

    return activity.outcome;
  }

  function formatActivityDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  return (
    <div className="ops-drawer-backdrop ops-lead-drawer-backdrop" onClick={onClose}>
      <section
        className="panel ops-drawer ops-lead-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Nuevo lead" : isOperationalOnly ? "Seguimiento del lead" : "Editar lead"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ops-drawer-head ops-lead-drawer-head">
          <div>
            <p className="mini-label">
              {mode === "create" ? "Nuevo lead" : isOperationalOnly ? "Seguimiento operativo" : "Editar lead"}
            </p>
            <h3>
              {mode === "create"
                ? "Cargar negocio al CRM"
                : isOperationalOnly
                  ? "Registrar gestión del lead"
                  : "Ficha comercial"}
            </h3>
          </div>
          <div className="ops-button-row">
            {selectedLead && mode !== "create" ? (
              <span className={`badge ${badgeClass(selectedLead.priority)}`}>
                Score {selectedLead.score}
              </span>
            ) : null}
            <button className="button button-secondary" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Form */}
        <form className="ops-editor-form ops-lead-drawer-form" onSubmit={onSubmit}>
          {isOperationalOnly ? (
            <>
              {selectedLead ? (
                <section className="ops-summary-grid ops-summary-grid-v3">
                  <article className="ops-summary-card">
                    <span>Negocio</span>
                    <strong>{selectedLead.businessName}</strong>
                    <p>
                      {selectedLead.city} / {selectedLead.niche} / {selectedLead.subniche}
                    </p>
                  </article>
                  <article className="ops-summary-card">
                    <span>Etapa comercial</span>
                    <strong>{labelForStage(selectedLead.stage)}</strong>
                    <p>El stage solo sube a agendada cuando realmente confirmas la llamada.</p>
                  </article>
                  <article className="ops-summary-card">
                    <span>Estado operativo</span>
                    <strong>{labelForOpsStatus(selectedLead.opsStatus)}</strong>
                    <p>{selectedLead.lastActivitySummary || "Aún no hay una gestión resumida en el lead."}</p>
                  </article>
                </section>
              ) : null}

              <div className="ops-drawer-grid ops-lead-drawer-grid">
                <label>
                  Teléfono
                  <input type="tel" {...field("phone")} placeholder="+57 300..." />
                </label>
                <label>
                  Email
                  <input type="email" {...field("email")} placeholder="hola@negocio.com" />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="ops-drawer-grid ops-lead-drawer-grid">
                <label>
                  Negocio
                  <input {...field("businessName")} placeholder="Clinica Dental Norte" required />
                </label>
                <label>
                  Ciudad
                  <input {...field("city")} placeholder="Tunja" required />
                </label>
                <label>
                  Nicho principal
                  <input {...field("niche")} placeholder="Odontologia" required />
                </label>
                <label>
                  Especialidad
                  <input {...field("subniche")} placeholder="Endodoncista" required />
                </label>
                <label>
                  Importacion
                  <input {...field("batchName")} placeholder="Importacion marzo" required />
                </label>
                <label>
                  Oferta
                  <input {...field("offerType")} placeholder="Landing + automatizacion" required />
                </label>
                <label>
                  Telefono
                  <input type="tel" {...field("phone")} placeholder="+57 300..." />
                </label>
                <label>
                  Email
                  <input type="email" {...field("email")} placeholder="hola@negocio.com" />
                </label>
                <label>
                  Sitio web
                  <input type="url" {...field("website")} placeholder="https://negocio.com" />
                </label>
                <label>
                  Fuente
                  <input {...field("source")} placeholder="Google Maps export" />
                </label>
                <label>
                  Estado del sitio
                  <select {...field("websiteStatus")}>
                    <option value="none">No tiene sitio</option>
                    <option value="weak">Sitio debil o viejo</option>
                    <option value="strong">Tiene sitio aceptable</option>
                  </select>
                </label>
                <label>
                  Presencia digital
                  <select {...field("digitalPresence")}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
                <label>
                  Etapa
                  <select
                    value={state.stage}
                    onChange={(e) => onUpdate("stage", e.target.value as Stage)}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ultimo contacto
                  <input type="date" {...field("lastTouch")} />
                </label>
              </div>

              <div className="ops-lead-drawer-notes">
                <label>
                  Pain points
                  <textarea
                    rows={4}
                    {...field("painPointsInput")}
                    placeholder="Sin CTA visible | Web antigua | Sin automatizacion"
                  />
                </label>

                <label>
                  Notas internas
                  <textarea
                    rows={5}
                    {...field("notes")}
                    placeholder="Buen candidato para mostrar demo de funnel y agenda automatizada"
                  />
                </label>
              </div>
            </>
          )}

          <div className="ops-drawer-grid ops-lead-drawer-grid">
            <label>
              Estado operativo
              <select {...field("opsStatus")}>
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
              Próximo seguimiento
              <input type="date" {...field("nextFollowUpAt")} />
            </label>
            {canManageAssignment ? (
              <label>
                Asignado a
                <select {...field("assignedUserId")}>
                  <option value="">Sin asignar</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="ops-lead-drawer-notes">
            <label>
              Resumen de gestión
              <textarea
                rows={4}
                {...field("lastActivitySummary")}
                placeholder="Llamé, pidió devolver la llamada el jueves después de las 3pm."
                required={isOperationalOnly}
              />
            </label>
          </div>

          <div className="ops-button-row ops-lead-drawer-actions">
            <button className="button button-primary" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : submitLabel}
            </button>
            <button className="button button-secondary" type="button" onClick={onCancel}>
              {resetLabel}
            </button>
            {mode === "edit" ? (
              <button
                className="button button-danger"
                type="button"
                onClick={onDelete}
                disabled={isSaving}
              >
                Eliminar
              </button>
            ) : null}
          </div>

          {mode !== "create" ? (
            <section className="ops-stack">
              <div className="ops-section-head">
                <div>
                  <p className="mini-label">Timeline</p>
                  <h3>Historial del lead</h3>
                </div>
                {isLoadingActivities ? (
                  <span className="status-chip status-chip-waiting">Cargando</span>
                ) : null}
              </div>

              {leadActivitiesError ? <p className="ops-city-error">{leadActivitiesError}</p> : null}

              {leadActivities.length ? (
                <div className="ops-stack">
                  {leadActivities.map((activity) => {
                    const activityOutcome = labelForActivityOutcome(activity);

                    return (
                      <article className="ops-agenda-card" key={activity.id}>
                        <div className="ops-section-head">
                          <div>
                            <strong>{labelForActivityType(activity.activityType)}</strong>
                            <p>
                              {activity.userName} · {formatActivityDate(activity.createdAt)}
                            </p>
                          </div>
                          {activityOutcome ? (
                            <span className="status-chip status-chip-local">{activityOutcome}</span>
                          ) : null}
                        </div>
                        <p>{activity.summary}</p>
                        {activity.nextFollowUpAt ? (
                          <p>Próximo seguimiento: {activity.nextFollowUpAt}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : !isLoadingActivities ? (
                <div className="empty-state compact-empty">Todavía no hay actividades registradas.</div>
              ) : null}
            </section>
          ) : null}
        </form>
      </section>
    </div>
  );
}
