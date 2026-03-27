"use client";

import type { ChangeEvent, FormEvent, RefObject, DragEvent } from "react";
import type { ImportPreview, MarketSummary } from "@/lib/component-types";
import { normalizeFocus } from "@/lib/dashboard";
import type { WorkspaceFocus } from "@/lib/types";
import { OfferConfigFields } from "@/components/offer-config-fields";

type ImportsViewProps = {
  focusDraft: WorkspaceFocus;
  focus: WorkspaceFocus;
  marketSummaries: MarketSummary[];
  selectedCsvFile: File | null;
  selectedCsvFileName: string;
  importPreview: ImportPreview | null;
  importMessage: string;
  isImportDragOver: boolean;
  isSaving: boolean;
  importProgress: number;
  csvInputId: string;
  csvInputRef: RefObject<HTMLInputElement | null>;
  onFocusDraftChange: (draft: WorkspaceFocus) => void;
  onFocusSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCsvSelection: (e: ChangeEvent<HTMLInputElement>) => void;
  onImportCsv: () => void;
  onImportDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onImportDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onImportDrop: (e: DragEvent<HTMLDivElement>) => void;
  formatFileSize: (bytes: number) => string;
};

export function ImportsView({
  focusDraft,
  focus,
  marketSummaries,
  selectedCsvFile,
  selectedCsvFileName,
  importPreview,
  importMessage,
  isImportDragOver,
  isSaving,
  importProgress,
  csvInputId,
  csvInputRef,
  onFocusDraftChange,
  onFocusSubmit,
  onCsvSelection,
  onImportCsv,
  onImportDragOver,
  onImportDragLeave,
  onImportDrop,
  formatFileSize,
}: ImportsViewProps) {
  function handleFocusNicheInput() {
    document.getElementById("imports-niche-input")?.focus();
  }

  function handleCitySelect(marketId: string) {
    const market = marketSummaries.find((item) => item.id === marketId);
    if (!market) return;

    onFocusDraftChange(normalizeFocus({ ...focusDraft, marketId: market.id, city: market.name }));
  }

  const currentMarketId = marketSummaries.some((market) => market.id === focusDraft.marketId) ? focusDraft.marketId : "";
  const importProgressValue = Math.max(8, Math.min(100, Math.round(importProgress)));

  return (
    <section className="ops-view ops-view-v3">
      {/* Hero */}
      <section className="panel ops-card ops-import-hero-v3">
        <div>
          <p className="mini-label">Importaciones</p>
          <h3>Sube un CSV y dejalo en su destino correcto</h3>
          <p className="muted">
            Primero defines ciudad, nicho e importacion. Luego subes el archivo, revisas el preview y por ultimo lo
            guardas dentro del mercado correcto.
          </p>
          <div className="ops-import-destination">
            <div>
              <p className="mini-label">Destino activo</p>
              <strong>
                Importando a: {focusDraft.niche} ({focusDraft.city})
              </strong>
              <p>
                Las columnas de nicho del CSV se guardan como subnicho para no crear un nicho principal nuevo por
                accidente.
              </p>
            </div>
            <div className="ops-button-row">
              <button className="button button-secondary" type="button" onClick={handleFocusNicheInput}>
                Cambiar nicho
              </button>
            </div>
          </div>
        </div>
        <div className="ops-import-steps">
          <article className="ops-step-card">
            <span>1</span>
            <strong>Define destino</strong>
            <p>Ciudad, nicho e importacion.</p>
          </article>
          <article className="ops-step-card">
            <span>2</span>
            <strong>Sube el archivo</strong>
            <p>CSV de Maps o archivo estructurado.</p>
          </article>
          <article className="ops-step-card">
            <span>3</span>
            <strong>Confirma el preview</strong>
            <p>Revisa filas, especialidades y ejemplos.</p>
          </article>
        </div>
      </section>

      <div className="ops-import-grid ops-import-grid-v3">
        {/* Destination config */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Destino</p>
              <h3>Contexto de guardado</h3>
            </div>
            <span className="status-chip status-chip-local">Contextual</span>
          </div>

          <form className="ops-editor-form" onSubmit={onFocusSubmit}>
            <div className="ops-editor-grid ops-editor-grid-tight">
              <label>
                Ciudad guardada
                <select
                  value={currentMarketId}
                  onChange={(e) => handleCitySelect(e.target.value)}
                  disabled={!marketSummaries.length}
                >
                  <option value="">Selecciona una ciudad</option>
                  {marketSummaries.map((market) => (
                    <option key={market.id} value={market.id}>
                      {market.name} ({market.total} negocios)
                    </option>
                  ))}
                </select>
                <p className="muted ops-console-copy">
                  Puedes elegir una ciudad vacia y despues importar alli el archivo.
                </p>
              </label>
              <label>
                Ciudad
                <input
                  value={focusDraft.city}
                  onChange={(e) => onFocusDraftChange(normalizeFocus({ ...focusDraft, city: e.target.value }))}
                  placeholder="Tunja"
                  required
                />
              </label>
              <label>
                Nicho principal
                <input
                  id="imports-niche-input"
                  value={focusDraft.niche}
                  onChange={(e) => onFocusDraftChange({ ...focusDraft, niche: e.target.value })}
                  placeholder="Odontologia"
                  required
                />
                {importPreview && importPreview.topSubniches.length > 0 && (
                  <span className="ops-niche-hint">
                    <span className="mini-label">Detectados en el CSV:</span>
                    {importPreview.topSubniches.slice(0, 4).map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="ops-compact-chip"
                        onClick={() => onFocusDraftChange({ ...focusDraft, niche: s.label })}
                      >
                        {s.label} ({s.total})
                      </button>
                    ))}
                  </span>
                )}
              </label>
              <label>
                Importacion
                <input
                  value={focusDraft.batchName}
                  onChange={(e) => onFocusDraftChange({ ...focusDraft, batchName: e.target.value })}
                  placeholder="Importacion marzo"
                  required
                />
              </label>
            </div>

            <OfferConfigFields
              focusDraft={focusDraft}
              onFocusDraftChange={onFocusDraftChange}
              eyebrow="Oferta principal"
              title="Selecciona la línea comercial"
              helperText="Esta oferta viaja con la importación y se usa como default en nuevos leads."
            />

            <div className="ops-button-row">
              <button className="button button-secondary" type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar contexto"}
              </button>
            </div>
          </form>

          <div className="ops-import-preview-grid">
            <article className="ops-summary-card">
              <span>Ciudad destino</span>
              <strong>{focusDraft.city}</strong>
              <p>Si el archivo no trae ciudad clara, todo cae aqui.</p>
            </article>
            <article className="ops-summary-card">
              <span>Nicho</span>
              <strong>{focusDraft.niche}</strong>
              <p>Las categorias detectadas se guardan como especialidades.</p>
            </article>
            <article className="ops-summary-card">
              <span>Importacion</span>
              <strong>{focusDraft.batchName}</strong>
              <p>Esta sera la lista que agrupa la carga actual.</p>
            </article>
          </div>
        </section>

        {/* File upload */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Archivo</p>
              <h3>Subir CSV</h3>
            </div>
            <label className="button button-secondary ops-file-trigger" htmlFor={csvInputId}>
              Seleccionar CSV
            </label>
          </div>

          <div className="ops-import-layout">
            <input
              id={csvInputId}
              ref={csvInputRef}
              className="ops-file-picker"
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={onCsvSelection}
            />

            <div
              className={`ops-import-dropzone ${isImportDragOver ? "ops-import-dropzone-active" : ""}`}
              onDragOver={onImportDragOver}
              onDragLeave={onImportDragLeave}
              onDrop={onImportDrop}
            >
              <p className="mini-label">Archivo seleccionado</p>
              <strong>{selectedCsvFileName || "Arrastra un CSV o selecciona uno desde tu equipo"}</strong>
              <p className="muted">
                El importador toma la ciudad y el nicho del destino actual para mantener el orden.
              </p>
              <div className="ops-import-meta">
                <span>
                  {selectedCsvFile
                    ? `${formatFileSize(selectedCsvFile.size)} listos para cargar`
                    : "Acepta .csv o .txt delimitado por coma, punto y coma o tab"}
                </span>
              </div>
            </div>

            <div className="ops-import-actions">
              <label className="button button-secondary ops-file-trigger" htmlFor={csvInputId}>
                Cambiar archivo
              </label>
              {isSaving ? (
                <button className="button button-primary ops-import-progress-button" type="button" disabled>
                  <span className="ops-import-progress-fill" style={{ width: `${importProgressValue}%` }} />
                  <span className="ops-import-progress-label">
                    <strong>Importando...</strong>
                    <span>{importProgressValue}%</span>
                  </span>
                </button>
              ) : (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={onImportCsv}
                  disabled={!selectedCsvFileName}
                >
                  Guardar importacion
                </button>
              )}
              <p className="muted">{importMessage}</p>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="panel ops-card">
          <div className="ops-section-head">
            <div>
              <p className="mini-label">Preview</p>
              <h3>Lo que detecto el importador</h3>
            </div>
          </div>

          {importPreview ? (
            <div className="ops-stack">
              <article className="ops-mini-card">
                <div className="ops-mini-card-head">
                  <strong>Fuente</strong>
                  <span className="status-chip status-chip-local">{importPreview.detectedSource}</span>
                </div>
                <p>{importPreview.totalRows} filas detectadas dentro del archivo.</p>
              </article>
              <article className="ops-mini-card">
                <strong>Especialidades detectadas</strong>
                <p>
                  {importPreview.topSubniches.length
                    ? importPreview.topSubniches.map((item) => `${item.label} (${item.total})`).join(" / ")
                    : "Todavia no detecte especialidades claras en el preview."}
                </p>
              </article>
              <article className="ops-mini-card">
                <strong>Muestras del archivo</strong>
                <p>
                  {importPreview.sampleBusinesses.length
                    ? importPreview.sampleBusinesses.join(" / ")
                    : "No encontre negocios claros en las primeras filas."}
                </p>
              </article>
            </div>
          ) : (
            <div className="empty-state">
              Selecciona un archivo para revisar filas, especialidades y ejemplos antes de importarlo.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
