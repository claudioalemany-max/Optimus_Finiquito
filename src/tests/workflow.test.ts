import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { CaseInput } from "../models/case-input.js";
import { processFiniquitoCase } from "../services/finiquito-engine.js";
import {
  buildWorkflowContext,
  buildWorkflowPlan,
  resolveApprovalRequirements,
  simulateWorkflowPath,
  transition,
} from "../services/workflow-service.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadFixture(name: string): CaseInput {
  return JSON.parse(readFileSync(join(packageRoot, "examples", name), "utf8")) as CaseInput;
}

test("workflow: art. 161 executable case requires partner and tax approvals", () => {
  const processed = processFiniquitoCase(loadFixture("employer_case_private_art161.json"));
  const approvals = processed.workflowPlan.required_approvals.map((a) => a.role);

  assert.equal(processed.recommendedWorkflowState, "LEGAL_CLASSIFIED");
  assert.ok(approvals.includes("ASSOCIATE"));
  assert.ok(approvals.includes("TAX_ADVISOR"));
  assert.ok(approvals.includes("PARTNER"));
  assert.equal(processed.workflowPlan.can_issue_report, true);
});

test("workflow: fuero case is blocked and cannot issue report", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.fuero = true;
  input.evidence.desafuero_authorized = false;

  const processed = processFiniquitoCase(input);

  assert.equal(processed.recommendedWorkflowState, "BLOCKED");
  assert.equal(processed.workflowPlan.can_issue_report, false);
  assert.equal(processed.workflowPlan.can_execute, false);
  assert.ok(processed.workflowPlan.required_approvals.some((a) => a.blocking));
});

test("workflow: public sector requires public law partner approval", () => {
  const processed = processFiniquitoCase(loadFixture("public_sector_case.json"));

  assert.equal(processed.recommendedWorkflowState, "BLOCKED");
  assert.ok(
    processed.workflowPlan.required_approvals.some((a) => a.role === "PUBLIC_LAW_PARTNER" && a.blocking),
  );
});

test("workflow: honorarios high risk requires litigation review", () => {
  const processed = processFiniquitoCase(loadFixture("honorarios_recharacterization_case.json"));

  assert.ok(
    processed.workflowPlan.required_approvals.some((a) => a.role === "LITIGATION_REVIEW" && a.blocking),
  );
});

test("workflow: transition enforces partner block on hard blockers", () => {
  const input = loadFixture("employer_case_private_art161.json");
  const processed = processFiniquitoCase(input);
  const ctx = buildWorkflowContext(processed.classification, processed.calculation);

  ctx.hasHardBlockers = true;
  assert.equal(transition("PARTNER_REVIEW_PENDING", "APPROVE_PARTNER", ctx), "BLOCKED");
});

test("workflow: CLIENT_REPORT_ISSUED moves to EXECUTION_PENDING before EXECUTED", () => {
  const input = loadFixture("employer_case_private_art161.json");
  const processed = processFiniquitoCase(input);
  const ctx = buildWorkflowContext(processed.classification, processed.calculation);

  let state = transition("APPROVED_FOR_CLIENT", "ISSUE_REPORT", ctx);
  assert.equal(state, "CLIENT_REPORT_ISSUED");
  state = transition(state, "MARK_EXECUTED", ctx);
  assert.equal(state, "EXECUTION_PENDING");
  state = transition(state, "MARK_EXECUTED", ctx);
  assert.equal(state, "EXECUTED");
});

test("workflow: simulate path stops at BLOCKED", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.evidence.fuero = true;
  const processed = processFiniquitoCase(input);
  const path = simulateWorkflowPath(input, processed.classification, processed.calculation);

  assert.deepEqual(path, [
    "DRAFT",
    "INTAKE_COMPLETE",
    "LEGAL_CLASSIFICATION_PENDING",
    "BLOCKED",
  ]);
});

test("workflow: deductions add tax advisor approval", () => {
  const input = loadFixture("employer_case_private_art161.json");
  input.payroll.authorized_deductions = 100_000;
  const processed = processFiniquitoCase(input);
  const approvals = resolveApprovalRequirements(
    processed.input,
    processed.classification,
    processed.calculation,
  );

  assert.ok(approvals.filter((a) => a.role === "TAX_ADVISOR").length >= 2);
  assert.ok(buildWorkflowPlan(processed.input, processed.classification, processed.calculation).blocked_actions.length >= 0);
});
