export type StageRoute = "STAGE1" | "STAGE2" | "STAGE3" | "BLOCKER";

export interface CaseTypeConfig {
  code: string;
  menu_group: string;
  label: string;
  description: string;
  cause_code: string;
  stage_route: StageRoute;
  example_file?: string;
  required_fields: string[];
  required_evidence: string[];
  enabled_modules: string[];
  blockers: string[];
}

export interface FieldDefinition {
  path: string;
  type: "string" | "text" | "date" | "boolean" | "money" | "number";
  label: string;
}

export interface CaseTypeRegistry {
  case_types: CaseTypeConfig[];
  field_catalog: Record<string, FieldDefinition>;
  section_fields: Record<string, string[]>;
  evidence_labels: Record<string, string>;
}

export interface InputSchemaSection {
  id: string;
  title: string;
  fields: Array<FieldDefinition & { key: string }>;
  required_documents?: Array<{ key: string; label: string }>;
}

export interface CaseTypeInputSchema {
  case_type: string;
  label: string;
  menu_group: string;
  stage_route: StageRoute;
  sections: InputSchemaSection[];
  run_modes: Array<"draft" | "final_review">;
  warnings: string[];
  enabled_modules: string[];
}

export interface CaseTypeValidationIssue {
  code: string;
  severity: "BLOCKER" | "WARNING" | "INFO";
  message: string;
  field?: string;
}

export interface CaseTypeValidationResult {
  case_type_code: string;
  valid: boolean;
  blockers: CaseTypeValidationIssue[];
  warnings: CaseTypeValidationIssue[];
  missing_fields: string[];
  missing_evidence: string[];
  can_draft_calculate: boolean;
  can_final_review: boolean;
  can_approved_report: boolean;
}

export interface CaseSession {
  id: string;
  case_type_code: string;
  created_at: string;
  updated_at: string;
  input: import("./case-input.js").CaseInput;
  partner_approved: boolean;
  run_mode?: "draft" | "final_review";
}

export interface CaseFields {
  specific_business_reason?: string;
  role_eliminated?: boolean;
  replacement_expected?: boolean;
  incident_date?: string;
  disciplinary_facts?: string;
  fuero_type?: string;
  unpaid_months?: number;
  delivery_method?: string;
  [key: string]: string | number | boolean | undefined;
}
