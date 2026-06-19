export type WorkflowState =
  | "DRAFT"
  | "INTAKE_COMPLETE"
  | "LEGAL_CLASSIFICATION_PENDING"
  | "LEGAL_CLASSIFIED"
  | "PAYROLL_PENDING"
  | "PAYROLL_COMPLETE"
  | "TAX_REVIEW_PENDING"
  | "TAX_REVIEWED"
  | "PARTNER_REVIEW_PENDING"
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
  | "REMEDIATE_BLOCKER";

export interface WorkflowContext {
  hasHardBlockers: boolean;
  requiresPartnerReview: boolean;
  taxReviewed: boolean;
  partnerApproved: boolean;
}
