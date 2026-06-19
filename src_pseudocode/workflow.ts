// Workflow pseudocode for implementation.

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

export function transition(state: WorkflowState, event: WorkflowEvent, ctx: WorkflowContext): WorkflowState {
  if (event === "BLOCK_CASE") return "BLOCKED";

  if (state === "DRAFT" && event === "SUBMIT_INTAKE") return "INTAKE_COMPLETE";
  if (state === "INTAKE_COMPLETE" && event === "CLASSIFY_LEGAL_ROUTE") return "LEGAL_CLASSIFICATION_PENDING";
  if (state === "LEGAL_CLASSIFICATION_PENDING" && event === "RUN_CALCULATION") {
    return ctx.hasHardBlockers ? "BLOCKED" : "LEGAL_CLASSIFIED";
  }
  if (state === "LEGAL_CLASSIFIED" && event === "UPLOAD_PAYROLL") return "PAYROLL_COMPLETE";
  if (state === "PAYROLL_COMPLETE" && event === "REQUEST_TAX_REVIEW") return "TAX_REVIEW_PENDING";
  if (state === "TAX_REVIEW_PENDING" && event === "APPROVE_TAX") return "TAX_REVIEWED";
  if (state === "TAX_REVIEWED" && event === "REQUEST_PARTNER_REVIEW") return "PARTNER_REVIEW_PENDING";
  if (state === "PARTNER_REVIEW_PENDING" && event === "APPROVE_PARTNER") {
    if (ctx.hasHardBlockers) return "BLOCKED";
    return "APPROVED_FOR_CLIENT";
  }
  if (state === "APPROVED_FOR_CLIENT" && event === "ISSUE_REPORT") return "CLIENT_REPORT_ISSUED";
  if (state === "CLIENT_REPORT_ISSUED" && event === "MARK_EXECUTED") return "EXECUTED";
  if (state === "EXECUTED" && event === "CLOSE_CASE") return "CLOSED";
  if (state === "BLOCKED" && event === "REMEDIATE_BLOCKER") return "LEGAL_CLASSIFICATION_PENDING";

  throw new Error(`Invalid transition: ${state} + ${event}`);
}

