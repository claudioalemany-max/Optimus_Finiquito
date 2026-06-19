import type { CaseInput } from "../models/case-input.js";
import type { CalculationResult } from "../models/calculation-result.js";
import type { LegalClassification } from "../models/engine.js";
import type {
  ApprovalRequirement,
  WorkflowContext,
  WorkflowEvent,
  WorkflowPlan,
  WorkflowState,
} from "../models/workflow.js";

function uniqueApprovals(items: ApprovalRequirement[]): ApprovalRequirement[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.role}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveApprovalRequirements(
  input: CaseInput,
  classification: LegalClassification,
  calculation: CalculationResult,
): ApprovalRequirement[] {
  const approvals: ApprovalRequirement[] = [];
  const blocked = calculation.status === "NOT_EXECUTABLE_BLOCKED";

  if (blocked) {
    approvals.push({
      role: "PARTNER",
      reason: "Hard blocker detected; remediation or partner override required.",
      blocking: true,
    });
  }

  if (input.contract.legal_regime === "PUBLIC_STATUTORY" || input.contract.legal_regime === "MUNICIPAL") {
    approvals.push({
      role: "PUBLIC_LAW_PARTNER",
      reason: "Public-sector case requires public law partner review.",
      blocking: true,
    });
  }

  if (input.contract.legal_regime === "HONORARIOS" && classification.riskLevel !== "LOW") {
    approvals.push({
      role: "PARTNER",
      reason: "Honorarios recharacterization risk requires partner review.",
      blocking: true,
    });
    approvals.push({
      role: "LITIGATION_REVIEW",
      reason: "Honorarios high risk requires litigation review.",
      blocking: true,
    });
  }

  if (input.evidence?.fuero && !input.evidence?.desafuero_authorized) {
    approvals.push({
      role: "PARTNER",
      reason: "Fuero/protected status requires partner authorization path.",
      blocking: true,
    });
  }

  if (
    input.evidence?.medical_leave &&
    ["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"].includes(input.termination.cause_code)
  ) {
    approvals.push({
      role: "PARTNER",
      reason: "Medical leave conflicts with art. 161/desahucio route.",
      blocking: true,
    });
  }

  if (input.termination.cause_code === "DISCIPLINARIA_160") {
    approvals.push({
      role: "PARTNER",
      reason: "Art. 160 disciplinary dismissal requires partner approval.",
      blocking: false,
    });
  }

  if (["NECESIDADES_EMPRESA", "DESAHUCIO_CONFIANZA"].includes(input.termination.cause_code)) {
    approvals.push({
      role: "PARTNER",
      reason: "Art. 161 termination requires partner approval.",
      blocking: false,
    });
  }

  if (classification.partnerReviewRequired) {
    approvals.push({
      role: "PARTNER",
      reason: `Cause/regime risk level ${classification.riskLevel} requires partner review.`,
      blocking: calculation.status === "LEGAL_REVIEW_REQUIRED",
    });
  }

  if ((input.payroll.authorized_deductions ?? 0) > 0) {
    approvals.push({
      role: "TAX_ADVISOR",
      reason: "Authorized deductions require tax/payroll reviewer sign-off.",
      blocking: false,
    });
  }

  if (input.termination.afc_offset_attempted) {
    approvals.push({
      role: "PARTNER",
      reason: "Employer AFC offset requires explicit partner approval.",
      blocking: false,
    });
  }

  approvals.push({
    role: "ASSOCIATE",
    reason:
      calculation.status === "EXECUTABLE" && classification.riskLevel === "LOW"
        ? "Associate confirms legal route and intake completeness."
        : "Associate confirms legal classification route.",
    blocking: false,
  });

  approvals.push({
    role: "TAX_ADVISOR",
    reason: "Tax advisor approves remuneration classifications and IUSC treatment.",
    blocking: false,
  });

  return uniqueApprovals(approvals);
}

