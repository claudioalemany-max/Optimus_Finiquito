import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { CaseInput } from "../models/case-input.js";
import { calculateFiniquito, processFiniquitoCase } from "../services/finiquito-engine.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadFixture(name: string): CaseInput {
  const path = join(packageRoot, "examples", name);
  return JSON.parse(readFileSync(path, "utf8")) as CaseInput;
}

function employerScenario(result: ReturnType<typeof calculateFiniquito>) {
  return result.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED");
}

test("TC-001: private art. 161 calculates IAS, notice, vacation and tax items", () => {
  const input = loadFixture("employer_case_private_art161.json");
  const result = calculateFiniquito(input);
  const employer = employerScenario(result);

  assert.ok(["EXECUTABLE", "EXECUTABLE_WITH_WARNINGS"].includes(result.status));
  assert.equal(result.blockers.length, 0);
  assert.ok(employer);
  const amounts = employer!.amounts;
  assert.equal(amounts.indemnity_base, 2_950_000);
  assert.equal(amounts.ias_legal, 17_700_000);
  assert.equal(amounts.notice_indemnity, 2_950_000);
  assert.ok((amounts.vacation_payment ?? 0) > 1_300_000);
  assert.equal(amounts.taxable_gross, 3_000_000);
  assert.ok((amounts.net_payable ?? 0) > 24_000_000);
  assert.equal(result.scenarios.length, 3);
});

test("TC-002: fuero blocker stops execution", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.fuero = true;
  input.evidence.desafuero_authorized = false;

  const result = calculateFiniquito(input);
  assert.equal(result.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(result.blockers.some((b) => b.code === "FUERO_BLOCKER"));
});

test("TC-003: medical leave + art. 161 blocker", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.medical_leave = true;

  const result = calculateFiniquito(input);
  assert.equal(result.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(result.blockers.some((b) => b.code === "MEDICAL_LEAVE_ART_161_BLOCKER"));
});

test("TC-004: unpaid cotizaciones blocker", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.cotizaciones_paid = false;

  const result = calculateFiniquito(input);
  assert.equal(result.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(result.blockers.some((b) => b.code === "COTIZACIONES_UNPAID_BLOCKER"));
});

test("TC-005: honorarios high recharacterization routes to special module", () => {
  const input = loadFixture("honorarios_recharacterization_case.json");
  const result = calculateFiniquito(input);

  assert.equal(result.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(result.blockers.some((b) => b.code === "SPECIAL_ROUTE_REQUIRED"));
  assert.ok(result.blockers.some((b) => b.code === "COTIZACIONES_UNPAID_BLOCKER"));
  const challenge = result.scenarios.find((s) => s.scenario_id === "EMPLOYEE_CHALLENGE");
  assert.ok((challenge?.amounts.ias_legal ?? 0) > 0);
});

test("TC-006: public-sector case blocked from private engine", () => {
  const input = loadFixture("public_sector_case.json");
  const result = calculateFiniquito(input);

  assert.equal(result.status, "NOT_EXECUTABLE_BLOCKED");
  assert.ok(result.blockers.some((b) => b.code === "SPECIAL_ROUTE_REQUIRED"));
});

test("TC-007: invalid resignation requires legal review", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.termination.cause_code = "RENUNCIA";
  input.termination.resignation_voluntary_evidence = false;

  const result = calculateFiniquito(input);
  assert.equal(result.status, "LEGAL_REVIEW_REQUIRED");
  assert.ok(result.warnings.some((w) => w.code === "INVALID_RESIGNATION_RISK"));
});

test("TC-008: deductions excluded without authorization", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.payroll.authorized_deductions = 250_000;
  input.evidence.deduction_authorization_uploaded = false;

  const result = calculateFiniquito(input);
  const employer = employerScenario(result);
  assert.equal(employer?.amounts.authorized_deductions, 0);
  assert.ok(result.warnings.some((w) => w.code === "DEDUCTION_SUPPORT"));
});

test("TC-009: bonus without policy emits warning", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.bonus_policy_uploaded = false;

  const result = calculateFiniquito(input);
  assert.ok(result.warnings.some((w) => w.code === "BONUS_SUPPORT"));
});

test("TC-010: AFC offset attempted emits warning", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.termination.afc_offset_attempted = true;

  const result = calculateFiniquito(input);
  assert.ok(result.warnings.some((w) => w.code === "AFC_OFFSET_REVIEW"));
});

test("processFiniquitoCase returns report, audit log and workflow recommendation", () => {
  const input = loadFixture("employer_case_private_art161.json");
  const processed = processFiniquitoCase(input);

  assert.equal(processed.calculation.case_id, input.case_id);
  assert.equal(processed.report.case_id, input.case_id);
  assert.equal(processed.report.executive_summary.client_name, input.client.name);
  assert.ok(processed.auditLog.entries.length >= 3);
  assert.equal(processed.recommendedWorkflowState, "LEGAL_CLASSIFIED");
  assert.ok(processed.report.disclaimer?.includes("lawyer review"));
});
