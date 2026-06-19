export type WorkflowState =
  | "DRAFT"
  | "INTAKE_COMPLETE"
  | "EVIDENCE_INTAKE_PENDING"
  | "EVIDENCE_INTAKE_COMPLETE"
  | "LEGAL_CLASSIFICATION_PENDING"
  | "LEGAL_CLASSIFIED"
  | "DISMISSAL_LETTER_REVIEW_PENDING"
  | "DISMISSAL_LETTER_APPROVED"
  | "PROOF_GAPS_BLOCKED"
  | "PAYROLL_PENDING"
  | "PAYROLL_COMPLETE"
  | "TAX_REVIEW_PENDING"
  | "TAX_REVIEWED"
  | "FINIQUITO_EXECUTION_REVIEW_PENDING"
  | "PARTNER_REVIEW_PENDING"
  | "TRIBUNAL_EXPORT_READY"
  | "APPROVED_FOR_CLIENT"
  | "CLIENT_REPORT_ISSUED"
  | "EXECUTION_PENDING"
  | "EXECUTED"
  | "CLOSED"
  | "BLOCKED";

export type WorkflowEvent =
  | "SUBMIT_INTAKE"
  | "CLASSIFY_LEGAL_ROUTE"
  | "UPLOAD_PAYROLL"
  | "RUN_CALCULATION"
  | "REQUEST_TAX_REVIEW"
  | "APPROVE_TAX"
  | "REQUEST_PARTNER_REVIEW"
  | "APPROVE_PARTNER"
  | "BLOCK_CASE"
  | "ISSUE_REPORT"
  | "MARK_EXECUTED"
  | "CLOSE_CASE"
  | "REMEDIATE_BLOCKER"
  | "ABANDON_CASE"
  | "APPROVE_DISMISSAL_LETTER"
  | "COMPLETE_EVIDENCE_INTAKE";

export type ApprovalRole =
  | "ASSOCIATE"
  | "TAX_ADVISOR"
  | "PARTNER"
  | "PUBLIC_LAW_PARTNER"
  | "LITIGATION_REVIEW";

export interface ApprovalRequirement {
  role: ApprovalRole;
  reason: string;
  blocking: boolean;
}

export interface WorkflowContext {
  hasHardBlockers: boolean;
  requiresPartnerReview: boolean;
  taxReviewed: boolean;
  partnerApproved: boolean;
}

export interface WorkflowPlan {
  current_state: WorkflowState;
  recommended_state: WorkflowState;
  required_approvals: ApprovalRequirement[];
  allowed_events: WorkflowEvent[];
  blocked_actions: string[];
  can_issue_report: boolean;
  can_execute: boolean;
}
