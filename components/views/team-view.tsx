"use client";

import { useMemo, useState, type FormEvent } from "react";

import { labelForAppRole } from "@/lib/dashboard";
import type { MarketSummary, SegmentSummary, TeamTrackingSummary } from "@/lib/component-types";
import type { AppRole, SegmentAssignment, TeamMember, WorkspaceFocus } from "@/lib/types";

type TeamViewProps = {
  teamMembers: TeamMember[];
  segmentAssignments: SegmentAssignment[];
  trackingSummaries: TeamTrackingSummary[];
  marketSummaries: MarketSummary[];
  segmentSummaries: SegmentSummary[];
  isSaving: boolean;
  onCreateMember: (input: {
    email: string;
    fullName: string;
    password: string;
    role: AppRole;
  }) => Promise<void>;
  onResetPassword: (memberId: string, password: string) => Promise<void>;
  onCreateAssignment: (input: { userId: string; marketId: string; segmentId: string }) => Promise<void>;
  onDeleteAssignment: (assignmentId: string) => Promise<void>;
  onOpenMemberLeads: (memberId: string, targetFocus?: WorkspaceFocus) => void;
  onOpenMemberOverdueLeads?: (memberId: string, targetFocus?: WorkspaceFocus) => void;
  onOpenMemberTodayLeads?: (memberId: string, targetFocus?: WorkspaceFocus) => void;
  onOpenMemberUnscheduledLeads?: (memberId: string, targetFocus?: WorkspaceFocus) => void;
  onOpenMemberPipeline: (memberId: string, targetFocus?: WorkspaceFocus) => void;
};

type TeamTrackingFilterMode = "all" | "with_load" | "overdue" | "today" | "booked";
type TeamSection = "tracking" | "people" | "assignments";

function formatActivityDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function describeTrackingFilter(mode: TeamTrackingFilterMode) {
  switch (mode) {
    case "with_load":
      return "Solo setters que ya tienen cartera cargada.";
    case "overdue":
      return "Solo setters con seguimientos vencidos.";
    case "today":
      return "Solo setters con agenda para hoy.";
    case "booked":
      return "Solo setters con leads ya agendados.";
    default:
      return "Vista completa del equipo operativo.";
  }
}

function getDaysSinceActivity(value?: string) {
  if (!value) {
    return null;
  }

  const millis = new Date(value).getTime();
  if (!Number.isFinite(millis)) {
    return null;
  }

  const elapsed = Date.now() - millis;
  if (elapsed <= 0) {
    return 0;
  }

  return Math.floor(elapsed / 86_400_000);
}

