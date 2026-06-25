import type { CaseInput } from "../models/case-input.js";
import type { CaseTypeValidationResult } from "../models/case-type.js";
import type { SavedCaseResult } from "./run-case-service.js";
import { runCaseAndSave } from "./run-case-service.js";
import {
  createCaseSession,
  getCaseSession,
  updateCaseSession,
} from "./case-session-store.js";
import { listAppModules } from "./app-module-service.js";
import {
  getCaseType,
  getInputSchema,
  listCaseTypesGrouped,
} from "./case-type-registry-service.js";
import {
  applyFormValuesToInput,
  validateCaseTypeInput,
} from "./case-type-validation-service.js";

function syncCauseCode(input: CaseInput, caseTypeCode: string): CaseInput {
  const config = getCaseType(caseTypeCode);
  if (!config) return input;
  return {
    ...input,
    case_type_code: caseTypeCode,
    termination: { ...input.termination, cause_code: config.cause_code },
  };
}

function buildCaseApiPayload(
  saved: SavedCaseResult,
  validation: CaseTypeValidationResult,
  extra: Record<string, unknown> = {},
) {
  const { result, paths } = saved;
  const employer = result.calculation.scenarios.find((s) => s.scenario_id === "EMPLOYER_INTENDED");

  return {
    case_id: result.input.case_id,
    session_id: extra.session_id,
    case_type_code: result.input.case_type_code,
    run_mode: extra.run_mode,
    draft: extra.draft === true,
    status: result.calculation.status,
    workflow: result.recommendedWorkflowState,
    workflow_plan: result.workflowPlan,
    validation,
    net_payable: employer?.amounts.net_payable ?? 0,
    employer_cost: employer?.amounts.total_client_cash_cost ?? 0,
    blockers: result.calculation.blockers,
    warnings: result.calculation.warnings,
    required_approvals: result.workflowPlan.required_approvals,
    proof_score: result.fix1.proof_score.average_score,
    tribunal_ready: result.fix1.proof_score.tribunal_ready,
    proof_gaps: result.fix1.evidence_matrix.proof_gaps,
    tribunal_export_url: `/output/${paths.baseName}_tribunal.json`,
    can_issue_report: result.workflowPlan.can_issue_report && extra.draft !== true,
    report_url: `/report/${paths.baseName}.html`,
    report_json_url: `/output/${paths.baseName}_report.json`,
    generated_at: new Date().toISOString(),
  };
}

export function handleGetCaseTypes() {
  return listCaseTypesGrouped();
}

export function handleGetAppModules() {
  return listAppModules();
}

export function handleGetInputSchema(code: string) {
  const schema = getInputSchema(code);
  if (!schema) throw new Error("Tipo de caso no encontrado");
  return schema;
}

export function handleCreateCase(body: { case_type_code?: string }) {
  if (!body.case_type_code) throw new Error("Se requiere case_type_code");
  const session = createCaseSession(body.case_type_code);
  return {
    id: session.id,
    case_type_code: session.case_type_code,
    case_id: session.input.case_id,
    input: session.input,
    created_at: session.created_at,
  };
}

export function handleGetCase(id: string) {
  const session = getCaseSession(id);
  if (!session) throw new Error("Caso no encontrado");
  return session;
}

export function handleUpdateCase(
  id: string,
  body: { values?: Record<string, string | number | boolean>; input?: Partial<CaseInput> },
) {
  const session = getCaseSession(id);
  if (!session) throw new Error("Caso no encontrado");

  let input = session.input;
  if (body.values) {
    input = applyFormValuesToInput(input, body.values);
  }
  if (body.input) {
    input = { ...input, ...body.input };
  }
  input = syncCauseCode(input, session.case_type_code);

  const updated = updateCaseSession(id, { input });
  return updated;
}

export function handleValidateCase(id: string) {
  const session = getCaseSession(id);
  if (!session) throw new Error("Caso no encontrado");
  const input = syncCauseCode(session.input, session.case_type_code);
  return validateCaseTypeInput(session.case_type_code, input, {
    partner_approved: session.partner_approved,
    run_mode: session.run_mode,
  });
}

export function handleCalculateCase(
  id: string,
  mode: "draft" | "final",
  outputDir: string,
) {
  const session = getCaseSession(id);
  if (!session) throw new Error("Caso no encontrado");

  const run_mode = mode === "final" ? "final_review" : "draft";
  const input = syncCauseCode(session.input, session.case_type_code);
  const validation = validateCaseTypeInput(session.case_type_code, input, {
    partner_approved: session.partner_approved,
    run_mode,
  });

  if (mode === "final" && !validation.can_final_review) {
    const err = new Error("Revisión final no permitida: resolver bloqueos primero") as Error & {
      validation?: CaseTypeValidationResult;
    };
    err.validation = validation;
    throw err;
  }

  updateCaseSession(id, { run_mode });
  const saved = runCaseAndSave(input, outputDir, { draft: mode === "draft" });

  return buildCaseApiPayload(saved, validation, {
    session_id: id,
    run_mode,
    draft: mode === "draft",
  });
}

export function handleApproveCase(id: string) {
  const session = getCaseSession(id);
  if (!session) throw new Error("Caso no encontrado");
  const updated = updateCaseSession(id, { partner_approved: true });
  return {
    id: updated.id,
    partner_approved: updated.partner_approved,
    validation: validateCaseTypeInput(updated.case_type_code, updated.input, {
      partner_approved: true,
      run_mode: updated.run_mode,
    }),
  };
}
