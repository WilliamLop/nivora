"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardStatus, WorkspaceFocus } from "@/lib/types";
import type { MarketSummary } from "@/lib/component-types";
import { cleanStatusTitle, statusChipClass } from "@/lib/ui-helpers";

type WorkspaceSwitcherDrawerProps = {
  currentFocus: WorkspaceFocus;
  marketSummaries: MarketSummary[];
  storageStatus: DashboardStatus;
  isSaving: boolean;
  resolveMarketFocus: (marketId: string) => WorkspaceFocus | null;
  onApplyFocus: (focus: WorkspaceFocus) => Promise<void>;
  onOpenMarkets: () => void;
  onClose: () => void;
};

export function WorkspaceSwitcherDrawer({
  currentFocus,
  marketSummaries,
  storageStatus,
  isSaving,
  resolveMarketFocus,
  onApplyFocus,
  onOpenMarkets,
  onClose,
}: WorkspaceSwitcherDrawerProps) {
  const [selectedMarketId, setSelectedMarketId] = useState(currentFocus.marketId);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedMarketId(currentFocus.marketId);
    setError("");
  }, [currentFocus.marketId]);

  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    if (!marketSummaries.length) return;
    if (marketSummaries.some((market) => market.id === selectedMarketId)) return;
    setSelectedMarketId(currentFocus.marketId);
  }, [marketSummaries, selectedMarketId, currentFocus.marketId]);

  const previewFocus = useMemo(
    () => resolveMarketFocus(selectedMarketId),
    [resolveMarketFocus, selectedMarketId]
  );

  const hasChanged = Boolean(
    previewFocus &&
      (previewFocus.marketId !== currentFocus.marketId ||
        previewFocus.segmentId !== currentFocus.segmentId ||
        previewFocus.batchId !== currentFocus.batchId ||
        previewFocus.city !== currentFocus.city ||
        previewFocus.niche !== currentFocus.niche ||
        previewFocus.batchName !== currentFocus.batchName ||
        previewFocus.batchSize !== currentFocus.batchSize)
  );

  async function handleApply() {
    if (!previewFocus) return;
    setError("");

    try {
      await onApplyFocus(previewFocus);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar el espacio.");
    }
  }

  return (
    <div className="ops-drawer-backdrop" onClick={onClose}>
      <section
        className="panel ops-drawer ops-workspace-switcher-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar espacio activo"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ops-drawer-head">
          <div>
            <p className="mini-label">Cambio rapido</p>
            <h3>Cambiar espacio activo</h3>
            <p className="muted">
              Elige una ciudad y el nicho con su importacion se ajustan al catalogo existente.
            </p>
          </div>
          <div className="ops-button-row">
            <span className={`status-chip ${statusChipClass(storageStatus.tone)}`}>
              {cleanStatusTitle(storageStatus.title)}
            </span>
            <button className="button button-secondary" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className="ops-drawer-grid">
          <article className="ops-mini-card">
            <div className="ops-mini-card-head">
              <strong>Espacio actual</strong>
              <span className="status-chip status-chip-local">Activo</span>
            </div>
            <p>
              {currentFocus.city} / {currentFocus.niche}
            </p>
            <p>{currentFocus.batchName}</p>
          </article>
          <article className="ops-mini-card">
            <div className="ops-mini-card-head">
              <strong>Se aplicara</strong>
              <span className={`status-chip ${hasChanged ? "status-chip-cloud" : "status-chip-local"}`}>
                {hasChanged ? "Preview" : "Actual"}
              </span>
            </div>
            <p>
              {previewFocus ? (
                <>
                  {previewFocus.city} / {previewFocus.niche}
                </>
              ) : (
                "Selecciona una ciudad."
              )}
            </p>
            <p>{previewFocus ? previewFocus.batchName : "La importacion se ajusta automaticamente."}</p>
          </article>
        </div>

        <section>
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Ciudades</p>
              <h3>Seleccion rapida</h3>
            </div>
          </div>

          <div className="ops-tree-list ops-workspace-switcher-list">
            {marketSummaries.map((market) => (
              <button
                key={market.id}
                type="button"
                aria-pressed={selectedMarketId === market.id}
                className={`ops-tree-button ${
                  selectedMarketId === market.id ? "ops-tree-button-active" : ""
                }`}
                onClick={() => {
                  setSelectedMarketId(market.id);
                  setError("");
                }}
              >
                <span>{market.name}</span>
                <small>
                  {market.total} negocios · {market.segmentCount} nichos
                </small>
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="ops-workspace-switcher-error">{error}</p> : null}

        <div className="ops-workspace-switcher-note">
          El cambio se aplica en todo el tablero. Si quieres afinar nicho o importacion manualmente, abre Mercados.
        </div>

        <div className="ops-button-row">
          <button className="button button-primary" type="button" onClick={() => void handleApply()} disabled={isSaving || !previewFocus || !hasChanged}>
            {isSaving ? "Aplicando..." : hasChanged ? "Aplicar espacio" : "Ya esta aplicado"}
          </button>
          <button className="button button-secondary" type="button" onClick={onOpenMarkets}>
            Abrir Mercados
          </button>
          <button className="button button-secondary" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  );
}
