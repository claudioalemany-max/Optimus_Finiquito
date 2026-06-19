import type { WorkflowContext, WorkflowEvent, WorkflowState } from "../models/workflow.js";

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
