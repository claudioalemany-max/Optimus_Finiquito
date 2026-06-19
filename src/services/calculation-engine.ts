import type { CaseInput } from "../models/case-input.js";
import type { TraceLine } from "../models/common.js";
import type { CalculationContext, ComputedScenario, LegalClassification } from "../models/engine.js";
import type { IuscBracket } from "../models/ruleset.js";

function effectiveClassification(
  classification: LegalClassification,
  overrides?: CalculationContext["overrides"],
): LegalClassification {
  if (!overrides) return classification;
  return {
    ...classification,
    iasApplies: overrides.iasApplies ?? classification.iasApplies,
    noticeApplies: overrides.noticeApplies ?? classification.noticeApplies,
    obraFaenaApplies: overrides.obraFaenaApplies ?? classification.obraFaenaApplies,
    vacationPayable: overrides.vacationPayable ?? classification.vacationPayable,
    riskLevel: overrides.riskLevel ?? classification.riskLevel,
  };
}

function rate(input: CaseInput, key: keyof CaseInput["config"]["rates"]): number {
  return input.config.rates[key] ?? 0;
}

export function calculateService(startDate: string, endDate: string, yearCap: number) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let fullYears = end.getFullYear() - start.getFullYear();
  const anniversary = new Date(end.getFullYear(), start.getMonth(), start.getDate());
  if (end < anniversary) fullYears -= 1;

  let remainingMonths = end.getMonth() - start.getMonth();
  if (remainingMonths < 0) remainingMonths += 12;

  const indemnizableYears = Math.min(yearCap, fullYears + (remainingMonths > 6 ? 1 : 0));
  return { fullYears, remainingMonths, indemnizableYears };
}

export function calculateIusc(base: number, brackets: IuscBracket[]): number {
  const bracket = brackets.find((b) => base >= b.from && base <= b.to) ?? brackets[brackets.length - 1];
  return Math.max(0, base * bracket.factor - bracket.rebate);
}

