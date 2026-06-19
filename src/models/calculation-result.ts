import type { Money, RiskItem, TraceLine } from "./common.js";

export type CalculationStatus =
  | "EXECUTABLE"
  | "EXECUTABLE_WITH_WARNINGS"
  | "NOT_EXECUTABLE_BLOCKED"
  | "LEGAL_REVIEW_REQUIRED";

export interface ScenarioAmounts {
  indemnity_base?: Money;
  ias_legal?: Money;
  notice_indemnity?: Money;
  obra_faena_indemnity?: Money;
  vacation_payment?: Money;
  taxable_gross?: Money;
  worker_contributions?: Money;
  iusc?: Money;
  non_taxable_total?: Money;
  reimbursements?: Money;
  authorized_deductions?: Money;
  net_payable?: Money;
  employer_contributions?: Money;
  total_client_cash_cost?: Money;
}

export interface Scenario {
  scenario_id: string;
  label: string;
  risk_level?: string;
  amounts: ScenarioAmounts;
  trace: TraceLine[];
}

export interface CalculationAudit {
  calculated_at?: string;
  calculated_by?: string;
  ruleset_hash?: string;
}

export interface CalculationResult {
  case_id: string;
  rule_version?: string;
  status: CalculationStatus;
  scenarios: Scenario[];
  blockers: RiskItem[];
  warnings: RiskItem[];
  audit: CalculationAudit;
}
