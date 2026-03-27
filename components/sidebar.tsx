"use client";

import { labelForAppRole } from "@/lib/dashboard";
import type { ReactNode } from "react";
import type { AuthenticatedUser, DashboardStatus, DataMode, WorkspaceFocus } from "@/lib/types";
import type { DashboardView, NavItem } from "@/lib/component-types";
import { statusChipClass, getOperationalStatus } from "@/lib/ui-helpers";
import { NivoraBrand } from "@/components/nivora-brand";

// ── Icons ─────────────────────────────────────────────────────────────────────

const NAV_ICONS: Record<DashboardView, ReactNode> = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  leads: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 12.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  pipeline: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M1.5 3.5h12M1.5 7.5h9M1.5 11.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  imports: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M7.5 1.5v8M4.5 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  studio: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M2.5 3.5h10a1 1 0 011 1v5a1 1 0 01-1 1H9l-1.5 2-1.5-2H2.5a1 1 0 01-1-1v-5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 7h5M5 5.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1.5v1.2M7.5 12.3v1.2M1.5 7.5h1.2M12.3 7.5h1.2M3.4 3.4l.85.85M10.75 10.75l.85.85M3.4 11.6l.85-.85M10.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  team: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.8 12c0-2.1 2.05-3.8 4.58-3.8 2.52 0 4.57 1.7 4.57 3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.5 11.7c.34-1.24 1.52-2.2 2.95-2.2 1 0 1.88.47 2.45 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};

const WORKSPACE_SWITCHER_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M3 5.25h7.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <path
      d="M8.7 3.45 10.5 5.25 8.7 7.05"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 10.75H5.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <path
      d="M7.3 8.95 5.5 10.75l1.8 1.8"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Props ─────────────────────────────────────────────────────────────────────

type SidebarProps = {
  navItems: NavItem[];
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  focus: WorkspaceFocus;
  storageStatus: DashboardStatus;
  dataMode: DataMode;
  visibleLeadCount: number;
  urgentLeadCount: number;
  completionRate: number;
  activeBatchLeadCount: number;
  workspaceImportLabel: string;
  currentUser?: AuthenticatedUser | null;
  canChangeWorkspace: boolean;
  canCreateLead: boolean;
  canImport: boolean;
  onOpenWorkspaceSwitcher: () => void;
  onNewLead: () => void;
  onImport: () => void;
  onLogout: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({
  navItems,
  activeView,
  setActiveView,
  focus,
  storageStatus,
  dataMode,
  visibleLeadCount,
  urgentLeadCount,
  completionRate,
  activeBatchLeadCount,
  workspaceImportLabel,
  currentUser,
  canChangeWorkspace,
  canCreateLead,
  canImport,
  onOpenWorkspaceSwitcher,
  onNewLead,
  onImport,
  onLogout,
}: SidebarProps) {
  const operationalStatus = getOperationalStatus(storageStatus, dataMode);

  return (
    <aside className="panel ops-sidebar ops-sidebar-v3">
      <div className="ops-sidebar-scroll ops-sidebar-scroll-v3">
        {/* Brand */}
        <div className="ops-brand ops-brand-v3">
          <NivoraBrand compact className="nivora-brand-sidebar" />
        </div>

        {/* Navigation */}
        <nav className="ops-nav ops-nav-v3" aria-label="Navegacion principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`ops-nav-item ${activeView === item.id ? "ops-nav-item-active" : ""}`}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              {NAV_ICONS[item.id]}
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>

        {/* Workspace status */}
        <section className="ops-side-block ops-side-block-primary">
          <div className="ops-side-block-head ops-side-block-head-stacked">
            <span className={`status-chip ${statusChipClass(operationalStatus.tone)}`}>
              {operationalStatus.label}
            </span>
            <div>
              <p className="mini-label">Espacio activo</p>
              <h3>{focus.city}</h3>
            </div>
          </div>
          <p className="ops-side-focus-line">
            {focus.niche} / {workspaceImportLabel}
          </p>
          <div className="ops-side-metrics">
            <article>
              <span>Visibles</span>
              <strong>{visibleLeadCount}</strong>
            </article>
            <article>
              <span>Urgentes</span>
              <strong>{urgentLeadCount}</strong>
            </article>
          </div>
          <div className="ops-progress ops-progress-soft">
            <span style={{ width: `${Math.max(completionRate, activeBatchLeadCount ? 10 : 0)}%` }} />
          </div>
          <p className="muted">
            {activeBatchLeadCount} de {focus.batchSize} negocios en la importacion activa.
          </p>
        </section>

        {/* Navigation guide */}
        <section className="ops-side-block">
          <div className="ops-side-block-head">
            <div>
              <p className="mini-label">Orden</p>
              <h3>Como se navega</h3>
            </div>
          </div>
          <div className="ops-side-notes">
            <article>
              <span>1</span>
              <p>Entra a <strong>Mercados</strong> para cambiar ciudad, nicho e importacion.</p>
            </article>
            <article>
              <span>2</span>
              <p>La tabla es el centro. La ficha del lead se abre en drawer sin aplastarte el CRM.</p>
            </article>
            <article>
              <span>3</span>
              <p>Usa <strong>Importaciones</strong> solo para cargar CSV y volver al trabajo.</p>
            </article>
          </div>
        </section>

        {currentUser ? (
          <section className="ops-side-block">
            <div className="ops-side-block-head">
              <div>
                <p className="mini-label">Sesión</p>
                <h3>{currentUser.fullName}</h3>
              </div>
              <span className="status-chip status-chip-local">{labelForAppRole(currentUser.role)}</span>
            </div>
            <p className="muted">{currentUser.email}</p>
            <div className="ops-button-row">
              <button className="button button-secondary" type="button" onClick={onLogout}>
                Cerrar sesión
              </button>
            </div>
          </section>
        ) : null}

        {/* Actions */}
        <div className="ops-sidebar-actions ops-sidebar-actions-v3">
          {canChangeWorkspace ? (
            <button className="button ops-workspace-switcher-trigger" type="button" onClick={onOpenWorkspaceSwitcher}>
              <span className="ops-workspace-switcher-icon" aria-hidden>
                {WORKSPACE_SWITCHER_ICON}
              </span>
              <span className="ops-workspace-switcher-copy">
                <span className="ops-workspace-switcher-kicker">Cambio rápido</span>
                <strong>Cambiar espacio</strong>
                <small>
                  {focus.city} · {focus.niche}
                </small>
              </span>
            </button>
          ) : null}
          {canCreateLead ? (
            <button className="button button-primary" type="button" onClick={onNewLead}>
              Nuevo negocio
            </button>
          ) : null}
          {canImport ? (
            <button className="button button-secondary" type="button" onClick={onImport}>
              Subir CSV
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
