import type { CaseInput } from "./case-input.js";
import type { CalculationResult } from "./calculation-result.js";
import type { AuditLog } from "./audit.js";
import type { LegalClassification } from "./engine.js";
import type { Report } from "./report.js";
import type { Fix1Result, LitigationCaseFile } from "./fix1.js";
import type { WorkflowPlan, WorkflowState } from "./workflow.js";

export interface ProcessFiniquitoResult {
  input: CaseInput;
  classification: LegalClassification;
  calculation: CalculationResult;
  report: Report;
  auditLog: AuditLog;
  recommendedWorkflowState: WorkflowState;
  workflowPlan: WorkflowPlan;
  fix1: Fix1Result;
  litigationCaseFile: LitigationCaseFile;
}
