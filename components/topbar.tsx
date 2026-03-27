"use client";

import { labelForAppRole } from "@/lib/dashboard";
import type { AuthenticatedUser, DashboardLead, DashboardStatus } from "@/lib/types";
import type { NavItem } from "@/lib/component-types";
import { statusChipClass, cleanStatusTitle } from "@/lib/ui-helpers";

type TopbarProps = {
  activeNavItem: NavItem;
  focus: { city: string; niche: string };
  workspaceImportLabel: string;
  storageStatus: DashboardStatus;
  selectedLead: DashboardLead | null;
  currentUser?: AuthenticatedUser | null;
  canCreateLead: boolean;
  canImport: boolean;
  onNewLead: () => void;
  onImport: () => void;
  onViewStudio: () => void;
  onLogout: () => void;
};

export function Topbar({
  activeNavItem,
  focus,
  workspaceImportLabel,
  storageStatus,
  selectedLead,
  currentUser,
  canCreateLead,
  canImport,
  onNewLead,
  onImport,
  onViewStudio,
  onLogout,
}: TopbarProps) {
  return (
    <header className="panel ops-topbar ops-topbar-v3">
      <div className="ops-topbar-copy">
        <div className="ops-breadcrumbs">
          {activeNavItem.label} / {focus.city} / {focus.niche} / {workspaceImportLabel}
        </div>
        <h2>{activeNavItem.label}</h2>
        <p className="muted">{activeNavItem.description}</p>
      </div>

      <div className="ops-topbar-actions ops-topbar-actions-v3">
        <span className={`status-chip ${statusChipClass(storageStatus.tone)}`}>
          {cleanStatusTitle(storageStatus.title)}
        </span>
        {currentUser ? (
          <span className="status-chip status-chip-local">
            {currentUser.fullName} · {labelForAppRole(currentUser.role)}
          </span>
        ) : null}
        {canImport ? (
          <button className="button button-secondary" type="button" onClick={onImport}>
            Importar CSV
          </button>
        ) : null}
        {canCreateLead ? (
          <button className="button button-primary" type="button" onClick={onNewLead}>
            Nuevo lead
          </button>
        ) : null}
        <button
          className="button button-secondary"
          type="button"
          onClick={onViewStudio}
          disabled={!selectedLead}
        >
          Ver propuesta
        </button>
        {currentUser ? (
          <button className="button button-secondary" type="button" onClick={onLogout}>
            Salir
          </button>
        ) : null}
      </div>
    </header>
  );
}
