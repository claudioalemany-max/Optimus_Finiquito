import { createHash } from "node:crypto";
import type { ProcessFiniquitoResult } from "../models/process-result.js";
import type { Fix1Result, LitigationCaseFile } from "../models/fix1.js";

export function buildLitigationCaseFile(result: ProcessFiniquitoResult): LitigationCaseFile {
  const trace = result.calculation.scenarios.flatMap((scenario) =>
    scenario.trace.map((line) => ({
      scenario_id: scenario.scenario_id,
      line_id: line.line_id,
      amount: line.amount,
      formula: line.formula,
      rule_refs: line.rule_refs,
      legal_basis: line.legal_basis ?? line.rule_refs,
      evidence_refs: line.evidence_refs ?? [],
    })),
  );

  const payload = {
    case_id: result.input.case_id,
    legal_theory: result.classification.causeCode,
    evidence_manifest: result.input.evidence_items ?? [],
    calculation_trace: trace,
    workflow_approvals: result.workflowPlan.required_approvals,
    risk_flags: [
      ...result.calculation.blockers,
      ...result.calculation.warnings,
      ...(result.fix1?.court_risk_flags ?? []),
    ],
    proof_score: result.fix1?.proof_score,
    export_timestamp: new Date().toISOString(),
  };

  const manifest_hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);

  return {
    ...payload,
    proof_score: result.fix1!.proof_score,
    manifest_hash,
  };
}

export function buildTribunalExportJson(result: ProcessFiniquitoResult): string {
  return JSON.stringify(buildLitigationCaseFile(result), null, 2);
}
