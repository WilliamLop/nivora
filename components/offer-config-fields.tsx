"use client";

import type { WorkspaceFocus } from "@/lib/types";
import {
  composeOfferSummary,
  getOfferBaseOption,
  OFFER_ADDON_OPTIONS,
  OFFER_BASE_OPTIONS,
  normalizeFocus,
  toggleOfferAddon,
} from "@/lib/dashboard";

type OfferConfigFieldsProps = {
  focusDraft: WorkspaceFocus;
  onFocusDraftChange: (draft: WorkspaceFocus) => void;
  eyebrow?: string;
  title?: string;
  helperText?: string;
};

export function OfferConfigFields({
  focusDraft,
  onFocusDraftChange,
  eyebrow = "Oferta comercial",
  title = "Base y complementos",
  helperText = "La oferta activa se copia como default a los nuevos leads y a las propuestas.",
}: OfferConfigFieldsProps) {
  const offerSummary = composeOfferSummary(focusDraft.offerBaseId, focusDraft.offerAddons);
  const baseOption = getOfferBaseOption(focusDraft.offerBaseId);

  function updateFocus(next: Partial<WorkspaceFocus>) {
    onFocusDraftChange(normalizeFocus({ ...focusDraft, ...next }));
  }

  return (
    <section className="ops-offer-config">
      <div className="ops-section-head">
        <div>
          <p className="mini-label">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="ops-offer-stack">
        <label>
          <span className="mini-label">Base principal</span>
          <select
            value={focusDraft.offerBaseId}
            onChange={(e) => updateFocus({ offerBaseId: e.target.value as WorkspaceFocus["offerBaseId"] })}
          >
            {OFFER_BASE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="muted ops-console-copy">{baseOption.description}</p>
        </label>

        <article className="ops-summary-card ops-offer-active-card">
          <span>Oferta activa</span>
          <strong>{offerSummary}</strong>
          <p>{helperText}</p>
        </article>
      </div>

      <section className="ops-offer-addons">
        <div className="ops-section-head ops-offer-addons-head">
          <div>
            <p className="mini-label">Complementos</p>
            <h4>Opcionales</h4>
          </div>
        </div>

        <div className="ops-offer-addon-grid">
          {OFFER_ADDON_OPTIONS.map((option) => {
            const active = focusDraft.offerAddons.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className={`ops-compact-chip ${active ? "ops-compact-chip-active" : ""}`}
                aria-pressed={active}
                title={option.description}
                onClick={() =>
                  updateFocus({
                    offerAddons: toggleOfferAddon(focusDraft.offerAddons, option.id),
                  })
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <p className="muted ops-console-copy" style={{ marginTop: "8px" }}>
          Selecciona una base y agrega solo los complementos que realmente quieras ofrecer.
        </p>
      </section>
    </section>
  );
}
