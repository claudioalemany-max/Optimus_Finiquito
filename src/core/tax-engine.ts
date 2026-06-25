import type { CaseInput } from "../models/case-input.js";
import type { Money, TraceLine } from "../models/common.js";
import type { IuscBracket } from "../models/ruleset.js";

export interface TaxTreatmentResult {
  taxable_gross: Money;
  worker_contributions: Money;
  iusc: Money;
  iusc_base: Money;
  trace: TraceLine[];
}

function rate(input: CaseInput, key: keyof CaseInput["config"]["rates"]): number {
  return input.config.rates[key] ?? 0;
}

export function calculateIusc(base: number, brackets: IuscBracket[]): number {
  const bracket = brackets.find((b) => base >= b.from && base <= b.to) ?? brackets[brackets.length - 1];
  return Math.max(0, base * bracket.factor - bracket.rebate);
}

export function calculateTaxableGross(input: CaseInput): Money {
  return (
    input.payroll.pending_salary +
    input.payroll.taxable_bonus +
    (input.payroll.conventional_indemnity_taxable ?? 0)
  );
}

export function calculateTaxTreatment(
  input: CaseInput,
  iuscBrackets: IuscBracket[],
): TaxTreatmentResult {
  const trace: TraceLine[] = [];
  const taxableGross = calculateTaxableGross(input);

  trace.push({
    line_id: "TAXABLE_GROSS",
    amount: taxableGross,
    formula: "pending_salary + taxable_bonus + conventional_indemnity_taxable",
    inputs: ["pending_salary", "taxable_bonus"],
    rule_refs: ["CL_TAX_REMUNERATION"],
  });

  const workerContributionRate =
    rate(input, "afp_worker") +
    rate(input, "health_worker") +
    (input.contract.contract_type === "INDEFINITE" ? rate(input, "afc_worker_indefinite") : 0);

  const workerContributions = taxableGross * workerContributionRate;
  trace.push({
    line_id: "WORKER_CONTRIBUTIONS",
    amount: workerContributions,
    formula: "taxable_gross * (afp + health + afc_worker)",
    inputs: ["taxable_gross"],
    rule_refs: ["CL_PREVISIONAL_WORKER"],
  });

  const iuscBase = Math.max(0, taxableGross - workerContributions);
  const iusc = calculateIusc(iuscBase, iuscBrackets);
  trace.push({
    line_id: "IUSC",
    amount: iusc,
    formula: "max(0, iusc_base * bracket_factor - bracket_rebate)",
    inputs: ["taxable_gross", "worker_contributions"],
    rule_refs: ["CL_SII_IUSC"],
  });

  return { taxable_gross: taxableGross, worker_contributions: workerContributions, iusc, iusc_base: iuscBase, trace };
}
