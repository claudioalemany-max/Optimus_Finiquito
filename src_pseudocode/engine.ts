// Pseudocode for Cursor implementation.
// This is intentionally framework-neutral TypeScript.

type Money = number;

export interface CalculationContext {
  input: any;
  rules: any;
  classification: LegalClassification;
  risks: RiskResult;
}

export interface LegalClassification {
  ordinaryPrivateEngine: boolean;
  causeCode: string;
  iasApplies: boolean;
  noticeApplies: boolean;
  obraFaenaApplies: boolean;
  vacationPayable: boolean;
  routeTo?: string;
  riskLevel: "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH" | "CRITICAL";
}

export interface RiskItem {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKER" | "CRITICAL";
  message: string;
  required_action?: string;
}

export interface RiskResult {
  blockers: RiskItem[];
  warnings: RiskItem[];
}

export interface TraceLine {
  line_id: string;
  amount: Money;
  formula: string;
  inputs: string[];
  rule_refs: string[];
  assumptions?: string[];
  warnings?: string[];
}

export function classifyCase(input: any, caseCatalog: any): LegalClassification {
  const catalogEntry = caseCatalog.cases.find((c: any) => c.cause_code === input.termination.cause_code);
  if (!catalogEntry) throw new Error(`Unknown cause_code: ${input.termination.cause_code}`);

  if (input.contract.legal_regime === "PUBLIC_STATUTORY" || input.contract.legal_regime === "MUNICIPAL") {
    return {
      ordinaryPrivateEngine: false,
      causeCode: input.termination.cause_code,
      iasApplies: false,
      noticeApplies: false,
      obraFaenaApplies: false,
      vacationPayable: false,
      routeTo: "public_sector_module",
      riskLevel: "CRITICAL",
    };
  }

  if (input.contract.legal_regime === "HONORARIOS") {
    const score = scoreHonorariosRecharacterization(input.risk_factors ?? {});
    return {
      ordinaryPrivateEngine: score < 3,
      causeCode: input.termination.cause_code,
      iasApplies: score >= 3,
      noticeApplies: score >= 3,
      obraFaenaApplies: false,
      vacationPayable: score >= 3,
      routeTo: score >= 3 ? "honorarios_recharacterization_module" : undefined,
      riskLevel: score >= 4 ? "CRITICAL" : score >= 3 ? "HIGH" : "MEDIUM",
    };
  }

  return {
    ordinaryPrivateEngine: Boolean(catalogEntry.ordinary_private_engine),
    causeCode: catalogEntry.cause_code,
    iasApplies: Boolean(catalogEntry.ias_applies),
    noticeApplies: Boolean(catalogEntry.notice_applies),
    obraFaenaApplies: Boolean(catalogEntry.obra_faena_indemnity_applies),
    vacationPayable: Boolean(catalogEntry.vacation_payable),
    routeTo: catalogEntry.route_to,
    riskLevel: catalogEntry.default_risk,
  };
}

export function runRiskEngine(input: any, classification: LegalClassification): RiskResult {
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

  return { blockers, warnings };
}

export function calculateScenario(ctx: CalculationContext, scenarioId: string) {
  const { input, rules, classification } = ctx;
  const trace: TraceLine[] = [];

  const rawBase =
    input.payroll.fixed_salary +
    input.payroll.avg_variable_3m +
    input.payroll.included_allowances;

  const cap90Uf = input.config.uf_value * rules.parameters.ias_monthly_cap_uf.value;
  const indemnityBase = Math.min(rawBase, cap90Uf);

  trace.push({
    line_id: "INDEMNITY_BASE",
    amount: indemnityBase,
    formula: "min(fixed_salary + avg_variable_3m + included_allowances, uf_value * 90)",
    inputs: ["fixed_salary", "avg_variable_3m", "included_allowances", "uf_value"],
    rule_refs: ["CL_CT_ART_172"],
  });

  const service = calculateService(input.contract.start_date, input.contract.end_date, rules.parameters.ias_year_cap.value);

  const iasLegal = classification.iasApplies && service.fullYears >= 1 ? indemnityBase * service.indemnizableYears : 0;
  const noticeIndemnity =
    classification.noticeApplies && input.termination.notice_given_30_days === false ? indemnityBase : 0;

  const obraFaenaIndemnity = classification.obraFaenaApplies
    ? (indemnityBase / 30) *
      rules.parameters.obra_faena_days_per_month.value *
      ((input.payroll.obra_faena_months ?? 0) + (input.payroll.obra_faena_fraction_gt_15 ? 1 : 0))
    : 0;

  const vacationPayment = classification.vacationPayable
    ? (indemnityBase / 30) * (input.payroll.vacation_calendar_days ?? 0)
    : 0;

  const taxableGross =
    input.payroll.pending_salary +
    input.payroll.taxable_bonus +
    (input.payroll.conventional_indemnity_taxable ?? 0);

  const workerContributionRate =
    input.config.rates.afp_worker +
    input.config.rates.health_worker +
    (input.contract.contract_type === "INDEFINITE" ? input.config.rates.afc_worker_indefinite : 0);

  const workerContributions = taxableGross * workerContributionRate;
  const iuscBase = Math.max(0, taxableGross - workerContributions);
  const iusc = calculateIusc(iuscBase, rules.iusc_monthly_table_2026_06.brackets);

  const nonTaxableTotal =
    iasLegal +
    noticeIndemnity +
    obraFaenaIndemnity +
    vacationPayment +
    (input.payroll.non_taxable_bonus_or_indemnity ?? 0);

  const reimbursements = input.payroll.reimbursements ?? 0;
  const deductions = input.payroll.authorized_deductions ?? 0;

  const netPayable = nonTaxableTotal + taxableGross - workerContributions - iusc + reimbursements - deductions;

  const employerContributionRate =
    (input.contract.contract_type === "INDEFINITE"
      ? input.config.rates.afc_employer_indefinite
      : input.config.rates.afc_employer_fixed_or_work) +
    input.config.rates.sis_employer +
    input.config.rates.mutual_employer +
    input.config.rates.employer_pension;

  const employerContributions = taxableGross * employerContributionRate;
  const totalClientCashCost = nonTaxableTotal + taxableGross + reimbursements + employerContributions;

  return {
    scenario_id: scenarioId,
    label: scenarioId,
    risk_level: classification.riskLevel,
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

function scoreHonorariosRecharacterization(riskFactors: Record<string, boolean>): number {
  return Object.values(riskFactors).filter(Boolean).length;
}

function calculateService(startDate: string, endDate: string, yearCap: number) {
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

function calculateIusc(base: number, brackets: Array<{ from: number; to: number; factor: number; rebate: number }>) {
  const bracket = brackets.find((b) => base >= b.from && base <= b.to) ?? brackets[brackets.length - 1];
  return Math.max(0, base * bracket.factor - bracket.rebate);
}

