import type { RiskItem } from "./common.js";
import type { ApprovalRequirement } from "./workflow.js";

export type EvidenceAdmissibility = "PENDING" | "ADMITTED" | "CHALLENGED" | "REJECTED";

export interface EvidenceItem {
  id: string;
  type: string;
  file_name: string;
  source?: string;
  date?: string;
  author?: string;
  received_from?: string;
  hash?: string;
  related_facts?: string[];
  admissibility_status?: EvidenceAdmissibility;
}

export interface DismissalLetter {
  cause_code: string;
  article?: string;
  facts: string;
  notice_date?: string;
  delivery_method?: string;
  dt_filing?: boolean;
  dt_filing_date?: string;
  amounts_stated?: number;
  cotizaciones_statement?: string;
}

export interface FiniquitoExecution {
  available_date?: string;
  payment_date?: string;
  signed?: boolean;
  ratified?: boolean;
  minister_of_faith?: boolean;
  reservation_text?: string;
  disputed_items?: string[];
}

export interface BurdenOfProofFact {
  fact_id: string;
  label: string;
  party_burden: string;
  required_evidence_types: string[];
  provided_evidence_refs: string[];
  minimum_score: number;
  blocking: boolean;
  sufficiency_score: number;
  sufficient: boolean;
  gap_reason?: string;
}

export interface EvidenceMatrix {
  cause_code: string;
  required_facts: BurdenOfProofFact[];
  proof_gaps: string[];
  overall_ready: boolean;
  critical_gap: boolean;
}

export interface DismissalLetterReview {
  sufficient: boolean;
  score: number;
  generic_risk: boolean;
  warnings: string[];
  missing_elements: string[];
}

export interface ProofScoreResult {
  facts: BurdenOfProofFact[];
  has_critical_gap: boolean;
  partner_review_required: boolean;
  tribunal_ready: boolean;
  average_score: number;
}

export interface Fix1Result {
  evidence_matrix: EvidenceMatrix;
  dismissal_letter_review?: DismissalLetterReview;
  proof_score: ProofScoreResult;
  finiquito_execution_ready: boolean;
  finiquito_warnings: string[];
  court_risk_flags: Array<{ code: string; message: string; source?: string }>;
  blocked: boolean;
  blocker_code?: string;
}

export interface LitigationCaseFile {
  case_id: string;
  legal_theory: string;
  evidence_manifest: EvidenceItem[];
  calculation_trace: Array<Record<string, unknown>>;
  workflow_approvals: ApprovalRequirement[];
  risk_flags: Array<RiskItem | { code: string; message: string; source?: string }>;
  proof_score: ProofScoreResult;
  export_timestamp: string;
  manifest_hash: string;
}

export interface EvidenceRequirementsRules {
  facts: Array<{
    fact_id: string;
    label: string;
    party_burden: string;
    minimum_score: number;
    blocking: boolean;
    evidence_types: string[];
  }>;
  causes: Record<string, { required_facts: string[] }>;
  default_required_facts: string[];
}

export interface BurdenOfProofRules {
  score_meanings: Record<string, string>;
  critical_block_threshold: number;
  partner_review_threshold: number;
  material_amount_clp: number;
}
