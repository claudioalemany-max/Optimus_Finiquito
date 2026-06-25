import type { Money } from "./common.js";
import type { IuscBracket } from "./ruleset.js";

export type ComplexRunMode = "single" | "batch" | "executive_complex";

export type DeductionType =
  | "mutuo"
  | "advance"
  | "employer_credit"
  | "court_order"
  | "other";

export type ComplexScenarioId =
  | "EMPLOYER_PREFERRED"
  | "CONSERVATIVE_TAX"
  | "EMPLOYEE_CHALLENGE"
  | "WORST_CREDIBLE";

export interface ParameterSnapshot {
  termination_date: string;
  uf_value: number;
  utm_value: number;
  ipc_reference_month: string;
  iusc_table_month: string;
  rule_version: string;
}

export interface VariableCompensationItem {
  type: string;
  amount: Money;
  include_in_art17_average: boolean;
  legal_review_required?: boolean;
}

export interface MonthlyRemunerationRow {
  month: string;
  payment_item: string;
  amount: Money;
  is_remuneration: boolean;
  include_in_art17: boolean;
  ipc_factor?: number;
  adjusted_amount?: Money;
}

export interface IndemnityRule {
  source: "statutory" | "contractual" | "custom";
  days_per_year: number;
  apply_statutory_cap: boolean;
  sale_change_of_control: boolean;
  uplift_percent: number;
  manual_average_monthly?: Money;
}

export interface ComplexDeduction {
  type: DeductionType;
  amount_uf: number;
  amount_clp: Money;
  conversion_date?: string;
  written_agreement: boolean;
  employee_authorization: boolean;
  balance_certificate: boolean;
  lawyer_approved: boolean;
  notes?: string;
}

export interface EmployeeCase {
  employee_id: string;
  name: string;
  rut: string;
  role?: string;
  start_date: string;
  termination_date: string;
  base_salary: Money;
  variable_compensation_items: VariableCompensationItem[];
  indemnity_rule: IndemnityRule;
  deductions: ComplexDeduction[];
  monthly_remuneration_24m: MonthlyRemunerationRow[];
  vacation_calendar_days?: number;
  pending_salary?: Money;
  reimbursements?: Money;
  years_of_service_for_tax?: number;
}

export interface ComplexScenarioDefinition {
  scenario_id: ComplexScenarioId;
  label: string;
  exclude_disputed_variable: boolean;
  employee_favorable_bonus: boolean;
  adverse_labor_assumptions: boolean;
}

export interface ComplexCaseInput {
  case_id: string;
  client: { name: string; rut: string };
  employer: { name: string; rut: string };
  termination_date: string;
  run_mode: ComplexRunMode;
  parameter_snapshot: ParameterSnapshot;
  employees: EmployeeCase[];
  scenarios: ComplexScenarioDefinition[];
  lawyer_review?: { status: "draft" | "approved"; notes: string[] };
}

export interface IpcTable {
  months: Record<string, number>;
}

export interface Art17Parameters {
  ipc_table: IpcTable;
  years_of_service_for_tax: number;
}

export interface Art17Result {
  monthly_table: MonthlyRemunerationRow[];
  adjusted_average: Money;
  non_taxable_limit: Money;
  gross_indemnity: Money;
  taxable_excess: Money;
}

export interface IuscReliquidationResult {
  taxable_excess: Money;
  monthly_excess: Money;
  base_monthly_tax: Money;
  monthly_tax_with_excess: Money;
  monthly_delta: Money;
  total_iusc: Money;
}

export interface DeductionValidationResult {
  status: "allowed" | "blocked" | "lawyer_override_required";
  missing_evidence: string[];
  deductible_amount: Money;
}

export interface EmployeeScenarioResult {
  employee_id: string;
  scenario_id: ComplexScenarioId;
  assumptions: string[];
  gross_indemnity: Money;
  art17: Art17Result;
  iusc_reliquidation: IuscReliquidationResult;
  deductions: DeductionValidationResult;
  reimbursements: Money;
  net_payable: Money;
  warnings: string[];
}

export interface BatchResult {
  case_id: string;
  parameter_snapshot: ParameterSnapshot;
  employee_results: EmployeeScenarioResult[];
  consolidated: {
    total_gross: Money;
    total_tax: Money;
    total_deductions: Money;
    total_net: Money;
  };
  scenario_deltas: Array<{
    scenario_id: ComplexScenarioId;
    delta_gross: Money;
    delta_net: Money;
  }>;
}

export interface ComplexCalculationParameters {
  ipc_table: IpcTable;
  iusc_brackets: IuscBracket[];
  utm_value: number;
}