export function buildWorkflowContext(
  classification: LegalClassification,
  calculation: CalculationResult,
): WorkflowContext {
  return {
    hasHardBlockers: calculation.blockers.some(
      (b) => b.severity === "BLOCKER" || b.severity === "CRITICAL",
    ),
    requiresPartnerReview:
      Boolean(classification.partnerReviewRequired) ||
      calculation.status === "LEGAL_REVIEW_REQUIRED" ||
      classification.riskLevel === "HIGH" ||
      classification.riskLevel === "CRITICAL",
    taxReviewed: false,
    partnerApproved: false,
  };
}

export function recommendWorkflowState(
  calculation: CalculationResult,
  classification: LegalClassification,
): WorkflowState {
  if (calculation.status === "NOT_EXECUTABLE_BLOCKED") return "BLOCKED";
  if (calculation.status === "LEGAL_REVIEW_REQUIRED") return "PARTNER_REVIEW_PENDING";
  if (calculation.status === "EXECUTABLE_WITH_WARNINGS") return "TAX_REVIEW_PENDING";
  return "LEGAL_CLASSIFIED";
}

function allowedEventsForState(state: WorkflowState, ctx: WorkflowContext): WorkflowEvent[] {
  const events: WorkflowEvent[] = ["BLOCK_CASE"];

  switch (state) {
    case "DRAFT":
      events.push("SUBMIT_INTAKE");
      break;
    case "INTAKE_COMPLETE":
      events.push("CLASSIFY_LEGAL_ROUTE");
      break;
    case "LEGAL_CLASSIFICATION_PENDING":
      events.push("RUN_CALCULATION");
      break;
    case "LEGAL_CLASSIFIED":
      events.push("UPLOAD_PAYROLL", "REQUEST_TAX_REVIEW");
      break;
    case "PAYROLL_PENDING":
      events.push("UPLOAD_PAYROLL");
      break;
    case "PAYROLL_COMPLETE":
      events.push("REQUEST_TAX_REVIEW");
      break;
    case "TAX_REVIEW_PENDING":
      events.push("APPROVE_TAX");
      break;
    case "TAX_REVIEWED":
      events.push("REQUEST_PARTNER_REVIEW");
      break;
    case "PARTNER_REVIEW_PENDING":
      if (!ctx.hasHardBlockers) events.push("APPROVE_PARTNER");
      break;
    case "APPROVED_FOR_CLIENT":
      if (!ctx.hasHardBlockers) events.push("ISSUE_REPORT");
      break;
    case "CLIENT_REPORT_ISSUED":
      if (!ctx.hasHardBlockers) events.push("MARK_EXECUTED");
      break;
    case "EXECUTION_PENDING":
      if (!ctx.hasHardBlockers) events.push("MARK_EXECUTED");
      break;
    case "EXECUTED":
      events.push("CLOSE_CASE");
      break;
    case "BLOCKED":
      events.push("REMEDIATE_BLOCKER", "ABANDON_CASE");
      break;
    default:
      break;
  }

  return events;
}

function blockedActions(state: WorkflowState, ctx: WorkflowContext, calculation: CalculationResult): string[] {
  const blocked: string[] = [];

  if (ctx.hasHardBlockers) {
    blocked.push("APPROVED_FOR_CLIENT", "EXECUTION_PENDING", "ISSUE_REPORT", "MARK_EXECUTED");
  }

  if (calculation.status === "NOT_EXECUTABLE_BLOCKED") {
    blocked.push("Client report issuance", "Finiquito execution");
  }

  if (state === "PARTNER_REVIEW_PENDING" && ctx.requiresPartnerReview && !ctx.partnerApproved) {
    blocked.push("ISSUE_REPORT");
  }

  return [...new Set(blocked)];
}

