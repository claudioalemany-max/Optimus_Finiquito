import type { Money } from "./common.js";
import type { DismissalLetter, EvidenceItem, FiniquitoExecution } from "./fix1.js";
import type { CaseFields } from "./case-type.js";

export type LegalRegime =
  | "PRIVATE_CODIGO_TRABAJO"
  | "PUBLIC_COMPANY_CODIGO_TRABAJO"
  | "PUBLIC_STATUTORY"
  | "MUNICIPAL"
  | "HONORARIOS"
  | "SPECIAL";

export type ContractType =
  | "INDEFINITE"
  | "FIXED_TERM"
  | "WORK_SERVICE"
  | "DOMESTIC_WORKER"
  | "HONORARIOS"
  | "PUBLIC_CONTRATA"
  | "PUBLIC_PLANTA";

export interface Client {
  name: string;
  rut: string;
  industry?: string;
}

export interface Worker {
  name: string;
  rut: string;
  role?: string;
}

export interface Contract {
  legal_regime: LegalRegime;
  contract_type: ContractType;
  start_date: string;
  end_date: string;
  collective_agreement?: boolean;
  high_trust_role?: boolean;
}

export interface Termination {
  cause_code: string;
  notice_given_30_days: boolean;
  resignation_voluntary_evidence?: boolean;
  afc_offset_attempted?: boolean;
}

export interface Payroll {
  fixed_salary: Money;
  avg_variable_3m: Money;
  included_allowances: Money;
  pending_salary: Money;
  taxable_bonus: Money;
  vacation_calendar_days: number;
  non_taxable_bonus_or_indemnity?: Money;
  reimbursements?: Money;
  authorized_deductions?: Money;
  vacation_business_days?: number;
  obra_faena_months?: number;
  obra_faena_fraction_gt_15?: boolean;
  /** Used by engine; not yet in JSON schema. */
  conventional_indemnity_taxable?: Money;
}

export interface Evidence {
  fuero?: boolean;
  fuero_type?: string;
  medical_leave?: boolean;
  cotizaciones_paid?: boolean;
  business_need_evidence?: boolean;
  disciplinary_evidence?: boolean;
  bonus_policy_uploaded?: boolean;
  reimbursement_receipts_uploaded?: boolean;
  deduction_authorization_uploaded?: boolean;
  /** Referenced by validation rules and engine pseudocode. */
  desafuero_authorized?: boolean;
}

export interface ConfigRates {
  afp_worker?: number;
  health_worker?: number;
  afc_worker_indefinite?: number;
  afc_employer_indefinite?: number;
  afc_employer_fixed_or_work?: number;
  sis_employer?: number;
  mutual_employer?: number;
  employer_pension?: number;
}

export interface Config {
  uf_value: number;
  rates: ConfigRates;
}

/** Honorarios recharacterization scoring factors (honorarios example). */
export interface RiskFactors {
  fixed_schedule?: boolean;
  direct_supervision?: boolean;
  monthly_fixed_payment?: boolean;
  uses_employer_tools?: boolean;
  permanent_functions?: boolean;
  [key: string]: boolean | undefined;
}

/** Public-sector module inputs (public_sector example). */
export interface PublicSectorFactors {
  years_continuous_service?: number;
  act_of_non_renewal_exists?: boolean;
  motivation_documented?: boolean;
  confianza_legitima_risk?: boolean;
}

export interface CaseInput {
  case_id: string;
  case_type_code?: string;
  rule_version?: string;
  client: Client;
  worker: Worker;
  contract: Contract;
  termination: Termination;
  payroll: Payroll;
  evidence: Evidence;
  config: Config;
  risk_factors?: RiskFactors;
  public_sector_factors?: PublicSectorFactors;
  evidence_items?: EvidenceItem[];
  dismissal_letter?: DismissalLetter;
  finiquito_execution?: FiniquitoExecution;
  case_fields?: CaseFields;
}
