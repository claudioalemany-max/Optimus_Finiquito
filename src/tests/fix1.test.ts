import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { CaseInput } from "../models/case-input.js";
import { processFiniquitoCase } from "../services/finiquito-engine.js";
import { reviewDismissalLetter } from "../services/dismissal-letter-review.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadFixture(name: string): CaseInput {
  return JSON.parse(readFileSync(join(packageRoot, "examples", name), "utf8")) as CaseInput;
}

test("FIX1-TC01: art. 161 generic carta and missing proof blocks case", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.dismissal_letter = {
    cause_code: "NECESIDADES_EMPRESA",
    article: "Art. 161",
    facts: "Por necesidades de la empresa se pone término al contrato sin mayor detalle.",
    delivery_method: "CORREO",
    dt_filing: false,
  };
  input.evidence_items = [];
  input.evidence.business_need_evidence = false;

  const processed = processFiniquitoCase(input);

  assert.equal(processed.recommendedWorkflowState, "PROOF_GAPS_BLOCKED");
  assert.equal(processed.calculation.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(
    processed.calculation.blockers.some(
      (b) => b.code === "PROOF_GAPS_BLOCKED" || b.code === "GENERIC_DISMISSAL_LETTER",
    ),
  );
});

test("FIX1-TC02: art. 161 with full evidence passes to partner review path", () => {
  const processed = processFiniquitoCase(loadFixture("employer_case_private_art161.json"));

  assert.notEqual(processed.recommendedWorkflowState, "PROOF_GAPS_BLOCKED");
  assert.ok(processed.fix1.proof_score.average_score >= 3);
  assert.ok(processed.litigationCaseFile.manifest_hash.length > 0);
});

test("FIX1-TC03: broad finiquito reservation emits warning", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.finiquito_execution = {
    signed: true,
    ratified: true,
    payment_date: "2026-06-20",
    reservation_text: "El trabajador se reserva todos los derechos y acciones laborales.",
  };

  const processed = processFiniquitoCase(input);

  assert.ok(processed.fix1.finiquito_warnings.some((w) => w.includes("reservation")));
  assert.ok(processed.fix1.court_risk_flags.some((f) => f.code === "FINIQUITO_CADUCIDAD_RISK"));
});

test("FIX1-TC04: AFC offset without approval is flagged by Fix1", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.termination.afc_offset_attempted = true;

  const processed = processFiniquitoCase(input);

  assert.ok(processed.calculation.warnings.some((w) => w.code === "AFC_OFFSET_REVIEW"));
  assert.ok(processed.fix1.court_risk_flags.some((f) => f.code === "AFC_REFUND_RISK"));
});

test("FIX1-TC05: deductions without authorization remain excluded", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.payroll.authorized_deductions = 300_000;
  input.evidence.deduction_authorization_uploaded = false;

  const processed = processFiniquitoCase(input);
  const employer = processed.calculation.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED");

  assert.equal(employer?.amounts.authorized_deductions, 0);
});

test("FIX1-TC06: honorarios high risk routes to special module", () => {
  const processed = processFiniquitoCase(loadFixture("honorarios_recharacterization_case.json"));

  assert.equal(processed.calculation.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(processed.fix1.court_risk_flags.some((f) => f.code === "HONORARIOS_RECHARACTERIZATION"));
});

test("FIX1-TC07: unpaid cotizaciones blocked with nulidad risk flag", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.cotizaciones_paid = false;

  const processed = processFiniquitoCase(input);

  assert.equal(processed.calculation.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(processed.fix1.court_risk_flags.some((f) => f.code === "COTIZACIONES_NULIDAD"));
});

test("FIX1-TC08: renuncia without voluntariness evidence requires legal review", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.termination.cause_code = "RENUNCIA";
  input.termination.resignation_voluntary_evidence = false;
  input.dismissal_letter = undefined;
  input.evidence_items = [];

  const processed = processFiniquitoCase(input);

  assert.equal(processed.calculation.status, "LEGAL_REVIEW_REQUIRED");
});

test("dismissal letter review detects generic art. 161 text", () => {
  const review = reviewDismissalLetter(
    {
      cause_code: "NECESIDADES_EMPRESA",
      facts: "Por necesidades de la empresa se despide al trabajador.",
    },
    "NECESIDADES_EMPRESA",
  );

  assert.equal(review.generic_risk, true);
  assert.ok(review.score < 4);
});