export function TeamView({
  teamMembers,
  segmentAssignments,
  trackingSummaries,
  marketSummaries,
  segmentSummaries,
  isSaving,
  onCreateMember,
  onResetPassword,
  onCreateAssignment,
  onDeleteAssignment,
  onOpenMemberLeads,
  onOpenMemberOverdueLeads,
  onOpenMemberTodayLeads,
  onOpenMemberUnscheduledLeads,
  onOpenMemberPipeline,
}: TeamViewProps) {
  const [activeSection, setActiveSection] = useState<TeamSection>("tracking");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberFullName, setMemberFullName] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState<AppRole>("setter");
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignmentSegmentId, setAssignmentSegmentId] = useState("");
  const [trackingFilterMode, setTrackingFilterMode] = useState<TeamTrackingFilterMode>("all");
  const [error, setError] = useState("");

  function handleSectionChange(section: TeamSection) {
    setActiveSection(section);
  }

  function handleOpenMemberLeadsFromTracking(memberId: string, targetFocus?: WorkspaceFocus) {
    onOpenMemberLeads(memberId, targetFocus);
  }

  function handleOpenMemberOverdueFromTracking(memberId: string, targetFocus?: WorkspaceFocus) {
    onOpenMemberOverdueLeads?.(memberId, targetFocus);
  }

  function handleOpenMemberTodayFromTracking(memberId: string, targetFocus?: WorkspaceFocus) {
    onOpenMemberTodayLeads?.(memberId, targetFocus);
  }

  function handleOpenMemberUnscheduledFromTracking(memberId: string, targetFocus?: WorkspaceFocus) {
    onOpenMemberUnscheduledLeads?.(memberId, targetFocus);
  }

  function handleOpenMemberPipelineFromTracking(memberId: string, targetFocus?: WorkspaceFocus) {
    onOpenMemberPipeline(memberId, targetFocus);
  }

  const marketNameById = useMemo(
    () => new Map(marketSummaries.map((market) => [market.id, market.name])),
    [marketSummaries]
  );
  const segmentById = useMemo(
    () => new Map(segmentSummaries.map((segment) => [segment.id, segment])),
    [segmentSummaries]
  );
  const assignmentsByUserId = useMemo(() => {
    const map = new Map<string, SegmentAssignment[]>();

    segmentAssignments.forEach((assignment) => {
      const current = map.get(assignment.userId) || [];
      current.push(assignment);
      map.set(assignment.userId, current);
    });

    return map;
  }, [segmentAssignments]);
  const setterMembers = useMemo(
    () => teamMembers.filter((member) => member.role === "setter" && member.isActive),
    [teamMembers]
  );
  const selectedSegment = segmentById.get(assignmentSegmentId) || null;
  const trackingOverview = useMemo(
    () => ({
      activeSetters: trackingSummaries.length,
      settersWithLoad: trackingSummaries.filter((summary) => summary.assignedLeadCount > 0).length,
      overdueTotal: trackingSummaries.reduce((total, summary) => total + summary.overdueCount, 0),
      dueTodayTotal: trackingSummaries.reduce((total, summary) => total + summary.dueTodayCount, 0),
      bookedTotal: trackingSummaries.reduce((total, summary) => total + summary.bookedCount, 0),
    }),
    [trackingSummaries]
  );
  const trackingFilterOptions = useMemo(
    () => [
      { value: "all" as const, label: "Todos", total: trackingSummaries.length },
      {
        value: "with_load" as const,
        label: "Con carga",
        total: trackingSummaries.filter((summary) => summary.assignedLeadCount > 0).length,
      },
      {
        value: "overdue" as const,
        label: "Vencidos",
        total: trackingSummaries.filter((summary) => summary.overdueCount > 0).length,
      },
      {
        value: "today" as const,
        label: "Para hoy",
        total: trackingSummaries.filter((summary) => summary.dueTodayCount > 0).length,
      },
      {
        value: "booked" as const,
        label: "Agendadas",
        total: trackingSummaries.filter((summary) => summary.bookedCount > 0).length,
      },
    ],
    [trackingSummaries]
  );
  const filteredTrackingSummaries = useMemo(() => {
    switch (trackingFilterMode) {
      case "with_load":
        return trackingSummaries.filter((summary) => summary.assignedLeadCount > 0);
      case "overdue":
        return trackingSummaries.filter((summary) => summary.overdueCount > 0);
      case "today":
        return trackingSummaries.filter((summary) => summary.dueTodayCount > 0);
      case "booked":
        return trackingSummaries.filter((summary) => summary.bookedCount > 0);
      default:
        return trackingSummaries;
    }
  }, [trackingSummaries, trackingFilterMode]);
  const trackingQueues = useMemo(
    () => [
      {
        id: "overdue" as const,
        title: "Seguimientos vencidos",
        description: "Setters con agenda pasada que siguen esperando gestión.",
        emptyMessage: "No hay setters con seguimientos vencidos ahora mismo.",
        items: [...trackingSummaries]
          .filter((summary) => summary.overdueCount > 0)
          .sort((left, right) => right.overdueCount - left.overdueCount || left.fullName.localeCompare(right.fullName))
          .slice(0, 6),
      },
      {
        id: "today" as const,
        title: "Por mover hoy",
        description: "Setters con seguimientos fechados para hoy dentro de su cartera.",
        emptyMessage: "No hay seguimientos programados para hoy en este momento.",
        items: [...trackingSummaries]
          .filter((summary) => summary.dueTodayCount > 0)
          .sort((left, right) => right.dueTodayCount - left.dueTodayCount || left.fullName.localeCompare(right.fullName))
          .slice(0, 6),
      },
      {
        id: "booked" as const,
        title: "Agendadas",
        description: "Setters con avances ya movidos a agenda desde la operación.",
        emptyMessage: "Todavía no hay setters con agendas marcadas.",
        items: [...trackingSummaries]
          .filter((summary) => summary.bookedCount > 0)
          .sort((left, right) => right.bookedCount - left.bookedCount || left.fullName.localeCompare(right.fullName))
          .slice(0, 6),
      },
    ],
    [trackingSummaries]
  );
  const trackingExceptions = useMemo(() => {
    const staleDaysThreshold = 3;
    const highLoadThreshold = 20;
    const unscheduledItems = [...trackingSummaries]
      .filter((summary) => summary.unscheduledCount > 0)
      .sort(
        (left, right) =>
          right.unscheduledCount - left.unscheduledCount ||
          right.overdueCount - left.overdueCount ||
          left.fullName.localeCompare(right.fullName)
      )
      .slice(0, 5);
    const staleItems = [...trackingSummaries]
      .map((summary) => ({
        summary,
        staleDays: getDaysSinceActivity(summary.lastOperationalActivityAt),
      }))
      .filter(
        ({ summary, staleDays }) =>
          summary.assignedLeadCount > 0 &&
          summary.actionableLeadCount > 0 &&
          (summary.untouchedCount > 0 || staleDays === null || staleDays >= staleDaysThreshold)
      )
      .sort((left, right) => {
        const leftNeverWorked = !left.summary.lastOperationalActivityAt ? 1 : 0;
        const rightNeverWorked = !right.summary.lastOperationalActivityAt ? 1 : 0;
        if (rightNeverWorked !== leftNeverWorked) {
          return rightNeverWorked - leftNeverWorked;
        }
        if ((right.staleDays ?? -1) !== (left.staleDays ?? -1)) {
          return (right.staleDays ?? -1) - (left.staleDays ?? -1);
        }
        if (right.summary.untouchedCount !== left.summary.untouchedCount) {
          return right.summary.untouchedCount - left.summary.untouchedCount;
        }
        return left.summary.fullName.localeCompare(right.summary.fullName);
      })
      .slice(0, 5);
    const highLoadItems = [...trackingSummaries]
      .filter((summary) => summary.assignedLeadCount >= highLoadThreshold)
      .sort(
        (left, right) =>
          right.assignedLeadCount - left.assignedLeadCount ||
          right.overdueCount - left.overdueCount ||
          left.fullName.localeCompare(right.fullName)
      )
      .slice(0, 5);

    return [
      {
        id: "unscheduled" as const,
        title: "Sin próxima fecha",
        description: "Leads activos que siguen asignados, pero no tienen próximo seguimiento cargado.",
        total: trackingSummaries.reduce((total, summary) => total + summary.unscheduledCount, 0),
        emptyMessage: "No hay setters con cartera activa sin próxima fecha.",
        items: unscheduledItems,
      },
      {
        id: "stale" as const,
        title: "Sin movimiento reciente",
        description: "Setters con cartera activa sin gestión reciente o todavía sin tocar.",
        total: staleItems.length,
        emptyMessage: "No hay setters con cartera parada en este momento.",
        items: staleItems,
      },
      {
        id: "high_load" as const,
        title: "Carga alta",
        description: `Setters con ${highLoadThreshold}+ leads asignados y carga suficiente para vigilar balance.`,
        total: highLoadItems.length,
        emptyMessage: "No hay setters en carga alta con el umbral actual.",
        items: highLoadItems,
      },
    ];
  }, [trackingSummaries]);
  const teamOverview = useMemo(
    () => ({
      activeUsers: teamMembers.filter((member) => member.isActive).length,
      adminCount: teamMembers.filter((member) => member.role === "admin").length,
      setterCount: setterMembers.length,
      pendingPasswordCount: teamMembers.filter((member) => member.mustChangePassword).length,
      assignmentCount: segmentAssignments.length,
      settersWithoutAssignments: setterMembers.filter((member) => !(assignmentsByUserId.get(member.id) || []).length).length,
    }),
    [teamMembers, setterMembers, segmentAssignments, assignmentsByUserId]
  );
  const sortedTeamMembers = useMemo(
    () =>
      [...teamMembers].sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === "admin" ? -1 : 1;
        }
        return left.fullName.localeCompare(right.fullName);
      }),
    [teamMembers]
  );

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await onCreateMember({
        email: memberEmail.trim(),
        fullName: memberFullName.trim(),
        password: memberPassword.trim(),
        role: memberRole,
      });
      setMemberEmail("");
      setMemberFullName("");
      setMemberPassword("");
      setMemberRole("setter");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pude crear el usuario.");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await onResetPassword(resetUserId, resetPassword.trim());
      setResetPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pude resetear la contraseña.");
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!assignmentUserId || !selectedSegment) {
      setError("Elige un setter y un nicho para guardar la asignación.");
      return;
    }

    try {
      await onCreateAssignment({
        userId: assignmentUserId,
        marketId: selectedSegment.marketId,
        segmentId: selectedSegment.id,
      });
      setAssignmentSegmentId("");
      handleSectionChange("assignments");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pude guardar la asignación.");
    }
  }

  async function handleDeleteAssignment(assignmentId: string) {
    setError("");

    try {
      await onDeleteAssignment(assignmentId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pude quitar la asignación.");
    }
  }

  return (
    <section className="ops-view ops-view-v3 team-shell">
      <section className="panel ops-card team-hub-card">
        <div className="ops-section-head team-hub-head">
          <div>
            <p className="mini-label">Equipo</p>
            <h3>Centro de control del equipo</h3>
            <p className="muted ops-inline-note">
              Separa operación, personas y asignaciones para que el equipo no se vuelva una pantalla infinita.
            </p>
          </div>
          <div className="ops-chip-row team-hub-chips">
            <span className="status-chip status-chip-local">{teamOverview.activeUsers} usuarios activos</span>
            <span className="status-chip status-chip-waiting">{teamOverview.pendingPasswordCount} con cambio pendiente</span>
            <span className="status-chip status-chip-cloud">{teamOverview.assignmentCount} asignaciones activas</span>
          </div>
        </div>

        <div className="team-section-tabs" role="tablist" aria-label="Secciones de equipo">
          <button
            className={`team-section-tab ${activeSection === "tracking" ? "team-section-tab-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeSection === "tracking"}
            onClick={() => handleSectionChange("tracking")}
          >
            <span className="mini-label">Operación</span>
            <strong>Seguimiento</strong>
            <small>{trackingOverview.activeSetters} setters activos</small>
          </button>
          <button
            className={`team-section-tab ${activeSection === "people" ? "team-section-tab-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeSection === "people"}
            onClick={() => handleSectionChange("people")}
          >
            <span className="mini-label">Accesos</span>
            <strong>Personas y accesos</strong>
            <small>{teamOverview.activeUsers} usuarios en el CRM</small>
          </button>
          <button
            className={`team-section-tab ${activeSection === "assignments" ? "team-section-tab-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeSection === "assignments"}
            onClick={() => handleSectionChange("assignments")}
          >
            <span className="mini-label">Enrutamiento</span>
            <strong>Asignaciones</strong>
            <small>{teamOverview.assignmentCount} nichos repartidos</small>
          </button>
        </div>

        {error ? <p className="ops-city-error">{error}</p> : null}

        {activeSection === "tracking" ? (
          <div className="team-section-stack">
            <div className="ops-catalog-grid team-tracking-overview">
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Setters activos</strong>
                  <span className="status-chip status-chip-local">{trackingOverview.activeSetters}</span>
                </div>
                <p>{trackingOverview.settersWithLoad} ya tienen leads asignados para trabajar.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Seguimientos vencidos</strong>
                  <span className="status-chip status-chip-alert">{trackingOverview.overdueTotal}</span>
                </div>
                <p>Leads con próxima fecha pasada que necesitan reacción del equipo.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Por mover hoy</strong>
                  <span className="status-chip status-chip-waiting">{trackingOverview.dueTodayTotal}</span>
                </div>
                <p>Seguimientos fechados para hoy en toda la operación.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Agendadas</strong>
                  <span className="status-chip status-chip-cloud">{trackingOverview.bookedTotal}</span>
                </div>
                <p>Leads con avance a agenda ya marcado desde la operación.</p>
              </article>
            </div>

            <div className="ops-catalog-grid team-focus-lanes">
              {trackingQueues.map((queue) => (
                <article className="ops-mini-card team-focus-lane" key={queue.id}>
                  <div className="ops-mini-card-head">
                    <strong>{queue.title}</strong>
                    <span className="status-chip status-chip-local">
                      {queue.items.reduce((total, summary) => {
                        if (queue.id === "overdue") return total + summary.overdueCount;
                        if (queue.id === "today") return total + summary.dueTodayCount;
                        return total + summary.bookedCount;
                      }, 0)}
                    </span>
                  </div>
                  <p>{queue.description}</p>

                  <div className="team-focus-list">
                    {queue.items.length ? (
                      queue.items.map((summary) => {
                        const count =
                          queue.id === "overdue"
                            ? summary.overdueCount
                            : queue.id === "today"
                              ? summary.dueTodayCount
                              : summary.bookedCount;

                        return (
                          <article className="ops-agenda-card team-focus-item" key={`${queue.id}-${summary.memberId}`}>
                            <div className="team-focus-item-copy">
                              <strong>{summary.fullName}</strong>
                              <p>{summary.primaryScopeLabel || "Sin foco operativo sugerido todavía."}</p>
                              <span className="mini-label">
                                {summary.lastActivityAt
                                  ? `Último movimiento ${formatActivityDate(summary.lastActivityAt)}`
                                  : "Sin actividad reciente"}
                              </span>
                            </div>
                            <div className="team-focus-item-actions">
                              <span
                                className={`status-chip ${
                                  queue.id === "overdue"
                                    ? "status-chip-alert"
                                    : queue.id === "today"
                                      ? "status-chip-waiting"
                                      : "status-chip-cloud"
                                }`}
                              >
                                {count}{" "}
                                {queue.id === "overdue"
                                  ? "vencidos"
                                  : queue.id === "today"
                                    ? "para hoy"
                                    : "agendadas"}
                              </span>

                              {queue.id === "overdue" ? (
                                <button
                                  className="button button-secondary table-button"
                                  type="button"
                                  onClick={() =>
                                    handleOpenMemberOverdueFromTracking(summary.memberId, summary.targetFocus)
                                  }
                                >
                                  Abrir vencidos
                                </button>
                              ) : queue.id === "today" ? (
                                <button
                                  className="button button-secondary table-button"
                                  type="button"
                                  onClick={() =>
                                    handleOpenMemberTodayFromTracking(summary.memberId, summary.targetFocus)
                                  }
                                >
                                  Abrir agenda
                                </button>
                              ) : (
                                <button
                                  className="button button-secondary table-button"
                                  type="button"
                                  onClick={() =>
                                    handleOpenMemberPipelineFromTracking(summary.memberId, summary.targetFocus)
                                  }
                                >
                                  Ver pipeline
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="empty-state compact-empty">{queue.emptyMessage}</div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="ops-catalog-grid team-exception-lanes">
              {trackingExceptions.map((lane) => (
                <article className="ops-mini-card team-exception-lane" key={lane.id}>
                  <div className="ops-mini-card-head">
                    <strong>{lane.title}</strong>
                    <span className="status-chip status-chip-local">{lane.total}</span>
                  </div>
                  <p>{lane.description}</p>

                  <div className="team-exception-list">
                    {lane.items.length ? (
                      lane.id === "stale" ? (
                        lane.items.map(({ summary, staleDays }) => {
                          const staleLabel =
                            staleDays === null
                              ? `Todavía sin gestión real sobre ${summary.untouchedCount || summary.actionableLeadCount} lead${
                                  summary.untouchedCount === 1 || summary.actionableLeadCount === 1 ? "" : "s"
                                }.`
                              : staleDays === 0
                                ? "Tuvo movimiento operativo hoy."
                                : `Sin mover hace ${staleDays} día${staleDays === 1 ? "" : "s"}.`;

                          return (
                            <article className="ops-agenda-card team-exception-item" key={`${lane.id}-${summary.memberId}`}>
                              <div className="team-exception-copy">
                                <strong>{summary.fullName}</strong>
                                <p>{summary.primaryScopeLabel || "Sin foco operativo sugerido todavía."}</p>
                                <span className="mini-label">{staleLabel}</span>
                              </div>
                              <div className="team-exception-actions">
                                <span
                                  className={`status-chip ${
                                    staleDays === null ? "status-chip-alert" : "status-chip-waiting"
                                  }`}
                                >
                                  {staleDays === null ? "Sin gestión" : `${staleDays} días`}
                                </span>
                                <button
                                  className="button button-secondary table-button"
                                  type="button"
                                  onClick={() =>
                                    handleOpenMemberLeadsFromTracking(summary.memberId, summary.targetFocus)
                                  }
                                >
                                  Abrir cartera
                                </button>
                              </div>
                            </article>
                          );
                        })
                      ) : lane.id === "unscheduled" ? (
                        lane.items.map((summary) => (
                          <article className="ops-agenda-card team-exception-item" key={`${lane.id}-${summary.memberId}`}>
                            <div className="team-exception-copy">
                              <strong>{summary.fullName}</strong>
                              <p>{summary.primaryScopeLabel || "Sin foco operativo sugerido todavía."}</p>
                              <span className="mini-label">
                                {summary.unscheduledCount} lead{summary.unscheduledCount === 1 ? "" : "s"} activos sin
                                próxima fecha.
                              </span>
                            </div>
                            <div className="team-exception-actions">
                              <span className="status-chip status-chip-alert">{summary.unscheduledCount} sin fecha</span>
                              <button
                                className="button button-secondary table-button"
                                type="button"
                                onClick={() =>
                                  handleOpenMemberUnscheduledFromTracking(summary.memberId, summary.targetFocus)
                                }
                              >
                                Abrir cartera
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        lane.items.map((summary) => (
                          <article className="ops-agenda-card team-exception-item" key={`${lane.id}-${summary.memberId}`}>
                            <div className="team-exception-copy">
                              <strong>{summary.fullName}</strong>
                              <p>{summary.primaryScopeLabel || "Sin foco operativo sugerido todavía."}</p>
                              <span className="mini-label">
                                {summary.overdueCount} vencidos · {summary.dueTodayCount} para hoy ·{" "}
                                {summary.hotLeadCount} calientes.
                              </span>
                            </div>
                            <div className="team-exception-actions">
                              <span className="status-chip status-chip-waiting">{summary.assignedLeadCount} cartera</span>
                              <button
                                className="button button-secondary table-button"
                                type="button"
                                onClick={() =>
                                  handleOpenMemberPipelineFromTracking(summary.memberId, summary.targetFocus)
                                }
                              >
                                Ver pipeline
                              </button>
                            </div>
                          </article>
                        ))
                      )
                    ) : (
                      <div className="empty-state compact-empty">{lane.emptyMessage}</div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="ops-button-row team-tracking-filter-row">
              {trackingFilterOptions.map((option) => (
                <button
                  key={option.value}
                  className={`button ${
                    trackingFilterMode === option.value ? "button-primary" : "button-secondary"
                  } table-button`}
                  type="button"
                  onClick={() => setTrackingFilterMode(option.value)}
                >
                  {option.label} ({option.total})
                </button>
              ))}
            </div>

            <div className="team-tracking-layout">
              <section className="team-surface-card team-tracking-rail">
                <div className="ops-section-head">
                  <div>
                    <p className="mini-label">Vista compacta</p>
                    <h3>Setters en operación</h3>
                    <p className="muted ops-inline-note">{describeTrackingFilter(trackingFilterMode)}</p>
                  </div>
                  <span className="status-chip status-chip-local">Acciones directas</span>
                </div>

                <div className="team-tracking-list">
                  {filteredTrackingSummaries.length ? (
                    filteredTrackingSummaries.map((summary) => {
                      return (
                        <article key={summary.memberId} className="team-tracking-list-item">
                          <div className="team-tracking-list-primary">
                            <strong>{summary.fullName}</strong>
                            <p>{summary.primaryScopeLabel || "Sin foco operativo sugerido"}</p>
                          </div>
                          <div className="team-tracking-list-stats">
                            <span className="status-chip status-chip-local">{summary.assignedLeadCount} cartera</span>
                            <span className="status-chip status-chip-alert">{summary.overdueCount} venc.</span>
                            <span className="status-chip status-chip-waiting">{summary.dueTodayCount} hoy</span>
                            <span className="status-chip status-chip-cloud">{summary.bookedCount} agend.</span>
                          </div>
                          <div className="team-tracking-list-secondary">
                            <span>{summary.lastActivityLeadName || "Sin actividad registrada"}</span>
                            <span className="mini-label">
                              {summary.lastActivityAt
                                ? formatActivityDate(summary.lastActivityAt)
                                : "Sin fecha reciente"}
                            </span>
                          </div>
                          <div className="team-tracking-list-actions">
                            <button
                              className="button button-secondary table-button"
                              type="button"
                              onClick={() => handleOpenMemberLeadsFromTracking(summary.memberId, summary.targetFocus)}
                            >
                              Abrir cartera
                            </button>
                            <button
                              className="button button-primary table-button"
                              type="button"
                              onClick={() => handleOpenMemberPipelineFromTracking(summary.memberId, summary.targetFocus)}
                            >
                              Ver pipeline
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-state">
                      {trackingSummaries.length
                        ? "Ningún setter coincide con el filtro actual."
                        : "Todavía no hay setters activos para supervisar."}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {activeSection === "people" ? (
          <div className="team-section-stack">
            <div className="ops-catalog-grid team-admin-overview">
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Usuarios activos</strong>
                  <span className="status-chip status-chip-local">{teamOverview.activeUsers}</span>
                </div>
                <p>{teamMembers.length} personas cargadas en el CRM interno.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Admins</strong>
                  <span className="status-chip status-chip-cloud">{teamOverview.adminCount}</span>
                </div>
                <p>Usuarios con control total sobre la operación y configuración.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Setters</strong>
                  <span className="status-chip status-chip-local">{teamOverview.setterCount}</span>
                </div>
                <p>{teamOverview.settersWithoutAssignments} todavía no tienen nichos activos asignados.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Cambios pendientes</strong>
                  <span className="status-chip status-chip-waiting">{teamOverview.pendingPasswordCount}</span>
                </div>
                <p>Usuarios que deberían renovar su contraseña temporal en el siguiente acceso.</p>
              </article>
            </div>

            <div className="team-admin-layout">
              <div className="team-panel-stack">
                <section className="team-surface-card">
                  <div className="ops-section-head">
                    <div>
                      <p className="mini-label">Alta rápida</p>
                      <h3>Crear usuario</h3>
                    </div>
                  </div>

                  <form className="ops-editor-form" onSubmit={handleCreateMember}>
                    <div className="ops-editor-grid ops-editor-grid-tight">
                      <label>
                        Nombre completo
                        <input
                          value={memberFullName}
                          onChange={(event) => setMemberFullName(event.target.value)}
                          placeholder="Laura Moreno"
                          required
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={memberEmail}
                          onChange={(event) => setMemberEmail(event.target.value)}
                          placeholder="laura@equipo.com"
                          required
                        />
                      </label>
                      <label>
                        Contraseña temporal
                        <input
                          type="text"
                          value={memberPassword}
                          onChange={(event) => setMemberPassword(event.target.value)}
                          placeholder="Setter2026!"
                          required
                        />
                      </label>
                      <label>
                        Rol
                        <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as AppRole)}>
                          <option value="setter">Setter</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    </div>

                    <div className="ops-button-row">
                      <button className="button button-primary" type="submit" disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Crear usuario"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="team-surface-card">
                  <div className="ops-section-head">
                    <div>
                      <p className="mini-label">Acceso</p>
                      <h3>Resetear contraseña temporal</h3>
                    </div>
                  </div>

                  <form className="ops-editor-form" onSubmit={handleResetPassword}>
                    <div className="ops-editor-grid ops-editor-grid-tight">
                      <label>
                        Usuario
                        <select
                          value={resetUserId}
                          onChange={(event) => setResetUserId(event.target.value)}
                          required
                        >
                          <option value="">Selecciona un usuario</option>
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.fullName} · {member.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Nueva contraseña temporal
                        <input
                          type="text"
                          value={resetPassword}
                          onChange={(event) => setResetPassword(event.target.value)}
                          placeholder="Equipo2026!"
                          required
                        />
                      </label>
                    </div>

                    <div className="ops-button-row">
                      <button
                        className="button button-secondary"
                        type="submit"
                        disabled={isSaving || !resetUserId || !resetPassword.trim()}
                      >
                        Resetear contraseña
                      </button>
                    </div>
                  </form>
                </section>
              </div>

              <section className="team-surface-card team-directory-card">
                <div className="ops-section-head">
                  <div>
                    <p className="mini-label">Directorio</p>
                    <h3>Personas del equipo</h3>
                    <p className="muted ops-inline-note">
                      Aquí ves el rol, el estado y el nivel de carga de cada persona sin mezclarlo con la operación.
                    </p>
                  </div>
                </div>

                <div className="team-directory-list">
                  {sortedTeamMembers.length ? (
                    sortedTeamMembers.map((member) => {
                      const memberAssignments = assignmentsByUserId.get(member.id) || [];

                      return (
                        <article className="team-member-row" key={member.id}>
                          <div className="team-member-row-main">
                            <span className="mini-label">{labelForAppRole(member.role)}</span>
                            <strong>{member.fullName}</strong>
                            <p>{member.email}</p>
                          </div>
                          <div className="team-member-row-status">
                            <span className={`status-chip ${member.isActive ? "status-chip-cloud" : "status-chip-alert"}`}>
                              {member.isActive ? "Activo" : "Inactivo"}
                            </span>
                            {member.mustChangePassword ? (
                              <span className="status-chip status-chip-waiting">Cambio pendiente</span>
                            ) : null}
                          </div>
                          <div className="team-member-row-meta">
                            {memberAssignments.length ? (
                              <>
                                <span className="status-chip status-chip-local">
                                  {memberAssignments.length} nicho{memberAssignments.length === 1 ? "" : "s"}
                                </span>
                                <div className="ops-chip-row">
                                  {memberAssignments.slice(0, 2).map((assignment) => {
                                    const segment = segmentById.get(assignment.segmentId);
                                    const marketName = marketNameById.get(assignment.marketId) || assignment.marketId;

                                    return (
                                      <span className="status-chip status-chip-local" key={assignment.id}>
                                        {marketName} / {segment?.name || assignment.segmentId}
                                      </span>
                                    );
                                  })}
                                  {memberAssignments.length > 2 ? (
                                    <span className="status-chip status-chip-local">
                                      +{memberAssignments.length - 2} más
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <span className="status-chip status-chip-alert">Sin nichos asignados todavía</span>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-state">Todavía no hay usuarios creados en el equipo.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {activeSection === "assignments" ? (
          <div className="team-section-stack">
            <div className="ops-catalog-grid team-admin-overview">
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Asignaciones activas</strong>
                  <span className="status-chip status-chip-local">{teamOverview.assignmentCount}</span>
                </div>
                <p>Nichos ya repartidos para que la autoasignación y la supervisión tengan contexto.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Setters sin nicho</strong>
                  <span className="status-chip status-chip-alert">{teamOverview.settersWithoutAssignments}</span>
                </div>
                <p>Personas que aún no tienen una regla activa de enrutamiento por nicho.</p>
              </article>
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Nichos disponibles</strong>
                  <span className="status-chip status-chip-local">{segmentSummaries.length}</span>
                </div>
                <p>Catálogo actual de nichos operativos que puedes repartir al equipo.</p>
              </article>
            </div>

            <div className="team-assignment-layout">
              <section className="team-surface-card">
                <div className="ops-section-head">
                  <div>
                    <p className="mini-label">Enrutamiento</p>
                    <h3>Asignar nicho a setter</h3>
                  </div>
                </div>

                <form className="ops-editor-form" onSubmit={handleCreateAssignment}>
                  <div className="ops-editor-grid ops-editor-grid-tight">
                    <label>
                      Setter
                      <select
                        value={assignmentUserId}
                        onChange={(event) => setAssignmentUserId(event.target.value)}
                        required
                      >
                        <option value="">Selecciona un setter</option>
                        {setterMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nicho
                      <select
                        value={assignmentSegmentId}
                        onChange={(event) => setAssignmentSegmentId(event.target.value)}
                        required
                      >
                        <option value="">Selecciona un nicho</option>
                        {segmentSummaries.map((segment) => (
                          <option key={segment.id} value={segment.id}>
                            {marketNameById.get(segment.marketId) || segment.marketId} / {segment.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="ops-button-row">
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={isSaving || !assignmentUserId || !assignmentSegmentId}
                    >
                      Guardar asignación
                    </button>
                  </div>
                </form>
              </section>

              <section className="team-surface-card team-assignment-directory">
                <div className="ops-section-head">
                  <div>
                    <p className="mini-label">Mapa actual</p>
                    <h3>Asignaciones por persona</h3>
                    <p className="muted ops-inline-note">
                      Gestiona el reparto activo sin mezclarlo con la lista general de usuarios.
                    </p>
                  </div>
                </div>

                <div className="team-assignment-list">
                  {sortedTeamMembers.length ? (
                    sortedTeamMembers.map((member) => {
                      const memberAssignments = assignmentsByUserId.get(member.id) || [];

                      return (
                        <article className="team-assignment-group" key={member.id}>
                          <div className="ops-city-card-head">
                            <div>
                              <span className="mini-label">{labelForAppRole(member.role)}</span>
                              <strong>{member.fullName}</strong>
                              <p className="ops-city-card-meta">{member.email}</p>
                            </div>
                            <span className="status-chip status-chip-local">
                              {memberAssignments.length} asignación{memberAssignments.length === 1 ? "" : "es"}
                            </span>
                          </div>

                          {memberAssignments.length ? (
                            <div className="ops-stack">
                              {memberAssignments.map((assignment) => {
                                const segment = segmentById.get(assignment.segmentId);
                                const marketName = marketNameById.get(assignment.marketId) || assignment.marketId;

                                return (
                                  <article className="ops-agenda-card" key={assignment.id}>
                                    <div className="ops-section-head">
                                      <div>
                                        <strong>{segment?.name || assignment.segmentId}</strong>
                                        <p>{marketName}</p>
                                      </div>
                                      <button
                                        className="button button-secondary table-button"
                                        type="button"
                                        onClick={() => void handleDeleteAssignment(assignment.id)}
                                        disabled={isSaving}
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="empty-state compact-empty">Sin nichos asignados todavía.</div>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-state">Todavía no hay usuarios creados en el equipo.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
