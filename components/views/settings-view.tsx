"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { MarketSummary, SegmentSummary, BatchSummary, DisplayStatus } from "@/lib/component-types";
import type { WorkspaceFocus } from "@/lib/types";
import { statusChipClass } from "@/lib/ui-helpers";
import { OfferConfigFields } from "@/components/offer-config-fields";

type SettingsViewProps = {
  focusDraft: WorkspaceFocus;
  focus: WorkspaceFocus;
  marketSummaries: MarketSummary[];
  segmentSummaries: SegmentSummary[];
  batchSummaries: BatchSummary[];
  activityFeedback: DisplayStatus;
  isSaving: boolean;
  onFocusDraftChange: (draft: WorkspaceFocus) => void;
  onFocusSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCreateCity: (name: string) => Promise<void>;
  onUpdateCity: (id: string, name: string) => Promise<void>;
  onDeleteCity: (id: string) => Promise<void>;
};

export function SettingsView({
  focusDraft,
  focus,
  marketSummaries,
  segmentSummaries,
  batchSummaries,
  activityFeedback,
  isSaving,
  onFocusDraftChange,
  onFocusSubmit,
  onCreateCity,
  onUpdateCity,
  onDeleteCity,
}: SettingsViewProps) {
  const [newCityName, setNewCityName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [cityError, setCityError] = useState("");
  const [isCitySaving, setIsCitySaving] = useState(false);
  const [pendingDeleteCity, setPendingDeleteCity] = useState<MarketSummary | null>(null);

  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingDeleteCity(null);
      }
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  async function handleCreateCity(e: FormEvent) {
    e.preventDefault();
    if (!newCityName.trim()) return;
    setCityError("");
    setIsCitySaving(true);
    try {
      await onCreateCity(newCityName.trim());
      setNewCityName("");
    } catch (err) {
      setCityError(err instanceof Error ? err.message : "No se pudo crear la ciudad.");
    } finally {
      setIsCitySaving(false);
    }
  }

  function startEdit(id: string, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
    setCityError("");
  }

  async function handleUpdateCity(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editingName.trim()) return;
    setCityError("");
    setIsCitySaving(true);
    try {
      await onUpdateCity(editingId, editingName.trim());
      setEditingId(null);
    } catch (err) {
      setCityError(err instanceof Error ? err.message : "No se pudo actualizar la ciudad.");
    } finally {
      setIsCitySaving(false);
    }
  }

  function requestDeleteCity(market: MarketSummary) {
    setPendingDeleteCity(market);
    setCityError("");
  }

  async function confirmDeleteCity() {
    if (!pendingDeleteCity) return;
    const { id } = pendingDeleteCity;
    setCityError("");
    setIsCitySaving(true);
    try {
      await onDeleteCity(id);
      setPendingDeleteCity(null);
    } catch (err) {
      setCityError(err instanceof Error ? err.message : "No se pudo eliminar la ciudad.");
    } finally {
      setIsCitySaving(false);
    }
  }

  return (
    <section className="ops-view ops-view-v3">
      <div className="ops-settings-grid ops-settings-grid-v3">
        {/* Focus config */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Configuracion</p>
              <h3>Contexto persistido</h3>
            </div>
          </div>

          <form className="ops-editor-form" onSubmit={onFocusSubmit}>
            <div className="ops-editor-grid ops-editor-grid-tight">
              <label>
                Ciudad
                <input
                  value={focusDraft.city}
                  onChange={(e) => onFocusDraftChange({ ...focusDraft, city: e.target.value })}
                  placeholder="Chiquinquira"
                  required
                />
              </label>
              <label>
                Nicho principal
                <input
                  value={focusDraft.niche}
                  onChange={(e) => onFocusDraftChange({ ...focusDraft, niche: e.target.value })}
                  placeholder="Odontologia"
                  required
                />
              </label>
              <label>
                Importacion
                <input
                  value={focusDraft.batchName}
                  onChange={(e) => onFocusDraftChange({ ...focusDraft, batchName: e.target.value })}
                  placeholder="Base marzo"
                  required
                />
              </label>
              <label>
                Capacidad objetivo
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={focusDraft.batchSize}
                  onChange={(e) =>
                    onFocusDraftChange({
                      ...focusDraft,
                      batchSize: Number(e.target.value) || focusDraft.batchSize,
                    })
                  }
                  required
                />
              </label>
            </div>

            <OfferConfigFields
              focusDraft={focusDraft}
              onFocusDraftChange={onFocusDraftChange}
              eyebrow="Oferta principal"
              title="Selecciona la línea comercial"
              helperText="Esta combinación se copia como default a nuevos leads y a las propuestas."
            />

            <div className="ops-button-row">
              <button className="button button-primary" type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar configuracion"}
              </button>
            </div>
          </form>
        </section>

        {/* Catalog summary */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Catalogo</p>
              <h3>Lo que ya existe en la base</h3>
            </div>
          </div>

          <div className="ops-catalog-grid">
            <article className="ops-mini-card">
              <div className="ops-mini-card-head">
                <strong>Nichos en {focus.city}</strong>
                <span className="status-chip status-chip-local">{segmentSummaries.length}</span>
              </div>
              <p>
                {segmentSummaries.map((s) => `${s.name} (${s.total})`).join(" / ") ||
                  "Sin nichos detectados todavia."}
              </p>
            </article>
            <article className="ops-mini-card">
              <div className="ops-mini-card-head">
                <strong>Importaciones en {focus.niche}</strong>
                <span className="status-chip status-chip-local">{batchSummaries.length}</span>
              </div>
              <p>
                {batchSummaries.map((b) => `${b.name} (${b.total})`).join(" / ") ||
                  "Sin importaciones guardadas todavia."}
              </p>
            </article>
            <article className="ops-mini-card">
              <div className="ops-mini-card-head">
                <strong>Salud de plataforma</strong>
                <span className={`status-chip ${statusChipClass(activityFeedback.tone)}`}>
                  {activityFeedback.label}
                </span>
              </div>
              <p>{activityFeedback.message}</p>
            </article>
          </div>
        </section>
      </div>

      {/* City CRUD */}
      <section className="panel ops-card">
        <div className="ops-section-head">
          <div>
            <p className="mini-label">Ciudades</p>
            <h3>Gestionar ciudades</h3>
            <p className="muted ops-console-copy">
              Crea, renombra o elimina ciudades. Solo puedes eliminar ciudades sin negocios asignados.
            </p>
          </div>
        </div>

        {/* Create form */}
        <form className="ops-editor-form" onSubmit={handleCreateCity}>
          <div className="ops-filter-grid-v3">
            <label>
              Nueva ciudad
              <input
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                placeholder="Bogota, Medellin, Cali..."
              />
            </label>
          </div>
          <div className="ops-button-row">
            <button className="button button-primary" type="submit" disabled={isCitySaving || !newCityName.trim()}>
              {isCitySaving ? "Guardando..." : "Agregar ciudad"}
            </button>
          </div>
        </form>

        {cityError && <p className="ops-city-error">{cityError}</p>}

        {/* City list */}
        <div className="ops-city-list">
          {marketSummaries.length ? (
            marketSummaries.map((market) => (
              <article
                className={`ops-city-card ${editingId === market.id ? "ops-city-card-editing" : ""}`}
                key={market.id}
              >
                {editingId === market.id ? (
                  <form className="ops-city-edit-form" onSubmit={handleUpdateCity}>
                    <div className="ops-city-card-head">
                      <div>
                        <span className="mini-label">Editar ciudad</span>
                        <strong>{market.name}</strong>
                        <p className="ops-city-card-meta">
                          {market.total} negocios · {market.segmentCount} nichos
                        </p>
                      </div>
                      <span
                        className={`status-chip ${
                          focus.marketId === market.id ? "status-chip-cloud" : "status-chip-local"
                        }`}
                      >
                        {focus.marketId === market.id ? "Activa" : market.total > 0 ? "Con leads" : "Vacía"}
                      </span>
                    </div>
                    <label>
                      Nuevo nombre
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        required
                      />
                    </label>
                    <div className="ops-button-row">
                      <button className="button button-primary" type="submit" disabled={isCitySaving}>
                        Guardar
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="ops-city-card-head">
                      <div>
                        <span className="mini-label">Ciudad</span>
                        <strong>{market.name}</strong>
                        <p className="ops-city-card-meta">
                          {market.total} negocios · {market.segmentCount} nichos
                        </p>
                      </div>
                      <span
                        className={`status-chip ${
                          focus.marketId === market.id ? "status-chip-cloud" : "status-chip-local"
                        }`}
                      >
                        {focus.marketId === market.id ? "Activa" : market.total > 0 ? "Con leads" : "Vacía"}
                      </span>
                    </div>
                    <div className="ops-city-card-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => startEdit(market.id, market.name)}
                        disabled={isCitySaving}
                      >
                        Renombrar
                      </button>
                      <button
                        className="button button-danger"
                        type="button"
                        onClick={() => requestDeleteCity(market)}
                        disabled={isCitySaving || market.total > 0}
                        title={market.total > 0 ? `Tiene ${market.total} negocios` : "Eliminar ciudad"}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state">Sin ciudades registradas todavia.</div>
          )}
        </div>
      </section>

      {pendingDeleteCity ? (
        <div
          className="ops-delete-modal-backdrop"
          role="presentation"
          onClick={() => setPendingDeleteCity(null)}
        >
          <section
            className="panel ops-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-city-title"
            aria-describedby="delete-city-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ops-delete-modal-head">
              <div>
                <p className="mini-label">Confirmar accion</p>
                <h3 id="delete-city-title">Eliminar ciudad</h3>
              </div>
              <span className="status-chip status-chip-alert">Irreversible</span>
            </div>

            <div className="ops-delete-modal-body">
              <article className="ops-delete-summary-card">
                <div className="ops-delete-summary-card-head">
                  <div>
                    <span className="mini-label">Ciudad seleccionada</span>
                    <strong>{pendingDeleteCity.name}</strong>
                    <p id="delete-city-description">
                      Esta ciudad no tiene negocios, asi que puedes retirarla del catalogo sin afectar leads.
                    </p>
                  </div>
                  <span className="status-chip status-chip-local">Vacía</span>
                </div>
                <div className="ops-delete-summary-metrics">
                  <article>
                    <span>Negocios</span>
                    <strong>{pendingDeleteCity.total}</strong>
                  </article>
                  <article>
                    <span>Nichos</span>
                    <strong>{pendingDeleteCity.segmentCount}</strong>
                  </article>
                </div>
                <p className="ops-delete-summary-note">
                  Si era la ciudad activa, el sistema movera el foco a otra ciudad disponible.
                </p>
              </article>
            </div>

            {cityError ? <p className="ops-city-error">{cityError}</p> : null}

            <div className="ops-delete-modal-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setPendingDeleteCity(null)}
                disabled={isCitySaving}
              >
                Cancelar
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={() => void confirmDeleteCity()}
                disabled={isCitySaving}
              >
                {isCitySaving ? "Eliminando..." : "Eliminar ciudad"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
