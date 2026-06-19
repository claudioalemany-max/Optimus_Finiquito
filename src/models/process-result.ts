import type { CaseInput } from "./case-input.js";
import type { CalculationResult } from "./calculation-result.js";
import type { AuditLog } from "./audit.js";
import type { LegalClassification } from "./engine.js";
import type { Report } from "./report.js";
import type { WorkflowState } from "./workflow.js";

export interface ProcessFiniquitoResult {
  input: CaseInput;
  classification: LegalClassification;
  calculation: CalculationResult;
  report: Report;
  auditLog: AuditLog;
  recommendedWorkflowState: WorkflowState;
}
