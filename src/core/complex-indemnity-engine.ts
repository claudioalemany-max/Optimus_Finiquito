import type { EmployeeCase, IndemnityRule } from "../models/complex-case.js";
import type { Money } from "../models/common.js";

export interface GrossIndemnityResult {
  gross_indemnity: Money;
  service_years: number;
  warnings: string[];
  assumptions: string[];
}

function serviceYears(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let years = end.getFullYear() - start.getFullYear();
  const anniversary = new Date(end.getFullYear(), start.getMonth(), start.getDate());
  if (end < anniversary) years -= 1;
  const months = ((end.getMonth() - start.getMonth()) + 12) % 12;
  return years + (months > 6 ? 1 : 0);
}

export function checkAnniversaryWarning(startDate: string, terminationDate: string): string | null {
  const start = new Date(startDate);
  const end = new Date(terminationDate);
  const nextAnniversary = new Date(end.getFullYear(), start.getMonth(), start.getDate());
  if (nextAnniversary <= end) {
    nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
  }
  const prevAnniversary = new Date(nextAnniversary);
  prevAnniversary.setFullYear(prevAnniversary.getFullYear() - 1);

  const daysSince = Math.floor((end.getTime() - prevAnniversary.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntil = Math.floor((nextAnniversary.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince <= 60 || daysUntil <= 60) {
    return "ANNIVERSARY_WARNING: termination within 60 days of service anniversary";
  }
  return null;
}

export function calculateGrossIndemnity(
  employee: EmployeeCase,
  ufValue: number,
  statutoryCapUf = 90,
  statutoryYearCap = 11,
): GrossIndemnityResult {
  const rule: IndemnityRule = employee.indemnity_rule;
  const years = serviceYears(employee.start_date, employee.termination_date);
  const warnings: string[] = [];
  const assumptions: string[] = [];

  const anniversary = checkAnniversaryWarning(employee.start_date, employee.termination_date);
  if (anniversary) warnings.push(anniversary);

  const daysPerYear = rule.days_per_year;
  assumptions.push(`days_per_year=${daysPerYear}`);
  assumptions.push(`source=${rule.source}`);

  let indemnizableYears = years;
  if (rule.apply_statutory_cap) {
    indemnizableYears = Math.min(years, statutoryYearCap);
    assumptions.push(`statutory_year_cap=${statutoryYearCap}`);
  } else {
    assumptions.push("statutory_year_cap=not_applied");
  }

  let base = employee.base_salary;
  if (rule.apply_statutory_cap) {
    const cap = ufValue * statutoryCapUf;
    base = Math.min(base, cap);
    assumptions.push(`monthly_cap_uf=${statutoryCapUf}`);
  }

  let gross = (base / 30) * daysPerYear * indemnizableYears;

  if (rule.sale_change_of_control && rule.uplift_percent > 0) {
    gross *= 1 + rule.uplift_percent / 100;
    assumptions.push(`sale_uplift=${rule.uplift_percent}%`);
  }

  for (const item of employee.variable_compensation_items) {
    if (item.legal_review_required) {
      warnings.push(`LEGAL_REVIEW: ${item.type} requires lawyer review`);
    }
  }

  return { gross_indemnity: gross, service_years: years, warnings, assumptions };
}
