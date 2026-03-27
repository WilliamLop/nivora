"use client";

import type { ProposalScopeMode, SegmentSummary } from "@/lib/component-types";
import type { DashboardLead, ProposalCopy } from "@/lib/types";

type Proposal = ProposalCopy;

function normalizeColombiaPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57")) return digits;
  return digits.length <= 10 ? `57${digits}` : digits;
}

function buildWhatsappHref(phone: string, message: string) {
  const normalizedPhone = normalizeColombiaPhone(phone);
  if (!normalizedPhone) return "";
  const text = message.trim();
  return text
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${normalizedPhone}`;
}

function buildMailtoHref(email: string, draft: string, fallbackSubject: string) {
  if (!email.trim()) return "";

  const normalizedDraft = draft.trim();
  const lines = normalizedDraft.split(/\r?\n/);
  const firstLine = lines[0] || "";
  const hasSubject = firstLine.toLowerCase().startsWith("asunto:");
  const subject = hasSubject ? firstLine.slice(firstLine.indexOf(":") + 1).trim() : fallbackSubject;
  const body = (hasSubject ? lines.slice(1) : lines).join("\n").trim() || normalizedDraft;

  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);

  const query = params.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}

function buildTelHref(phone: string) {
  const normalizedPhone = normalizeColombiaPhone(phone);
  return normalizedPhone ? `tel:+${normalizedPhone}` : "";
}

type ProposalActionCardProps = {
  title: string;
  helperText: string;
  message: string;
  actionLabel: string;
  disabledLabel: string;
  badge?: string;
  href: string;
  variant?: "primary" | "secondary";
  openInNewTab?: boolean;
};

function ProposalActionCard({
  title,
  helperText,
  message,
  actionLabel,
  disabledLabel,
  badge,
  href,
  variant = "secondary",
  openInNewTab = false,
}: ProposalActionCardProps) {
  const buttonClassName = `button ${variant === "primary" ? "button-primary" : "button-secondary"}`;

  return (
    <article className="proposal-block proposal-block-contact">
      <div className="proposal-block-head">
        <div>
          <p className="mini-label">{title}</p>
          <p className="proposal-action-kicker">{helperText}</p>
        </div>
        {badge ? <span className="badge score-pill">{badge}</span> : null}
      </div>

      <pre>{message}</pre>

      <div className="proposal-contact-actions">
        {href ? (
          <a
            className={buttonClassName}
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer" : undefined}
          >
            {actionLabel}
          </a>
        ) : (
          <button className={buttonClassName} type="button" disabled>
            {disabledLabel}
          </button>
        )}
      </div>
    </article>
  );
}

type StudioViewProps = {
  proposalLeads: DashboardLead[];
  segmentSummaries: SegmentSummary[];
  proposalScopeMode: ProposalScopeMode;
  activeSegmentId: string;
  selectedLead: DashboardLead | null;
  proposal: Proposal | null;
  proposalMessage: string;
  isSaving: boolean;
  onSelectLead: (id: string) => void;
  onSelectSegment: (id: string) => void;
  onProposalScopeModeChange: (mode: ProposalScopeMode) => void;
  onCopyWhatsapp: () => void;
  onCopyEmail: () => void;
  onCopyCall: () => void;
  onExportPdf: () => void;
  scopeLabel: string;
};

export function StudioView({
  proposalLeads,
  segmentSummaries,
  proposalScopeMode,
  activeSegmentId,
  selectedLead,
  proposal,
  proposalMessage,
  isSaving,
  onSelectLead,
  onSelectSegment,
  onProposalScopeModeChange,
  onCopyWhatsapp,
  onCopyEmail,
  onCopyCall,
  onExportPdf,
  scopeLabel,
}: StudioViewProps) {
  const recommendation = selectedLead && proposal ? { service: proposal.service.label, reason: proposal.serviceReason } : null;
  const emptyStateMessage =
    proposalScopeMode === "batch"
      ? "No hay leads en la importacion activa. Cambia a Nicho activo o importa otra base."
      : "No hay leads en este nicho activo.";
  const whatsappHref =
    selectedLead && proposal ? buildWhatsappHref(selectedLead.phone, proposal.whatsapp) : "";
  const emailHref =
    selectedLead && proposal
      ? buildMailtoHref(
          selectedLead.email,
          proposal.email,
          `Idea rapida de ${proposal.service.label} para ${selectedLead.businessName}`
        )
      : "";
  const callHref = selectedLead && proposal ? buildTelHref(selectedLead.phone) : "";
  const selectedLeadOutsideScope =
    Boolean(selectedLead) && !proposalLeads.some((lead) => lead.id === selectedLead?.id);
  return (
    <section className="ops-view ops-view-v3">
      <section className="panel ops-card">
        <div className="ops-section-head">
          <div>
            <p className="mini-label">Propuestas</p>
            <h3>Material de contacto y cierre</h3>
          </div>
          <div className="ops-button-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={onCopyWhatsapp}
              disabled={!proposal || isSaving}
            >
              Copiar WhatsApp
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onCopyEmail}
              disabled={!proposal || isSaving}
            >
              Copiar email
            </button>
            <button className="button button-secondary" type="button" onClick={onCopyCall} disabled={!proposal || isSaving}>
              Copiar llamada
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={onExportPdf}
              disabled={!proposal || isSaving}
            >
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="proposal-toolbar">
          <label className="proposal-select proposal-scope-select">
            Alcance
            <select
              value={proposalScopeMode}
              onChange={(e) => onProposalScopeModeChange(e.target.value as ProposalScopeMode)}
            >
              <option value="segment">Nicho activo</option>
              <option value="batch">Importacion activa</option>
            </select>
          </label>
          <label className="proposal-select proposal-niche-select">
            Nicho
            <select
              value={activeSegmentId}
              onChange={(e) => onSelectSegment(e.target.value)}
              disabled={!segmentSummaries.length}
            >
              {segmentSummaries.length ? (
                segmentSummaries.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name} ({segment.total} leads)
                  </option>
                ))
              ) : (
                <option value="">Sin nichos</option>
              )}
            </select>
          </label>
          <label className="proposal-select proposal-lead-select">
            Lead
            <select
              value={selectedLead?.id || ""}
              onChange={(e) => onSelectLead(e.target.value)}
              disabled={!proposalLeads.length}
            >
              {selectedLeadOutsideScope && selectedLead ? (
                <option value={selectedLead.id}>
                  {selectedLead.businessName} / {selectedLead.city} / {selectedLead.subniche} (seleccionado)
                </option>
              ) : null}
              {proposalLeads.length ? (
                proposalLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.businessName} / {lead.city} / {lead.subniche}
                  </option>
                ))
              ) : (
                <option value="">Sin leads cargados</option>
              )}
            </select>
          </label>
          <span className="status-chip status-chip-local">{scopeLabel}</span>
          <p className="muted ops-inline-note">{proposalMessage}</p>
        </div>

        {selectedLead && proposal ? (
          <div className="proposal-content">
            <article className="proposal-block proposal-block-wide">
              <p className="mini-label">Resumen comercial</p>
              <h3>{selectedLead.businessName}</h3>
              <p>{proposal.audit}</p>
              <div className="ops-chip-row">
                <span className="badge score-pill">{selectedLead.city}</span>
                <span className="badge score-pill">{selectedLead.niche}</span>
                <span className="badge score-pill">{selectedLead.subniche}</span>
                <span className="badge score-pill">{selectedLead.batchName}</span>
              </div>
              <ul>
                {proposal.scope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="proposal-block proposal-block-wide">
              <p className="mini-label">Servicio recomendado</p>
              <p>
                <strong>{recommendation?.service}</strong>
              </p>
              <p className="muted">{recommendation?.reason}</p>
            </article>

            <ProposalActionCard
              title="WhatsApp"
              helperText="Abre el chat con el mensaje listo para enviar."
              message={proposal.whatsapp}
              actionLabel="Abrir WhatsApp"
              disabledLabel="Sin teléfono"
              badge={selectedLead.phone || "Sin teléfono"}
              href={whatsappHref}
              variant="primary"
              openInNewTab
            />

            <ProposalActionCard
              title="Email"
              helperText="Abre tu correo con asunto y cuerpo prellenados."
              message={proposal.email}
              actionLabel="Abrir correo"
              disabledLabel="Sin email"
              badge={selectedLead.email || "Sin email"}
              href={emailHref}
            />

            <ProposalActionCard
              title="Llamada"
              helperText="Marca directo al lead desde tu dispositivo."
              message={proposal.call}
              actionLabel="Llamar ahora"
              disabledLabel="Sin teléfono"
              badge={selectedLead.phone || "Sin teléfono"}
              href={callHref}
            />

            <article className="proposal-block">
              <p className="mini-label">Checklist de demo</p>
              <ul>
                {proposal.demoChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="proposal-block">
              <p className="mini-label">Objetivo de reunion</p>
              <pre>{proposal.meetingGoal}</pre>
            </article>
          </div>
        ) : (
          <div className="empty-state">{emptyStateMessage}</div>
        )}
      </section>
    </section>
  );
}
