import type { Money } from "./common.js";

export type ReportStatus =
  | "DRAFT"
  | "INTERNAL_REVIEW"
  | "APPROVED_FOR_CLIENT"
  | "ISSUED_TO_CLIENT";

export interface ExecutiveSummary {
  client_name?: string;
  worker_name?: string;
  termination_cause?: string;
  recommended_action?: string;
  net_payable?: Money;
  total_client_cash_cost?: Money;
}

export interface ScenarioComparison {
  scenario_id?: string;
  net_payable?: Money;
  employer_cost?: Money;
  risk?: string;
  assumptions?: string[];
}

export interface ReportRiskFlag {
  severity?: string;
  message?: string;
  action?: string;
}

export interface EvidenceChecklistItem {
  document_type?: string;
  required?: boolean;
  received?: boolean;
  blocking_if_missing?: boolean;
}

export interface ReportLegalClassification {
  cause_code?: string;
  ordinary_private_engine?: boolean;
  route_to?: string;
  risk_level?: string;
  ias_applies?: boolean;
  notice_applies?: boolean;
  vacation_payable?: boolean;
}

export interface Report {
  case_id: string;
  report_status: ReportStatus;
  executive_summary: ExecutiveSummary;
  scenario_comparison: ScenarioComparison[];
  risk_flags: ReportRiskFlag[];
  evidence_checklist?: EvidenceChecklistItem[];
  legal_classification?: ReportLegalClassification;
  calculation_status?: string;
  rule_version?: string;
  disclaimer?: string;
}