export function calculateScenario(ctx: CalculationContext, scenarioId: string): ComputedScenario {
  const { input, rules, classification, overrides } = ctx;
  const effective = effectiveClassification(classification, overrides);
  const trace: TraceLine[] = [];

  const rawBase =
    input.payroll.fixed_salary + input.payroll.avg_variable_3m + input.payroll.included_allowances;

  const cap90Uf = input.config.uf_value * rules.parameters.ias_monthly_cap_uf.value;
  const indemnityBase = Math.min(rawBase, cap90Uf);

  trace.push({
    line_id: "INDEMNITY_BASE",
    amount: indemnityBase,
    formula: "min(fixed_salary + avg_variable_3m + included_allowances, uf_value * 90)",
    inputs: ["fixed_salary", "avg_variable_3m", "included_allowances", "uf_value"],
    rule_refs: ["CL_CT_ART_172"],
  });

  const service = calculateService(
    input.contract.start_date,
    input.contract.end_date,
    rules.parameters.ias_year_cap.value,
  );

  const iasLegal =
    effective.iasApplies && service.fullYears >= 1 ? indemnityBase * service.indemnizableYears : 0;

  if (iasLegal > 0) {
    trace.push({
      line_id: "IAS_LEGAL",
      amount: iasLegal,
      formula: "indemnity_base * indemnizable_years",
      inputs: ["indemnity_base", "indemnizable_years"],
      rule_refs: ["CL_CT_ART_163", "CL_CT_ART_172"],
      assumptions: [`indemnizable_years=${service.indemnizableYears}`],
    });
  }

  const noticeNotGiven = overrides?.forceNoNotice ?? input.termination.notice_given_30_days === false;
  const noticeIndemnity = effective.noticeApplies && noticeNotGiven ? indemnityBase : 0;

  if (noticeIndemnity > 0) {
    trace.push({
      line_id: "NOTICE_INDEMNITY",
      amount: noticeIndemnity,
      formula: "indemnity_base if notice not given",
      inputs: ["indemnity_base", "notice_given_30_days"],
      rule_refs: ["CL_CT_ART_162"],
    });
  }

  const obraFaenaIndemnity = effective.obraFaenaApplies
    ? (indemnityBase / 30) *
      rules.parameters.obra_faena_days_per_month.value *
      ((input.payroll.obra_faena_months ?? 0) + (input.payroll.obra_faena_fraction_gt_15 ? 1 : 0))
    : 0;

  if (obraFaenaIndemnity > 0) {
    trace.push({
      line_id: "OBRA_FAENA_INDEMNITY",
      amount: obraFaenaIndemnity,
      formula: "(indemnity_base / 30) * obra_faena_days_per_month * obra_faena_months",
      inputs: ["indemnity_base", "obra_faena_months"],
      rule_refs: ["CL_CT_ART_163"],
    });
  }

  const vacationPayment = effective.vacationPayable
    ? (indemnityBase / 30) * (input.payroll.vacation_calendar_days ?? 0)
    : 0;

  if (vacationPayment > 0) {
    trace.push({
      line_id: "VACATION_PAYMENT",
      amount: vacationPayment,
      formula: "(indemnity_base / 30) * vacation_calendar_days",
      inputs: ["indemnity_base", "vacation_calendar_days"],
      rule_refs: ["CL_CT_FERIADO"],
    });
  }

  const taxableGross =
    input.payroll.pending_salary +
    input.payroll.taxable_bonus +
    (input.payroll.conventional_indemnity_taxable ?? 0);

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
  const iusc = calculateIusc(iuscBase, rules.iusc_monthly_table_2026_06.brackets);
  trace.push({
    line_id: "IUSC",
    amount: iusc,
    formula: "max(0, iusc_base * bracket_factor - bracket_rebate)",
    inputs: ["taxable_gross", "worker_contributions"],
    rule_refs: ["CL_SII_IUSC"],
  });

  const nonTaxableTotal =
    iasLegal +
    noticeIndemnity +
    obraFaenaIndemnity +
    vacationPayment +
    (input.payroll.non_taxable_bonus_or_indemnity ?? 0);

  const reimbursements = input.payroll.reimbursements ?? 0;
  const deductions =
    (input.payroll.authorized_deductions ?? 0) > 0 && !input.evidence?.deduction_authorization_uploaded
      ? 0
      : (input.payroll.authorized_deductions ?? 0);

  const netPayable = nonTaxableTotal + taxableGross - workerContributions - iusc + reimbursements - deductions;

  trace.push({
    line_id: "NET_PAYABLE",
    amount: netPayable,
    formula: "non_taxable_total + taxable_gross - worker_contributions - iusc + reimbursements - deductions",
    rule_refs: ["CL_FINIQUITO_NET"],
  });

  const employerContributionRate =
    (input.contract.contract_type === "INDEFINITE"
      ? rate(input, "afc_employer_indefinite")
      : rate(input, "afc_employer_fixed_or_work")) +
    rate(input, "sis_employer") +
    rate(input, "mutual_employer") +
    rate(input, "employer_pension");

  const employerContributions = taxableGross * employerContributionRate;
  const totalClientCashCost = nonTaxableTotal + taxableGross + reimbursements + employerContributions;

  trace.push({
    line_id: "EMPLOYER_CASH_COST",
    amount: totalClientCashCost,
    formula: "non_taxable_total + taxable_gross + reimbursements + employer_contributions",
    rule_refs: ["CL_EMPLOYER_COST"],
  });

  if (deductions === 0 && (input.payroll.authorized_deductions ?? 0) > 0) {
    trace.push({
      line_id: "DEDUCTIONS_EXCLUDED",
      amount: 0,
      formula: "authorized_deductions excluded pending upload",
      rule_refs: ["VALIDATION_DEDUCTION_SUPPORT"],
      warnings: ["Deduction excluded until authorization uploaded."],
    });
  }

  return {
    scenario_id: scenarioId,
    label: overrides?.label ?? scenarioId,
    risk_level: effective.riskLevel,
    amounts: {
      indemnity_base: indemnityBase,
      ias_legal: iasLegal,
      notice_indemnity: noticeIndemnity,
      obra_faena_indemnity: obraFaenaIndemnity,
      vacation_payment: vacationPayment,
      taxable_gross: taxableGross,
      worker_contributions: workerContributions,
      iusc,
      non_taxable_total: nonTaxableTotal,
      reimbursements,
      authorized_deductions: deductions,
      net_payable: netPayable,
      employer_contributions: employerContributions,
      total_client_cash_cost: totalClientCashCost,
    },
    trace,
  };
}
