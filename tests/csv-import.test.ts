import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeCsvImport, mapCsvRowToLead, normalizeFocus, parseCsv } from "../lib/dashboard";
import { isCsvLikeFile } from "../lib/component-helpers";
import { buildImportPreview } from "../lib/ui-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "data", "fixtures", "imports");
const focus = normalizeFocus({ city: "Tunja", niche: "Odontologia", batchName: "Base activa" });

function loadFixture(name: string) {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

test("detects raw Google Maps exports and ignores empty rows before import", () => {
  const analysis = analyzeCsvImport(loadFixture("google-maps-raw.csv"));
  const preview = buildImportPreview(analysis);
  const lead = mapCsvRowToLead(analysis.validRows[0], focus);

  assert.equal(analysis.detectedSource, "Google Maps export");
  assert.equal(analysis.totalRows, 5);
  assert.equal(analysis.nonEmptyRows, 2);
  assert.equal(analysis.emptyRows, 3);
  assert.equal(analysis.invalidRows, 0);
  assert.equal(analysis.validRows.length, 2);
  assert.equal(preview.validRows, 2);
  assert.equal(lead.businessName, "Odontonatural Ortodoncia Tunja");
  assert.equal(lead.subniche, "Clinica dental");
  assert.equal(lead.phone, "313 3485763");
  assert.equal(lead.website, "http://www.odontonatural.com/");
  assert.match(lead.notes, /Perfil de Google Maps:/);
  assert.match(lead.notes, /Rating en Google Maps:/);
});

test("maps structured CSV headers in Spanish", () => {
  const analysis = analyzeCsvImport(loadFixture("structured-spanish.csv"));
  const lead = mapCsvRowToLead(analysis.validRows[0], focus);

  assert.equal(analysis.detectedSource, "CSV estructurado");
  assert.equal(analysis.validRows.length, 2);
  assert.equal(lead.businessName, "ClarIsa Cloud SAS");
  assert.equal(lead.city, "Tunja");
  assert.equal(lead.subniche, "Empresa de software");
  assert.equal(lead.phone, "+57 317 7624291");
  assert.equal(lead.website, "https://www.clarisa.co/");
});

test("maps lowercase structured CSV headers without creating fallback names", () => {
  const rows = parseCsv(loadFixture("structured-lower.csv"));
  const lead = mapCsvRowToLead(rows[0], focus);

  assert.equal(rows.length, 2);
  assert.notEqual(lead.businessName, "Lead sin nombre");
  assert.equal(lead.businessName, "Consultorio Odontologico Nelson Gonzalez");
  assert.equal(lead.subniche, "Dentista");
  assert.equal(lead.city, "Tunja");
});

test("supports generic alias headers and reports invalid rows in preview", () => {
  const analysis = analyzeCsvImport(loadFixture("generic-aliases.csv"));
  const preview = buildImportPreview(analysis);
  const lead = mapCsvRowToLead(analysis.validRows[0], focus);

  assert.equal(analysis.totalRows, 3);
  assert.equal(analysis.nonEmptyRows, 3);
  assert.equal(analysis.emptyRows, 0);
  assert.equal(analysis.invalidRows, 1);
  assert.equal(analysis.validRows.length, 2);
  assert.equal(preview.validRows, analysis.validRows.length);
  assert.ok(preview.skippedRows.some((item) => item.label === "Filas sin nombre reconocible" && item.total === 1));
  assert.equal(lead.businessName, "Acme Dental");
  assert.equal(lead.subniche, "Dental clinic");
  assert.equal(lead.phone, "+57 300 0000001");
  assert.equal(lead.website, "https://acmedental.co");
});

test("accepts injected files by content even with empty MIME and no .csv extension", async () => {
  const file = new File([loadFixture("generic-aliases.csv")], "import-upload", { type: "" });

  assert.equal(isCsvLikeFile(file), false);

  const analysis = analyzeCsvImport(await file.text());
  const lead = mapCsvRowToLead(analysis.validRows[1], focus);

  assert.equal(analysis.validRows.length, 2);
  assert.equal(lead.businessName, "Studio Nova");
  assert.equal(lead.subniche, "Creative agency");
});
