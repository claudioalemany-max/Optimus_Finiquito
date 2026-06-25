import type { ComplexDeduction, DeductionValidationResult } from "../models/complex-case.js";
import type { Money } from "../models/common.js";

function requiredEvidence(deduction: ComplexDeduction): string[] {
  const missing: string[] = [];
  if (!deduction.written_agreement) missing.push("written_agreement");
  if (!deduction.employee_authorization) missing.push("employee_authorization");
  if (deduction.type === "mutuo" && !deduction.balance_certificate) {
    missing.push("balance_certificate");
  }
  return missing;
}

export function validateDeductions(
  deductions: ComplexDeduction[],
  ufValue: number,
): DeductionValidationResult {
  let deductibleAmount = 0;
  const missingEvidence: string[] = [];
  let blocked = false;
  let lawyerOverride = false;

  for (const deduction of deductions) {
    const clp =
      deduction.amount_clp > 0 ? deduction.amount_clp : deduction.amount_uf * ufValue;
    const missing = requiredEvidence(deduction);

    if (missing.length === 0 || deduction.lawyer_approved) {
      deductibleAmount += clp;
      if (missing.length > 0 && deduction.lawyer_approved) {
        lawyerOverride = true;
      }
    } else {
      blocked = true;
      missingEvidence.push(...missing.map((m) => `${deduction.type}:${m}`));
    }
  }

  let status: DeductionValidationResult["status"] = "allowed";
  if (blocked && lawyerOverride) status = "lawyer_override_required";
  else if (blocked) status = "blocked";

  return { status, missing_evidence: missingEvidence, deductible_amount: deductibleAmount };
}
