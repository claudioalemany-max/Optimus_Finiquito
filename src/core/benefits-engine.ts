import type { CaseInput } from "../models/case-input.js";
import type { Money } from "../models/common.js";

export interface PendingBenefitsResult {
  pending_salary: Money;
  proportional_salary: Money;
  pending_commissions: Money;
  pending_bonuses: Money;
  proportional_bonuses: Money;
  travel_reimbursements: Money;
  other_reimbursements: Money;
  other_benefits: Money;
  total_pending_benefits: Money;
}

export function calculatePendingBenefits(input: CaseInput): PendingBenefitsResult {
  const pendingSalary = input.payroll.pending_salary ?? 0;
  const pendingBonuses = input.payroll.taxable_bonus ?? 0;
  const travelReimbursements = input.payroll.reimbursements ?? 0;
  const otherBenefits = input.payroll.non_taxable_bonus_or_indemnity ?? 0;

  const result: PendingBenefitsResult = {
    pending_salary: pendingSalary,
    proportional_salary: 0,
    pending_commissions: 0,
    pending_bonuses: pendingBonuses,
    proportional_bonuses: 0,
    travel_reimbursements: travelReimbursements,
    other_reimbursements: 0,
    other_benefits: otherBenefits,
    total_pending_benefits: pendingSalary + pendingBonuses + travelReimbursements + otherBenefits,
  };

  return result;
}