export function buildWorkflowPlan(
  input: CaseInput,
  classification: LegalClassification,
  calculation: CalculationResult,
  currentState: WorkflowState = "LEGAL_CLASSIFICATION_PENDING",
): WorkflowPlan {
  const ctx = buildWorkflowContext(classification, calculation);
  const recommended = recommendWorkflowState(calculation, classification);
  const required_approvals = resolveApprovalRequirements(input, classification, calculation);

  const can_issue_report =
    !ctx.hasHardBlockers && calculation.status !== "NOT_EXECUTABLE_BLOCKED" && recommended !== "BLOCKED";

  const can_execute =
    can_issue_report &&
    (recommended === "APPROVED_FOR_CLIENT" ||
      recommended === "CLIENT_REPORT_ISSUED" ||
      recommended === "EXECUTION_PENDING" ||
      recommended === "EXECUTED");

  return {
    current_state: currentState,
    recommended_state: recommended,
    required_approvals,
    allowed_events: allowedEventsForState(recommended, ctx),
    blocked_actions: blockedActions(recommended, ctx, calculation),
    can_issue_report,
    can_execute,
  };
}

export function transition(state: WorkflowState, event: WorkflowEvent, ctx: WorkflowContext): WorkflowState {
  if (event === "BLOCK_CASE") return "BLOCKED";
  if (event === "ABANDON_CASE") return "CLOSED";

  if (state === "DRAFT" && event === "SUBMIT_INTAKE") return "INTAKE_COMPLETE";
  if (state === "INTAKE_COMPLETE" && event === "CLASSIFY_LEGAL_ROUTE") return "LEGAL_CLASSIFICATION_PENDING";
  if (state === "LEGAL_CLASSIFICATION_PENDING" && event === "RUN_CALCULATION") {
    return ctx.hasHardBlockers ? "BLOCKED" : "LEGAL_CLASSIFIED";
  }
  if (state === "LEGAL_CLASSIFIED" && event === "UPLOAD_PAYROLL") return "PAYROLL_COMPLETE";
  if (state === "PAYROLL_PENDING" && event === "UPLOAD_PAYROLL") return "PAYROLL_COMPLETE";
  if (state === "PAYROLL_COMPLETE" && event === "REQUEST_TAX_REVIEW") return "TAX_REVIEW_PENDING";
  if (state === "TAX_REVIEW_PENDING" && event === "APPROVE_TAX") return "TAX_REVIEWED";
  if (state === "TAX_REVIEWED" && event === "REQUEST_PARTNER_REVIEW") return "PARTNER_REVIEW_PENDING";
  if (state === "PARTNER_REVIEW_PENDING" && event === "APPROVE_PARTNER") {
    if (ctx.hasHardBlockers) return "BLOCKED";
    return "APPROVED_FOR_CLIENT";
  }
  if (state === "APPROVED_FOR_CLIENT" && event === "ISSUE_REPORT") return "CLIENT_REPORT_ISSUED";
  if (state === "CLIENT_REPORT_ISSUED" && event === "MARK_EXECUTED") return "EXECUTION_PENDING";
  if (state === "EXECUTION_PENDING" && event === "MARK_EXECUTED") return "EXECUTED";
  if (state === "EXECUTED" && event === "CLOSE_CASE") return "CLOSED";
  if (state === "BLOCKED" && event === "REMEDIATE_BLOCKER") return "LEGAL_CLASSIFICATION_PENDING";

  throw new Error(`Invalid transition: ${state} + ${event}`);
}

export function simulateWorkflowPath(
  input: CaseInput,
  classification: LegalClassification,
  calculation: CalculationResult,
): WorkflowState[] {
  const ctx = buildWorkflowContext(classification, calculation);
  const path: WorkflowState[] = ["DRAFT"];

  const steps: WorkflowEvent[] = ["SUBMIT_INTAKE", "CLASSIFY_LEGAL_ROUTE", "RUN_CALCULATION"];
  let state: WorkflowState = "DRAFT";

  for (const event of steps) {
    state = transition(state, event, ctx);
    path.push(state);
    if (state === "BLOCKED") return path;
  }

  return path;
}
