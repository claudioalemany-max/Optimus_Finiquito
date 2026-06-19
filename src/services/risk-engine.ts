import type { CaseInput } from "../models/case-input.js";
import type { RiskItem } from "../models/common.js";
import type { LegalClassification, RiskResult } from "../models/engine.js";

export function runRiskEngine(input: CaseInput, classification: LegalClassification): RiskResult {
  const blockers: RiskItem[] = [];
  const warnings: RiskItem[] = [];

  if (input.evidence?.fuero && !input.evidence?.desafuero_authorized) {
    blockers.push({
      code: "FUERO_BLOCKER",
      severity: "BLOCKER",
      message: "Worker has fuero/protected status.",
      required_action: "Partner review and authorization/desafuero route.",
    });
  }

  if (
    input.evidence?.medical_leave &&
    ["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"].includes(input.termination.cause_code)
  ) {
    blockers.push({
      code: "MEDICAL_LEAVE_ART_161_BLOCKER",
      severity: "BLOCKER",
      message: "Medical leave conflicts with art. 161/desahucio route.",
      required_action: "Do not execute without legal review.",
    });
  }

  if (input.evidence?.cotizaciones_paid === false) {
    blockers.push({
      code: "COTIZACIONES_UNPAID_BLOCKER",
      severity: "BLOCKER",
      message: "Unpaid cotizaciones create nulidad exposure.",
      required_action: "Regularize or quantify nulidad scenario.",
    });
  }

  if (!classification.ordinaryPrivateEngine && classification.routeTo) {
    blockers.push({
      code: "SPECIAL_ROUTE_REQUIRED",
      severity: "BLOCKER",
      message: `Case must route to ${classification.routeTo}.`,
      required_action: "Run special legal module before ordinary finiquito.",
    });
  }

  if (input.termination?.afc_offset_attempted) {
    warnings.push({
      code: "AFC_OFFSET_REVIEW",
      severity: "WARNING",
      message: "Employer AFC offset attempted.",
      required_action: "Requires partner approval; disabled by default.",
    });
  }

  if ((input.payroll?.authorized_deductions ?? 0) > 0 && !input.evidence?.deduction_authorization_uploaded) {
    warnings.push({
      code: "DEDUCTION_SUPPORT",
      severity: "WARNING",
      message: "Deductions require legal basis and authorization.",
      required_action: "Upload support or exclude deduction.",
    });
  }

  if ((input.payroll?.taxable_bonus ?? 0) > 0 && !input.evidence?.bonus_policy_uploaded) {
    warnings.push({
      code: "BONUS_SUPPORT",
      severity: "WARNING",
      message: "Bonus needs policy/contract/devengo evidence.",
      required_action: "Upload support or lawyer override.",
    });
  }

  if ((input.payroll?.reimbursements ?? 0) > 0 && !input.evidence?.reimbursement_receipts_uploaded) {
    warnings.push({
      code: "REIMBURSEMENT_SUPPORT",
      severity: "WARNING",
      message: "Reimbursements need receipts/business purpose.",
      required_action: "Upload receipts.",
    });
  }

  if (
    input.termination.cause_code === "RENUNCIA" &&
    !input.termination.resignation_voluntary_evidence
  ) {
    warnings.push({
      code: "INVALID_RESIGNATION_RISK",
      severity: "WARNING",
      message: "Resignation lacks voluntary evidence; challenge risk as unjustified dismissal.",
      required_action: "Partner review before client report.",
    });
  }

  return { blockers, warnings };
}
