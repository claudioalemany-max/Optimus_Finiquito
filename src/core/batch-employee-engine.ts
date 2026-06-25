import type {
  BatchResult,
  ComplexCalculationParameters,
  ComplexCaseInput,
  ComplexScenarioDefinition,
  ComplexScenarioId,
  EmployeeScenarioResult,
} from "../models/complex-case.js";
import type { Money } from "../models/common.js";
import { calculateArt17N13Limit } from "./art17-n13-engine.js";
import { calculateGrossIndemnity } from "./complex-indemnity-engine.js";
import { validateDeductions } from "./deduction-evidence-engine.js";
import { calculateIuscReliquidation } from "./iusc-reliquidation-engine.js";

export const DEFAULT_COMPLEX_SCENARIOS: ComplexScenarioDefinition[] = [
  {
    scenario_id: "EMPLOYER_PREFERRED",
    label: "Employer preferred",
    exclude_disputed_variable: false,
    employee_favorable_bonus: false,
    adverse_labor_assumptions: false,
  },
  {
    scenario_id: "CONSERVATIVE_TAX",
    label: "Conservative tax",
    exclude_disputed_variable: true,
    employee_favorable_bonus: false,
    adverse_labor_assumptions: false,
  },
  {
    scenario_id: "EMPLOYEE_CHALLENGE",
    label: "Employee challenge",
    exclude_disputed_variable: false,
    employee_favorable_bonus: true,
    adverse_labor_assumptions: false,
  },
  {
    scenario_id: "WORST_CREDIBLE",
    label: "Worst credible case",
    exclude_disputed_variable: false,
    employee_favorable_bonus: true,
    adverse_labor_assumptions: true,
  },
];

function runEmployeeScenario(
  employee: ComplexCaseInput["employees"][0],
  scenario: ComplexScenarioDefinition,
  params: ComplexCalculationParameters,
  ufValue: number,
): EmployeeScenarioResult {
  const gross = calculateGrossIndemnity(employee, ufValue);
  const art17 = calculateArt17N13Limit(
    employee,
    {
      gross_indemnity: gross.gross_indemnity,
      exclude_disputed_variable: scenario.exclude_disputed_variable,
      employee_favorable_bonus: scenario.employee_favorable_bonus,
    },
    {
      ipc_table: params.ipc_table,
      years_of_service_for_tax: employee.years_of_service_for_tax ?? gross.service_years,
    },
  );

  const iusc = calculateIuscReliquidation(
    art17.taxable_excess,
    employee.base_salary,
    params.utm_value,
    params.iusc_brackets,
  );

  const deductions = validateDeductions(employee.deductions, ufValue);
  const reimbursements = employee.reimbursements ?? 0;
  const pendingSalary = employee.pending_salary ?? 0;

  const deductible =
    deductions.status === "blocked" ? 0 : deductions.deductible_amount;

  const netPayable =
    art17.gross_indemnity +
    pendingSalary +
    reimbursements -
    iusc.total_iusc -
    deductible;

  const assumptions = [
    ...gross.assumptions,
    `scenario=${scenario.scenario_id}`,
    `exclude_disputed=${scenario.exclude_disputed_variable}`,
  ];

  if (scenario.adverse_labor_assumptions) {
    assumptions.push("adverse_labor_assumptions=true");
  }

  return {
    employee_id: employee.employee_id,
    scenario_id: scenario.scenario_id,
    assumptions,
    gross_indemnity: art17.gross_indemnity,
    art17,
    iusc_reliquidation: iusc,
    deductions,
    reimbursements,
    net_payable: netPayable,
    warnings: gross.warnings,
  };
}

export function runBatch(caseInput: ComplexCaseInput, params: ComplexCalculationParameters): BatchResult {
  const scenarios =
    caseInput.scenarios.length > 0 ? caseInput.scenarios : DEFAULT_COMPLEX_SCENARIOS;
  const ufValue = caseInput.parameter_snapshot.uf_value;

  const employeeResults: EmployeeScenarioResult[] = [];
  for (const employee of caseInput.employees) {
    for (const scenario of scenarios) {
      employeeResults.push(runEmployeeScenario(employee, scenario, params, ufValue));
    }
  }

  const baseScenario: ComplexScenarioId = "EMPLOYER_PREFERRED";
  const baseResults = employeeResults.filter((r) => r.scenario_id === baseScenario);

  const consolidated = baseResults.reduce(
    (acc, r) => ({
      total_gross: acc.total_gross + r.gross_indemnity,
      total_tax: acc.total_tax + r.iusc_reliquidation.total_iusc,
      total_deductions:
        acc.total_deductions +
        (r.deductions.status === "blocked" ? 0 : r.deductions.deductible_amount),
      total_net: acc.total_net + r.net_payable,
    }),
    { total_gross: 0, total_tax: 0, total_deductions: 0, total_net: 0 },
  );

  const scenarioDeltas = scenarios
    .filter((s) => s.scenario_id !== baseScenario)
    .map((scenario) => {
      const results = employeeResults.filter((r) => r.scenario_id === scenario.scenario_id);
      const deltaGross = results.reduce((s, r) => s + r.gross_indemnity, 0) - consolidated.total_gross;
      const deltaNet = results.reduce((s, r) => s + r.net_payable, 0) - consolidated.total_net;
      return { scenario_id: scenario.scenario_id, delta_gross: deltaGross, delta_net: deltaNet };
    });

  return {
    case_id: caseInput.case_id,
    parameter_snapshot: caseInput.parameter_snapshot,
    employee_results: employeeResults,
    consolidated,
    scenario_deltas: scenarioDeltas,
  };
}

export function validateBatchInput(caseInput: ComplexCaseInput): {
  can_draft: boolean;
  can_final: boolean;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!caseInput.case_id) blockers.push("MISSING_CASE_ID");
  if (caseInput.employees.length === 0) blockers.push("NO_EMPLOYEES");

  for (const emp of caseInput.employees) {
    const hasTable = emp.monthly_remuneration_24m.length > 0;
    const hasManual = emp.indemnity_rule.manual_average_monthly != null;
    if (!hasTable && !hasManual) {
      warnings.push(`${emp.employee_id}: no 24-month table; using base salary for Art. 17`);
    }
    if (!hasTable && !hasManual && caseInput.lawyer_review?.status !== "approved") {
      blockers.push(`${emp.employee_id}: FINAL_BLOCKED_NO_24M_TABLE`);
    }
  }

  return {
    can_draft: caseInput.employees.length > 0,
    can_final: blockers.filter((b) => b.includes("FINAL_BLOCKED")).length === 0,
    blockers,
    warnings,
  };
}
